package investorgame.behavior.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** 모든 수치는 체감 테스트 후 조정할 초기값이다 (specs/behavior.md 5절). 확률은 만분율(bp)이다. */
@ConfigurationProperties("behavior")
public record BehaviorProperties(
    int deviationCapBp, int impulseSellPercent, HintSettings hint, LuckSettings luck) {

  public record HintSettings(
      int accuracyBaseBp,
      int accuracyPerPointBp,
      int neutralBelowInsight,
      int neutralPercent,
      int strongFromInsight,
      int strongPercent) {}

  public record LuckSettings(int chancePerPointBp, int lossFactorPercent) {}
}
