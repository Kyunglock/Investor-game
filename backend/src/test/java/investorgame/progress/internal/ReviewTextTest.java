package investorgame.progress.internal;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.common.Action;
import investorgame.common.Direction;
import investorgame.common.Hint;
import org.junit.jupiter.api.Test;

/** 안목 한마디의 기준 (decisions.md 108번): 내가 누른 선택과 실제 방향, 힌트는 따로. */
class ReviewTextTest {

  @Test
  void goodIsJudgedByChosenAction() {
    assertThat(DefaultProgressService.reviewGood(Action.BUY, Direction.UP, false)).isTrue();
    assertThat(DefaultProgressService.reviewGood(Action.BUY, Direction.DOWN, false)).isFalse();
    assertThat(DefaultProgressService.reviewGood(Action.SELL, Direction.DOWN, true)).isTrue();
    // 관망: 들고 있으면 오르는 게 좋고, 없으면 내리는 게 좋다.
    assertThat(DefaultProgressService.reviewGood(Action.HOLD, Direction.UP, true)).isTrue();
    assertThat(DefaultProgressService.reviewGood(Action.HOLD, Direction.UP, false)).isFalse();
    assertThat(DefaultProgressService.reviewGood(Action.HOLD, Direction.DOWN, false)).isTrue();
  }

  @Test
  void hintNoteSeparatesHintFromJudgement() {
    // 힌트가 내렸다고 했는데 샀고 올랐다: 힌트는 틀렸고 내 판단이 맞았다.
    assertThat(
            DefaultProgressService.hintNoteKey(Action.BUY, Direction.UP, Hint.HintDirection.DOWN))
        .isEqualTo("hint-wrong-you-right");
    // 힌트대로 샀는데 내렸다: 힌트가 틀렸고 따라갔다.
    assertThat(
            DefaultProgressService.hintNoteKey(Action.BUY, Direction.DOWN, Hint.HintDirection.UP))
        .isEqualTo("hint-wrong-followed");
    // 힌트는 오른다고 했는데 팔았고 올랐다: 힌트가 맞았는데 거슬렀다.
    assertThat(DefaultProgressService.hintNoteKey(Action.SELL, Direction.UP, Hint.HintDirection.UP))
        .isEqualTo("hint-right-ignored");
    // 힌트대로 하고 맞았으면 덧붙일 말이 없다.
    assertThat(DefaultProgressService.hintNoteKey(Action.BUY, Direction.UP, Hint.HintDirection.UP))
        .isNull();
    // 모호한 힌트·관망·힌트를 모르면 덧붙이지 않는다.
    assertThat(
            DefaultProgressService.hintNoteKey(
                Action.BUY, Direction.UP, Hint.HintDirection.NEUTRAL))
        .isNull();
    assertThat(
            DefaultProgressService.hintNoteKey(Action.HOLD, Direction.UP, Hint.HintDirection.DOWN))
        .isNull();
    assertThat(DefaultProgressService.hintNoteKey(Action.BUY, Direction.UP, null)).isNull();
  }
}
