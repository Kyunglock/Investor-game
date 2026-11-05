package investorgame.raising.internal;

import investorgame.behavior.BehaviorService;
import investorgame.common.Korean;
import investorgame.common.StatCodes;
import investorgame.common.StatGrade;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.RaisingContent;
import investorgame.raising.internal.CompanyState.Employee;
import investorgame.raising.internal.CompanyState.Result;
import investorgame.raising.internal.CompanyState.Settlement;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.random.RandomGenerator;
import org.springframework.stereotype.Component;

/**
 * 아주 작은 회사의 규칙 (증권사 육성 설계 4·6절): 사장은 배치만 하고 직원은 능력치대로 알아서 굴린다. 한 해 = 연초 회의 → 배치 → (공채 육성) → 결산. DB와
 * 시각을 모르고 상태와 난수만 받는다.
 */
@Component
class CompanyEngine {

  /** 모든 객체가 쓰는 등급표 15단계 (2.1절). */
  static final List<String> LADDER =
      List.of("F", "E", "D", "C", "B", "A", "S", "SS", "SSS", "X", "XX", "XXX", "Z", "ZZ", "ZZZ");

  static final String CRASH = "crash";
  private static final String RISK_DESK = "risk";
  private static final String RESEARCH_DESK = "research";
  private static final int BP = 10_000;
  private static final int PERCENT = 100;

  private final ContentCatalog content;
  private final BehaviorService behavior;
  private final CompanyProperties properties;

  CompanyEngine(ContentCatalog content, BehaviorService behavior, CompanyProperties properties) {
    this.content = content;
    this.behavior = behavior;
    this.properties = properties;
  }

  int turns() {
    return properties.turns();
  }

  /** 첫 육성의 사람이 1호 직원이 되며 회사가 열린다. 그 판에서 번 돈이 시작 자본이다 (6.0절). */
  CompanyState open(SeededRandom random, Map<String, Integer> stats, long capital) {
    CompanyState company = new CompanyState();
    company.capital = Math.max(0, capital);
    hire(company, stats);
    startYear(company, random);
    return company;
  }

  /** 첫 직원의 이름이 들어간 회사를 연 한 줄. */
  String openingLine(CompanyState company) {
    return Korean.fill(
        content.raising().company().opening(),
        Map.of(
            "name", company.employees.getFirst().name, "capital", RunEngine.won(company.capital)));
  }

  Employee hire(CompanyState company, Map<String, Integer> stats) {
    List<String> names = content.raising().company().names();
    Employee employee = new Employee();
    employee.id = ++company.hired;
    int round = (company.hired - 1) / names.size();
    String name = names.get((company.hired - 1) % names.size());
    employee.name = round == 0 ? name : name + (round + 1);
    employee.stats.putAll(stats);
    company.employees.add(employee);
    return employee;
  }

  String grade(long capital) {
    int at = 0;
    for (int i = 0; i < properties.gradeCapital().size(); i++) {
      if (capital >= properties.gradeCapital().get(i)) {
        at = i;
      }
    }
    return LADDER.get(at);
  }

  int seats(long capital) {
    int at = LADDER.indexOf(grade(capital));
    List<Integer> seats = properties.seats();
    return at < seats.size() ? seats.get(at) : seats.getLast() + (at - seats.size() + 1);
  }

  long recruitFund(CompanyState company) {
    return Math.min(
        properties.recruitMax(), company.capital * properties.recruitPercent() / PERCENT);
  }

  /** 등급이 오를수록 고객이 돈을 더 맡겨 수수료와 판돈이 커진다 (4.5절). */
  private double multiplier(long capital) {
    return Math.pow(
        properties.multiplierPercent() / (double) PERCENT, LADDER.indexOf(grade(capital)));
  }

