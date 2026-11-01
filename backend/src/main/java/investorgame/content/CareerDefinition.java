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
 * @param minNetWorth 순자산이 이 이상일 때만 나온다(원). null이면 제한 없음. 전업투자자의 장면이 자산에 따라 커진다
 * @param followUpOnly 다른 장면의 결과(followUp)로만 오고 무작위로는 뽑지 않는다
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
    Long minNetWorth,
    Boolean followUpOnly,
    List<Option> options) {

  /** 직업 대신 전업투자자를 고른 사람의 직업 자리. 직업 선택의 INVEST 선택지와 같은 값이다 (decisions.md 35번). */
  public static final String FULL_TIME_INVESTOR = "INVEST";

  /** 판정에 떨어진 선택지는 실제 행동을 "코드!fail"로 남긴다. 후속 장면(followUp)을 찾을 때 쓴다. */
  private static final String FAIL_SUFFIX = "!fail";

  public CareerDefinition {
    jobs = jobs == null ? List.of() : List.copyOf(jobs);
    followUpOnly = followUpOnly != null && followUpOnly;
  }

  /** 이 직업·나이·순자산에 나올 수 있는 장면인가 (연차는 따로 본다). */
  public boolean fits(String jobCode, int age, long netWorth) {
    return forJob(jobCode)
        && (minAge == null || age >= minAge)
        && (maxAge == null || age <= maxAge)
        && (minNetWorth == null || netWorth >= minNetWorth);
  }

  /** jobs가 비어 있으면 모든 직업이지만 전업투자자는 따로 적어야 한다. 직장 이야기가 투자자에게 오면 안 되므로. */
  public boolean forJob(String jobCode) {
    return jobs.isEmpty() ? !FULL_TIME_INVESTOR.equals(jobCode) : jobs.contains(jobCode);
  }

  /** 조건(나이·순자산)이 하나도 없는 장면. 다른 조건에 다 걸렸을 때 물러설 곳이다. */
  public boolean unconditional() {
    return minAge == null && maxAge == null && minNetWorth == null && !followUpOnly;
  }

  public Option option(String optionCode) {
    return options.stream()
        .filter(o -> o.code().equals(optionCode))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("콘텐츠에 없는 직장 선택지: " + code + "/" + optionCode));
  }

  public static String actualAction(String optionCode, boolean success) {
    return success ? optionCode : optionCode + FAIL_SUFFIX;
  }

  /** actualAction으로 남긴 실제 행동에서 결과를 되찾는다. 이직 선택지("move:<직업>")는 "move"로 본다. 모르는 행동이면 아무 결과도 없다. */
  public Effect effectOf(String actualAction) {
    boolean failed = actualAction.endsWith(FAIL_SUFFIX);
    String optionCode =
        failed
            ? actualAction.substring(0, actualAction.length() - FAIL_SUFFIX.length())
            : actualAction;
    if (optionCode.startsWith("move:")) {
      optionCode = "move";
    }
    String found = optionCode;
    return options.stream()
        .filter(o -> o.code().equals(found))
        .findFirst()
        .map(o -> failed ? o.fail() : o.success())
        .orElse(Effect.NONE);
  }

  /** 장면 중 이직 제안(moveJob 선택지가 있는 것)은 지금 직업에서 옮겨 갈 직업(JobDefinition.movesTo)이 있을 때만 나온다. */
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
   * @param moveJob 같은 직종의 다른 자리(JobDefinition.movesTo)로 옮긴다. 연차와 인상분은 초기화된다
   * @param moveSalaryPercent 옮긴 직장에서 시작하는 인상분(%)
   * @param amount 현금 변화(원). 음수면 지출
   * @param statDeltas 능력치 변화 (운 제외)
   * @param followUp 이 결과 뒤에 이어서 올 장면 코드(followUpOnly 장면). null이면 없음
   * @param followUpDays followUp이 오기까지 걸리는 날 수
   * @param becomeJob 전업투자자가 이 직업(회사 대표)이 된다. 직접 세운 회사라 직업 선택에는 나오지 않는 직업이다
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
      String followUp,
      Integer followUpDays,
      String becomeJob,
      String text,
      String textFamily,
      Boolean becomeInvestor) {
    public static final Effect NONE =
        new Effect(0, false, 0, false, 0, 0L, Map.of(), null, 0, null, "", null, false);

    public Effect {
      salaryPercent = salaryPercent == null ? 0 : salaryPercent;
      quit = quit != null && quit;
      severanceMonths = severanceMonths == null ? 0 : severanceMonths;
      moveJob = moveJob != null && moveJob;
      moveSalaryPercent = moveSalaryPercent == null ? 0 : moveSalaryPercent;
      amount = amount == null ? 0L : amount;
      statDeltas = statDeltas == null ? Map.of() : Map.copyOf(statDeltas);
      followUpDays = followUpDays == null ? 0 : followUpDays;
      text = text == null ? "" : text;
      becomeInvestor = becomeInvestor != null && becomeInvestor;
    }

    /** 가족(결혼·자녀)이 있으면 textFamily, 없으면 text (decisions.md 83번). */
    public String textFor(boolean family) {
      return family && textFamily != null && !textFamily.isBlank() ? textFamily : text;
    }
  }
}
