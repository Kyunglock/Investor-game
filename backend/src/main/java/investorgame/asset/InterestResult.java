package investorgame.asset;

/** 빚이 없거나 같은 날 이미 붙였으면 accrued=false. */
public record InterestResult(boolean accrued, long interest, long debtAfter) {}
