package investorgame.progress.internal;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.content.JobDefinition;
import org.junit.jupiter.api.Test;

/** 재취업의 경력 인정 (decisions.md 116번): 인정 연차만큼의 연차 인상을 인상분으로 바꾼다. */
class RehireBonusTest {

  @Test
  void 인정_연차의_연차_인상이_인상분이_된다() {
    JobDefinition job = new JobDefinition("office", "사무직", 10, 4_200_000, 4, true, true, null);
    assertThat(DefaultProgressService.rehireBonusBp(job, 0)).isZero();
    // 1.04^15 ≈ 1.80 → 약 +80%
    int bonus = DefaultProgressService.rehireBonusBp(job, 15);
    assertThat(bonus).isBetween(7_900, 8_100);
    assertThat(4_200_000L * (10_000 + bonus) / 10_000).isGreaterThan(7_500_000L);
  }
}
