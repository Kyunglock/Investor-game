package investorgame.market;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.TestcontainersConfiguration;
import investorgame.common.Direction;
import investorgame.common.random.HashSeededRandom;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.StockDefinition;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** 경제 개편 설계 5.3~5.5절의 규칙을 실제 Postgres에서 확인한다. 종목 코드는 content/stocks.json을 따른다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class MarketServiceTest {

  private static final String SEMI = "semiconductor";
  private static final String SSJ = "ssj";
  private static final String SQH = "sqh";
  private static final String CTL = "ctl";
  private static final int MONTH = 30;

  @Autowired MarketService market;
  @Autowired ContentCatalog content;

  UUID gameId;
  SeededRandom random;

  @BeforeEach
  void setUp() {
    gameId = UUID.randomUUID();
    random = new HashSeededRandom(7L);
    market.create(gameId);
  }

  @Test
  void 만들면_모든_종목이_기준가이고_다시_만들어도_그대로다() {
    Map<String, Long> prices = market.prices(gameId);
    assertThat(prices).hasSize(content.stocks().size());
    for (StockDefinition stock : content.stocks()) {
      assertThat(prices).containsEntry(stock.code(), stock.basePrice());
    }
    market.advanceTo(gameId, 3 * MONTH, random);
    market.create(gameId);
    assertThat(market.currentMonth(gameId)).as("다시 만들어도 되돌리지 않는다").isEqualTo(3);
  }

  @Test
  void 열두_달을_보내면_종목마다_이력이_13점이고_같은_시드로_다시_보내도_같다() {
    List<Quote> first = market.advanceTo(gameId, 12 * MONTH, random);

    List<PricePoint> history = market.history(gameId, SSJ);
    assertThat(history).hasSize(13);
    assertThat(history.getFirst().month()).isZero();
    assertThat(history.getLast().month()).isEqualTo(12);
    assertThat(history.getFirst().price()).isEqualTo(content.stock(SSJ).basePrice());
    assertThat(market.currentMonth(gameId)).isEqualTo(12);

    assertThat(market.advanceTo(gameId, 12 * MONTH, random)).as("멱등").isEqualTo(first);

    UUID other = UUID.randomUUID();
    market.create(other);
    market.advanceTo(other, 12 * MONTH, new HashSeededRandom(7L));
    assertThat(market.prices(other)).as("같은 시드면 같은 가격").isEqualTo(market.prices(gameId));

    UUID different = UUID.randomUUID();
    market.create(different);
    market.advanceTo(different, 12 * MONTH, new HashSeededRandom(8L));
    assertThat(market.prices(different)).isNotEqualTo(market.prices(gameId));
  }

  @Test
  void 가격은_바닥_아래로_내려가지_않는다() {
    for (int i = 0; i < 3; i++) {
      market.applyShock(gameId, "bio", CTL, false, Direction.DOWN, 9_999, 30, null);
    }
    assertThat(market.prices(gameId).get(CTL)).isEqualTo(100L);
  }

  @Test
  void 종목_충격은_같은_섹터에_30퍼센트_파급된다() {
    long ssjBefore = market.prices(gameId).get(SSJ);
    long sqhBefore = market.prices(gameId).get(SQH);

    ShockResult result = market.applyShock(gameId, SEMI, SSJ, false, Direction.UP, 1_000, 30, null);

    assertThat(result.before()).containsEntry(SSJ, ssjBefore).containsEntry(SQH, sqhBefore);
    assertThat(result.after().get(SSJ)).isEqualTo(ssjBefore * 11_000 / 10_000);
    assertThat(result.after().get(SQH)).isEqualTo(sqhBefore * 10_300 / 10_000);
    assertThat(result.after()).doesNotContainKey(CTL);
    assertThat(market.prices(gameId).get(CTL)).isEqualTo(content.stock(CTL).basePrice());
  }

  @Test
  void 섹터_전체_충격은_모든_종목에_같은_폭이다() {
    Map<String, Long> before = market.prices(gameId);
    ShockResult result =
        market.applyShock(gameId, SEMI, SSJ, true, Direction.DOWN, 1_000, 30, null);
    for (StockDefinition stock : content.stocksOf(SEMI)) {
      assertThat(result.after().get(stock.code()))
          .isEqualTo(before.get(stock.code()) * 9_000 / 10_000);
    }
    assertThat(result.after()).hasSize(content.stocksOf(SEMI).size());
  }

  @Test
  void 충격은_그_달의_이력을_덮어쓴다() {
    market.advanceTo(gameId, 3 * MONTH, random);
    ShockResult result = market.applyShock(gameId, SEMI, SSJ, false, Direction.UP, 500, 95, null);

    List<PricePoint> history = market.history(gameId, SSJ);
    assertThat(history).hasSize(4);
    assertThat(history.getLast()).isEqualTo(new PricePoint(3, result.after().get(SSJ)));
  }

  @Test
  void 시세는_1개월_12개월_전_가격과_최근_12달을_담는다() {
    market.advanceTo(gameId, 24 * MONTH, random);
    List<PricePoint> history = market.history(gameId, SSJ);

    Quote quote =
        market.quotes(gameId).stream().filter(q -> q.stockCode().equals(SSJ)).findFirst().get();
    assertThat(quote.price()).isEqualTo(history.get(24).price());
    assertThat(quote.priceMonthAgo()).isEqualTo(history.get(23).price());
    assertThat(quote.priceYearAgo()).isEqualTo(history.get(12).price());
    assertThat(quote.last12()).hasSize(12);
    assertThat(quote.last12().getLast()).isEqualTo(quote.price());
    assertThat(quote.last12().getFirst()).isEqualTo(history.get(13).price());
  }

  @Test
  void 처음에는_전_달_가격이_현재가와_같고_최근_12달은_한_점이다() {
    Quote quote =
        market.quotes(gameId).stream().filter(q -> q.stockCode().equals(SSJ)).findFirst().get();
    assertThat(quote.priceMonthAgo()).isEqualTo(quote.price());
    assertThat(quote.priceYearAgo()).isEqualTo(quote.price());
    assertThat(quote.last12()).containsExactly(quote.price());
  }
}
