package investorgame.content;

import java.util.List;
import java.util.Map;

/**
 * 취업 뒤 직장 장면(연봉 협상, 승진, 이직 제안, 구조조정, 번아웃…). 선택지마다 능력치로 성공을 가르고, 결과가 월급·직장·돈·능력치를 움직인다 (decisions.md
 * 26번).
 *
 * @param minTenureYears 이 연차 이상일 때만 나온다
 * @param jobs 이 장면이 나오는 직업 코드. 비어 있으면 모든 직업
 * @param minAge 이 나이 이상일 때만 나온다. null이면 제한 없음
 * @param maxAge 이 나이 이하일 때만 나온다. null이면 제한 없음
 */
public record CareerDefinition(
    String code,
    String title,
    String body,
    int weight,
    int minTenureYears,
    List<String> jobs,
    Integer minAge,
    Integer maxAge,
    List<Option> options) {

  public CareerDefinition {
    jobs = jobs == null ? List.of() : List.copyOf(jobs);
  }

  /** 이 직업·나이에 나올 수 있는 장면인가 (연차는 따로 본다). */
  public boolean fits(String jobCode, int age) {
    return (jobs.isEmpty() || jobs.contains(jobCode))
        && (minAge == null || age >= minAge)
        && (maxAge == null || age <= maxAge);
  }

  public boolean forJob(String jobCode) {
    return jobs.isEmpty() || jobs.contains(jobCode);
  }

  /** 장면 중 이직 제안(moveJob 선택지가 있는 것)은 지금보다 월급이 많은 직업이 있을 때만 나온다. */
  public boolean movesJob() {
    return options.stream().anyMatch(o -> o.success().moveJob());
  }

  /**
   * @param stat 성공 판정에 쓰는 능력치 코드. null이면 판정 없이 항상 success
   * @param baseBp 능력치 0일 때 성공 확률(만분율)
   * @param perPointBp 능력치 1점당 성공 확률 증가(만분율)
   * @param perRaisePercentBp 지금 직장에서 쌓은 인상분(실적) 1%p당 성공 확률 증가(만분율). 깎였으면 그만큼 줄어든다
   * @param fail 판정에 떨어졌을 때. stat이 없으면 쓰지 않는다
   */
  public record Option(
      String code,
      String label,
      String stat,
      Integer baseBp,
      Integer perPointBp,
      Integer perRaisePercentBp,
      Effect success,
      Effect fail) {
    public Option {
      success = success == null ? Effect.NONE : success;
      fail = fail == null ? Effect.NONE : fail;
      baseBp = baseBp == null ? 0 : baseBp;
      perPointBp = perPointBp == null ? 0 : perPointBp;
      perRaisePercentBp = perRaisePercentBp == null ? 0 : perRaisePercentBp;
    }

    public boolean rolls() {
      return stat != null;
    }
  }

  /**
   * 결과. JSON에 없는 항목은 0·false·빈 맵이다.
   *
   * @param salaryPercent 월급 인상(%). 직장을 옮기지 않는 한 누적된다
   * @param quit 직장을 잃는다
   * @param severanceMonths 직장을 잃을 때 받는 위로금(월급 × 달 수)
   * @param moveJob 월급이 더 많은 다른 직업으로 옮긴다. 연차와 인상분은 초기화된다
   * @param moveSalaryPercent 옮긴 직장에서 시작하는 인상분(%)
   * @param amount 현금 변화(원). 음수면 지출
   * @param statDeltas 능력치 변화 (운 제외)
   * @param text 결과 문구
   */
  public record Effect(
      Integer salaryPercent,
      Boolean quit,
      Integer severanceMonths,
      Boolean moveJob,
      Integer moveSalaryPercent,
      Long amount,
      Map<String, Integer> statDeltas,
      String text) {
    public static final Effect NONE = new Effect(0, false, 0, false, 0, 0L, Map.of(), "");

    public Effect {
      salaryPercent = salaryPercent == null ? 0 : salaryPercent;
      quit = quit != null && quit;
      severanceMonths = severanceMonths == null ? 0 : severanceMonths;
      moveJob = moveJob != null && moveJob;
      moveSalaryPercent = moveSalaryPercent == null ? 0 : moveSalaryPercent;
      amount = amount == null ? 0L : amount;
      statDeltas = statDeltas == null ? Map.of() : Map.copyOf(statDeltas);
      text = text == null ? "" : text;
    }
  }
}
