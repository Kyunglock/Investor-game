package investorgame.asset.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param debtAnnualInterestBp 빚의 연이자 (만분율). 매월 1/12씩 붙는다 (decisions.md 72번)
 */
@ConfigurationProperties("asset")
public record AssetProperties(InitialCash initialCash, int debtAnnualInterestBp) {

  /** 초기 현금 = [minUnit, maxUnit] 범위의 정수 × unit 원. */
  public record InitialCash(int minUnit, int maxUnit, long unit) {}
}
