package investorgame.progress.internal;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.content.JobDefinition;
import org.junit.jupiter.api.Test;

/** 재취업의 경력 인정 (decisions.md 116번): 인정 연차만큼의 연차 인상을 인상분으로 바꾼다. 곡선이 꺾이는 것(133번)도 따른다. */
class RehireBonusTest {

  private static final ProgressProperties.Salary RULES =
      new ProgressProperties.Salary(10, 10, 55, 3, 10_000);

  @Test
  void 인정_연차의_연차_인상이_인상분이_된다() {
    JobDefinition job = new JobDefinition("office", "사무직", 10, 2_800_000, 2, true, true, null);
    assertThat(DefaultProgressService.rehireBonusBp(job, 0, RULES)).isZero();
    // 1.02^10 × 1.01^5 ≈ 1.281 → 약 +28%
    int bonus = DefaultProgressService.rehireBonusBp(job, 15, RULES);
    assertThat(bonus).isBetween(2_750, 2_850);
    // 20년을 넘는 연차는 더 오르지 않는다.
    assertThat(DefaultProgressService.rehireBonusBp(job, 30, RULES))
        .isEqualTo(DefaultProgressService.rehireBonusBp(job, 20, RULES));
  }
}
