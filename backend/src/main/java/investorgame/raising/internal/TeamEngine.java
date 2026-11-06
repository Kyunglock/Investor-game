package investorgame.raising.internal;

import investorgame.common.Korean;
import investorgame.common.StatCodes;
import investorgame.common.error.InvalidRequestException;
import investorgame.content.ContentCatalog;
import investorgame.content.RaisingContent;
import investorgame.raising.internal.CompanyState.Employee;
import investorgame.raising.internal.CompanyState.Report;
import investorgame.raising.internal.CompanyState.Result;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 팀장과 팀장 보고 (decisions.md 269번). 사람이 앉은 자리마다 팀장이 한 명 있다: 사장이 정했으면 그 사람, 아니면 그 자리에서 종합 등급이 가장 높은
 * 사람(같으면 오래 앉은 사람, 먼저 들어온 사람). 분기와 연말마다 팀장이 자기 팀 일을 사장에게 보고한다: 돈을 굴리는 팀은 팀 손익과 손을 뒤집은 팀원, 돕는 팀은 한
 * 일. 팀장은 보고만 하고 수치에는 손대지 않는다. DB와 시각을 모른다.
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
    Integer chosen = c.leaders.get(desk);
    if (chosen != null) {
      Optional<Employee> named = members.stream().filter(e -> e.id == chosen).findFirst();
      if (named.isPresent()) {
        return named;
      }
    }
    return members.stream()
        .max(
            Comparator.comparingInt(
                    (Employee e) -> CompanyEngine.LADDER.indexOf(CompanyEngine.employeeGrade(e)))
                .thenComparingInt(e -> e.deskYears)
                .thenComparingInt(e -> -e.id));
  }

  /** 팀장인가. */
  boolean leads(CompanyState c, Employee e) {
    return e.desk != null && leaderOf(c, e.desk).map(x -> x.id == e.id).orElse(false);
  }

  /** 자리를 떠난 사람의 지정을 지운다. 배치가 바뀔 때마다 부른다: 돌아와도 다시 정하기 전에는 팀장이 아니다. */
  void tidy(CompanyState c) {
    c.leaders
        .entrySet()
        .removeIf(
            x ->
                c.employees.stream()
                    .noneMatch(e -> e.id == x.getValue() && x.getKey().equals(e.desk)));
  }

  /** 사장이 팀장을 정한다. 그 자리에 앉은 사람이 아니면 400. */
  void appoint(CompanyState c, String desk, int employeeId) {
    Employee e =
        c.employees.stream()
            .filter(x -> x.id == employeeId && desk.equals(x.desk))
            .findFirst()
            .orElseThrow(() -> new InvalidRequestException("그 자리에 앉은 직원이 아니다"));
    c.leaders.put(desk, e.id);
  }

  /**
   * 팀장 보고 (269번). 자리 순서대로 사람이 앉은 자리마다 한 줄. results는 그 기간에 돈을 굴린 결과(분기 또는 한 해), period는 "이번
   * 분기"·"올해". 결과가 있는 사람은 지금 자리가 아니라 그 결과의 자리로 묶는다.
   */
  List<Report> reports(CompanyState c, List<Result> results, String period, int seed) {
    RaisingContent.Teams texts = texts();
    Map<String, List<Result>> byDesk = new HashMap<>();
    results.forEach(r -> byDesk.computeIfAbsent(r.desk, d -> new ArrayList<>()).add(r));
    int swayed =
        (int)
            results.stream().filter(r -> r.flips.getOrDefault(StatCodes.CONVICTION, 0) > 0).count();
    List<Report> reports = new ArrayList<>();
    for (RaisingContent.Desk desk : company.desks()) {
      Optional<Employee> leader = leaderOf(c, desk.code());
      List<Result> team = byDesk.getOrDefault(desk.code(), List.of());
      if (leader.isEmpty() || (desk.trades() && team.isEmpty())) {
        continue;
      }
      Employee head = leader.get();
      Report report = new Report();
      report.desk = desk.code();
      report.leaderId = head.id;
      report.leader = head.name;
      String text;
      if (desk.trades()) {
        long pnl = team.stream().mapToLong(r -> r.pnl).sum();
        report.pnl = pnl;
        String mood = pnl > 0 ? "up" : pnl < 0 ? "down" : "flat";
        List<String> lines = texts.trading().get(mood);
        text =
            Korean.fill(
                lines.get(Math.floorMod(seed + head.id, lines.size())),
                Map.of("period", period, "pnl", CompanyEngine.won(Math.abs(pnl))));
        StringBuilder more = new StringBuilder(text);
        for (Result r : team) {
          r.flips.keySet().stream()
              .findFirst()
              .ifPresent(
                  stat ->
                      more.append(' ')
                          .append(
                              r.employeeId == head.id
                                  ? texts.selfFlips().get(stat)
                                  : Korean.fill(texts.flips().get(stat), Map.of("name", r.name))));
        }
        text = more.toString();
      } else {
        text =
            Korean.fill(
                texts.support().get(desk.code()),
                Map.of("period", period, "swayed", String.valueOf(swayed)));
      }
      report.text = text;
      reports.add(report);
    }
    return reports;
  }

  /** 보고자 한 줄: "반도체 데스크 팀장 박한결". */
  String head(String deskName, String name) {
    return Korean.fill(texts().head(), Map.of("desk", deskName, "name", name));
  }
}
