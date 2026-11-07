package investorgame.raising.internal;

import investorgame.common.StatCodes;
import investorgame.common.StatGrade;
import investorgame.content.ContentCatalog;
import investorgame.raising.CompanyView;
import investorgame.raising.internal.CompanyState.Employee;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * 회의에 앉은 팀의 합산 등급 (decisions.md 353번, #400). 사람 수만 늘려서는 오르지 않게 **가장 잘하는 셋의 평균**을 바탕으로, 회의에서 중요한
 * 능력치에 무게를 둔다(종목 회의는 안목, 거시경제 회의는 안목·줏대). 리서치 팀이 앉아 있으면 +4, 팀장이 둘 이상이면 +2. 점수는 능력치와 같은 띠(F~SSS)로
 * 읽고, 띠마다 한 줄 풀이가 붙는다("이 팀이면 기사 열에 일곱은 맞힌다").
 */
class TeamGrade {

  static final String INVEST = "invest";
  static final String MACRO = "macro";

  /** 종목 회의: 안목이 절반. */
  private static final Map<String, Integer> INVEST_WEIGHTS =
      Map.of(
          StatCodes.INSIGHT, 50,
          StatCodes.CONVICTION, 20,
          StatCodes.PATIENCE, 15,
          StatCodes.COURAGE, 10,
          StatCodes.LUCK, 5);

  /** 거시경제 회의: 안목과 줏대. */
  private static final Map<String, Integer> MACRO_WEIGHTS =
      Map.of(
          StatCodes.INSIGHT, 35,
          StatCodes.CONVICTION, 30,
          StatCodes.PATIENCE, 20,
          StatCodes.COURAGE, 10,
          StatCodes.LUCK, 5);

  /** 평균에 드는 사람 수: 잘하는 셋. */
  private static final int TOP = 3;

  private static final int RESEARCH_BONUS = 4;
  private static final int LEADERS_BONUS = 2;
  private static final String RESEARCH_DESK = "research";

  private final CompanyEngine company;
  private final ContentCatalog content;

  TeamGrade(CompanyEngine company, ContentCatalog content) {
    this.company = company;
    this.content = content;
  }

  /** 한 사람의 회의 점수: 능력치의 가중 평균(0~100). */
  static int memberScore(Employee e, Map<String, Integer> weights) {
    int sum = 0;
    int total = 0;
    for (Map.Entry<String, Integer> w : weights.entrySet()) {
      sum += e.stats.getOrDefault(w.getKey(), 0) * w.getValue();
      total += w.getValue();
    }
    return total == 0 ? 0 : sum / total;
  }

  /** 앉은 사람이 없으면 null. */
  CompanyView.TeamGrade of(CompanyState c, String meeting) {
    List<Employee> seated = c.employees.stream().filter(e -> e.desk != null).toList();
    if (seated.isEmpty()) {
      return null;
    }
    Map<String, Integer> weights = MACRO.equals(meeting) ? MACRO_WEIGHTS : INVEST_WEIGHTS;
    List<Integer> scores =
        seated.stream()
            .map(e -> memberScore(e, weights))
            .sorted(Comparator.reverseOrder())
            .limit(TOP)
            .toList();
    int base = (int) Math.round(scores.stream().mapToInt(Integer::intValue).average().orElse(0));
    int bonus = 0;
    if (seated.stream().anyMatch(e -> RESEARCH_DESK.equals(e.desk))) {
      bonus += RESEARCH_BONUS;
    }
    if (seated.stream().filter(e -> company.teams.leads(c, e)).count() >= 2) {
      bonus += LEADERS_BONUS;
    }
    int score = Math.clamp(base + bonus, 0, 100);
    String grade = StatGrade.of(score).name();
    Map<String, String> hints = content.raising().company().teamGrade();
    return new CompanyView.TeamGrade(
        grade, score, hints == null ? "" : hints.getOrDefault(grade, ""), seated.size());
  }
}
