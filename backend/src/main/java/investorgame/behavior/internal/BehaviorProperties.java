package investorgame.behavior.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** 모든 수치는 체감 테스트 후 조정할 초기값이다 (specs/behavior.md 5절). 확률은 만분율(bp)이다. */
@ConfigurationProperties("behavior")
public record BehaviorProperties(
    int deviationCapBp, HintSettings hint, LuckSettings luck, AnalysisSettings analysis) {

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

  /**
   * 추세·시황 해석 (매매창 설계 4.2절). 제대로 읽을 확률 = 안목 × readAtMaxBp / 100, 나머지는 갈래 중 하나를 찍는다. 세 갈래에서 안목 100이
   * 65%를 맞히려면 47.5%로 제대로 읽어야 한다(0.475 + 0.525 / 3 = 0.65).
   *
   * @param readAtMaxBp 안목 100이 제대로 읽을 확률(만분율)
   * @param confidentPercent 확신에 찬 말투가 나올 확률. 안목과 무관하다
   */
  public record AnalysisSettings(int readAtMaxBp, int confidentPercent) {}
}
