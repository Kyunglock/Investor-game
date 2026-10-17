package investorgame.event;

import investorgame.common.Direction;
import investorgame.common.Hint;

/** 진행이 행동의 hint()를 감싸서 넘긴다. 이벤트 운영은 행동을 알지 못한다. seq는 이벤트 순번이다. */
@FunctionalInterface
public interface HintProvider {

  Hint hintFor(Direction truth, int seq);
}
