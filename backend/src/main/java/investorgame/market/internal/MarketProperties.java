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
 */
@ConfigurationProperties("market")
public record MarketProperties(
    int sectorVolatilityBp,
    Map<String, Integer> volatilityBp,
    int spilloverPercent,
    long minPrice) {

  public int volatilityOf(String grade) {
    Integer value = volatilityBp.get(grade);
    if (value == null) {
      throw new IllegalArgumentException("변동성 등급 설정이 없다: " + grade);
    }
    return value;
  }
}
