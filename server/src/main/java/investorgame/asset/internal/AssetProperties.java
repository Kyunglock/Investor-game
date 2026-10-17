package investorgame.asset.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param buyRatioBp 매수 시 현금 사용 비율 (만분율)
 * @param minTrade 최소 거래 금액(원)
 */
@ConfigurationProperties("asset")
public record AssetProperties(InitialCash initialCash, int buyRatioBp, long minTrade) {

  /** 초기 현금 = [minUnit, maxUnit] 범위의 정수 × unit 원. */
  public record InitialCash(int minUnit, int maxUnit, long unit) {}
}
