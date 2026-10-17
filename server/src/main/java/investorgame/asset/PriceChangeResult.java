package investorgame.asset;

/** pnl은 이번 변동의 손익(원). 보유가 없으면 0. lossSoftened는 운으로 손실이 줄었는가. */
public record PriceChangeResult(long pnl, boolean lossSoftened, long holdingAfter) {}
