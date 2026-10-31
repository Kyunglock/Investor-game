package investorgame.asset;

/**
 * 한 판 동안의 주식 매매 누계 (원). 투자 손익 = sold − bought + 남은 평가액이다. 월급이 많은 직업일수록 최종 자산이 커지므로 투자 성과는 이것으로 따로
 * 본다.
 */
public record StockTotals(long bought, long sold) {}