  /** 올해 시장을 정하고 연초 회의를 준비한다. 조짐은 폭락장 앞에 보이고, 아무 일 없는 해에도 헛조짐이 섞인다 (4.3절). */
  void startYear(CompanyState company, SeededRandom random) {
    RandomGenerator rng = random.forKey("company-year", company.year);
    int phaseRoll = rng.nextInt(BP);
    int omenRoll = rng.nextInt(PERCENT);
    int textRoll = rng.nextInt(BP);
    int wantedRoll = rng.nextInt(BP);
    Map<String, Integer> weights = properties.phaseWeights();
    int total = weights.values().stream().mapToInt(Integer::intValue).sum();
    int pick = (int) ((long) phaseRoll * total / BP);
    String phase = null;
    for (String key : weights.keySet().stream().sorted().toList()) {
      pick -= weights.get(key);
      if (pick < 0) {
        phase = key;
        break;
      }
    }
    company.phase = phase;
    company.omen = null;
    if (CRASH.equals(phase) && omenRoll < properties.omenPercent()) {
      List<String> omens = content.crises().stream().flatMap(c -> c.omens().stream()).toList();
      company.omen = omens.get(textRoll % omens.size());
    } else if (!CRASH.equals(phase) && omenRoll < properties.falseOmenPercent()) {
      List<String> omens = content.commonOmens();
      company.omen = omens.get(textRoll % omens.size());
    }
    List<RaisingContent.Desk> trading =
        desks().stream().filter(RaisingContent.Desk::trades).toList();
    company.wantedDesk =
        company.omen != null ? RISK_DESK : trading.get(wantedRoll % trading.size()).code();
    company.recruited = false;
  }

  List<Long> gradeCapital() {
    return properties.gradeCapital();
  }

  String wantedLine(CompanyState company) {
    return content.raising().company().wanted().get(company.wantedDesk);
  }

  List<RaisingContent.Desk> desks() {
    return content.raising().company().desks();
  }

  private RaisingContent.Desk desk(String code) {
    return desks().stream()
        .filter(d -> d.code().equals(code))
        .findFirst()
        .orElseThrow(() -> new InvalidRequestException("없는 자리: " + code));
  }

  /** 직원을 자리에 앉힌다. 자리 수를 넘게 앉힐 수 없다. 빠진 직원은 쉬고, 같은 자리에 여럿 앉아도 된다. */
  void place(CompanyState company, Map<Integer, String> placements) {
    int placed = (int) placements.values().stream().filter(d -> d != null).count();
    if (placed > seats(company.capital)) {
      throw new InvalidRequestException("자리가 모자란다");
    }
    Set<Integer> ids = new HashSet<>();
    for (Employee employee : company.employees) {
      ids.add(employee.id);
    }
    if (!ids.containsAll(placements.keySet())) {
      throw new InvalidRequestException("없는 직원");
    }
    for (String code : placements.values()) {
      if (code != null) {
        desk(code);
      }
    }
    for (Employee employee : company.employees) {
      employee.desk = placements.get(employee.id);
    }
  }

