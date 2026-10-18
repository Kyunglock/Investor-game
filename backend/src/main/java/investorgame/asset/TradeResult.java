package investorgame.asset;

/**
 * 매매 결과. 실행되지 않으면 quantity·amount·realizedPnl은 0이다.
 *
 * @param realizedPnl 매도 금액 − 차감한 원가. 매수면 0
 */
public record TradeResult(
    Status status, long quantity, long price, long amount, long realizedPnl, long cashAfter) {

  public enum Status {
    EXECUTED,
    NOTHING_TO_SELL,
    INSUFFICIENT_CASH
  }
}
