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
  /**
   * 운 (decisions.md 78번). 운 × chance-per-point-bp 확률로 '운이 따른다'. 따르면 내릴 뉴스(truth DOWN)는
   * loss-factor-percent(30: 손실이 30%로), 오를 뉴스(UP)는 gain-bonus-percent(150: 이득이 1.5배)를 돌려주고, 아니면 100.
   * 들고 있는 종목에 충격이 닿을 때만 쓴다.
   */
  int luckFactorPercent(int luck, Direction truth, RandomGenerator rng);

  /**
   * 안목에 따라 차트·지표를 읽는다 (매매창 설계 4.2절). truth는 정답의 번호(0부터), choices는 갈래 수. 안목만큼의 확률로 제대로 읽고 나머지는 갈래 중
   * 하나를 찍는다. 찍어서 맞으면 맞은 것이다. 말투가 확신에 찼는지는 안목과 무관하다.
   */
  Reading analyze(int insight, int truth, int choices, RandomGenerator rng);
}
