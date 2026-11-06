package investorgame.raising.internal;

import investorgame.common.Korean;
import investorgame.common.StatCodes;
import investorgame.common.StatGrade;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.RaisingContent;
import investorgame.raising.internal.CompanyState.Employee;
import investorgame.raising.internal.CompanyState.Resign;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * 연봉과 사기 (decisions.md 270번, #325). 직원은 계약금을 낸 뒤에도 해마다 연봉을 받는다(그 직원의 지금 계약금 × 비율, 분기마다 4분의 1). 둘째
 * 해부터 해마다 한 사람이 연봉을 올려 달라고 한다: 올려 주면 사기가 오르고, 동결하면 꺾인다. 종목 회의에서 자기 말을 안 들어 줬는데 사장이 틀리면 서운하고, 들어 줬는데
 * 맞으면 신이 난다. 한 해 내내 쉬면 기운을 되찾는다. 사기는 손이 뒤집힐 확률에 걸린다. 직원은 사기가 낮아도 떠나지 않는다(265번). DB와 시각을 모른다.
 */
class PayEngine {

  static final int MORALE_MIN = -2;
  static final int MORALE_MAX = 2;
  private static final int PERCENT = 100;
  private static final int MAX_STAT = 100;

  private final CompanyEngine company;
  private final ContentCatalog content;
  private final CompanyProperties properties;

  PayEngine(CompanyEngine company, ContentCatalog content, CompanyProperties properties) {
    this.company = company;
    this.content = content;
    this.properties = properties;
  }

  private CompanyProperties.Pay rules() {
    return properties.people().pay();
  }

  private RaisingContent.People texts() {
    return content.raising().company().people();
  }

  /**
   * 한 해 연봉: 그 직원 계약금의 자본 비율 몫 × 비율, 올려 준 횟수만큼 더. 올해 회사 등급의 자본으로 매긴다. 정해진 계약금(초반 1억 회사에 큰 값)은 빼서 작은
   * 회사에는 가볍고 큰 회사에는 무겁다.
   */
  long salary(CompanyState c, Employee e) {
    return salary(c, e, e.raises);
  }

  private long salary(CompanyState c, Employee e, int raises) {
    if (!paysSalary(c)) {
      return 0;
    }
    long fee = company.feeShare(company.gradedCapital(c), e.stats, e.rank);
    double up = Math.pow((PERCENT + rules().raiseStepPercent()) / (double) PERCENT, raises);
    return Math.round(fee * rules().salaryPercent() / (double) PERCENT * up);
  }

  /** 연봉이 나가는 회사인가: salary-from-grade(상가) 아래 작은 회사의 직원은 지분으로 받는다. */
  boolean paysSalary(CompanyState c) {
    return CompanyEngine.LADDER.indexOf(company.grade(c))
        >= CompanyEngine.LADDER.indexOf(rules().salaryFromGrade());
  }

  /** 한 분기에 나가는 연봉의 합. 쉬는 사람도 받는다. */
  long quarterSalary(CompanyState c) {
    return c.employees.stream().mapToLong(e -> salary(c, e)).sum() / CompanyEngine.QUARTERS;
  }

  /** 사기에 따라 손이 뒤집힐 확률에 곱하는 비율(%): 사기 −2면 130%, +2면 70%. */
  int moralePercent(Employee e) {
    return PERCENT - e.morale * rules().moraleFlipPercent();
  }

  /**
   * 올해의 연봉 협상: raise-from-year 해부터 해마다 raise-percent 확률로, 마지막으로 올려 달라고 한 지 raise-every-years 해가 지난
   * 사람 가운데 종합 등급이 가장 높은 사람(같으면 오래 앉은 사람)이 온다. 없으면 null.
   */
  CompanyState.Raise raiseOf(CompanyState c, SeededRandom random) {
    CompanyProperties.Pay rules = rules();
    // 연봉이 없는 작은 회사(지분으로 받는다)에서는 올려 달라고 하지 않는다 (#337: "0만 원 → 0만 원").
    if (!paysSalary(c)) {
      return null;
    }
    if (c.year < rules.raiseFromYear()
        || random.forKey("raise", c.year).nextInt(PERCENT) >= rules.raisePercent()) {
      return null;
    }
    return c.employees.stream()
        .filter(e -> e.askedYear == 0 || c.year - e.askedYear >= rules.raiseEveryYears())
        .filter(e -> e.joinedYear < c.year)
        .max(
            Comparator.comparingInt(
                    (Employee e) -> CompanyEngine.LADDER.indexOf(CompanyEngine.employeeGrade(e)))
                .thenComparingInt(e -> e.deskYears)
                .thenComparingInt(e -> -e.id))
        .map(
            e -> {
              e.askedYear = c.year;
              CompanyState.Raise raise = new CompanyState.Raise();
              raise.employeeId = e.id;
              raise.before = salary(c, e);
              raise.after = salary(c, e, e.raises + 1);
              return raise;
            })
        .orElse(null);
  }

  private Employee raiser(CompanyState c) {
    return c.employees.stream().filter(e -> e.id == c.raise.employeeId).findFirst().orElse(null);
  }

  /** 연초 회의의 연봉 협상 한 줄. */
  String raiseLine(CompanyState c) {
    Employee e = raiser(c);
    return Korean.fill(
        texts().raiseAsk(),
        Map.of(
            "name",
            e == null ? "" : e.name,
            "before",
            CompanyEngine.won(c.raise.before),
            "after",
            CompanyEngine.won(c.raise.after)));
  }

  /**
   * 연봉 협상에 답한다: 올려 주면 연봉이 오르고 사기 +1, raise-grow-percent%로 능력치 하나가 한 띠 오른다(280번). 동결하면 사기 −2, 다음 분기를
   * 넘길 때 freeze-leave-percent%로 떠난다. 협상이 없으면 400.
   */
  void answer(CompanyState c, boolean accept, SeededRandom random) {
    if (c.raise == null) {
      throw new InvalidRequestException("올해 연봉 협상이 없다");
    }
    Employee e = raiser(c);
    c.raise = null;
    if (e == null) {
      return;
    }
    if (accept) {
      e.raises++;
      shift(e, 1);
      c.yearLines.add(Korean.fill(texts().raised(), Map.of("name", e.name)));
      if (random.forKey("raise-grow", c.year, e.id).nextInt(PERCENT) < rules().raiseGrowPercent()) {
        grow(c, e);
      }
    } else {
      shift(e, -2);
      e.frozenPending = true;
      c.yearLines.add(Korean.fill(texts().frozen(), Map.of("name", e.name)));
    }
  }

  /** 올려 준 보람 (280번): 앉은 자리가 원하는 능력치(쉬면 가장 낮은 능력치)가 한 띠 오른다. SSS 끝(100)이면 그대로다. */
  private void grow(CompanyState c, Employee e) {
    String stat =
        e.desk != null
            ? company.deskStat(e.desk)
            : e.stats.entrySet().stream()
                .filter(x -> !StatCodes.LUCK.equals(x.getKey()))
                .min(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(StatCodes.INSIGHT);
    int value = e.stats.getOrDefault(stat, 0);
    int raised = Math.min(MAX_STAT, value + company.band());
    if (raised == value) {
      return;
    }
    e.stats.put(stat, raised);
    c.yearLines.add(
        Korean.fill(
            texts().raiseGrew(),
            Map.of(
                "name",
                e.name,
                "stat",
                content.raising().company().statNames().get(stat),
                "before",
                StatGrade.of(value).name(),
                "after",
                StatGrade.of(raised).name())));
  }

  /**
   * 분기를 넘길 때 (280번): 답하지 않은 연봉 협상은 ignore-quarters 분기부터 분기마다 ignore-leave-percent%로, 동결당한 사람은 그다음
   * 분기에 freeze-leave-percent%로 떠난다. 떠나면 소식 줄을 lines에 남긴다.
   */
  void quarterPassed(CompanyState c, SeededRandom random, List<String> lines) {
    CompanyProperties.Pay rules = rules();
    // 사표를 들고 왔는데 붙잡지도 보내지도 않고 한 분기를 넘겼다 (282번): 이제 떠난다.
    if (c.resign != null) {
      Resign r = c.resign;
      c.resign = null;
      c.employees.stream()
          .filter(e -> e.id == r.employeeId)
          .findFirst()
          .ifPresent(
              e ->
                  quit(
                      c,
                      e,
                      FROZEN.equals(r.reason) ? texts().frozenQuit() : texts().raiseQuit(),
                      lines));
    }
    if (c.raise != null) {
      c.raise.quarters++;
      Employee e = raiser(c);
      if (e != null
          && c.resign == null
          && c.raise.quarters >= rules.ignoreQuarters()
          && random.forKey("raise-quit", c.year, c.quarter, e.id).nextInt(PERCENT)
              < rules.ignoreLeavePercent()) {
        c.raise = null;
        resign(c, e, IGNORED, lines);
      }
    }
    for (Employee e : List.copyOf(c.employees)) {
      if (!e.frozenPending) {
        continue;
      }
      e.frozenPending = false;
      if (c.resign == null
          && random.forKey("frozen-quit", c.year, c.quarter, e.id).nextInt(PERCENT)
              < rules.freezeLeavePercent()) {
        resign(c, e, FROZEN, lines);
      }
    }
  }

  static final String IGNORED = "IGNORED";
  static final String FROZEN = "FROZEN";

  /** 바로 떠나지 않고 사표를 들고 온다 (282번): 마지막으로 붙잡을 기회. */
  private void resign(CompanyState c, Employee e, String reason, List<String> lines) {
    Resign r = new Resign();
    r.employeeId = e.id;
    r.reason = reason;
    r.year = c.year;
    r.quarter = c.quarter;
    c.resign = r;
    lines.add(
        Korean.fill(
            FROZEN.equals(reason) ? texts().resignFrozen() : texts().resignIgnored(),
            Map.of("name", e.name)));
  }

  /** 사표에 답한다 (282번). 붙잡으면 연봉을 두 번 올려 준 만큼(약 +21%) 올려 주고 사기 +1, 남는다. 보내면 지금 떠난다. 사표가 없으면 400. */
  void answerResign(CompanyState c, boolean keep) {
    Resign r = c.resign;
    if (r == null) {
      throw new InvalidRequestException("사표를 들고 온 직원이 없다");
    }
    c.resign = null;
    Employee e = c.employees.stream().filter(x -> x.id == r.employeeId).findFirst().orElse(null);
    if (e == null) {
      return;
    }
    if (keep) {
      e.raises += KEEP_RAISES;
      shift(e, 1);
      c.yearLines.add(Korean.fill(texts().resignKept(), Map.of("name", e.name)));
    } else {
      quit(c, e, texts().resignLet(), c.yearLines);
    }
  }

  /** 붙잡을 때 올려 주는 횟수. */
  private static final int KEEP_RAISES = 2;

  /** 붙잡으면 오를 연봉. */
  long keepSalary(CompanyState c, Employee e) {
    return salary(c, e, e.raises + KEEP_RAISES);
  }

  /** 사표를 들고 온 직원과 한 줄 (282번). 없으면 null. */
  Employee resigner(CompanyState c) {
    if (c.resign == null) {
      return null;
    }
    return c.employees.stream().filter(e -> e.id == c.resign.employeeId).findFirst().orElse(null);
  }

  String resignLine(CompanyState c) {
    Employee e = resigner(c);
    return Korean.fill(
        FROZEN.equals(c.resign.reason) ? texts().resignFrozen() : texts().resignIgnored(),
        Map.of("name", e == null ? "" : e.name));
  }

  private void quit(CompanyState c, Employee e, String template, List<String> lines) {
    company.history.retire(c, e);
    c.employees.removeIf(x -> x.id == e.id);
    company.teams.tidy(c);
    lines.add(Korean.fill(template, Map.of("name", e.name)));
  }

  /** 연초 회의에 보이는 협상 결과의 확률 한 줄 (280번). */
  String raiseOdds() {
    CompanyProperties.Pay rules = rules();
    return Korean.fill(
        texts().raiseOdds(),
        Map.of(
            "grow", String.valueOf(rules.raiseGrowPercent()),
            "freeze", String.valueOf(rules.freezeLeavePercent()),
            "quarters", String.valueOf(rules.ignoreQuarters()),
            "ignore", String.valueOf(rules.ignoreLeavePercent())));
  }

  private static void shift(Employee e, int by) {
    e.morale = Math.clamp(e.morale + by, MORALE_MIN, MORALE_MAX);
  }

  /**
   * 종목 회의 뒤 (270번): 사장이 자기 말과 다르게 골랐는데 틀렸으면 서운하고(사기 −1), 자기 말대로 골랐는데 맞았으면 신이 난다(+1). 모르겠다고 한 사람은
   * 그대로다.
   */
  void afterMeeting(CompanyState c) {
    CompanyState.Invest invest = c.invest;
    if (invest == null || invest.remarks == null || invest.choice == null) {
      return;
    }
    String right = invest.up ? InvestEngine.BUY : InvestEngine.SELL;
    boolean bossRight = invest.choice.equals(right);
    for (CompanyState.Remark r : invest.remarks) {
      String said =
          "UP".equals(r.read) ? InvestEngine.BUY : "DOWN".equals(r.read) ? InvestEngine.SELL : null;
      Employee e = c.employees.stream().filter(x -> x.id == r.employeeId).findFirst().orElse(null);
      if (said == null || e == null) {
        continue;
      }
      if (!said.equals(invest.choice) && !bossRight) {
        shift(e, -1);
        c.yearLines.add(Korean.fill(texts().meetingIgnored(), Map.of("name", e.name)));
      } else if (said.equals(invest.choice) && bossRight) {
        shift(e, 1);
        c.yearLines.add(Korean.fill(texts().heard(), Map.of("name", e.name)));
      }
    }
  }

  /** 분기를 넘길 때 자리에 앉아 있던 사람은 올해 쉰 것이 아니다. */
  void markWorked(CompanyState c) {
    c.employees.stream().filter(e -> e.desk != null).forEach(e -> e.restedAllYear = false);
  }

  /**
   * 연말 (270번): 사기가 0 쪽으로 한 칸 돌아오고, 한 해 내내 쉰 사람은 기운을 되찾고(+1), 답하지 않은 연봉 협상은 흐지부지돼 서운하다(−1). 소식 줄을
   * 남긴다.
   */
  void yearEnd(CompanyState c, List<String> lines) {
    for (Employee e : c.employees) {
      e.morale -= Integer.signum(e.morale);
      if (e.restedAllYear && e.joinedYear < c.year) {
        shift(e, 1);
        lines.add(Korean.fill(texts().rested(), Map.of("name", e.name)));
      }
      e.restedAllYear = true;
    }
    if (c.raise != null) {
      Employee e = raiser(c);
      c.raise = null;
      if (e != null) {
        shift(e, -1);
        lines.add(Korean.fill(texts().raiseIgnored(), Map.of("name", e.name)));
      }
    }
  }
}
