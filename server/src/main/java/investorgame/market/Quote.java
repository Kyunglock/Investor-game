package investorgame.market;

import java.util.List;

/**
 * 한 종목의 시세. 이력이 짧으면 priceMonthAgo·priceYearAgo는 있는 가장 오래된 값이다.
 *
 * @param last12 최근 12달의 가격(이번 달 포함). 가장 오래된 것부터. 이력이 짧으면 있는 만큼
 */
public record Quote(
    String stockCode, long price, long priceMonthAgo, long priceYearAgo, List<Long> last12) {}
