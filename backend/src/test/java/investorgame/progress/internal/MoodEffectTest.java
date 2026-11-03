package investorgame.progress.internal;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.common.Stats;
import org.junit.jupiter.api.Test;

/** #230 (decisions.md 165번): 행복도가 판단과 직장 판정에 주는 영향. */
class MoodEffectTest {

  private static final Stats STATS = new Stats(50, 40, 60, 5, 30);

  @Test
  void 마음이_가라앉으면_인내와_줏대가_10_빠지고_0_아래로는_안_간다() {
    Stats low = MoodEffect.steadied(STATS, 29);
    assertThat(low.patience()).isEqualTo(30);
    assertThat(low.conviction()).isZero();
    assertThat(low.insight()).isEqualTo(50);
    assertThat(low.courage()).isEqualTo(60);
    assertThat(low.luck()).isEqualTo(30);
  }

  @Test
  void 마음이_편하면_인내와_줏대가_5_오르고_보통이면_그대로다() {
    Stats high = MoodEffect.steadied(STATS, 70);
    assertThat(high.patience()).isEqualTo(45);
    assertThat(high.conviction()).isEqualTo(10);
    assertThat(MoodEffect.steadied(STATS, 30)).isEqualTo(STATS);
    assertThat(MoodEffect.steadied(STATS, 69)).isEqualTo(STATS);
  }

  @Test
  void 직장_판정_보정은_행복도_50에서_멀어질수록_크고_5퍼센트가_끝이다() {
    assertThat(MoodEffect.careerBonusBp(50)).isZero();
    assertThat(MoodEffect.careerBonusBp(70)).isEqualTo(200);
    assertThat(MoodEffect.careerBonusBp(20)).isEqualTo(-300);
    assertThat(MoodEffect.careerBonusBp(100)).isEqualTo(500);
    assertThat(MoodEffect.careerBonusBp(0)).isEqualTo(-500);
  }
}
