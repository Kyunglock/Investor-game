package investorgame.asset;

/** fromCash + toDebt = 지출 금액. 이미 처리된 날(EXPENSE)이면 spent=false이고 금액은 0. */
public record SpendResult(
    boolean spent, long fromCash, long toDebt, long cashAfter, long debtAfter) {}
