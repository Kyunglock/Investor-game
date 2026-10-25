package investorgame.asset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.TestcontainersConfiguration;
import investorgame.common.error.InvalidRequestException;
import java.util.Map;
import java.util.SplittableRandom;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** 경제 개편 설계 6절(수량 보유, 자유 매매, 빚)의 규칙을 실제 Postgres에서 확인한다. 가격은 인자로 받는다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AssetServiceTest {

  private static final String SSJ = "ssj";
  private static final String SALARY = "SALARY";
  private static final String EXPENSE = "EXPENSE";
  private static final String LIFE_COST = "LIFE_COST";

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
    assertThat(assets.get(gameId).debt()).isZero();
  }

  @Test
  void 수량과_가격으로_사면_현금이_줄고_원가가_쌓인다() {
    TradeResult trade = assets.buy(gameId, SSJ, 10, 72_000, 10, null);

    assertThat(trade.status()).isEqualTo(TradeResult.Status.EXECUTED);
    assertThat(trade.amount()).isEqualTo(720_000);
    assertThat(trade.quantity()).isEqualTo(10);
    assertThat(trade.price()).isEqualTo(72_000);
    assertThat(assets.get(gameId).cash()).isEqualTo(initialCash - 720_000);
    AccountView.Holding holding = assets.get(gameId).holdings().get(SSJ);
    assertThat(holding).isEqualTo(new AccountView.Holding(10, 720_000));
    assertThat(holding.avgCost()).isEqualTo(72_000);
  }

  /** 빚투 (decisions.md 39번): 대출은 현금과 빚을 함께 늘리고, 수입이 들어오면 빚부터 갚는다. */
  @Test
  void 대출하면_현금과_빚이_함께_늘고_수입이_빚부터_갚는다() {
    assets.borrow(gameId, 5_000_000, 10, null);
    assertThat(assets.get(gameId).cash()).isEqualTo(initialCash + 5_000_000);
    assertThat(assets.get(gameId).debt()).isEqualTo(5_000_000);
    assertThat(assets.totalAsset(gameId, Map.of())).as("빌린 돈은 순자산이 아니다").isEqualTo(initialCash);

    assets.credit(gameId, "SALARY", 2_000_000, 30);
    assertThat(assets.get(gameId).debt()).isEqualTo(3_000_000);

    assets.buy(gameId, SSJ, 10, 100_000, 31, null);
    assets.sell(gameId, SSJ, 10, 100_000, 32, null);
    assertThat(assets.get(gameId).debt()).as("판 돈도 빚부터 갚는다").isEqualTo(2_000_000);
    assertThatThrownBy(() -> assets.borrow(gameId, 0, 40, null))
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 현금이_모자라면_사지_않는다() {
    TradeResult trade = assets.buy(gameId, SSJ, initialCash / 1_000 + 1, 1_000, 10, null);
    assertThat(trade.status()).isEqualTo(TradeResult.Status.INSUFFICIENT_CASH);
    assertThat(assets.get(gameId).cash()).isEqualTo(initialCash);
    assertThat(assets.get(gameId).holdings()).isEmpty();
  }

  @Test
  void 수량이_너무_커서_금액이_넘치면_사지_않는다() {
    TradeResult trade = assets.buy(gameId, SSJ, Long.MAX_VALUE / 2, 72_000, 10, null);
    assertThat(trade.status()).isEqualTo(TradeResult.Status.INSUFFICIENT_CASH);
    assertThat(assets.get(gameId).cash()).isEqualTo(initialCash);
    assertThat(assets.get(gameId).holdings()).isEmpty();
  }

  @Test
  void 큰_보유의_일부_매도도_원가를_정확히_비례_차감한다() {
    // 원가 × 수량이 long을 넘는 크기. 평단 9,000,000,000원 × 2,000,000주
    long quantity = 2_000_000;
    long price = 9_000_000_000L;
    assets.credit(gameId, "WINDFALL", price * quantity, 5);
    assets.buy(gameId, SSJ, quantity, price, 10, null);

    TradeResult sell = assets.sell(gameId, SSJ, 500_000, price, 11, null);

    assertThat(sell.realizedPnl()).isZero();
    assertThat(assets.get(gameId).holdings().get(SSJ))
        .isEqualTo(new AccountView.Holding(1_500_000, price * 1_500_000));
  }

  @Test
  void 수량_0은_오류다() {
    assertThatThrownBy(() -> assets.buy(gameId, SSJ, 0, 1_000, 10, null))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> assets.sell(gameId, SSJ, 0, 1_000, 10, null))
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 일부_매도는_원가를_비례_차감하고_실현_손익을_돌려준다() {
    assets.buy(gameId, SSJ, 10, 72_000, 10, null);

    TradeResult sell = assets.sell(gameId, SSJ, 4, 80_000, 11, null);

    assertThat(sell.status()).isEqualTo(TradeResult.Status.EXECUTED);
    assertThat(sell.amount()).isEqualTo(320_000);
    assertThat(sell.realizedPnl()).isEqualTo(32_000);
    assertThat(assets.get(gameId).holdings().get(SSJ))
        .isEqualTo(new AccountView.Holding(6, 432_000));
    assertThat(assets.get(gameId).cash()).isEqualTo(initialCash - 720_000 + 320_000);
  }

  @Test
  void 보유보다_많이_팔면_전량이고_없으면_NOTHING_TO_SELL() {
    assertThat(assets.sell(gameId, SSJ, 5, 1_000, 10, null).status())
        .isEqualTo(TradeResult.Status.NOTHING_TO_SELL);

    assets.buy(gameId, SSJ, 10, 72_000, 10, null);
    TradeResult sell = assets.sell(gameId, SSJ, 999, 70_000, 11, null);
    assertThat(sell.quantity()).isEqualTo(10);
    assertThat(sell.amount()).isEqualTo(700_000);
    assertThat(sell.realizedPnl()).isEqualTo(-20_000);
    assertThat(assets.get(gameId).holdings()).doesNotContainKey(SSJ);
    assertThat(assets.get(gameId).cash()).isEqualTo(initialCash - 720_000 + 700_000);
  }

  @Test
  void 지출은_현금이_모자라면_빚이_되고_현금은_음수가_되지_않는다() {
    SpendResult spend = assets.spend(gameId, EXPENSE, initialCash + 500_000, 30, null);

    assertThat(spend.spent()).isTrue();
    assertThat(spend.fromCash()).isEqualTo(initialCash);
    assertThat(spend.toDebt()).isEqualTo(500_000);
    assertThat(assets.get(gameId).cash()).isZero();
    assertThat(assets.get(gameId).debt()).isEqualTo(500_000);
  }

  @Test
  void 수입은_빚을_먼저_갚는다() {
    assets.spend(gameId, EXPENSE, initialCash + 500_000, 30, null);

    IncomeResult income = assets.credit(gameId, SALARY, 800_000, 30);

    assertThat(income.credited()).isTrue();
    assertThat(income.debtRepaid()).isEqualTo(500_000);
    assertThat(income.cashAfter()).isEqualTo(300_000);
    assertThat(assets.get(gameId).debt()).isZero();
  }

  @Test
  void 이자는_빚에만_붙고_같은_날_두_번_붙지_않는다() {
    assertThat(assets.accrueInterest(gameId, 30).accrued()).as("빚이 없으면 붙지 않는다").isFalse();

    assets.spend(gameId, EXPENSE, initialCash + 1_000_000, 30, null);
    InterestResult interest = assets.accrueInterest(gameId, 30);
    assertThat(interest.accrued()).isTrue();
    // 연 5%의 1/12 (asset.debt-annual-interest-bp 500, decisions.md 72번): 100만 × 5% / 12 = 4,166원
    assertThat(interest.interest()).isEqualTo(4_166);
    assertThat(interest.debtAfter()).isEqualTo(1_004_166);
    assertThat(assets.accrueInterest(gameId, 30).accrued()).isFalse();
    assertThat(assets.get(gameId).debt()).isEqualTo(1_004_166);
  }

  @Test
  void 같은_날_같은_종류의_수입_지출은_한_번만_처리된다() {
    assertThat(assets.credit(gameId, SALARY, 3_000_000, 30).credited()).isTrue();
    assertThat(assets.credit(gameId, SALARY, 3_000_000, 30).credited()).isFalse();
    assertThat(assets.get(gameId).cash()).isEqualTo(initialCash + 3_000_000);

    assertThat(assets.spend(gameId, EXPENSE, 1_000_000, 30, null).spent()).isTrue();
    assertThat(assets.spend(gameId, EXPENSE, 1_000_000, 30, null).spent()).isFalse();
    assertThat(assets.spend(gameId, LIFE_COST, 100_000, 30, null).spent()).isTrue();
    assertThat(assets.spend(gameId, LIFE_COST, 100_000, 30, null).spent())
        .as("일회성 비용은 같은 날 여러 번 가능")
        .isTrue();
    assertThat(assets.get(gameId).cash()).isEqualTo(initialCash + 3_000_000 - 1_000_000 - 200_000);
  }

  @Test
  void 총자산은_현금_더하기_평가_빼기_빚이다() {
    assets.buy(gameId, SSJ, 10, 72_000, 10, null);
    assets.buy(gameId, "ctl", 2, 180_000, 10, null);
    assets.spend(gameId, EXPENSE, initialCash, 30, null);
    assets.spend(gameId, LIFE_COST, 300_000, 31, null);
    Map<String, Long> prices = Map.of(SSJ, 80_000L, "ctl", 150_000L, "nsm", 400_000L);

    assertThat(assets.holdingsValue(gameId, prices)).isEqualTo(800_000 + 300_000);
    long cash = assets.get(gameId).cash();
    long debt = assets.get(gameId).debt();
    assertThat(debt).isEqualTo(300_000 + (720_000 + 360_000));
    assertThat(assets.totalAsset(gameId, prices)).isEqualTo(cash + 1_100_000 - debt);
  }
}