  /**
   * 직원들이 배치대로 한 해를 굴린 결과 (6.1절 5번). 판단마다 꼬드김(리스크 관리 팀이 막는다) → 손 뒤집힘(자리가 원하는 능력치, 폭락장이면 모두 인내심) →
   * 맞힘(안목, 리서치 팀이 형광펜을 빌려준다) 순으로 굴린다. 수수료 매출은 시장과 상관없이 들어온다.
   */
  Settlement settle(CompanyState company, SeededRandom random) {
    if (company.year > properties.turns()) {
      throw new InvalidRequestException("끝난 회사다");
    }
    if (company.recruitRun != null || company.pendingRun != null) {
      throw new InvalidRequestException("공채 육성을 먼저 마친다");
    }
    RandomGenerator rng = random.forKey("company-settle", company.year);
    Settlement settlement = new Settlement();
    settlement.year = company.year;
    settlement.phase = company.phase;
    settlement.omen = company.omen;
    settlement.capitalBefore = company.capital;
    settlement.gradeBefore = grade(company.capital);

    double multiplier = multiplier(company.capital);
    int research = bestOf(company, RESEARCH_DESK, StatCodes.INSIGHT);
    int risk = bestOf(company, RISK_DESK, StatCodes.CONVICTION);
    List<Employee> traders =
        company.employees.stream().filter(e -> e.desk != null && desk(e.desk).trades()).toList();
    long pot =
        Math.min(
            company.capital,
            (long) (company.capital * properties.stakePercent() / (double) PERCENT * multiplier));
    long stake = traders.isEmpty() ? 0 : pot / traders.size();
    boolean crash = CRASH.equals(company.phase);
    long totalPnl = 0;
    for (Employee employee : traders) {
      Result result = new Result();
      result.employeeId = employee.id;
      result.name = employee.name;
      result.desk = employee.desk;
      result.stake = stake;
      CompanyProperties.DeskReturn returns = properties.desks().get(employee.desk);
      String flipStat = crash ? StatCodes.PATIENCE : desk(employee.desk).statCode();
      int insight = Math.max(employee.stats.get(StatCodes.INSIGHT), research);
      int swayBp =
          behavior.flipChanceBp(employee.stats.get(StatCodes.CONVICTION))
              * properties.swayPercent()
              / PERCENT
              * (PERCENT - risk)
              / PERCENT;
      int flipBp = behavior.flipChanceBp(employee.stats.get(flipStat));
      int hitBp = behavior.hintAccuracyPercent(insight) * PERCENT;
      long bp = 0;
      for (int i = 0; i < properties.decisions(); i++) {
        int swayRoll = rng.nextInt(BP);
        int flipRoll = rng.nextInt(BP);
        int hitRoll = rng.nextInt(BP);
        bp += properties.phaseBp().getOrDefault(company.phase, 0);
        if (swayRoll < swayBp) {
          result.flips.merge(StatCodes.CONVICTION, 1, Integer::sum);
          bp -= returns.missBp();
        } else if (flipRoll < flipBp) {
          result.flips.merge(flipStat, 1, Integer::sum);
          bp -=
              crash ? returns.flipBp() * properties.crashFlipPercent() / PERCENT : returns.flipBp();
        } else {
          bp += hitRoll < hitBp ? returns.gainBp() : -returns.missBp();
        }
      }
      result.pnl = stake * bp / BP;
      totalPnl += result.pnl;
      settlement.results.add(result);
      result.flips.forEach(
          (stat, count) ->
              settlement.lines.add(
                  Korean.fill(
                          content.raising().company().flipLines().get(stat),
                          Map.of("name", employee.name))
                      + (count > 1 ? " (" + count + "번)" : "")));
    }
    long fee = (long) (company.capital * properties.feeBp() / (double) BP * multiplier);
    settlement.fee = fee;
    company.capital = Math.max(0, company.capital + fee + totalPnl);
    settlement.capitalAfter = company.capital;
    settlement.gradeAfter = grade(company.capital);
    settlement.lines.addFirst(content.raising().company().phases().get(company.phase));
    if (!crash && company.omen != null) {
      settlement.lines.add(1, content.raising().company().falseOmenNote());
    }
    company.settlements.add(settlement);
    company.year++;
    if (company.year <= properties.turns()) {
      startYear(company, random);
    }
    return settlement;
  }

  /** 그 자리에 앉은 직원 가운데 가장 높은 능력치. 아무도 없으면 0. */
  private static int bestOf(CompanyState company, String desk, String stat) {
    return company.employees.stream()
        .filter(e -> desk.equals(e.desk))
        .mapToInt(e -> e.stats.get(stat))
        .max()
        .orElse(0);
  }

  /** 다섯 능력치 평균의 등급 (2.3절). */
  static String overallGrade(Map<String, Integer> stats) {
    int sum = stats.values().stream().mapToInt(Integer::intValue).sum();
    return StatGrade.of(Math.round(sum / (float) stats.size())).name();
  }

  static Map<String, String> grades(Map<String, Integer> stats) {
    Map<String, String> grades = new HashMap<>();
    stats.forEach((code, value) -> grades.put(code, StatGrade.of(value).name()));
    return grades;
  }
}
