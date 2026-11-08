package investorgame.raising.internal;

import investorgame.common.StatCodes;
import investorgame.common.random.SeededRandom;
import investorgame.raising.internal.CompanyState.Employee;
import java.util.Comparator;
import java.util.List;

/**
 * 종목 발굴 (decisions.md 267번). 사장이 분기 넘기기를 누르면 종목 발굴팀 직원이(낮은 확률로 섹터 데스크 직원도) 종목을 물어 온다: 종목 회의는 그때만
 * 열린다. 전에는 거시경제 회의가 끝나야 물어 왔다(382번에서 회의를 뺐다). DB와 시각을 모른다.
 */
class ScoutEngine {

  static final String SCOUT_DESK = "scout";

  private static final int PERCENT = 100;

  private final CompanyEngine company;
  private final InvestEngine invest;
  private final CompanyProperties properties;

  ScoutEngine(CompanyEngine company, InvestEngine invest, CompanyProperties properties) {
    this.company = company;
    this.invest = invest;
    this.properties = properties;
  }

  /**
   * 종목을 물어 온 사람의 호칭 (#346): 그 자리의 팀장이면 분기 실적의 팀장 보고와 같이 "종목 발굴팀 팀장", 아니면 직함. 전에는 같은 사람이 회의에서는 "종목
   * 발굴 담당", 실적에서는 "종목 발굴팀 팀장"이었다.
   */
  String finderTitle(CompanyState c, Employee e) {
    if (e.desk != null && company.teams.leads(c, e)) {
      return company.desk(e.desk).name() + " 팀장";
    }
    return roleOf(e);
  }

  /** 종목 발굴팀에 앉은 사람의 직함 (decisions.md 267번). 직함이 없는 자리면 null. */
  String roleOf(Employee e) {
    if (e.desk == null) {
      return null;
    }
    List<String> roles = company.deskRoles(e.desk);
    if (roles == null) {
      return null;
    }
    int at = CompanyEngine.LADDER.indexOf(CompanyEngine.employeeGrade(e));
    int c = CompanyEngine.LADDER.indexOf("C");
    int s = CompanyEngine.LADDER.indexOf("S");
    return roles.get(at < c ? 0 : at < s ? 1 : 2);
  }

  /**
   * 종목을 물어 온다 (267번). 분기 넘기기를 누르면 지금 배치로 한 분기에 한 번 굴린다(같은 분기에 다시 불러도 아무것도 하지 않는다). 종목 발굴팀 직원부터(안목이
   * 높은 사람부터) base + 안목 × insight-percent / 100 확률로, 그다음 섹터 데스크 직원이 desk-percent 확률로. 먼저 가져온 한 사람의
   * 종목으로 종목 회의가 열린다. 첫 회사의 첫 분기에는 회의를 배우게 돈을 굴리는 직원이 꼭 하나 가져온다. 돈을 굴리는 사람이 없으면 가져와도 굴릴 수 없어 아무도 오지
   * 않는다(그래도 그 분기에는 굴린 셈이다).
   */
  void discover(CompanyState c, SeededRandom random) {
    if (c.invest == null || !Boolean.FALSE.equals(c.invest.found) || c.invest.scouted) {
      return;
    }
    c.invest.scouted = true;
    List<Employee> traders = company.traders(c);
    if (traders.isEmpty()) {
      return;
    }
    CompanyProperties.Scout rules = properties.scout();
    List<Employee> scouts =
        c.employees.stream()
            .filter(e -> SCOUT_DESK.equals(e.desk))
            .sorted(
                Comparator.comparingInt((Employee e) -> -e.stats.get(StatCodes.INSIGHT))
                    .thenComparingInt(e -> e.id))
            .toList();
    Employee finder = null;
    for (Employee e : scouts) {
      int chance =
          rules.basePercent() + e.stats.get(StatCodes.INSIGHT) * rules.insightPercent() / PERCENT;
      if (random.forKey("scout", c.turn(), e.id).nextInt(PERCENT) < chance) {
        finder = e;
        break;
      }
    }
    if (finder == null) {
      for (Employee e : traders) {
        if (company.deskSector(e.desk) != null
            && random.forKey("scout-desk", c.turn(), e.id).nextInt(PERCENT) < rules.deskPercent()) {
          finder = e;
          break;
        }
      }
    }
    if (finder == null && c.number == 1 && c.year == 1 && c.quarter == 1) {
      finder = traders.getFirst();
    }
    if (finder == null) {
      return;
    }
    c.usedNews.remove(c.invest.news);
    c.invest = invest.found(c, finder, finderTitle(c, finder), random);
    c.invest.scouted = true;
  }
}
