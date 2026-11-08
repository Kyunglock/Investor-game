package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 종목 발굴 (decisions.md 267·382번): 분기 넘기기를 누르면 직원이 종목을 물어 온다. 실제 콘텐츠와 application.yml 수치로 돌린다. */
class ScoutEngineTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final CompanyEngine ENGINE =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);

  private static Map<String, Integer> stats(int insight) {
    return Map.of("insight", insight, "patience", 60, "courage", 60, "conviction", 60, "luck", 50);
  }

  /** 2호 회사로 연다: 첫 회사의 첫해에는 꼭 누가 종목을 물어 온다(267번). */
  private static CompanyState second(long seed) {
    CompanyState company = new CompanyState();
    company.number = 2;
    company.capital = 100_000_000L;
    company.era = "plain";
    ENGINE.startYear(company, new HashSeededRandom(seed));
    return company;
  }

  @Test
  void 분기_넘기기를_누르기_전에는_아무도_물어_오지_않고_그대로_넘기면_종목_회의가_없다() {
    CompanyState c = second(3);
    ENGINE.hire(c, stats(60));
    ENGINE.place(c, Map.of(1, "bio"));
    assertThat(ENGINE.invest.open(c)).as("물어 오기 전에는 종목 회의가 없다").isFalse();
    assertThatThrownBy(() -> ENGINE.invest.decide(c, InvestEngine.BUY, new HashSeededRandom(3)))
        .isInstanceOf(InvalidRequestException.class);
    CompanyState.Quarter q = ENGINE.settleQuarter(c, new HashSeededRandom(3));
    assertThat(q.investTitle).isNull();
  }

  @Test
  void 한_분기에_한_번만_굴려_배치를_바꿔_다시_눌러도_그대로다() {
    for (int seed = 0; seed < 50; seed++) {
      CompanyState c = second(seed);
      ENGINE.hire(c, stats(60));
      ENGINE.hire(c, stats(100));
      ENGINE.place(c, Map.of(1, "day"));
      ENGINE.scout.discover(c, new HashSeededRandom(seed));
      assertThat(c.invest.found).as("단타 데스크는 섹터가 없어 물어 오지 않는다").isFalse();
      assertThat(c.invest.scouted).isTrue();
      ENGINE.place(c, Map.of(1, "day", 2, "scout"));
      ENGINE.scout.discover(c, new HashSeededRandom(seed));
      assertThat(c.invest.found).as("이번 분기에는 이미 굴렸다").isFalse();
    }
  }

  @Test
  void 돈을_굴리는_사람이_없으면_아무도_물어_오지_않고_다음_분기에_다시_굴린다() {
    CompanyState c = second(1);
    ENGINE.scout.discover(c, new HashSeededRandom(1));
    assertThat(c.invest.scouted).isTrue();
    assertThat(c.invest.found).isFalse();
    ENGINE.settleQuarter(c, new HashSeededRandom(1));
    assertThat(c.invest.scouted).as("분기를 넘기면 새로 굴린다").isFalse();
  }

  @Test
  void 종목_발굴팀_직원이_종목을_물어_오고_직함으로_불린다() {
    int found = 0;
    int trials = 200;
    for (int seed = 0; seed < trials; seed++) {
      CompanyState c = second(seed);
      ENGINE.hire(c, stats(90));
      ENGINE.hire(c, stats(90));
      ENGINE.place(c, Map.of(1, "bio", 2, "scout"));
      ENGINE.scout.discover(c, new HashSeededRandom(seed));
      if (Boolean.TRUE.equals(c.invest.found)) {
        found++;
        assertThat(ENGINE.invest.open(c)).isTrue();
        if (c.invest.finderId == 2) {
          assertThat(c.invest.finderRole)
              .as("혼자 앉으면 팀장: 분기 실적과 같은 호칭 (#346)")
              .isEqualTo("종목 발굴팀 팀장");
          assertThat(c.invest.pitch).doesNotContain("{").contains(ENGINE.stockName(c.invest.stock));
          assertThat(c.invest.clarity).as("안목 90이면 또렷한 기사").isEqualTo("clear");
        }
      }
    }
    // 안목 90 발굴 담당: 40% + 45% = 85%. 놓쳐도 섹터 데스크(바이오)가 15%로 가져온다.
    assertThat(found / (double) trials).isBetween(0.8, 0.95);
  }

  @Test
  void 발굴_담당이_없으면_종목_회의가_드물다() {
    int found = 0;
    int trials = 400;
    for (int seed = 0; seed < trials; seed++) {
      CompanyState c = second(seed);
      ENGINE.hire(c, stats(60));
      ENGINE.place(c, Map.of(1, "day"));
      ENGINE.scout.discover(c, new HashSeededRandom(seed));
      found += Boolean.TRUE.equals(c.invest.found) ? 1 : 0;
    }
    assertThat(found).as("단타 데스크는 섹터가 없어 물어 오지 않는다").isZero();
  }

  @Test
  void 첫_회사의_첫_분기에는_돈을_굴리는_직원이_꼭_하나_물어_온다() {
    for (int seed = 0; seed < 50; seed++) {
      CompanyState c = ENGINE.open(new HashSeededRandom(seed), 100_000_000L);
      ENGINE.hire(c, stats(50));
      ENGINE.place(c, Map.of(1, "day"));
      ENGINE.scout.discover(c, new HashSeededRandom(seed));
      assertThat(c.invest.found).isTrue();
      assertThat(c.invest.finderName).isEqualTo(c.employees.getFirst().name);
    }
  }

  @Test
  void 안목이_높은_사람이_가져온_종목이_더_자주_오른다() {
    int sharp = 0;
    int dull = 0;
    int trials = 600;
    for (int seed = 0; seed < trials; seed++) {
      CompanyState high = second(seed);
      CompanyState.Employee a = ENGINE.hire(high, stats(100));
      a.desk = "scout";
      sharp += ENGINE.invest.found(high, a, null, new HashSeededRandom(seed)).up ? 1 : 0;
      CompanyState low = second(seed);
      CompanyState.Employee b = ENGINE.hire(low, stats(5));
      b.desk = "scout";
      CompanyState.Invest rumor = ENGINE.invest.found(low, b, null, new HashSeededRandom(seed));
      dull += rumor.up ? 1 : 0;
      assertThat(rumor.clarity).as("소문은 흐리다").isEqualTo("foggy");
    }
    assertThat(sharp - dull).isGreaterThan(trials / 5);
  }
}
