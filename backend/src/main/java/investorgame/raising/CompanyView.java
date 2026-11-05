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
 * @param number 사장이 차린 몇 번째 회사인가
 * @param era 이 회사의 시대 (9.4절)
 * @param opening 회사를 차릴 때의 한 줄
 * @param owner 사장의 명성 (9.2절)
 * @param sale 지금 팔 수 있으면 매각 조건. 못 팔면 null (9.1절)
 */
public record CompanyView(
    UUID companyId,
    Status status,
    int number,
    Era era,
    String opening,
    Owner owner,
    Sale sale,
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

  /**
   * @param desk 앉은 자리 코드. 쉬면 null
   * @param overallGrade 종합 등급. SSS면 실전 경험으로 X~ZZZ까지 오른다 (2.3절)
   * @param experience 실전 경험
   * @param experienceNeeded 다음 단계까지 드는 실전 경험. SSS가 아니면 null(아직 쌓이지 않는다)
   */
  public record Employee(
      int id,
      String name,
      String overallGrade,
      Map<String, String> grades,
      String desk,
      int experience,
      Integer experienceNeeded) {}

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

  public record Era(String code, String name, String description) {}

  /**
   * @param fameGrade 사장 명성 등급 F~ZZZ
   * @param sales 판 회사 수
   * @param cofounderSlots 다음 회사에 데려갈 수 있는 공동창업자 수
   */
  public record Owner(String fameGrade, int famePoints, int sales, int cofounderSlots) {}

  /**
   * @param forced 시대가 끝나 반드시 판다. 거짓이면 시대가 끝나기 전에 스스로 파는 것이다
   * @param price 매각가(지금 자본)
   * @param fameAfter 팔면 오를 사장 명성 등급
   * @param cofounderSlots 이번에 데려갈 수 있는 공동창업자 수 (판 뒤의 명성으로)
   */
  public record Sale(
      boolean forced, String note, long price, String fameAfter, int cofounderSlots) {}
}
