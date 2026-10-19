package investorgame.market.internal;

import investorgame.common.Direction;
import investorgame.common.GameProperties;
import investorgame.common.error.NotFoundException;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.CrisisDefinition;
import investorgame.content.StockDefinition;
import investorgame.market.MarketCycle;
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
    MarketCycle cycle = cycle(random);
    for (int month = currentMonth(gameId) + 1; month <= target; month++) {
      prices = tick(gameId, month, prices, cycle, random.forKey("market", "month", month));
    }
    return quotes(gameId);
  }

  /** 한 달. 섹터 움직임을 코드순으로 먼저 전부 뽑고, 종목 움직임을 코드순으로 뽑는다 (순서 고정). */
  private Map<String, Long> tick(
      UUID gameId, int month, Map<String, Long> prices, MarketCycle cycle, RandomGenerator rng) {
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
              + rng.nextInt(-vol, vol + 1)
              + cycleBp(cycle, stock, month);
      long price = floor(prices.get(stock.code()) * (BP + change) / BP);
      setPrice(gameId, stock.code(), price, month);
      next.put(stock.code(), price);
    }
    return next;
  }

  /** 위기 중인 달의 추가 변동. 빠지는 동안은 갈래의 섹터 비율만큼, 회복하는 동안은 모든 종목이 같이 오른다. 겹치면 더한다. */
  private int cycleBp(MarketCycle cycle, StockDefinition stock, int month) {
    int bp = 0;
    for (MarketCycle.Crisis crisis : cycle.crises()) {
      if (month >= crisis.startMonth() && month <= crisis.bottomMonth()) {
        CrisisDefinition definition = crisisDefinition(crisis.crisisCode());
        bp -= crisis.fallBp() * definition.sectorPercentOf(stock.sector()) / 100;
      } else if (month > crisis.bottomMonth() && month <= crisis.revealMonth()) {
        bp += crisis.recoveryBp();
      }
    }
    return bp;
  }

  /**
   * 경기 흐름 (decisions.md 38번). ("market","cycle") 키 하나에서 순서대로 뽑아 같은 판은 언제나 같다. 불안한 시기를 구간으로 나눠 하나씩
   * 두고, 시기마다 전조 없는 위기인지 먼저 굴린 뒤, 아니면 전조를 흘리고 결과(대공황·불황·조정·아무 일 없음)를 따로 굴린다.
   */
  @Override
  public MarketCycle cycle(SeededRandom random) {
    MarketProperties.Cycle settings = properties.cycle();
    RandomGenerator rng = random.forKey("market", "cycle");
    List<CrisisDefinition> scenarios = content.crises();
    int windows = between(rng, settings.windows());
    int span = (settings.lastMonth() - settings.firstMonth() + 1) / windows;
    List<MarketCycle.Omen> omens = new ArrayList<>();
    List<MarketCycle.Crisis> crises = new ArrayList<>();
    for (int w = 0; w < windows; w++) {
      int start = settings.firstMonth() + w * span + rng.nextInt(span);
      CrisisDefinition scenario = scenarios.get(rng.nextInt(scenarios.size()));
      if (rng.nextInt(100) < settings.silentPercent()) {
        MarketCycle.Severity severity =
            rng.nextInt(100) < settings.silentDepressionPercent()
                ? MarketCycle.Severity.DEPRESSION
                : MarketCycle.Severity.RECESSION;
        crises.add(crisis(rng, settings, scenario, severity, start, List.of()));
        continue;
      }
      List<MarketCycle.Omen> told = omensBefore(rng, settings, scenario, start);
      omens.addAll(told);
      MarketCycle.Severity severity = outcome(rng, settings);
      if (severity != null) {
        crises.add(
            crisis(
                rng,
                settings,
                scenario,
                severity,
                start,
                told.stream().map(MarketCycle.Omen::text).toList()));
      }
    }
    omens.sort(Comparator.comparingInt(MarketCycle.Omen::month));
    return new MarketCycle(List.copyOf(omens), List.copyOf(crises));
  }

  /** 위기 시작 전 lead 달 사이에 전조를 흩는다. 갈래의 전조와 공통 전조를 섞어, 문구만 보고는 어떤 위기인지(혹은 아무 일 없을지) 알 수 없게 한다. */
  private List<MarketCycle.Omen> omensBefore(
      RandomGenerator rng, MarketProperties.Cycle settings, CrisisDefinition scenario, int start) {
    int count = between(rng, settings.omens());
    int lead = between(rng, settings.omenLeadMonths());
    List<String> pool = new ArrayList<>(scenario.omens());
    List<String> common = new ArrayList<>(content.commonOmens());
    List<MarketCycle.Omen> told = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      List<String> from = !common.isEmpty() && rng.nextInt(100) < 30 ? common : pool;
      if (from.isEmpty()) {
        from = pool.isEmpty() ? common : pool;
      }
      if (from.isEmpty()) {
        break;
      }
      String text = from.remove(rng.nextInt(from.size()));
      told.add(new MarketCycle.Omen(Math.max(1, start - 1 - rng.nextInt(lead)), text));
    }
    told.sort(Comparator.comparingInt(MarketCycle.Omen::month));
    return told;
  }

  /** 전조 뒤의 결과. outcomePercent를 차례로 쌓아 굴리고, 어디에도 안 걸리면 아무 일 없이 지나간다(null). */
  private static MarketCycle.Severity outcome(
      RandomGenerator rng, MarketProperties.Cycle settings) {
    int roll = rng.nextInt(100);
    int acc = 0;
    for (MarketCycle.Severity severity : MarketCycle.Severity.values()) {
      acc += settings.outcomePercent().getOrDefault(severity.name().toLowerCase(), 0);
      if (roll < acc) {
        return severity;
      }
    }
    return null;
  }

  private static MarketCycle.Crisis crisis(
      RandomGenerator rng,
      MarketProperties.Cycle settings,
      CrisisDefinition scenario,
      MarketCycle.Severity severity,
      int start,
      List<String> omens) {
    MarketProperties.Shape shape = settings.shapeOf(severity.name().toLowerCase());
    return new MarketCycle.Crisis(
        scenario.code(),
        severity,
        start,
        between(rng, shape.fallMonths()),
        between(rng, shape.fallBp()),
        between(rng, shape.recoveryMonths()),
        between(rng, shape.recoveryBp()),
        omens);
  }

  private static int between(RandomGenerator rng, MarketProperties.Range range) {
    return range.min() + rng.nextInt(range.max() - range.min() + 1);
  }

  private CrisisDefinition crisisDefinition(String code) {
    return content.crises().stream()
        .filter(c -> c.code().equals(code))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("콘텐츠에 없는 위기 갈래: " + code));
  }

  @Override
  @Transactional(readOnly = true)
  public int averageDropBp(UUID gameId, int fromMonth, int toMonth) {
    List<Integer> drops =
        jdbc.sql(
                """
                SELECT s.price AS start_price, MIN(h.price) AS low
                FROM market_price_history s
                JOIN market_price_history h
                  ON h.game_id = s.game_id AND h.stock_code = s.stock_code
                 AND h.month > :fromMonth AND h.month <= :toMonth
                WHERE s.game_id = :gameId AND s.month = :fromMonth
                GROUP BY s.stock_code, s.price
                """)
            .param("gameId", gameId)
            .param("fromMonth", fromMonth)
            .param("toMonth", toMonth)
            .query(
                (rs, i) ->
                    (int)
                        ((rs.getLong("start_price") - rs.getLong("low"))
                            * BP
                            / rs.getLong("start_price")))
            .list();
    return drops.isEmpty()
        ? 0
        : (int) drops.stream().mapToInt(Integer::intValue).average().orElse(0);
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
