package investorgame.behavior;

import investorgame.common.Direction;
import investorgame.common.Hint;
import java.util.random.RandomGenerator;

/** 능력치가 선택과 정보에 영향을 주는 순수 규칙 (specs/behavior.md). 상태와 DB가 없다. */
public interface BehaviorService {

  /** 선택이 판정을 거쳐 실제 행동이 된다. 이탈이 있으면 원인을 함께 돌려준다. */
  Resolution resolve(ChoiceContext context, RandomGenerator rng);

  /** 안목에 따른 힌트의 방향과 강도를 정한다. */
  Hint hint(int insight, Direction truth, RandomGenerator rng);

  /** 운에 따라 손실을 줄일지 정한다. 손실에 곱할 비율(퍼센트)을 돌려준다. */
  int lossFactorPercent(int luck, RandomGenerator rng);
}
