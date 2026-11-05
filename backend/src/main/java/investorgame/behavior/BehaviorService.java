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

  /** 안목으로 방향을 짚은 힌트가 맞을 확률(퍼센트). 방향을 못 읽은(중립) 힌트에는 쓰지 않는다. 화면에 보여 준다. */
  int hintAccuracyPercent(int insight);

  /** 능력치 하나로 하는 판정 한 번이 뒤집힐 확률(만분율). 0이면 상한, 100이면 0. 회사 결산이 직원의 판단을 굴릴 때 쓴다 (증권사 육성 설계 4.2절). */
  int flipChanceBp(int stat);

  /** 운에 따라 손실을 줄일지 정한다. 손실에 곱할 비율(퍼센트)을 돌려준다. */
  /**
   * 운 (decisions.md 78번). 운 × chance-per-point-bp 확률로 '운이 따른다'. 따르면 내릴 뉴스(truth DOWN)는
   * loss-factor-percent(30: 손실이 30%로), 오를 뉴스(UP)는 gain-bonus-percent(150: 이득이 1.5배)를 돌려주고, 아니면 100.
   * 들고 있는 종목에 충격이 닿을 때만 쓴다.
   */
  int luckFactorPercent(int luck, Direction truth, RandomGenerator rng);
}
