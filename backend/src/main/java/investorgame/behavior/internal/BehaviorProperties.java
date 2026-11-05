package investorgame.behavior.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** 모든 수치는 체감 테스트 후 조정할 초기값이다 (specs/behavior.md 5절). 확률은 만분율(bp)이다. */
@ConfigurationProperties("behavior")
public record BehaviorProperties(int deviationCapBp, HintSettings hint, LuckSettings luck) {

  public record HintSettings(
      int accuracyBaseBp,
      int accuracyPerPointBp,
      int neutralBelowInsight,
      int neutralPercent,
      int strongPercent) {}

  /**
   * 운 (decisions.md 78번). chancePerPointBp는 운 1점당 '운이 따를' 확률, 걸리면 내릴 뉴스의 손실은 lossFactorPercent만큼만,
   * 오를 뉴스의 이득은 gainBonusPercent만큼 커진다.
   */
  public record LuckSettings(int chancePerPointBp, int lossFactorPercent, int gainBonusPercent) {}
}
