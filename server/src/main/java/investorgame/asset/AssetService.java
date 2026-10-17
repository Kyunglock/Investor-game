package investorgame.asset;

import investorgame.common.Action;
import investorgame.common.Direction;
import java.util.UUID;
import java.util.random.RandomGenerator;

/** 자산 도메인의 입구 (specs/asset.md). 직업도 능력치도 모른다. 필요한 값은 모두 인자로 받는다. */
public interface AssetService {

  /** 판 시작 시 계정을 만들고 초기 현금을 랜덤으로 정한다. 같은 gameId로 다시 부르면 기존 계정을 돌려준다. */
  AccountView create(UUID gameId, RandomGenerator rng);

  AccountView get(UUID gameId);

  /** 실제 행동을 반영한다. 매수는 현금의 일정 비율, 매도는 해당 섹터 전량이다. */
  TradeResult trade(UUID gameId, Action action, String sectorCode, int gameDay, UUID eventId);

  /** 뉴스의 숨은 방향·폭을 해당 섹터 보유에 반영한다. 손실이면 lossFactorPercent를 곱한다. */
  PriceChangeResult applyPriceChange(
      UUID gameId,
      String sectorCode,
      Direction direction,
      int magnitudeBp,
      int lossFactorPercent,
      int gameDay,
      UUID eventId);

  /** 월급을 입금한다. 같은 (gameId, gameDay)로 다시 부르면 중복 입금하지 않는다. */
  SalaryResult creditSalary(UUID gameId, long amount, int gameDay);

  /** 현금과 보유 평가액의 합. */
  long totalAsset(UUID gameId);
}
