package investorgame.progress;

import java.util.List;

/** 한 종목의 월별 가격 이력. 시장 패널의 차트용. */
public record StockHistory(String stockCode, List<Point> points) {

  public record Point(int month, long price) {}
}
