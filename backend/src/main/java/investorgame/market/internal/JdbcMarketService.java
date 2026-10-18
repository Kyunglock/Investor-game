package investorgame.market.internal;

import investorgame.common.Direction;
import investorgame.common.GameProperties;
import investorgame.common.error.NotFoundException;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.StockDefinition;
import investorgame.market.MarketService;
import investorgame.market.PricePoint;
import investorgame.market.Quote;
import investorgame.market.ShockResult;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.random.RandomGenerator;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 매월 1일마다 종목 가격 = 가격 × (10000 + 추세/12 + 섹터 잡음 + 종목 잡음) / 10000, 바닥은 min-price (경제 개편 설계 5.3절). 난수는
 * ("market","month",m) 키에서 섹터를 코드순으로, 그다음 종목을 코드순으로 뽑는다. 호출하는 쪽(진행)이 판을 잠근 상태에서 부른다.
 */
@Service
class JdbcMarketService implements MarketService {

  private static final long BP = 10_000;
  private static final int MONTHS_PER_YEAR = 12;
  private static final int SPARK_MONTHS = 12;

  private final JdbcClient jdbc;
  private final Clock clock;
  private final ContentCatalog content;
  private final MarketProperties properties;
  private final GameProperties calendar;

  JdbcMarketService(
      JdbcClient jdbc,
      Clock clock,
      ContentCatalog content,
      MarketProperties properties,
      GameProperties calendar) {
    this.jdbc = jdbc;
    this.clock = clock;
    this.content = content;
    this.properties = properties;
    this.calendar = calendar;
  }

  @Override
  @Transactional
  public void create(UUID gameId) {
    for (StockDefinition stock : content.stocks()) {
      int inserted =
          jdbc.sql(
                  """
                  INSERT INTO market_price (game_id, stock_code, price, month, updated_at)
                  VALUES (:gameId, :stock, :price, 0, :now)
                  ON CONFLICT (game_id, stock_code) DO NOTHING
                  """)
              .param("gameId", gameId)
              .param("stock", stock.code())
              .param("price", stock.basePrice())
              .param("now", now())
              .update();
      if (inserted > 0) {
        recordHistory(gameId, stock.code(), 0, stock.basePrice());
      }
    }
  }

  @Override
  @Transactional
  public List<Quote> advanceTo(UUID gameId, int toDay, SeededRandom random) {
    int target = toDay / calendar.daysPerMonth();
    Map<String, Long> prices = prices(gameId);
    for (int month = currentMonth(gameId) + 1; month <= target; month++) {
      prices = tick(gameId, month, prices, random.forKey("market", "month", month));
    }
    return quotes(gameId);
  }

  /** 한 달. 섹터 움직임을 코드순으로 먼저 전부 뽑고, 종목 움직임을 코드순으로 뽑는다 (순서 고정). */
  private Map<String, Long> tick(
      UUID gameId, int month, Map<String, Long> prices, RandomGenerator rng) {
    int sectorVol = properties.sectorVolatilityBp();
    Map<String, Integer> sectorMoves = new TreeMap<>();
    for (ContentCatalog.NamedCode sector :
        content.sectors().stream()
            .sorted(Comparator.comparing(ContentCatalog.NamedCode::code))
            .toList()) {
      sectorMoves.put(sector.code(), rng.nextInt(-sectorVol, sectorVol + 1));
    }
    Map<String, Long> next = new LinkedHashMap<>();
    for (StockDefinition stock : content.stocks()) {
      int vol = properties.volatilityOf(stock.volatility());
      int change =
          stock.driftBpPerYear() / MONTHS_PER_YEAR
              + sectorMoves.get(stock.sector())
              + rng.nextInt(-vol, vol + 1);
      long price = floor(prices.get(stock.code()) * (BP + change) / BP);
      setPrice(gameId, stock.code(), price, month);
      next.put(stock.code(), price);
    }
    return next;
  }

  @Override
  @Transactional
  public ShockResult applyShock(
      UUID gameId,
      String sectorCode,
      String stockCode,
      boolean sectorWide,
      Direction direction,
      int magnitudeBp,
      int gameDay,
      UUID eventId) {
    int month = currentMonth(gameId);
    Map<String, Long> prices = prices(gameId);
    Map<String, Long> before = new LinkedHashMap<>();
    Map<String, Long> after = new LinkedHashMap<>();
    int sign = direction == Direction.UP ? 1 : -1;
    for (StockDefinition stock : content.stocksOf(sectorCode)) {
      int bp;
      if (sectorWide || stock.code().equals(stockCode)) {
        bp = magnitudeBp;
      } else {
        bp = magnitudeBp * properties.spilloverPercent() / 100;
      }
      long old = prices.get(stock.code());
      long price = floor(old * (BP + sign * bp) / BP);
      setPrice(gameId, stock.code(), price, month);
      before.put(stock.code(), old);
      after.put(stock.code(), price);
    }
    return new ShockResult(Map.copyOf(before), Map.copyOf(after));
  }

