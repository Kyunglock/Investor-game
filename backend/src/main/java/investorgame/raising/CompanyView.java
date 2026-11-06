package investorgame.raising;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 회사 화면의 값 (증권사 육성 설계 4·6절). 올해 시장 갈래는 숨은 값이라 조짐만 담는다. 직원 능력치는 등급만.
 *
 * @param year 지금 해(1부터). 회사는 끝나지 않고 해마다 이어진다 (decisions.md 236번)
 * @param grade 자본으로 매기는 회사 등급 (4.5절)
 * @param nextGradeCapital 다음 등급의 자본. 맨 위면 null
 * @param seats 앉힐 수 있는 자리 수
 * @param meeting 연초 회의. 끝난 회사면 null
 * @param applicants 올해 공채 시장의 지원자. 끝난 회사면 비어 있다 (decisions.md 228번)
 * @param refreshCost 지원자를 새로 받는 값
 * @param broke 망한 회사의 한 줄. 자본이 0이거나 직원 없이 가장 싼 계약금도 못 내면 있고, 그때 사재로 다음 회사를 차릴 수 있다. 아니면 null
 *     (decisions.md 246번)
 * @param invest 올해 투자 회의. 끝난 회사나 옛 회사면 null (decisions.md 229번)
 * @param lastSettlement 지난 결산. 아직 없으면 null
 * @param number 사장이 차린 몇 번째 회사인가
 * @param era 이 회사의 시대 (9.4절)
 * @param opening 회사를 차릴 때의 한 줄
 */
public record CompanyView(
    UUID companyId,
    Status status,
    int number,
    Era era,
    String opening,
    int year,
    long capital,
    String grade,
    Long nextGradeCapital,
    int seats,
    List<Employee> employees,
    List<Desk> desks,
    Meeting meeting,
    List<Applicant> applicants,
    long refreshCost,
    String broke,
    Invest invest,
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
   * @param effects X 이상 등급의 효과 이름(확신·경보…). 쌓인다 (2.4절)
   * @param sector 관심 섹터 코드. 같은 섹터 데스크에 앉으면 조금 더 번다. 없으면 null
   */
  public record Employee(
      int id,
      String name,
      String overallGrade,
      Map<String, String> grades,
      String desk,
      int experience,
      Integer experienceNeeded,
      List<String> effects,
      String sector,
      String sectorName) {}

  /**
   * 공채 시장의 지원자 한 명.
   *
   * @param fee 계약금. 뽑으면 회사 자본에서 나간다
   * @param line 카드의 한 줄(올해 필요한 인재, 사수가 붙음, 인사팀이 데려옴). 없으면 null
   * @param sector 관심 섹터 코드. 뽑으면 직원이 안고 들어온다
   */
  public record Applicant(
      int id,
      String name,
      String overallGrade,
      Map<String, String> grades,
      long fee,
      String line,
      String sector,
      String sectorName) {}

  /**
   * 투자 회의 (decisions.md 229번). 정하기 전에는 숨은 방향이 없다.
   *
   * @param ready 지금 정할 수 있다(돈을 굴리는 자리에 사람이 있다)
   * @param highlightBy 형광펜을 그은 리서치 팀 직원. 없으면 null
   * @param remarks 자리에 앉은 직원의 한마디. 회의를 열기 전에는 비어 있다
   * @param convened 회의를 열어 한마디와 형광펜을 굳혔다. 그 뒤로 배치를 바꿔도 그대로다 (decisions.md 248번)
   * @param outcome 정한 뒤의 결과. 아직이면 null
   */
  public record Invest(
      String title,
      String stockName,
      String sectorName,
      List<InvestSentence> sentences,
      String highlightBy,
      Sway sway,
      List<Remark> remarks,
      List<Option> options,
      boolean ready,
      boolean convened,
      InvestOutcome outcome) {}

  public record InvestSentence(String text, boolean highlighted) {}

  public record Sway(String who, String text) {}

  /**
   * @param read 기사를 읽은 쪽 UP·DOWN·NEUTRAL
   * @param stubborn 돈을 굴리는 직원이 제멋대로 할 낌새 LOW·MID·HIGH. 돈을 굴리지 않으면 null
   */
  public record Remark(
      int employeeId, String name, String desk, String read, String text, String stubborn) {}

  public record Option(String code, String label) {}

  /**
   * @param decisive 결정적 문장의 번호(sentences 안)
   * @param total 회의 손익. 이미 자본에 들어갔다
   */
  public record InvestOutcome(
      String choice,
      boolean up,
      String reveal,
      int decisive,
      long total,
      List<InvestResult> results) {}

  /**
   * follow: BOSS(사장 말대로)·OWN(제 판단대로, "제가 알아서 할게요")·SWAY(꼬드김).
   *
   * @param rival 사장 말과 맞붙은 행동(꼬드김 또는 제 판단). 맞붙을 것이 없었으면 null (decisions.md 235번)
   */
  public record InvestResult(
      int employeeId,
      String name,
      String desk,
      String action,
      String follow,
      long pnl,
      String line,
      Rival rival) {}

  /**
   * @param kind SWAY(꼬드김)·OWN(제 판단)
   * @param action 맞붙은 행동 BUY·SELL·HOLD
   * @param stat 사장 쪽을 지킨 능력치 코드
   */
  public record Rival(String kind, String action, String stat) {}

  /**
   * @param sector 섹터 데스크면 그 섹터 코드. 섹터를 가리지 않는 자리면 null
   * @param hot 이 시대에 뜨는 자리(시대 보너스가 붙는다, 9.4절)
   */
  public record Desk(
      String code,
      String name,
      String statCode,
      boolean trades,
      String sector,
      boolean hot,
      String description) {}

  /**
   * @param omen 폭락 조짐(빨간 글씨). 없으면 null. 헛조짐일 수도 있다
   * @param hrCap 인사팀에 사람이 있으면 지원자 등급의 중심이 오를 수 있는 곳(인사 직원보다 두 단계 아래). 없으면 null
   * @param earlyOmen XX 경보: 내년 폭락 조짐 한 줄. 경보 직원이 없거나 조짐이 없으면 null
   * @param forecast ZZZ 선견: 내년 시장 한 줄. 선견 직원이 없으면 null
   * @param wanted 회사가 올해 필요한 인재 한 줄 (6.1절 1번)
   * @param hot 이번 시대에 뜨는 섹터 한 줄. 뜨는 섹터가 없는 시대면 null (9.4절)
   */
  /**
   * @param eraEnding 지금 시대의 마지막 해면 "내년에는 시대가 바뀐다" 한 줄. 아니면 null (decisions.md 249번)
   */
  public record Meeting(
      String hrCap,
      String omen,
      String earlyOmen,
      String forecast,
      String wanted,
      String hot,
      String eraEnding) {}

  public record Settlement(
      int year,
      String phase,
      String omen,
      long capitalBefore,
      long capitalAfter,
      long fee,
      SettlementInvest invest,
      String gradeBefore,
      String gradeAfter,
      List<Result> results,
      List<String> lines) {}

  /** 결산한 해의 투자 회의: 기사 제목과 회의 손익(이미 자본에 들어갔다). 회의를 안 했으면 결산의 invest가 null (decisions.md 240번). */
  public record SettlementInvest(String title, long total) {}

  /** flips는 능력치 코드 → 그해 뒤집힌 횟수. */
  public record Result(
      int employeeId, String name, String desk, long stake, long pnl, Map<String, Integer> flips) {}

  public record Era(String code, String name, String description) {}
}
