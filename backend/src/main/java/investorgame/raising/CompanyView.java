package investorgame.raising;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 회사 화면의 값 (증권사 육성 설계 4·6절). 올해 시장 갈래는 숨은 값이라 조짐만 담는다. 직원 능력치는 등급만.
 *
 * @param year 지금 해(1부터). 끝났으면 turns + 1
 * @param grade 자본으로 매기는 회사 등급 (4.5절)
 * @param nextGradeCapital 다음 등급의 자본. 맨 위면 null
 * @param seats 앉힐 수 있는 자리 수
 * @param meeting 연초 회의. 끝난 회사면 null
 * @param lastSettlement 지난 결산. 아직 없으면 null
 */
public record CompanyView(
    UUID companyId,
    Status status,
    int year,
    int turns,
    long capital,
    String grade,
    Long nextGradeCapital,
    int seats,
    List<Employee> employees,
    List<Desk> desks,
    Meeting meeting,
    Settlement lastSettlement) {

  public enum Status {
    ACTIVE,
    ENDED
  }

  /** desk는 앉은 자리 코드. 쉬면 null. */
  public record Employee(
      int id, String name, String overallGrade, Map<String, String> grades, String desk) {}

  public record Desk(
      String code, String name, String statCode, boolean trades, String description) {}

  /**
   * @param omen 폭락 조짐(빨간 글씨). 없으면 null. 헛조짐일 수도 있다
   * @param wanted 회사가 올해 필요한 인재 한 줄 (6.1절 1번)
   * @param recruitFund 공채 육성에 회사가 내주는 운용금 (6.5절)
   * @param recruitOpen 올해 공채 육성을 아직 안 했다
   * @param pendingRunId 끝났지만 등록을 정하지 않은 공채 판. 없으면 null
   */
  public record Meeting(
      String omen, String wanted, long recruitFund, boolean recruitOpen, UUID pendingRunId) {}

  public record Settlement(
      int year,
      String phase,
      String omen,
      long capitalBefore,
      long capitalAfter,
      long fee,
      String gradeBefore,
      String gradeAfter,
      List<Result> results,
      List<String> lines) {}

  /** flips는 능력치 코드 → 그해 뒤집힌 횟수. */
  public record Result(
      int employeeId, String name, String desk, long stake, long pnl, Map<String, Integer> flips) {}
}
