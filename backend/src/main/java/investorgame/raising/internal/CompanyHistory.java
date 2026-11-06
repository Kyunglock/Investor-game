package investorgame.raising.internal;

import investorgame.common.Korean;
import investorgame.content.ContentCatalog;
import investorgame.content.RaisingContent;
import investorgame.raising.internal.CompanyState.Employee;
import investorgame.raising.internal.CompanyState.Settlement;
import java.util.List;
import java.util.Map;

/**
 * 회사 연표·업적·명예의 전당 (decisions.md 263번, #326). 매각이 빠져 끝없는 회사에 중간 목표와 기록을 준다. 결산마다 큰 일만 연표에 쌓고, 업적을
 * 열고, 떠난 직원을 남긴다. DB와 시각을 모른다.
 */
class CompanyHistory {

  private static final int BP = 10_000;

  /** 연표에 남기는 "가장 크게 번 해"의 문턱: 자본 1.5배 이상. */
  private static final int BEST_BP = 15_000;

  /** 연표에 남기는 "가장 아팠던 해"의 문턱: 자본 20% 이상 감소. */
  private static final int WORST_BP = 8_000;

  /** 업계 1위·드림팀의 문턱. */
  private static final int DREAM_TEAM = 3;

  private static final int STREAK = 5;
  private static final int BASEMENT_YEARS = 10;

  private final ContentCatalog content;

  CompanyHistory(ContentCatalog content) {
    this.content = content;
  }

  private RaisingContent.History texts() {
    return content.raising().company().history();
  }

  void add(CompanyState company, int year, String kind, String text, String grade) {
    CompanyState.Event event = new CompanyState.Event();
    event.year = year;
    event.kind = kind;
    event.text = text;
    event.grade = grade;
    company.timeline.add(event);
  }

  /** 회사를 연 해. */
  void opened(CompanyState company) {
    add(
        company,
        company.year,
        "open",
        Korean.fill(texts().events().get("open"), Map.of("number", String.valueOf(company.number))),
        null);
  }

  /** 직원이 회사를 떠난다: 명예의 전당에 남기고 연표에 한 줄. */
  void retire(CompanyState company, Employee employee) {
    CompanyState.Alumnus alumnus = new CompanyState.Alumnus();
    alumnus.name = employee.name;
    alumnus.from = employee.joinedYear;
    alumnus.to = company.year;
    alumnus.totalPnl = employee.totalPnl;
    alumnus.grade = CompanyEngine.employeeGrade(employee);
    company.alumni.add(alumnus);
    add(
        company,
        company.year,
        "left",
        Korean.fill(texts().events().get("left"), Map.of("name", employee.name)),
        null);
  }

  /**
   * 결산 한 해를 적는다. ranksBefore는 결산 전 직원별 SSS 위 단계(실전 경험으로 오른 사람을 가린다). eraLine은 시대가 바뀐 해의 소식 줄(없으면
   * null). rank는 결산 뒤 업계 순위.
   */
  void settled(
      CompanyState company,
      Settlement s,
      Map<Integer, Integer> ranksBefore,
      String eraLine,
      int industryRank,
      boolean basement) {
    int before = CompanyEngine.LADDER.indexOf(s.gradeBefore);
    int after = CompanyEngine.LADDER.indexOf(s.gradeAfter);
    if (after != before) {
      add(company, s.year, after > before ? "grow" : "shrink", null, s.gradeAfter);
    }
    if (eraLine != null) {
      add(company, s.year, "era", eraLine, null);
    }
    for (String name : s.overtook) {
      add(
          company,
          s.year,
          "overtake",
          Korean.fill(texts().events().get("overtake"), Map.of("name", name)),
          null);
    }
    // 올해의 라이벌을 이겼다 (275번), 랜드마크 타워에 올라 엔딩을 봤다 (276번).
    if (s.target != null && s.target.won) {
      add(
          company,
          s.year,
          "target",
          Korean.fill(texts().events().get("target"), Map.of("name", s.target.name)),
          null);
    }
    if (s.finished) {
      add(company, s.year, "ending", texts().events().get("ending"), s.gradeAfter);
    }
    for (Employee e : company.employees) {
      if (e.rank > ranksBefore.getOrDefault(e.id, e.rank)) {
        add(
            company,
            s.year,
            "rise",
            Korean.fill(
                texts().events().get("rise"),
                Map.of(
                    "name", e.name, "grade", CompanyEngine.shown(CompanyEngine.employeeGrade(e)))),
            null);
      }
    }
    if (s.capitalBefore > 0) {
      int ratioBp = (int) Math.min(Integer.MAX_VALUE, operated(s) * BP / s.capitalBefore);
      if (ratioBp >= BEST_BP && ratioBp > company.bestYearBp) {
        company.bestYearBp = ratioBp;
        add(
            company,
            s.year,
            "best",
            Korean.fill(
                texts().events().get("best"),
                Map.of("ratio", "%.1f".formatted(ratioBp / (double) BP))),
            null);
      }
      if (ratioBp <= WORST_BP && (company.worstYearBp == 0 || ratioBp < company.worstYearBp)) {
        company.worstYearBp = ratioBp;
        add(
            company,
            s.year,
            "worst",
            Korean.fill(
                texts().events().get("worst"),
                Map.of("percent", String.valueOf((BP - ratioBp) / 100))),
            null);
      }
    }
    if (s.investTotal != null) {
      company.meetingStreak = s.investTotal > 0 ? company.meetingStreak + 1 : 0;
    }
    achieve(company, s, industryRank, basement);
  }

  private void achieve(CompanyState company, Settlement s, int industryRank, boolean basement) {
    long staff = s.results.stream().mapToLong(r -> r.pnl).sum();
    boolean crashProof = CompanyEngine.CRASH.equals(s.phase) && operated(s) >= s.capitalBefore;
    boolean doubled = s.capitalBefore > 0 && operated(s) >= s.capitalBefore * 2;
    boolean allSss =
        company.employees.size() >= DREAM_TEAM
            && company.employees.stream()
                .allMatch(
                    e ->
                        CompanyEngine.LADDER.indexOf(CompanyEngine.employeeGrade(e))
                            >= CompanyEngine.LADDER.indexOf("SSS"));
    boolean dayOnly =
        s.results.size() >= 2
            && s.results.stream().allMatch(r -> "day".equals(r.desk))
            && staff > 0;
    Map<String, Boolean> checks =
        Map.of(
            "crash-proof", crashProof,
            "doubled", doubled,
            "all-sss", allSss,
            "meeting-streak", company.meetingStreak >= STREAK,
            "day-only", dayOnly,
            "basement-ten", basement && s.year >= BASEMENT_YEARS,
            "top", industryRank == 1 && !company.rivals.isEmpty());
    for (RaisingContent.Achievement a : texts().achievements()) {
      if (Boolean.TRUE.equals(checks.get(a.code()))
          && !company.achievements.containsKey(a.code())) {
        company.achievements.put(a.code(), s.year);
        s.achieved.add(a.name());
      }
    }
  }

  /**
   * 인사 비용(계약금·새로 받기·붙잡는 값 − 이적료)을 빼기 전의 연말 자본: 한 해를 굴린 결과만 본다. 전에는 첫해에 두 사람을 뽑은 것만으로 "가장 아팠던 해다.
   * 자본이 27% 줄었다"가 떴다.
   */
  private static long operated(Settlement s) {
    return s.capitalAfter + s.hiring;
  }

  List<RaisingContent.Achievement> all() {
    return texts().achievements();
  }
}
