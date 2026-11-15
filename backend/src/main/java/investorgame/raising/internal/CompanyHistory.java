package investorgame.raising.internal;

import investorgame.common.Korean;
import investorgame.content.ContentCatalog;
import investorgame.content.RaisingContent;
import investorgame.raising.internal.CompanyState.Employee;
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

  /** F의 전당: 전부 F인 직원이 이만큼 (351번). */
  private static final int F_TEN = 10;

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

  List<RaisingContent.Achievement> all() {
    return texts().achievements();
  }
}
