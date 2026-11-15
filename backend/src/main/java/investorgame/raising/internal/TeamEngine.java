package investorgame.raising.internal;

import investorgame.common.Korean;
import investorgame.content.ContentCatalog;
import investorgame.content.RaisingContent;
import investorgame.raising.internal.CompanyState.Employee;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 팀장과 팀장 보고 (decisions.md 269번). 사람이 앉은 자리마다 팀장이 한 명 있다: 사장이 정했으면 그 사람, 아니면 그 자리에서 종합 등급이 가장 높은
 * 사람(같으면 오래 앉은 사람, 먼저 들어온 사람). 분기와 연말마다 팀장이 자기 팀 일을 사장에게 보고한다: 돈을 굴리는 팀은 팀 손익과 손을 뒤집은 팀원, 돕는 팀은 한
 * 일(291번: 손익의 크기·폭락·태도·팀원 성적·뒤집힘 횟수·조언까지). 팀장은 보고만 하고 수치에는 손대지 않는다. DB와 시각을 모른다.
 */
class TeamEngine {

  private final CompanyEngine company;
  private final ContentCatalog content;

  TeamEngine(CompanyEngine company, ContentCatalog content) {
    this.company = company;
    this.content = content;
  }

  private RaisingContent.Teams texts() {
    return content.raising().company().teams();
  }

  /** 그 자리의 팀장. 아무도 안 앉았으면 없다. */
  Optional<Employee> leaderOf(CompanyState c, String desk) {
    List<Employee> members = c.employees.stream().filter(e -> desk.equals(e.desk)).toList();
    if (members.isEmpty()) {
      return Optional.empty();
    }
    return members.stream()
        .max(
            Comparator.comparingInt(
                    (Employee e) -> CompanyEngine.LADDER.indexOf(CompanyEngine.employeeGrade(e)))
                .thenComparingInt(e -> -e.id));
  }

  /** 팀장인가. */
  boolean leads(CompanyState c, Employee e) {
    return e.desk != null && leaderOf(c, e.desk).map(x -> x.id == e.id).orElse(false);
  }

  /** 보고자 한 줄: "반도체 데스크 팀장 박한결". */
  String head(String deskName, String name) {
    return Korean.fill(texts().head(), Map.of("desk", deskName, "name", name));
  }
}
