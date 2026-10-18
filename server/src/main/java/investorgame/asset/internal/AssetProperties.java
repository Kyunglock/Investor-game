package investorgame.asset.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param debtInterestBp 빚에 매월 붙는 이자 (만분율)
 */
@ConfigurationProperties("asset")
public record AssetProperties(InitialCash initialCash, int debtInterestBp) {

  /** 초기 현금 = [minUnit, maxUnit] 범위의 정수 × unit 원. */
  public record InitialCash(int minUnit, int maxUnit, long unit) {}
}
