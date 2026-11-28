package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import investorgame.raising.CompanyView;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** 업적 (decisions.md 708번). */
class AchievementsTest {
  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);

  private final CompanyEngine engine =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);
  private final IdleEngineTest.MutableClock clock = new IdleEngineTest.MutableClock();
  private final IdleEngine idle = new IdleEngine(clock, engine);

  private CompanyState opened() {
    clock.now = Instant.parse("2026-11-15T03:00:00Z").toEpochMilli();
    CompanyState c = engine.open(new HashSeededRandom(3), engine.openingCapital());
    idle.view(c);
    c.diamonds = 0;
    return c;
  }

  private static CompanyView.AchievementGoal goal(CompanyState c, String code) {
    return Achievements.view(c).list().stream()
        .filter(g -> g.code().equals(code))
        .findFirst()
        .orElseThrow();
  }

  @Test
  void 목표에_닿으면_그_단계의_다이아를_받고_다음_단계로_간다() {
    CompanyState c = opened();
    assertThat(Achievements.view(c).ready()).isZero();
    assertThat(goal(c, "wall").title()).isEqualTo("매도벽 최고 기록 10 돌파");
    assertThat(goal(c, "wall").diamonds()).isEqualTo(10);
    assertThatThrownBy(() -> Achievements.claim(c, "wall"))
        .isInstanceOf(InvalidRequestException.class);
    // 최고 기록 60: 10과 50 두 단계에 닿았다. 한 번에 둘 다 받는다(10 + 20).
    c.idle.best = 60;
    assertThat(goal(c, "wall").ready()).isTrue();
    assertThat(Achievements.view(c).ready()).isEqualTo(1);
    assertThat(Achievements.claim(c, "wall")).isEqualTo(30);
    assertThat(c.diamonds).isEqualTo(30);
    assertThat(goal(c, "wall").tier()).isEqualTo(2);
    assertThat(goal(c, "wall").title()).isEqualTo("매도벽 최고 기록 100 돌파");
    assertThat(goal(c, "wall").count()).isEqualTo(60);
    assertThat(goal(c, "wall").ready()).isFalse();
    assertThat(Achievements.view(c).lastDiamonds()).isEqualTo(30);
    // 없는 업적은 400.
    assertThatThrownBy(() -> Achievements.claim(c, "nope"))
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 누적_기록은_시즌패스_미션과_같은_때에_쌓이고_모두_받기는_받을_것을_다_받는다() {
    CompanyState c = opened();
    engine.pass.progress(c, "draw", 12, idle.todayDate());
    engine.pass.progress(c, "upgrade", 60, idle.todayDate());
    assertThat(goal(c, "draw").count()).isEqualTo(10);
    assertThat(goal(c, "draw").ready()).isTrue();
    assertThat(goal(c, "upgrade").ready()).isTrue();
    c.rebirths = 1;
    assertThat(Achievements.view(c).ready()).isEqualTo(3);
    assertThat(Achievements.claim(c, null)).isEqualTo(10 + 10 + 20);
    assertThat(Achievements.view(c).ready()).isZero();
    assertThatThrownBy(() -> Achievements.claim(c, null))
        .isInstanceOf(InvalidRequestException.class);
    // 다 깬 업적은 마지막 목표로 보이고 done이다.
    c.rebirths = 100;
    Achievements.claim(c, "rebirth");
    assertThat(goal(c, "rebirth").done()).isTrue();
    assertThat(goal(c, "rebirth").target()).isEqualTo(50);
    assertThat(goal(c, "rebirth").ready()).isFalse();
  }

  @Test
  void 보스와_고양이와_출석은_저장의_기록으로_센다() {
    CompanyState c = opened();
    c.idle.bossCleared = 250;
    c.idle.cats.put("sky", 1);
    c.idle.cats.put("mint", 3);
    c.idle.cats.put("lilac", 1);
    c.attendCount = 7;
    assertThat(goal(c, "boss").count()).isEqualTo(1);
    assertThat(Achievements.claim(c, "boss")).isEqualTo(10 + 20);
    assertThat(goal(c, "cats").ready()).isTrue();
    assertThat(Achievements.claim(c, "attend")).isEqualTo(10 + 20);
  }
}
