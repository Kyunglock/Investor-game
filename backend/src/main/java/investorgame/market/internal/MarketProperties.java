package investorgame.market.internal;

import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 월 단위 가격 변동 수치 (경제 개편 설계 5.3절). 체감 후 조정한다.
 *
 * @param sectorVolatilityBp 섹터 공통 월간 잡음 폭 (±)
 * @param volatilityBp 종목 변동성 등급(low/mid/high)별 월간 잡음 폭 (±)
 * @param spilloverPercent 종목 뉴스가 같은 섹터 다른 종목에 미치는 비율
 * @param minPrice 가격 바닥(원)
 * @param cycle 경기 흐름: 불안한 시기·전조·위기 (decisions.md 38번)
 */
@ConfigurationProperties("market")
public record MarketProperties(
    int sectorVolatilityBp,
    Map<String, Integer> volatilityBp,
    int spilloverPercent,
    long minPrice,
    Cycle cycle) {

  public record Range(int min, int max) {}

  /**
   * 한 판에 불안한 시기가 windows번 온다. 시기마다 먼저 silentPercent로 전조 없는 위기인지 굴리고, 아니면 전조를 omens개 흘린 뒤 결과를
   * outcomePercent(대공황·불황·조정, 나머지는 아무 일 없음)로 굴린다. 월은 판 시작(15세)부터 센다.
   *
   * @param firstMonth 위기가 시작할 수 있는 가장 이른 달
   * @param lastMonth 위기가 시작할 수 있는 가장 늦은 달
   * @param omenLeadMonths 전조가 위기 시작보다 몇 달 앞서부터 흩어지는가
   * @param silentDepressionPercent 전조 없는 위기 중 대공황 비율(나머지는 불황)
   */
  public record Cycle(
      Range windows,
      int firstMonth,
      int lastMonth,
      Range omens,
      Range omenLeadMonths,
      int silentPercent,
      int silentDepressionPercent,
      Map<String, Integer> outcomePercent,
      Map<String, Shape> shapes) {

    public Shape shapeOf(String severity) {
      Shape shape = shapes.get(severity);
      if (shape == null) {
        throw new IllegalArgumentException("위기 모양 설정이 없다: " + severity);
      }
      return shape;
    }
  }

  /** 위기의 모양. 빠지는 달 수·다달이 빠지는 폭, 회복하는 달 수·다달이 오르는 폭. */
  public record Shape(Range fallMonths, Range fallBp, Range recoveryMonths, Range recoveryBp) {}

  public int volatilityOf(String grade) {
    Integer value = volatilityBp.get(grade);
    if (value == null) {
      throw new IllegalArgumentException("변동성 등급 설정이 없다: " + grade);
    }
    return value;
  }
}
