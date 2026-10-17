package investorgame.asset;

import investorgame.common.Action;

/** amount는 거래된 금액(원)이며 실행되지 않으면 0이다. */
public record TradeResult(Status status, Action action, long amount, long cashAfter) {

  public enum Status {
    EXECUTED,
    HELD,
    NOTHING_TO_SELL,
    INSUFFICIENT_CASH
  }
}
