package investorgame.progress;

import investorgame.common.Phase;
import investorgame.common.Sex;
import investorgame.common.Stats;
import investorgame.result.Ending;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 화면에 보여도 되는 값만 담는다. 시드, 숨은 방향, 확률, 다음 달 변동은 없다. API 응답으로 그대로 나간다 (contracts/openapi/game.yaml의
 * Game).
 *
 * @param day 서버가 마지막으로 확인한 게임 일수
 * @param sex 내 성별. 판 시드로 정해져 바뀌지 않는다 (decisions.md 69번)
 * @param happiness 행복도 0~100 (decisions.md 82번)
 * @param family 가족 점수 0~100 (decisions.md 88번)
 * @param initialStats 태어날 때의 능력치. 별명은 이 값으로 정해서 게임 중에 바뀌지 않는다
 * @param totalAsset 현금 + 보유 평가액 − 빚
 * @param lastMonthTotalAsset 전월 말 총자산. 첫 달이면 null
 * @param fullTimeInvestor 직업 대신 전업투자자를 골랐는가. 그러면 job은 언제나 null이다
 * @param nextEventDay 다음 이벤트가 생길 게임 일수. 클라이언트는 이 시각까지만 시계를 보낸다. 대기 중인 이벤트가 있거나 끝났으면 null
 */
public record GameView(
    UUID gameId,
    Status status,
    Phase phase,
    int day,
    int startAge,
    int endAge,
    int daysPerYear,
    Sex sex,
    int happiness,
    int family,
    Stats stats,
    Stats initialStats,
    long cash,
    long totalAsset,
    long initialAsset,
    long invested,
    long debt,
    Long lastMonthTotalAsset,
    List<Holding> holdings,
    Job job,
    boolean fullTimeInvestor,
    Named investmentStyle,
    Named riskProfile,
    Named mindProfile,
    Named interestSector,
    InvestorType investorType,
    Market market,
    Household household,
    Housing housing,
    PendingEvent pendingEvent,
    Integer nextEventDay,
    Result result,
    List<LogEntry> log,
    List<Yearly> yearly) {

  public enum Status {
    ACTIVE,
    ENDED
  }

  /** 보유 종목. value = quantity × price, pnl = value − 원가, pnlBp = 수익률(만분율). */
  public record Holding(
      String stockCode,
      String stockName,
      String sectorCode,
      String sectorName,
      long quantity,
      long avgCost,
      long price,
      long value,
      long pnl,
      int pnlBp) {}

  /** monthlySalary는 연차 인상과 협상·승진 인상분을 더한 지금 월급. tenureYears는 지금 직장의 연차. */
  public record Job(String code, String title, long monthlySalary, int tenureYears) {}

  public record Named(String code, String name) {}

  /** 네 축(기간·위험·소신) 조합으로 정해지는 투자자 유형. 성향이 확정되기 전에는 null이다. */
  public record InvestorType(String code, String name, String description) {}

  /** 시세. month는 게임 달 번호(판 시작 = 0). */
  public record Market(int month, List<StockQuote> stocks) {}

  public record StockQuote(
      String code,
      String name,
      String sectorCode,
      String sectorName,
      long price,
      int change1mBp,
      int change12mBp,
      List<Long> spark) {}

  /**
   * 가계부. 금액은 이번 달 기준. pension은 은퇴 뒤 매달 들어오는 연금, 은퇴 전 0. spouse는 미혼이거나 옛 판이면 null. pocketMoney는 일을
   * 시작하기 전 매달 들어오는 아르바이트 돈, 20세 전이거나 일을 시작했으면 null (decisions.md 96·98번).
   */
  public record Household(
      boolean married,
      Integer marriedAge,
      List<Child> children,
      long monthlyIncome,
      long spouseIncome,
      long monthlyExpense,
      boolean retired,
      long pension,
      Spouse spouse,
      PocketMoney pocketMoney) {}

  /** 일을 시작하기 전의 돈줄: "편의점 아르바이트" 등 (decisions.md 96번). */
  public record PocketMoney(String label, long monthly) {}

  /** 배우자 소개 (decisions.md 77번). */
  public record Spouse(String job, String intro) {}

  /** leftHome: 독립해서 집을 나갔다 (decisions.md 68번). 그 뒤로는 양육비가 들지 않고 수첩 사진에도 없다. sex는 태어날 때 정해진 성별. */
  public record Child(int age, boolean leftHome, Sex sex) {}

  /** kind: JOB, TRAIT, OFFER, LIFE, NEWS. 뉴스가 아니면 sector, stock, hint, sway, spark는 null이다. */
  public record PendingEvent(
      UUID eventId,
      String kind,
      int occursDay,
      String sectorCode,
      String sectorName,
      String stockCode,
      String stockName,
      boolean sectorWide,
      List<Long> spark,
      String title,
      String body,
      String hint,
      String sway,
      List<Option> options) {}

  /**
   * @param detail 이 선택에 드는 돈(주거: 필요한 현금·대출·월 부담). 없으면 null
   * @param blocked 고를 수 없는 이유(주거: 현금 부족·DSR 초과). 고를 수 있으면 null
   */
  public record Option(String code, String label, String detail, String blocked) {}

  /**
   * 주거 (주거 설계). totalAsset에는 집 시세 + 보증금 − 주담대 − 전세대출 − 세입자 보증금이 들어간다.
   *
   * @param tenure PARENTS, MONTHLY, VILLA_JEONSE, APT_JEONSE, OWN
   * @param leaseEndAge 세 만기 나이. 세입자가 아니면 null
   * @param mortgageRateBp 지금 주담대 금리(연)
   * @param monthlyCost 지금 한 달 주거비(월세 + 주담대 원리금 + 전세대출 이자 + 보증료)
   */
  public record Housing(
      String tenure,
      String regionName,
      long deposit,
      long monthlyRent,
      long jeonseLoan,
      boolean insured,
      Integer leaseEndAge,
      int mortgageRateBp,
      long monthlyCost,
      List<Home> homes,
      List<HomeQuote> quotes,
      String roomsName,
      boolean cramped) {}

  /** 가진 아파트. price는 지금 시세. residence가 아니면 세입자가 사는 갭투자 집이다. listed면 매수자를 기다리는 중이다. */
  public record Home(
      int seq,
      String regionName,
      long price,
      long purchasePrice,
      long mortgage,
      long monthlyPayment,
      boolean residence,
      long tenantDeposit,
      boolean listed) {}

  public record HomeQuote(
      String region, String name, long price, int change12mBp, List<Long> last12) {}

  /**
   * 인생 기록 한 줄. kind: BIRTH, TRAIT, JOB, STYLE, OFFER, NEWS, PRICE, GROWTH, TRADE, LIFE, MARRIAGE,
   * CHILD, RETIRE, END. 문구는 클라이언트가 만든다.
   */
  public record LogEntry(long seq, int day, String kind, Map<String, Object> payload) {}

  /** 한 해를 마친 시점의 자산. */
  public record Yearly(int age, long totalAsset, long cash) {}

  /**
   * returnBp는 수익률(만분율). deviationCounts는 능력치별 이탈 횟수(뉴스 + 자유 매매). ending이 BANKRUPT면 finalAge는 파산한
   * 나이다.
   */
  public record Result(
      long initialAsset,
      long finalAsset,
      int returnBp,
      int finalAge,
      Ending ending,
      Map<String, Integer> deviationCounts) {}
}
