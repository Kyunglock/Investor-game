package investorgame.asset;

/** 이미 처리된 날이면 credited가 false다. debtRepaid는 수입 중 빚 상환에 쓴 금액. */
public record IncomeResult(boolean credited, long amount, long debtRepaid, long cashAfter) {}
