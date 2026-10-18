package investorgame.market;

/** 월별 이력 한 점. month는 0(판 시작)부터. */
public record PricePoint(int month, long price) {}
