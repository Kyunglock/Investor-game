package investorgame.progress.internal;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.content.JobDefinition;
import org.junit.jupiter.api.Test;

/** 월급 곡선 (decisions.md 133번): 실제 평균 임금처럼 오르다 꺾이고 50대 후반부터 줄어든다. */
class SalaryCurveTest {

  private static final ProgressProperties.Salary RULES =
      new ProgressProperties.Salary(10, 10, 55, 3, 10_000);
  private static final JobDefinition OFFICE =
      new JobDefinition("office", "사무직", 10, 2_800_000, 2, true, true, null);
  private static final JobDefinition FARMER =
      new JobDefinition("farmer", "농부", 6, 2_200_000, 1, true, false, null);

  @Test
  void 연차_인상은_10년은_그대로_다음_10년은_절반_그_뒤는_없다() {
    long y10 = SalaryCurve.tenureFactorBp(OFFICE, 10, RULES);
    long y20 = SalaryCurve.tenureFactorBp(OFFICE, 20, RULES);
    long y35 = SalaryCurve.tenureFactorBp(OFFICE, 35, RULES);
    // 1.02^10 ≈ 1.219, × 1.01^10 ≈ 1.347
    assertThat(y10).isBetween(12_150L, 12_250L);
    assertThat(y20).isBetween(13_400L, 13_520L);
    assertThat(y35).isEqualTo(y20);
  }

  @Test
  void 실질_월급은_40대_후반에_정점이고_55세부터_줄어든다() {
    // 25세 취업: 45세(20년차)가 정점. 60세는 5년 줄어 0.97^5 ≈ 0.859.
    long at45 = SalaryCurve.real(OFFICE, 20, 45, RULES);
    long at54 = SalaryCurve.real(OFFICE, 29, 54, RULES);
    long at60 = SalaryCurve.real(OFFICE, 35, 60, RULES);
    assertThat(at45).isEqualTo(at54);
    assertThat((double) at45 / OFFICE.baseMonthlySalary()).isBetween(1.3, 1.4);
    assertThat((double) at60 / at45).isBetween(0.85, 0.87);
  }

  @Test
  void 정년이_없는_직업은_나이로_줄지_않는다() {
    assertThat(SalaryCurve.real(FARMER, 35, 60, RULES))
        .isEqualTo(SalaryCurve.real(FARMER, 35, 50, RULES));
  }
}
