package investorgame.asset;

import java.util.Map;
import java.util.UUID;
import java.util.random.RandomGenerator;

/**
 * 자산 도메인의 입구 (specs/asset.md, 경제 개편 설계 6절). 현금·종목 수량·원가·빚을 소유한다. 가격은 모르므로 진행이 시장에서 읽어 인자로 넘긴다. 직업도
 * 능력치도 모른다.
 */
public interface AssetService {

  /** 판 시작 시 계정을 만들고 초기 현금을 랜덤으로 정한다. 같은 gameId로 다시 부르면 기존 계정을 돌려준다. */
  AccountView create(UUID gameId, RandomGenerator rng);

  AccountView get(UUID gameId);

  /** 수량 × 가격을 현금에서 빼고 보유를 늘린다. 현금이 모자라면 부분 체결 없이 INSUFFICIENT_CASH. 수량이 1 미만이면 오류. */
  TradeResult buy(
      UUID gameId, String stockCode, long quantity, long price, int gameDay, UUID eventId);

  /** 수량만큼 팔아 현금에 더하고(빚이 있으면 먼저 갚는다) 원가를 비례 차감한다. 보유보다 많으면 전량, 보유가 없으면 NOTHING_TO_SELL. */
  TradeResult sell(
      UUID gameId, String stockCode, long quantity, long price, int gameDay, UUID eventId);

  /**
   * 수입. 빚이 있으면 먼저 갚고 남는 만큼 현금이 된다. 같은 (gameId, gameDay, kind)는 한 번만 (SALARY, SPOUSE_INCOME,
   * SEVERANCE).
   */
  IncomeResult credit(UUID gameId, String kind, long amount, int gameDay);

  /** 지출. 현금이 모자라면 모자란 만큼 빚이 된다. kind가 EXPENSE이면 같은 날 한 번만, LIFE_COST는 여러 번 가능. */
  SpendResult spend(UUID gameId, String kind, long amount, int gameDay, UUID eventId);

  /** 대출. 현금과 빚이 amount만큼 함께 늘어난다(빚투). 빚에는 다달이 이자가 붙고 수입이 들어오면 먼저 갚는다. amount가 1 미만이면 오류. */
  void borrow(UUID gameId, long amount, int gameDay, UUID eventId);

  /** 빚에 월 이자를 붙인다. 빚이 없거나 같은 날 이미 붙였으면 accrued=false. */
  InterestResult accrueInterest(UUID gameId, int gameDay);

  /** Σ 수량 × 가격. 가격 맵에 없는 종목은 0으로 친다. */
  long holdingsValue(UUID gameId, Map<String, Long> prices);

  /** 현금 + 평가액 − 빚. */
  long totalAsset(UUID gameId, Map<String, Long> prices);

  /** 체결된 매수·매도 금액의 누계. 매매가 없으면 모두 0. */
  StockTotals stockTotals(UUID gameId);
}
