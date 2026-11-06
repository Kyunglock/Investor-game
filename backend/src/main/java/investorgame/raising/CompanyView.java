package investorgame.raising;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 회사 화면의 값 (증권사 육성 설계 4·6절). 올해 시장 갈래는 숨은 값이라 조짐만 담는다. 직원 능력치는 등급만.
 *
 * @param year 지금 해(1부터). 회사는 끝나지 않고 해마다 이어진다 (decisions.md 236번)
 * @param quarter 지금 분기(1~4). 턴 하나가 한 분기다 (decisions.md 268번)
 * @param lastQuarter 올해 마지막으로 넘긴 분기의 실적. 1분기 전이면 null (268번)
 * @param grade 자본으로 매기는 회사 등급 (4.5절)
 * @param nextGradeCapital 다음 등급의 자본. 맨 위면 null
 * @param seats 앉힐 수 있는 자리 수
 * @param meeting 연초 회의. 끝난 회사면 null
 * @param applicants 올해 공채 시장의 지원자. 끝난 회사면 비어 있다 (decisions.md 228번)
 * @param refreshCost 지원자를 새로 받는 값
 * @param history 회사 연표·업적·명예의 전당 (decisions.md 263번)
 * @param refreshes 올해 지원자를 새로 받은 횟수. 새로 받기 요청에 싣는다 (decisions.md 254번)
 * @param broke 망한 회사의 한 줄. 자본이 0이거나 직원 없이 가장 싼 계약금도 못 내면 있고, 그때 사재로 다음 회사를 차릴 수 있다. 아니면 null
 *     (decisions.md 247번)
 * @param invest 올해 종목 회의. 끝난 회사나 옛 회사면 null (decisions.md 229번). 직원이 물어 오기 전에는 ready가 거짓이다 (267번)
 * @param macro 올해 거시경제 회의. 끝난 회사나 이 회의가 생기기 전의 해면 null (decisions.md 266번)
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
    int quarter,
    long capital,
    String grade,
    Long nextGradeCapital,
    int seats,
    List<Employee> employees,
    List<Desk> desks,
    Meeting meeting,
    List<Applicant> applicants,
    long refreshCost,
    int refreshes,
    History history,
    String broke,
    Invest invest,
    Macro macro,
    Quarter lastQuarter,
    Settlement lastSettlement,
    Ending ending,
    Resign resign) {

  /**
   * 연봉 때문에 사표를 들고 온 직원 (decisions.md 282번). 붙잡거나 보내지 않고 다음 분기를 넘기면 떠난다. 없으면 null.
   *
   * @param reason IGNORED(연봉 답을 기다리다 지쳤다)·FROZEN(동결에 실망했다)
   * @param before 지금 연봉
   * @param after 붙잡으면 오를 연봉
   */
  public record Resign(
      int employeeId, String name, String reason, String line, long before, long after) {}

  /**
   * 엔딩 (decisions.md 276번): 랜드마크 타워에 올랐다. 엔딩을 본 회사는 멈추고 사장이 다음 회사를 차린다. 아직이면 null.
   *
   * @param year 엔딩을 본 해(몇 년 만에 올랐나)
   */
  public record Ending(int year, long capital, String grade) {}

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
   * @param perk 등급 효과 한 줄: 이름·맞혔을 때 더 버는 몫·자랄 확률 (decisions.md 289번)
   * @param sector 관심 섹터 코드. 같은 섹터 데스크에 앉으면 조금 더 번다. 없으면 null
   * @param deskYears 지금 자리에서 결산을 맞은 해 수 (decisions.md 262번)
   * @param settled 올해 결산이 같은 자리 세 해째 이상이라 손이 덜 뒤집힌다
   * @param role 앉은 자리의 직함(애널리스트·종목 발굴 담당…). 직함이 없는 자리거나 쉬면 null (decisions.md 267번)
   * @param leader 앉은 자리의 팀장이다 (decisions.md 269번)
   * @param salary 한 해 연봉 (decisions.md 270번)
   * @param morale 사기(−2~+2). 낮으면 손이 더 뒤집힌다 (270번)
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
      String perk,
      String sector,
      String sectorName,
      int deskYears,
      boolean settled,
      String role,
      boolean leader,
      long salary,
      int morale) {}

  /**
   * 공채 시장의 지원자 한 명.
   *
   * @param fee 계약금. 뽑으면 회사 자본에서 나간다
   * @param line 카드의 한 줄(올해 필요한 인재, 사수가 붙음, 인사팀이 데려옴). 없으면 null
   * @param sector 관심 섹터 코드. 뽑으면 직원이 안고 들어온다
   * @param star 특급 인재: 아주 좋은 등급에 계약금이 아주 비싸고 곧 떠난다 (decisions.md 290번)
   * @param leavesIn 특급 인재가 머무는 남은 분기(이번 분기 포함). 보통 지원자는 0
   */
  public record Applicant(
      int id,
      String name,
      String overallGrade,
      Map<String, String> grades,
      long fee,
      String line,
      String sector,
      String sectorName,
      String perk,
      boolean star,
      int leavesIn) {}

  /**
   * 투자 회의 (decisions.md 229번). 정하기 전에는 숨은 방향이 없다.
   *
   * @param ready 지금 정할 수 있다(돈을 굴리는 자리에 사람이 있다)
   * @param highlightBy 형광펜을 그은 리서치 팀 직원. 없으면 null
   * @param remarks 자리에 앉은 직원의 한마디. 회의를 열기 전에는 비어 있다
   * @param convened 회의를 열어 한마디와 형광펜을 굳혔다. 그 뒤로 배치를 바꿔도 그대로다 (decisions.md 249번)
   * @param finder 이 종목을 물어 온 직원 (267번). 아직 아무도 안 가져왔거나 옛 회의면 null
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
      Finder finder,
      InvestOutcome outcome,
      Proposal proposal,
      Verdict verdict) {}

  /**
   * 막판 뒤집기 (decisions.md 283·290번): 결정이 다 끝났는데 누군가 반대로 하자고 나섰다. 답할 때까지 회의는 정해지지 않는다. 화면은 먼저 정해진
   * 결정(사장 결정 도장, 맡겼으면 토론과 결판)을 보이고 그 뒤에 이 제안을 띄운다.
   *
   * @param action 제안한 행동(BUY·SELL)
   * @param choice 막판 제안 전에 정해진 결정(BUY·SELL·HOLD). 맡겼으면 직원들이 정한 쪽
   * @param delegated 사장이 "너희가 알아서 해" 하고 맡겼다
   * @param debate 맡겼을 때의 토론(285번). 맡기지 않았으면 비었다
   */
  public record Proposal(
      int employeeId,
      String name,
      String action,
      String line,
      String choice,
      boolean big,
      boolean delegated,
      int teamBuy,
      int teamSell,
      List<DebateLine> debate) {}

  /**
   * 막판 제안을 따른 뒤의 상과 벌 (283번).
   *
   * @param good 따랐더니 벌었다
   * @param ask 결과 한 줄("○○의 말대로 해서 1,200만 원 벌었다!")
   * @param options 고를 것: 벌었으면 BONUS·RAISE·NOTHING, 잃었으면 CUT·FORGIVE. 이미 골랐으면 비었다
   * @param result 고른 뒤의 한 줄. 아직이면 null
   */
  public record Verdict(
      int employeeId, String name, boolean good, String ask, List<Option> options, String result) {}

  /**
   * 종목을 물어 온 직원 (decisions.md 267번).
   *
   * @param role 직함. 직함이 없는 자리면 null
   * @param pitch 가져올 때 한마디
   */
  public record Finder(int employeeId, String name, String role, String desk, String pitch) {}

  /**
   * 거시경제 회의 (decisions.md 266번). 고르기 전에는 숨은 방향이 없다.
   *
   * @param topic 주제 이름(기준금리·환율…)
   * @param remarks 자리에 앉은 직원의 한마디. 회의를 열기 전에는 비어 있다. read UP은 공격, DOWN은 방어 쪽
   * @param stances 고를 수 있는 태도와 그해 판돈 비율
   * @param ready 지금 고를 수 있다(돈을 굴리는 자리에 사람이 있고 아직 안 골랐다)
   * @param outcome 고른 뒤. 아직이면 null
   */
  public record Macro(
      String topic,
      String title,
      List<MacroSentence> sentences,
      String highlightBy,
      List<Remark> remarks,
      List<Stance> stances,
      boolean ready,
      boolean convened,
      MacroOutcome outcome) {}

  /** omen: 연초 회의의 폭락 조짐을 옮긴 문장(헛조짐일 수도 있다). */
  public record MacroSentence(String text, boolean highlighted, boolean omen) {}

  /** stakePercent: 그해 결산 판돈 비율(%). */
  public record Stance(String code, String label, String note, int stakePercent) {}

  /**
   * @param stance 고른 태도
   * @param finder 회의가 끝나고 종목을 물어 온 직원. 아무도 안 왔으면 null
   * @param none 아무도 안 왔을 때 한 줄. 왔으면 null
   */
  public record MacroOutcome(String stance, Finder finder, String none) {}

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
   * 맡긴 회의의 토론 한 줄 (decisions.md 285번).
   *
   * @param side BUY(매수파)·SELL(매도파)
   * @param last 결판의 세 박자(표결·선언·승복)면 참 (295번)
   * @param kind TALK(토론) · TALLY(사회가 표결을 부름) · WIN(이긴 쪽 선언) · LOSE(진 쪽 승복)
   */
  public record DebateLine(String name, String side, String text, boolean last, String kind) {}

  /**
   * @param decisive 결정적 문장의 번호(sentences 안)
   * @param total 회의 손익. 이미 자본에 들어갔다
   */
  /**
   * @param big 크게 했다: 판돈 두 배, 고집 1.5배 (decisions.md 260번)
   * @param missed 지켜봤을 때 맞는 쪽으로 했으면 벌었을 돈. 지켜보지 않았으면 null
   */
  /**
   * @param delegated 사장이 "너희가 알아서 해" 하고 맡겼다(decisions.md 279번). choice는 직원들이 정한 쪽
   * @param teamBuy 맡겼을 때 매수 쪽에 얹힌 무게(직원 안목). 맡기지 않았으면 0
   * @param teamSell 매도 쪽 무게
   * @param debate 맡겼을 때 매수파·매도파가 주고받은 말(decisions.md 285번). 맡기지 않았으면 비었다
   */
  public record InvestOutcome(
      String choice,
      boolean big,
      boolean delegated,
      int teamBuy,
      int teamSell,
      List<DebateLine> debate,
      Long missed,
      boolean up,
      String reveal,
      int decisive,
      long total,
      List<InvestResult> results,
      String credit) {}

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
  /**
   * 자리 하나 (4.2절). 돈을 굴리는 자리면 예상 효과가 실린다 (decisions.md 259번).
   *
   * @param gainBp 맞혔을 때 버는 몫(만분율, 시대 보너스 포함, 규모의 벽 전). 돈을 굴리지 않으면 null
   * @param missBp 틀렸을 때 잃는 몫(만분율). 돈을 굴리지 않으면 null
   * @param crashPercent 폭락장의 시장 손익에 곱하는 비율. 100보다 작으면 폭락장에 덜 빠진다. 돈을 굴리지 않으면 null
   */
  public record Desk(
      String code,
      String name,
      String statCode,
      boolean trades,
      String sector,
      boolean hot,
      String description,
      Integer gainBp,
      Integer missBp,
      Integer crashPercent) {}

  /**
   * @param omen 폭락 조짐(빨간 글씨). 없으면 null. 헛조짐일 수도 있다
   * @param hrCap 인사팀에 사람이 있으면 지원자 등급의 중심이 오를 수 있는 곳(인사 직원보다 두 단계 아래). 없으면 null
   * @param earlyOmen XX 경보: 내년 폭락 조짐 한 줄. 경보 직원이 없거나 조짐이 없으면 null
   * @param forecast ZZZ 선견: 내년 시장 한 줄. 선견 직원이 없으면 null
   * @param wanted 회사가 올해 필요한 인재 한 줄 (6.1절 1번)
   * @param hot 이번 시대에 뜨는 섹터 한 줄. 뜨는 섹터가 없는 시대면 null (9.4절)
   */
  /**
   * @param eraEnding 지금 시대의 마지막 해면 "내년에는 시대가 바뀐다" 한 줄. 아니면 null (decisions.md 250번)
   */
  public record Meeting(
      String hrCap,
      String omen,
      String earlyOmen,
      String forecast,
      String wanted,
      String hot,
      String eraEnding,
      Poach poach,
      Raise raise) {}

  /**
   * 올해의 연봉 협상 (decisions.md 270번).
   *
   * @param before 지금 연봉
   * @param after 올려 주면 연봉
   * @param line 연초 회의 한 줄
   * @param odds 답에 따른 확률 한 줄: 올리면 능력치 상승, 동결·무응답이면 떠남 (decisions.md 280번)
   */
  public record Raise(
      int employeeId, String name, long before, long after, String line, String odds) {}

  /**
   * 다른 증권사가 우리 직원에게 손을 뻗었다 (decisions.md 262번).
   *
   * @param rival 손을 뻗은 곳(이름 없는 다른 증권사, 288번)
   * @param transferFee 보내면 받는 이적료
   * @param line 연초 회의 한 줄
   */
  public record Poach(int employeeId, String name, String rival, long transferFee, String line) {}

  public record Settlement(
      int year,
      String phase,
      String omen,
      long capitalBefore,
      long capitalAfter,
      long fee,
      long hiring,
      long salary,
      SettlementInvest invest,
      List<Quarter> quarters,
      String gradeBefore,
      String gradeAfter,
      List<String> achieved,
      List<Result> results,
      List<String> lines,
      List<Report> reports,
      boolean finished) {}

  /** 결산한 해의 투자 회의: 기사 제목과 회의 손익(이미 자본에 들어갔다). 회의를 안 했으면 결산의 invest가 null (decisions.md 240번). */
  public record SettlementInvest(String title, long total) {}

  /**
   * 분기 하나의 실적 (decisions.md 268번).
   *
   * @param staff 직원들이 이 분기에 굴린 몫
   * @param hiring 이 분기에 낸 인사 비용(계약금·새로 받기 값 − 받은 이적료)
   * @param invest 이 분기 종목 회의. 안 열렸으면 null
   * @param topic 이 분기 거시경제 회의의 주제. 회의가 없던 분기면 null
   * @param stance 이 분기 태도. 회의가 없던 분기면 null
   * @param crash 이 분기에 폭락이 터졌다
   * @param lines 분기 소식 줄(직원 소식·섹터 바람)
   */
  public record Quarter(
      int year,
      int quarter,
      long capitalBefore,
      long capitalAfter,
      long fee,
      long staff,
      long hiring,
      long salary,
      SettlementInvest invest,
      String topic,
      String stance,
      boolean crash,
      List<String> lines,
      List<Report> reports) {}

  /**
   * 팀장 보고 한 줄 (decisions.md 269번).
   *
   * @param head 보고자: "반도체 데스크 팀장 박한결"
   * @param pnl 돈을 굴리는 팀의 손익. 돕는 팀이면 null
   */
  public record Report(
      String desk,
      String deskName,
      int leaderId,
      String leader,
      String head,
      Long pnl,
      String text) {}

  /** flips는 능력치 코드 → 그해 뒤집힌 횟수. */
  public record Result(
      int employeeId, String name, String desk, long stake, long pnl, Map<String, Integer> flips) {}

  public record Era(String code, String name, String description) {}

  /**
   * 회사 연표·업적·명예의 전당 (decisions.md 263번).
   *
   * @param timeline 큰 일, 오래된 것부터
   * @param achievements 모든 업적. 연 해가 없으면 아직 못 열었다
   * @param hall 이 회사에서 가장 많이 번 사람부터(지금 직원과 떠난 직원), 다섯까지
   */
  public record History(List<Event> timeline, List<Achievement> achievements, List<Hall> hall) {}

  /**
   * @param kind open·grow·shrink·era·overtake·rise·left·best·worst. grade는 grow·shrink의 새 등급(화면이 건물
   *     이름으로 바꾼다)
   */
  public record Event(int year, String kind, String text, String grade) {}

  /**
   * @param year 연 해. 아직이면 null
   */
  public record Achievement(String code, String name, String description, Integer year) {}

  /**
   * @param to 떠난 해. 아직 일하면 null
   */
  public record Hall(String name, int from, Integer to, long totalPnl, String grade) {}
}
