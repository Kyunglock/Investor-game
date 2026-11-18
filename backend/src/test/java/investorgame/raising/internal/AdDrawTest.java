package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.common.error.InvalidRequestException;
import org.junit.jupiter.api.Test;

class AdDrawTest {
  @Test
  void 종류별로_세번이고_날짜가_바뀌면_각각_초기화된다() {
    RaisingMemory memory = new RaisingMemory();
    for (int i = 0; i < 3; i++) memory.useAdDraw(true, "2026-11-18");
    assertThat(memory.adDrawLeft(true, "2026-11-18")).isZero();
    assertThat(memory.adDrawLeft(false, "2026-11-18")).isEqualTo(3);
    assertThatThrownBy(() -> memory.useAdDraw(true, "2026-11-18"))
        .isInstanceOf(InvalidRequestException.class);
    memory.useAdDraw(false, "2026-11-18");
    assertThat(memory.adDrawLeft(false, "2026-11-18")).isEqualTo(2);
    assertThat(memory.adDrawLeft(true, "2026-11-19")).isEqualTo(3);
    assertThat(memory.adDrawLeft(false, "2026-11-19")).isEqualTo(3);
    memory.useAdDraw(false, "2026-11-19");
    assertThat(memory.adDrawLeft(true, "2026-11-19")).isEqualTo(3);
    assertThat(memory.adDrawLeft(false, "2026-11-19")).isEqualTo(2);
  }
}
