package investorgame.asset;

/** 이미 입금된 날이면 credited가 false다. */
public record SalaryResult(boolean credited, long amount, long cashAfter) {}
