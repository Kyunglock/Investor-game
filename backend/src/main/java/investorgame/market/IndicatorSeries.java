package investorgame.market;

import java.util.List;

/**
 * 거시 지표 하나의 월별 이력 (매매창 설계 3.1절). code는 fx(원/달러), debt(가계부채 증가율, 연 만분율), sentiment(투자 심리 0~100),
 * turnover(거래대금, 평소 = 10000). 표시만 하고 가격에는 영향이 없다.
 */
public record IndicatorSeries(String code, List<PricePoint> points) {}
