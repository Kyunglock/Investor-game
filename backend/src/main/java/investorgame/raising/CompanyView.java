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
 * @param gacha 채용 뽑기: 채용권, 데리고 있는 사람, 확률표, 마지막 뽑기, 도감 (decisions.md 312번)
 * @param history 회사 연표·업적·명예의 전당 (decisions.md 263번)
 * @param broke 망한 회사의 한 줄. 자본이 0이면 있고, 그때 사재로 다음 회사를 차릴 수 있다. 아니면 null (decisions.md 247번)
 * @param invest 올해 종목 회의. 끝난 회사나 옛 회사면 null (decisions.md 229번). 직원이 물어 오기 전에는 ready가 거짓이다 (267번)
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
    Upgrade upgrade,
    int seats,
    List<Employee> employees,
    List<Desk> desks,
    Meeting meeting,
    Gacha gacha,
    History history,
    String broke,
    Invest invest,
    Quarter lastQuarter,
    Settlement lastSettlement,
    Industry industry,
    List<LockedDesk> lockedDesks,
    Mental mental,
    List<Weapon> weapons,
    Armory armory,
    List<BattleUpgrade> battleUpgrades,
    Stages stages) {

  /**
   * 업계 순위 (#351): 실제 유저 회사끼리 같은 연차의 연말 자본으로 견준다. 이름은 없다(로그인이 없는 익명 세션). 한 해도 마치지 않았으면 null.
   *
   * @param year 견준 연차(지난 연말)
   * @param rank 그 연차를 마친 회사 가운데 자리(1이 맨 위)
   * @param total 그 연차를 마친 회사 수
   */
  public record Industry(int year, int rank, int total) {}

  /**
   * 이번 분기의 멘탈 전투 (decisions.md 328번). 끝난 회사나 이 칸이 생기기 전의 분기면 null.
   *
   * @param genre ASSAULT(공격)·DEFENSE(디펜스). 그 분기 이벤트가 정한다
   * @param headline 이벤트 머리글
   * @param done 이번 분기 결과를 이미 보냈다. 참이면 다시 치르지 않는다
   */
  public record Mental(String genre, String headline, boolean done) {}

  /**
   * 무기 뽑기 (decisions.md 366번).
   *
   * @param tickets 가진 무기 뽑기권
   * @param mergeCount 합쳐 한 등급 올리는 데 드는 같은 무기 수
   * @param lastDraw 마지막으로 뽑은 무기. 뽑은 적이 없으면 null
   */
  public record Armory(int tickets, int mergeCount, WeaponDraw lastDraw) {}

  /**
   * 멘탈 스테이지 (decisions.md 369번).
   *
   * @param best 깬 최고 스테이지(0이면 아직 없다). 다음에 열리는 것은 best + 1
   * @param last 마지막 스테이지(지금은 챕터 하나라 perChapter)
   * @param perChapter 한 챕터의 스테이지 수. 챕터 마지막은 보스
   * @param stars 깬 스테이지의 별, 1번부터 차례로
   * @param bonusPercent 이번 분기 강화율(%): 깬 최고 스테이지로 매 분기 저절로 붙는다
   * @param exAvailable 이번 분기 EX 디펜스를 아직 안 했다
   * @param lastResult 마지막으로 보낸 스테이지·EX 결과와 받은 보상. 없으면 null
   */
  public record Stages(
      int best,
      int last,
      int perChapter,
      List<Integer> stars,
      int bonusPercent,
      boolean exAvailable,
      StageResult lastResult) {}

  /**
   * 스테이지·EX 한 판의 결과 (369번).
   *
   * @param stage 스테이지 번호. EX 디펜스면 0
   * @param firstClear 이 판에 처음 깼다
   * @param capital 받은 자본
   * @param tickets 받은 무기 뽑기권
   */
  public record StageResult(
      int stage, boolean cleared, int stars, boolean firstClear, long capital, int tickets) {}

  /**
   * 자본으로 사는 전투 강화 하나 (decisions.md 367·394번). 최대 단계는 없다.
   *
   * @param kind damage(공격력)·fire(연사)·hp(체력: 최대 멘탈, 410번)
   * @param level 지금 단계(0부터)
   * @param price 다음 단계 값
   * @param priceGrowthPercent 단계마다 값이 오르는 비율(%). 꾹 눌러 연속으로 올릴 때 화면이 다음 값들을 미리 셈한다(정하는 것은 서버)
   * @param bonusPercent 지금 단계의 효과(%): 공격력은 그만큼 오르고, 연사는 쏘는 빠르기가 그만큼 오르고, 체력은 최대 멘탈이 그만큼 오른다
   * @param nextBonusPercent 다음 단계의 효과(%)
   */
  public record BattleUpgrade(
      String kind,
      int level,
      long price,
      int priceGrowthPercent,
      int bonusPercent,
      int nextBonusPercent) {}

  /**
   * 뽑은 무기 하나 (366번).
   *
   * @param isNew 새로 얻었다. 이미 가진 종류·등급이면 거짓(그 무기의 수가 하나 늘어 무기 합성 재료가 된다)
   */
  public record WeaponDraw(
      String kind, String name, String grade, String gradeName, boolean isNew) {}

  /**
   * 가진 무기 하나 (decisions.md 346번). 수치는 등급을 더한 최종값: 한 판의 바탕 수치가 된다.
   *
   * @param damagePercent 탄 하나의 공격력(%). 100이 적 체력 1
   * @param fireMs 연사 간격(ms)
   * @param power 탄 강화 단계(0~3). 탄은 항상 한 줄이고, 단계가 오를수록 세고 크며 2단계부터 맞으면 주변 적도 휘말린다
   * @param bulletSpeed 탄 속도(px/s)
   * @param equipped 지금 든 무기
   * @param count 가진 수 (366번). 무기 합성 재료로 쓴다
   */
  public record Weapon(
      String kind,
      String name,
      String grade,
      String gradeName,
      int damagePercent,
      int fireMs,
      int power,
      int bulletSpeed,
      boolean equipped,
      int count) {}

  public enum Status {
    ACTIVE,
    ENDED
  }

  /**
   * @param desk 앉은 자리 코드. 쉬면 null
   * @param overallGrade 종합 등급. SSS면 실전 경험으로 X~ZZZ까지 오른다 (2.3절)
   * @param experience 실전 경험
   * @param experienceNeeded 다음 단계까지 드는 실전 경험. SSS가 아니면 null(아직 쌓이지 않는다)
   * @param effects 등급 효과 이름(A 손절·S 끌어주기·SS 방패·SSS 전설의 촉, X 이상의 확신·경보…). 쌓인다 (2.4절, decisions.md
   *     387번)
   * @param perk 등급 효과 한 줄: 이름·맞히면 버는 배수·손 뒤집힘 보정·이름 붙은 효과·자랄 확률 (decisions.md 289·387번)
   * @param sector 관심 섹터 코드. 같은 섹터 데스크에 앉으면 조금 더 번다. 없으면 null
   * @param deskYears 지금 자리에서 결산을 맞은 해 수 (decisions.md 262번)
   * @param settled 올해 결산이 같은 자리 세 해째 이상이라 손이 덜 뒤집힌다
   * @param role 앉은 자리의 직함(애널리스트·종목 발굴 담당…). 직함이 없는 자리거나 쉬면 null (decisions.md 267번)
   * @param leader 앉은 자리의 팀장이다 (decisions.md 269번)
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
      int morale,
      String quirk,
      String quirkName) {}

  /**
   * 채용 뽑기 (decisions.md 312번).
   *
   * @param tickets 가진 채용권. 한 장에 한 명
   * @param roster 데리고 있는 사람 수(쉬는 사람 포함)
   * @param rosterMax 데리고 있을 수 있는 사람 수(100명, 337번). 넘으면 내보내야 더 뽑는다
   * @param draws 지금까지 뽑은 횟수. 뽑기 요청에 싣는다
   * @param maxDraws 한 번에 뽑을 수 있는 최대 수
   * @param rates 이 회사의 확률표: 칸마다 나오는 등급과 확률. star면 특급
   * @param drawn 마지막 뽑기에서 온 사람. 분기를 넘기면 비운다
   * @param collection 도감: 등급(F~GOD)마다 뽑아서 얻은 사람 수. 다음 회사로 이어진다
   */
  public record Gacha(
      int tickets,
      int roster,
      int rosterMax,
      int draws,
      int maxDraws,
      List<Rate> rates,
      List<Drawn> drawn,
      List<CollectionEntry> collection) {}

  /** 확률표의 한 칸. */
  public record Rate(String grade, int percent, boolean star) {}

  /**
   * 뽑기로 온 사람.
   *
   * @param star 특급 칸에서 나왔다
   * @param fresh 도감에 처음 오른 등급이다
   * @param perk 짧은 등급 효과: 맞히면 버는 배수와 가장 높은 이름 붙은 효과("맞히면 13.8배 · 방패", decisions.md 387번)
   */
  public record Drawn(
      int employeeId,
      String name,
      String grade,
      boolean star,
      boolean fresh,
      String hello,
      String perk) {}

  /** 도감의 한 칸: 그 등급을 몇 명 얻었나. 0이면 아직 못 봤다. */
  public record CollectionEntry(String grade, int count) {}

  /**
   * 투자 회의 (decisions.md 229번). 정하기 전에는 숨은 방향이 없다.
   *
   * @param ready 지금 정할 수 있다(돈을 굴리는 자리에 사람이 있다)
   * @param highlightBy 형광펜을 그은 리서치 팀 직원. 없으면 null
   * @param remarks 자리에 앉은 직원의 한마디. 회의를 열기 전에는 비어 있다
   * @param convened 회의를 열어 한마디와 형광펜을 굳혔다. 그 뒤로 배치를 바꿔도 그대로다 (decisions.md 249번)
   * @param finder 이 종목을 물어 온 직원 (267번). 아직 아무도 안 가져왔거나 옛 회의면 null
   * @param outcome 정한 뒤의 결과. 아직이면 null
   * @param scouted 이번 분기에 이미 직원이 종목을 물어 왔거나, 분기 넘기기를 눌러 발굴을 굴렸다 (267·382번)
   * @param range 종목 회의 수익률이 오갈 수 있는 범위 (decisions.md 388번): −50% ~ +300%
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
      Integer teamBuy,
      Integer teamSell,
      String teamCall,
      List<DebateLine> debate,
      TeamGrade team,
      boolean scouted,
      InvestRange range) {}

  /**
   * 종목 회의 수익률의 범위 (decisions.md 388번, 만분율). 데스크 몫과 떼어 낸 회의만의 수익률이다.
   *
   * @param lossBp 틀렸을 때 가장 크게 잃는 몫(음수, −50%)
   * @param gainBp 맞혔을 때 가장 크게 버는 몫(+300%)
   */
  public record InvestRange(int lossBp, int gainBp) {}

  /**
   * 회의에 앉은 팀의 합산 등급 (decisions.md 353번): 잘하는 셋의 가중 평균(종목 회의는 안목 절반) + 리서치 팀·팀장 보너스.
   *
   * @param grade F~SSS
   * @param score 0~100
   * @param hint 한 줄 풀이("이 팀이면 기사 열에 일곱은 맞힌다")
   * @param members 앉은 사람 수
   */
  public record TeamGrade(String grade, int score, String hint, int members) {}

  /**
   * 종목을 물어 온 직원 (decisions.md 267번).
   *
   * @param role 직함. 직함이 없는 자리면 null
   * @param pitch 가져올 때 한마디
   */
  public record Finder(int employeeId, String name, String role, String desk, String pitch) {}

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
   * @param returnBp 회의 수익률(만분율, decisions.md 388번) = 회의 손익 ÷ 건 판돈. 판돈을 적기 전에 정한 옛 회의면 null
   * @param gainBp 이 종목을 맞힌 쪽으로 했으면 번 수익률(만분율)
   * @param lossBp 틀린 쪽으로 했으면 잃은 수익률(만분율, 음수, 크게 했으면 크게 틀린 몫)
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
      List<DebateLine> reactions,
      String credit,
      Integer returnBp,
      int gainBp,
      int lossBp) {}

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
      Integer crashPercent,
      String unlockGrade) {}

  /** 아직 닫힌 돕는 자리 (#393): 회사가 unlockGrade가 되면 열린다. */
  public record LockedDesk(String code, String name, String description, String unlockGrade) {}

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
      String eraEnding) {}

  public record Settlement(
      int year,
      String phase,
      String omen,
      long capitalBefore,
      long capitalAfter,
      long fee,
      long hiring,
      long moving,
      long upgrades,
      long rewards,
      SettlementInvest invest,
      List<Quarter> quarters,
      String gradeBefore,
      String gradeAfter,
      List<String> achieved,
      List<Result> results,
      List<String> lines,
      List<Report> reports,
      List<Promotion> promotions) {}

  /** 그해 종합 등급이 오른 직원 (#535). before·after는 결산 전후의 종합 등급. */
  public record Promotion(int employeeId, String name, String before, String after) {}

  /**
   * 건물 이사 (decisions.md 296번): 다음 건물로 가는 데 드는 돈. 끝 등급이면 null.
   *
   * @param to 다음 등급(건물)
   * @param cost 이사 비용(다음 띠 자본의 일부)
   * @param needed 이사하려면 있어야 하는 자본(다음 띠 + 이사 비용)
   * @param affordable 지금 자본으로 갈 수 있다
   */
  /**
   * 다음 건물 (296번). 공사 중이면(#347) to가 짓고 있는 건물이고 left가 남은 해다.
   *
   * @param years 그 건물을 짓는 데 걸리는 해. 같은 건물 안에서 책상만 늘면 0(바로 된다)
   * @param left 공사 중이면 남은 해, 아니면 null
   */
  public record Upgrade(
      String to, long cost, long needed, boolean affordable, int years, Integer left) {}

  /** 결산한 해의 투자 회의: 기사 제목과 회의 손익(이미 자본에 들어갔다). 회의를 안 했으면 결산의 invest가 null (decisions.md 240번). */
  public record SettlementInvest(String title, long total) {}

  /**
   * 분기 하나의 실적 (decisions.md 268번).
   *
   * @param staff 직원들이 이 분기에 굴린 몫
   * @param hiring 이 분기에 낸 인사 비용(계약금·새로 받기 값)
   * @param moving 이 분기에 낸 이사 비용 (296번)
   * @param upgrades 이 분기에 전투 강화에 쓴 돈 (367번)
   * @param rewards 이 분기에 스테이지 보상으로 받은 자본 (369번)
   * @param invest 이 분기 종목 회의. 안 열렸으면 null
   * @param crash 이 분기에 폭락이 터졌다
   * @param lines 분기 소식 줄(직원 소식)
   */
  public record Quarter(
      int year,
      int quarter,
      long capitalBefore,
      long capitalAfter,
      long fee,
      long staff,
      long hiring,
      long moving,
      long upgrades,
      long rewards,
      SettlementInvest invest,
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
  /** fail: 실패 업적 (351번). 열리면 채용권은 위로 보상 한 장. */
  public record Achievement(
      String code, String name, String description, Integer year, boolean fail) {}

  /**
   * @param to 떠난 해. 아직 일하면 null
   */
  public record Hall(String name, int from, Integer to, long totalPnl, String grade) {}
}
