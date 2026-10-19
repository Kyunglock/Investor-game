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

  /** 경기 흐름 (decisions.md 38번): 같은 판은 같고, 전조와 위기가 서로를 보장하지 않으며, 대공황은 판마다 오기도 안 오기도 한다. */
  @Test
  void 경기_흐름은_시드로_정해지고_전조가_위기를_보장하지_않는다() {
    assertThat(market.cycle(new HashSeededRandom(3L)))
        .isEqualTo(market.cycle(new HashSeededRandom(3L)));

    int withDepression = 0;
    int omensWithoutCrisis = 0;
    int silentCrises = 0;
    int omenedCrises = 0;
    for (long seed = 1; seed <= 400; seed++) {
      MarketCycle cycle = market.cycle(new HashSeededRandom(seed));
      if (cycle.crises().stream().anyMatch(c -> c.severity() == MarketCycle.Severity.DEPRESSION)) {
        withDepression++;
      }
      long told = cycle.omens().size();
      long toldBeforeCrises = cycle.crises().stream().mapToLong(c -> c.omens().size()).sum();
      if (told > toldBeforeCrises) {
        omensWithoutCrisis++;
      }
      silentCrises += (int) cycle.crises().stream().filter(c -> c.omens().isEmpty()).count();
      omenedCrises += (int) cycle.crises().stream().filter(c -> !c.omens().isEmpty()).count();
      for (MarketCycle.Crisis crisis : cycle.crises()) {
        assertThat(crisis.startMonth()).isBetween(132, 540);
        assertThat(crisis.revealMonth()).isGreaterThanOrEqualTo(crisis.bottomMonth());
        for (String omen : crisis.omens()) {
          assertThat(cycle.omens())
              .anyMatch(o -> o.text().equals(omen) && o.month() < crisis.startMonth());
        }
      }
    }
    assertThat(withDepression).as("대공황은 랜덤: 어떤 판엔 오고 어떤 판엔 안 온다").isBetween(80, 320);
    assertThat(omensWithoutCrisis).as("전조만 나오고 아무 일 없이 지나가는 판이 있다").isPositive();
    assertThat(silentCrises).as("전조 없이 오는 위기도 있다").isPositive();
    assertThat(omenedCrises).isPositive();
  }

  @Test
  void 위기가_오면_빠지는_동안_가격이_내려가고_낙폭을_돌아볼_수_있다() {
    long seed = 1;
    MarketCycle.Crisis depression = null;
    for (; seed <= 400 && depression == null; seed++) {
      depression =
          market.cycle(new HashSeededRandom(seed)).crises().stream()
              .filter(c -> c.severity() == MarketCycle.Severity.DEPRESSION)
              .findFirst()
              .orElse(null);
    }
    assertThat(depression).isNotNull();
    SeededRandom crisisRandom = new HashSeededRandom(seed - 1);
    market.advanceTo(gameId, depression.revealMonth() * MONTH, crisisRandom);

    int drop = market.averageDropBp(gameId, depression.startMonth() - 1, depression.revealMonth());
    assertThat(drop).as("대공황은 평균 30%% 넘게 빠진다: %d", drop).isGreaterThan(3_000);
  }

  /** 주거 설계 2·3절: 아파트 시세는 지역마다 추세를 따르고, 금리는 범위 안에서 위기 때 오른다. */
  @Test
  void 아파트_시세와_주담대_금리는_달마다_움직이고_위기_때_금리가_오른다() {
    assertThat(market.homePrices(gameId)).containsOnlyKeys("seoul", "gyeonggi");
    assertThat(market.mortgageRateBp(gameId)).isEqualTo(550);

    long seed = 1;
    MarketCycle.Crisis crisis = null;
    for (; seed <= 400 && crisis == null; seed++) {
      crisis =
          market.cycle(new HashSeededRandom(seed)).crises().stream()
              .filter(c -> c.severity() == MarketCycle.Severity.DEPRESSION)
              .findFirst()
              .orElse(null);
    }
    UUID other = UUID.randomUUID();
    market.create(other);
    SeededRandom crisisRandom = new HashSeededRandom(seed - 1);
    market.advanceTo(other, (crisis.startMonth() - 1) * MONTH, crisisRandom);
    int before = market.mortgageRateBp(other);
    long seoulBefore = market.homePrices(other).get("seoul");
    market.advanceTo(other, crisis.bottomMonth() * MONTH, crisisRandom);
    assertThat(market.mortgageRateBp(other)).as("위기로 빠지는 동안 금리가 오른다").isGreaterThan(before);
    assertThat(market.mortgageRateBp(other)).isBetween(300, 800);
    assertThat(market.homeQuotes(other)).allSatisfy(q -> assertThat(q.last12()).hasSize(12));
    assertThat(market.homePrices(other).get("seoul")).as("대공황이면 집값도 빠진다").isLessThan(seoulBefore);
  }
}
