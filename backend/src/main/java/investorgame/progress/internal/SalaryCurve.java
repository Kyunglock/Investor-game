package investorgame.progress.internal;

import investorgame.content.JobDefinition;

/**
 * 월급 곡선 (decisions.md 133번). 실제 평균 임금은 20대 후반에서 40대 후반까지 1.6배쯤 오르고 50대 후반부터 줄어드는데, 연차 인상이 평생 복리로
 * 붙으면 그 몇 배가 된다. 그래서 연차 인상(jobs.json raisePercentPerYear, 물가 위의 실질 인상)은 처음 raiseFullYears 동안만 그대로,
 * 다음 raiseHalfYears 동안은 절반, 그 뒤로는 붙지 않는다. declineAge부터는 해마다 declinePercent씩 줄어든다(정년이 있는 직업만). 물가는
 * 여기서 다루지 않고 밖에서 곱한다.
 */
final class SalaryCurve {

  private static final long PERCENT = 100;

  private SalaryCurve() {}

  /** 연차만 본 실질 배율(만분율). 재취업 경력 인정이 쓴다. */
  static long tenureFactorBp(JobDefinition job, int tenureYears, ProgressProperties.Salary rules) {
    long factor = 10_000;
    for (int year = 0; year < tenureYears; year++) {
      long raise =
          year < rules.raiseFullYears()
              ? job.raisePercentPerYear() * 100L
              : year < rules.raiseFullYears() + rules.raiseHalfYears()
                  ? job.raisePercentPerYear() * 50L
                  : 0;
      factor = factor * (10_000 + raise) / 10_000;
    }
    return factor;
  }

  /** 물가를 뺀 실질 월급: 기본 월급 × 연차 배율 × 나이 감소. */
  static long real(JobDefinition job, int tenureYears, int age, ProgressProperties.Salary rules) {
    long salary = job.baseMonthlySalary() * tenureFactorBp(job, tenureYears, rules) / 10_000;
    if (job.retires()) {
      for (int year = rules.declineAge(); year < age; year++) {
        salary = salary * (PERCENT - rules.declinePercent()) / PERCENT;
      }
    }
    return salary;
  }
}
