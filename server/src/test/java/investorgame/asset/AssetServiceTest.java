package investorgame.asset;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.TestcontainersConfiguration;
import investorgame.common.Action;
import investorgame.common.Direction;
import java.util.SplittableRandom;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** specs/asset.md 7절의 시나리오를 실제 Postgres에서 확인한다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AssetServiceTest {

  private static final String SEMI = "semiconductor";

  @Autowired AssetService assets;

  UUID gameId;
  long initialCash;

  @BeforeEach
  void setUp() {
    gameId = UUID.randomUUID();
    initialCash = assets.create(gameId, new SplittableRandom(1)).cash();
  }

  @Test
  void 같은_판으로_다시_만들면_기존_계정을_돌려준다() {
    assertThat(assets.create(gameId, new SplittableRandom(99)).cash()).isEqualTo(initialCash);
  }

  @Test
  void 매수는_현금의_30퍼센트를_쓴다() {
    TradeResult trade = assets.trade(gameId, Action.BUY, SEMI, 10, null);

    long amount = initialCash * 3000 / 10_000;
    assertThat(trade.status()).isEqualTo(TradeResult.Status.EXECUTED);
    assertThat(trade.amount()).isEqualTo(amount);
    assertThat(assets.get(gameId).cash()).isEqualTo(initialCash - amount);
    assertThat(assets.get(gameId).holdings()).containsEntry(SEMI, amount);
    assertThat(assets.totalAsset(gameId)).isEqualTo(initialCash);
  }

  @Test
  void 매도는_해당_섹터_전량이고_보유가_없으면_아무것도_하지_않는다() {
    assertThat(assets.trade(gameId, Action.SELL, SEMI, 10, null).status())
        .isEqualTo(TradeResult.Status.NOTHING_TO_SELL);

    long bought = assets.trade(gameId, Action.BUY, SEMI, 10, null).amount();
    TradeResult sell = assets.trade(gameId, Action.SELL, SEMI, 20, null);
    assertThat(sell.amount()).isEqualTo(bought);
    assertThat(assets.get(gameId).cash()).isEqualTo(initialCash);
    assertThat(assets.get(gameId).holdings()).doesNotContainKey(SEMI);
  }

  @Test
  void 관망은_아무것도_바꾸지_않는다() {
    assertThat(assets.trade(gameId, Action.HOLD, SEMI, 10, null).status())
        .isEqualTo(TradeResult.Status.HELD);
    assertThat(assets.get(gameId).cash()).isEqualTo(initialCash);
  }

  @Test
  void 주가가_오르면_보유가_늘고_손실은_운으로_줄어들_수_있다() {
    long held = assets.trade(gameId, Action.BUY, SEMI, 10, null).amount();

    PriceChangeResult up = assets.applyPriceChange(gameId, SEMI, Direction.UP, 1000, 30, 11, null);
    assertThat(up.pnl()).as("이득에는 완화 비율을 적용하지 않는다").isEqualTo(held / 10);
    assertThat(up.lossSoftened()).isFalse();

    long before = up.holdingAfter();
    PriceChangeResult softened =
        assets.applyPriceChange(gameId, SEMI, Direction.DOWN, 1000, 30, 12, null);
    assertThat(softened.pnl()).isEqualTo(-(before / 10) * 30 / 100);
    assertThat(softened.lossSoftened()).isTrue();

    PriceChangeResult full =
        assets.applyPriceChange(gameId, SEMI, Direction.DOWN, 1000, 100, 13, null);
    assertThat(full.lossSoftened()).isFalse();
  }

  @Test
  void 보유가_없으면_주가_변동이_아무것도_바꾸지_않는다() {
    PriceChangeResult result =
        assets.applyPriceChange(gameId, SEMI, Direction.DOWN, 1500, 100, 1, null);
    assertThat(result.pnl()).isZero();
    assertThat(assets.totalAsset(gameId)).isEqualTo(initialCash);
  }

  @Test
  void 다른_섹터의_보유는_영향을_받지_않는다() {
    long bio = assets.trade(gameId, Action.BUY, "bio", 10, null).amount();
    assets.trade(gameId, Action.BUY, SEMI, 11, null);
    assets.applyPriceChange(gameId, SEMI, Direction.DOWN, 1500, 100, 12, null);
    assertThat(assets.get(gameId).holdings()).containsEntry("bio", bio);
  }

  @Test
  void 월급은_같은_날_한_번만_들어온다() {
    assertThat(assets.creditSalary(gameId, 3_000_000, 30).credited()).isTrue();
    assertThat(assets.creditSalary(gameId, 3_000_000, 30).credited()).isFalse();
    assertThat(assets.get(gameId).cash()).isEqualTo(initialCash + 3_000_000);
  }
}
