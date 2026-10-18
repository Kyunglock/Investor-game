package investorgame.content;

/**
 * 종목 (경제 개편 설계 5.2절). 이름은 실제 상호가 아닌 패러디다.
 *
 * @param basePrice 판 시작 시 가격(원)
 * @param driftBpPerYear 기대 연간 상승률(만분율). 달마다 1/12씩 더한다
 * @param volatility 월간 잡음 폭 등급: low, mid, high. 등급별 수치는 시장 설정이 정한다
 */
public record StockDefinition(
    String code,
    String sector,
    String name,
    long basePrice,
    int driftBpPerYear,
    String volatility) {}
