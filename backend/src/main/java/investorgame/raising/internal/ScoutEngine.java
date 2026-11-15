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

  /** 종목을 물어 온 사람의 호칭 (#346): 앉은 자리의 직함. 팀장 호칭은 없앴다 (524번). */
  String finderTitle(CompanyState c, Employee e) {
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
   * 종목을 물어 온다 (267번). 종목회의를 열 때(523번) 지금 배치로 한 번 굴린다. 종목 발굴팀 직원부터(안목이 높은 사람부터) base + 안목 ×
   * insight-percent / 100 확률로, 그다음 섹터 데스크 직원이 desk-percent 확률로 가져온다. 아무도 걸리지 않으면 종목 발굴팀에서 안목이 가장 높은
   * 사람이, 그 팀이 비었으면 돈을 굴리는 직원 가운데 한 사람이 가져온다: 기회를 쓴 회의는 꼭 열린다(전에는 분기에 한 번 굴려 아무도 안 오면 회의가 없었다). 돈을
   * 굴리는 사람이 없으면 가져와도 굴릴 수 없어 아무도 오지 않는다.
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
    if (finder == null) {
      finder =
          scouts.isEmpty()
              ? traders.get(random.forKey("scout-any", c.turn()).nextInt(traders.size()))
              : scouts.getFirst();
    }
    c.usedNews.remove(c.invest.news);
    c.invest = invest.found(c, finder, finderTitle(c, finder), random);
    c.invest.scouted = true;
  }
}
