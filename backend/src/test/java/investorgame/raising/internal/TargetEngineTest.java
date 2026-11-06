package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** 올해의 라이벌(decisions.md 275번)과 랜드마크 타워 엔딩(276번). 실제 콘텐츠와 application.yml 수치로 돌린다. */
class TargetEngineTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final CompanyEngine ENGINE =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);

  private static CompanyState company(long seed, long capital) {
    CompanyState c = new CompanyState();
    c.number = 1;
    c.year = 1;
    c.capital = capital;
    c.era = "plain";
    ENGINE.startYear(c, new HashSeededRandom(seed));
    return c;
  }

  private static Map<String, Optional<TargetEngine.Candidate>> none() {
    return Map.of("EASY", Optional.empty(), "MEDIUM", Optional.empty(), "HARD", Optional.empty());
  }

  @Test
  void 연초에_쉬움_보통_어려움_후보가_오고_실제_회사가_없으면_지어낸_회사로_채운다() {
    CompanyState c = company(1, 100_000_000L);
    assertThat(ENGINE.targets.needsOptions(c)).isTrue();
    var bands = ENGINE.targets.bands(c);
    assertThat(bands.get("EASY").low()).isEqualTo(100_000_000L);
    assertThat(bands.get("HARD").high()).isEqualTo(200_000_000L);

    ENGINE.targets.offer(
        c,
        Map.of(
            "EASY",
            Optional.of(
                new TargetEngine.Candidate("4f1c2d3e-0000-4000-8000-000000000001", 108_000_000L)),
            "MEDIUM",
            Optional.empty(),
            "HARD",
            Optional.empty()),
        new HashSeededRandom(1));
    assertThat(c.targetOptions)
        .extracting(t -> t.difficulty)
        .containsExactly("EASY", "MEDIUM", "HARD");
    assertThat(c.targetOptions.get(0).companyId).isNotNull();
    assertThat(c.targetOptions.get(0).capital).isEqualTo(108_000_000L);
    // 띠에 실제 회사가 없으면 우리 자본의 fictional-percent로 지어낸다.
    assertThat(c.targetOptions.get(1).companyId).isNull();
    assertThat(c.targetOptions.get(1).capital).isEqualTo(125_000_000L);
    assertThat(c.targetOptions.get(2).capital).isEqualTo(160_000_000L);
    assertThat(c.targetOptions).extracting(t -> t.name).doesNotHaveDuplicates();
    assertThat(ENGINE.targets.needsOptions(c)).as("같은 해에 두 번 뽑지 않는다").isFalse();
  }

  @Test
  void 실제_회사의_이름은_회사_ID로_늘_같다() {
    var a = company(1, 100_000_000L);
    var b = company(2, 100_000_000L);
    var id = Optional.of(new TargetEngine.Candidate("same-company-id", 110_000_000L));
    Map<String, Optional<TargetEngine.Candidate>> found =
        Map.of("EASY", id, "MEDIUM", Optional.empty(), "HARD", Optional.empty());
    ENGINE.targets.offer(a, found, new HashSeededRandom(1));
    ENGINE.targets.offer(b, found, new HashSeededRandom(2));
    assertThat(a.targetOptions.getFirst().name).isEqualTo(b.targetOptions.getFirst().name);
  }

  @Test
  void 연초에만_하나를_고르고_1분기를_넘기면_후보가_사라진다() {
    CompanyState c = company(1, 100_000_000L);
    ENGINE.targets.offer(c, none(), new HashSeededRandom(1));
    assertThatThrownBy(() -> ENGINE.targets.pick(c, "IMPOSSIBLE"))
        .isInstanceOf(InvalidRequestException.class);
    ENGINE.targets.pick(c, "MEDIUM");
    assertThat(c.target.difficulty).isEqualTo("MEDIUM");
    assertThat(c.targetOptions).isEmpty();
    assertThatThrownBy(() -> ENGINE.targets.pick(c, "EASY"))
        .isInstanceOf(InvalidRequestException.class);

    CompanyState late = company(2, 100_000_000L);
    ENGINE.targets.offer(late, none(), new HashSeededRandom(2));
    ENGINE.settleQuarter(late, new HashSeededRandom(2));
    assertThat(late.targetOptions).as("고르지 않고 1분기를 넘기면 올해는 라이벌이 없다").isEmpty();
    assertThatThrownBy(() -> ENGINE.targets.pick(late, "EASY"))
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 연말에_한_번_견줘_이기면_자본이_늘고_지면_그대로다() {
    // 실제 회사: 결산 직전에 읽은 자본과 견준다.
    CompanyState win = company(1, 100_000_000L);
    ENGINE.targets.offer(
        win,
        Map.of(
            "EASY",
            Optional.of(new TargetEngine.Candidate("a", 101_000_000L)),
            "MEDIUM",
            Optional.empty(),
            "HARD",
            Optional.empty()),
        new HashSeededRandom(1));
    ENGINE.targets.pick(win, "EASY");
    // 그 회사가 쉬어서 자본이 그대로였다.
    win.target.capitalNow = 50_000_000L;
    var s = ENGINE.settle(win, new HashSeededRandom(1));
    assertThat(s.target.won).isTrue();
    assertThat(s.target.theirCapital).isEqualTo(50_000_000L);
    assertThat(s.target.bonus).isEqualTo((s.target.ourCapital - s.target.bonus) * 200 / 10_000);
    assertThat(s.capitalAfter).isEqualTo(s.target.ourCapital);
    assertThat(s.lines).anyMatch(l -> l.contains("이겼다"));
    assertThat(win.timeline).anyMatch(e -> "target".equals(e.kind));
    assertThat(win.target).as("견준 뒤 비운다").isNull();
    assertThat(win.targetOptions).as("다음 해 후보는 서비스가 다시 뽑는다").isEmpty();

    CompanyState lose = company(1, 100_000_000L);
    ENGINE.targets.offer(lose, none(), new HashSeededRandom(1));
    ENGINE.targets.pick(lose, "HARD");
    var l = ENGINE.settle(lose, new HashSeededRandom(1));
    assertThat(l.target.won).isFalse();
    assertThat(l.target.bonus).isZero();
    assertThat(l.target.real).isFalse();
    assertThat(l.lines).anyMatch(x -> x.contains("졌다"));
  }

  @Test
  void 랜드마크_타워에_오르면_엔딩이고_회사가_멈추며_다음_회사를_차릴_수_있다() {
    CompanyState c = company(1, 50_000_000_000_000L);
    var almost = ENGINE.settle(c, new HashSeededRandom(1));
    assertThat(almost.finished).isFalse();
    c.capital = 100_000_000_000_000L;
    var s = ENGINE.settle(c, new HashSeededRandom(1));
    assertThat(s.gradeAfter).isEqualTo("Z");
    assertThat(s.finished).isTrue();
    assertThat(c.finished).isTrue();
    assertThat(c.finishedYear).isEqualTo(2);
    assertThat(s.lines).anyMatch(l -> l.contains("랜드마크 타워에 올랐다"));
    assertThat(c.timeline).anyMatch(e -> "ending".equals(e.kind));
    assertThatThrownBy(() -> ENGINE.settleQuarter(c, new HashSeededRandom(1)))
        .isInstanceOf(InvalidRequestException.class);
    assertThat(ENGINE.targets.needsOptions(c)).isFalse();
    assertThat(ENGINE.canRestart(c)).isTrue();
    CompanyState next = ENGINE.restart(c, new HashSeededRandom(2), 100_000_000L);
    assertThat(next.number).isEqualTo(2);
    assertThat(next.capital).isEqualTo(100_000_000L);
    assertThat(next.finished).isFalse();
  }
}
