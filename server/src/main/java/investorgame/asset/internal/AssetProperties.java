package investorgame.asset.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("asset")
public record AssetProperties(InitialCash initialCash) {

  /** 초기 현금 = [minUnit, maxUnit] 범위의 정수 × unit 원. */
  public record InitialCash(int minUnit, int maxUnit, long unit) {}
}
