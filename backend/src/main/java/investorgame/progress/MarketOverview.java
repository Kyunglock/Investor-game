package investorgame.progress;

import java.util.List;

/**
 * 시황 (매매창 설계 2.2절): 거시 지표, 경제 신문, 안목 해석.
 *
 * @param indicators 지표 순서는 고정이다: 종합주가지수, 주담대 금리, 서울·경기 아파트, 물가, 환율, 가계부채 증가율, 투자 심리, 거래대금
 * @param newspaper 전조·헛소문·평범한 기사·위기 회고를 구분 없이 날짜순으로. 최근 것이 뒤다
 */
public record MarketOverview(
    int month, List<Indicator> indicators, List<NewsItem> newspaper, Analysis analysis) {

  /**
   * @param unit 값의 단위. index(판 시작 = 1000), bp(연 만분율), won(원), score(0~100), ratio(평소 = 10000)
   * @param yearAgo 12달 전 값. 이력이 짧으면 가장 오래된 값
   * @param points 최근 5년(60달)
   */
  public record Indicator(
      String code, String name, String unit, long value, long yearAgo, List<Point> points) {}

  public record Point(int month, long value) {}

  /** kind: OMEN(전조·헛소문), ARTICLE(평범한 기사), CRISIS(위기 회고). 화면은 종류를 구분해 보여 주지 않는다. */
  public record NewsItem(int day, String kind, String text) {}
}
