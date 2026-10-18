package investorgame.progress;

import investorgame.common.Phase;
import investorgame.common.Stats;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 화면에 보여도 되는 값만 담는다. 시드, 숨은 방향, 확률, 다음 달 변동은 없다. API 응답으로 그대로 나간다 (contracts/openapi/game.yaml의
 * Game).
 *
 * @param day 서버가 마지막으로 확인한 게임 일수
 * @param initialStats 태어날 때의 능력치. 별명은 이 값으로 정해서 게임 중에 바뀌지 않는다
 * @param totalAsset 현금 + 보유 평가액 − 빚
 * @param lastMonthTotalAsset 전월 말 총자산. 첫 달이면 null
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
    Named investmentStyle,
    Named riskProfile,
    Named mindProfile,
    Named interestSector,
    InvestorType investorType,
    Market market,
    Household household,
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

  public record Job(String code, String title, long monthlySalary) {}

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

  /** 가계부. 금액은 이번 달 기준. */
  public record Household(
      boolean married,
      Integer marriedAge,
      List<Child> children,
      long monthlyIncome,
      long spouseIncome,
      long monthlyExpense,
      boolean retired) {}

  public record Child(int age) {}

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

  public record Option(String code, String label) {}

  /**
   * 인생 기록 한 줄. kind: BIRTH, TRAIT, JOB, STYLE, OFFER, NEWS, PRICE, GROWTH, TRADE, LIFE, MARRIAGE,
   * CHILD, RETIRE, END. 문구는 클라이언트가 만든다.
   */
  public record LogEntry(long seq, int day, String kind, Map<String, Object> payload) {}

  /** 한 해를 마친 시점의 자산. */
  public record Yearly(int age, long totalAsset, long cash) {}

  /** returnBp는 수익률(만분율). deviationCounts는 능력치별 이탈 횟수(뉴스 + 자유 매매). */
  public record Result(
      long initialAsset,
      long finalAsset,
      int returnBp,
      int finalAge,
      Map<String, Integer> deviationCounts) {}
}
