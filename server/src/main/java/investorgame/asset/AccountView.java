package investorgame.asset;

import java.util.Map;
import java.util.UUID;

/** 금액은 원 단위. holdings는 종목 코드별 수량과 원가 합이다. 평가액은 가격을 아는 진행이 계산한다. */
public record AccountView(
    UUID gameId, long cash, long initialCash, long debt, Map<String, Holding> holdings) {

  /** costBasis는 매수 총액 누계(매도 시 비례 차감). 평단 = costBasis / quantity. */
  public record Holding(long quantity, long costBasis) {

    public long avgCost() {
      return quantity == 0 ? 0 : costBasis / quantity;
    }
  }
}