  @Override
  @Transactional(readOnly = true)
  public Map<String, Long> prices(UUID gameId) {
    Map<String, Long> prices = new LinkedHashMap<>();
    jdbc.sql(
            "SELECT stock_code, price FROM market_price WHERE game_id = :gameId ORDER BY stock_code")
        .param("gameId", gameId)
        .query((rs, rowNum) -> Map.entry(rs.getString("stock_code"), rs.getLong("price")))
        .list()
        .forEach(e -> prices.put(e.getKey(), e.getValue()));
    if (prices.isEmpty()) {
      throw new NotFoundException("시장이 없다");
    }
    return prices;
  }

  @Override
  @Transactional(readOnly = true)
  public List<Quote> quotes(UUID gameId) {
    int month = currentMonth(gameId);
    Map<String, List<PricePoint>> histories = new LinkedHashMap<>();
    jdbc.sql(
            """
            SELECT stock_code, month, price FROM market_price_history
            WHERE game_id = :gameId AND month >= :from
            ORDER BY stock_code, month
            """)
        .param("gameId", gameId)
        .param("from", Math.max(0, month - MONTHS_PER_YEAR))
        .query(
            (rs, rowNum) ->
                Map.entry(
                    rs.getString("stock_code"),
                    new PricePoint(rs.getInt("month"), rs.getLong("price"))))
        .list()
        .forEach(
            e -> histories.computeIfAbsent(e.getKey(), k -> new ArrayList<>()).add(e.getValue()));

    List<Quote> quotes = new ArrayList<>();
    for (Map.Entry<String, List<PricePoint>> entry : histories.entrySet()) {
      List<PricePoint> points = entry.getValue();
      long price = points.getLast().price();
      long monthAgo = points.size() >= 2 ? points.get(points.size() - 2).price() : price;
      long yearAgo = points.getFirst().price();
      List<Long> last12 =
          points.subList(Math.max(0, points.size() - SPARK_MONTHS), points.size()).stream()
              .map(PricePoint::price)
              .toList();
      quotes.add(new Quote(entry.getKey(), price, monthAgo, yearAgo, last12));
    }
    return quotes;
  }

  @Override
  @Transactional(readOnly = true)
  public List<PricePoint> history(UUID gameId, String stockCode) {
    return jdbc.sql(
            """
            SELECT month, price FROM market_price_history
            WHERE game_id = :gameId AND stock_code = :stock ORDER BY month
            """)
        .param("gameId", gameId)
        .param("stock", stockCode)
        .query((rs, rowNum) -> new PricePoint(rs.getInt("month"), rs.getLong("price")))
        .list();
  }

  @Override
  @Transactional(readOnly = true)
  public int currentMonth(UUID gameId) {
    return jdbc.sql("SELECT MIN(month) FROM market_price WHERE game_id = :gameId")
        .param("gameId", gameId)
        .query(Integer.class)
        .optional()
        .orElseThrow(() -> new NotFoundException("시장이 없다"));
  }

  private long floor(long price) {
    return Math.max(properties.minPrice(), price);
  }

  private void setPrice(UUID gameId, String stockCode, long price, int month) {
    jdbc.sql(
            """
            UPDATE market_price SET price = :price, month = :month, updated_at = :now
            WHERE game_id = :gameId AND stock_code = :stock
            """)
        .param("price", price)
        .param("month", month)
        .param("now", now())
        .param("gameId", gameId)
        .param("stock", stockCode)
        .update();
    recordHistory(gameId, stockCode, month, price);
  }

  /** 같은 달은 덮어쓴다. 뉴스 충격이 그 달의 값에 반영되고, 월 1점이 유지된다. */
  private void recordHistory(UUID gameId, String stockCode, int month, long price) {
    jdbc.sql(
            """
            INSERT INTO market_price_history (game_id, stock_code, month, price)
            VALUES (:gameId, :stock, :month, :price)
            ON CONFLICT (game_id, stock_code, month) DO UPDATE SET price = EXCLUDED.price
            """)
        .param("gameId", gameId)
        .param("stock", stockCode)
        .param("month", month)
        .param("price", price)
        .update();
  }

  private OffsetDateTime now() {
    return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
  }
}
