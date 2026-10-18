package investorgame.progress;

import java.util.List;

/** 선택(또는 자유 매매) 직후의 판 상태와 결과. 결과 화면에서 "선택 → 실제 행동 + 원인"을 보여 준다 (prd.md F6). */
public record ChoiceOutcome(GameView game, Outcome outcome) {

  /**
   * kind: JOB, TRAIT, OFFER, LIFE, NEWS, TRADE. 뉴스·매매가 아니면 actual은 chosen과 같고 trade, price는 null이다.
   * 해결된 뒤에는 주가의 실제 방향을 보여 줘도 된다.
   *
   * @param message 직업 확정, 성향 확정, 투자 시작, 결혼처럼 뉴스가 아닌 결과의 설명
   */
  public record Outcome(
      String kind,
      String chosen,
      String actual,
      List<DeviationView> deviations,
      Trade trade,
      Price price,
      List<Growth> growth,
      String message) {}

  /** source: 줏대 이탈의 꼬드김 출처 코드(youtuber, friend, …). 다른 이탈이면 null */
  public record DeviationView(String statCode, String from, String to, String source) {}

  /** status: EXECUTED, HELD, NOTHING_TO_SELL, INSUFFICIENT_CASH. realizedPnl은 매도일 때만. */
  public record Trade(String status, long quantity, long price, long amount, Long realizedPnl) {}

  /**
   * direction: UP 또는 DOWN. changeBp는 대상 종목에 적용된 변동 폭(만분율). pnl은 이번 충격으로 바뀐 내 보유 평가액(원). stockCode는
   * 매매 대상 종목.
   */
  public record Price(
      String sectorCode,
      String sectorName,
      String stockCode,
      String stockName,
      String direction,
      int changeBp,
      long pnl,
      boolean lossSoftened) {}

  /** reason: DEVIATION(이탈 경험) 또는 TRAIT(성장기의 선택). */
  public record Growth(String statCode, int before, int after, String reason) {}
}
