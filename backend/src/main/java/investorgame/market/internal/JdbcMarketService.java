package investorgame.market.internal;

import investorgame.common.Direction;
import investorgame.common.GameProperties;
import investorgame.common.error.NotFoundException;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.CrisisDefinition;
import investorgame.content.HomeRegion;
import investorgame.content.StockDefinition;
import investorgame.market.HomeQuote;
import investorgame.market.IndicatorSeries;
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
  private static final long INDEX_BASE = 1_000;

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
    for (HomeRegion region : content.homeRegions()) {
      recordHome(gameId, region.code(), 0, region.basePrice(), false);
    }
    recordRate(gameId, 0, properties.mortgage().baseBp(), false);
    seedIndicators(gameId, 0);
  }

  /** 거시 지표를 기준값으로 시작한다. 이미 있으면 그대로 둔다. */
  private void seedIndicators(UUID gameId, int month) {
    for (String code : INDICATOR_CODES) {
      recordIndicator(gameId, month, code, properties.indicators().of(code).base(), false);
    }
  }

  @Override
  @Transactional
  public List<Quote> advanceTo(UUID gameId, int toDay, SeededRandom random) {
    int target = toDay / calendar.daysPerMonth();
    Map<String, Long> prices = prices(gameId);
    MarketCycle cycle = cycle(random);
    // 아파트·금리가 생기기 전에 시작한 판은 지금 달에 기준가로 시작한다.
    int seedMonth = currentMonth(gameId);
    for (HomeRegion region : content.homeRegions()) {
      recordHome(gameId, region.code(), seedMonth, region.basePrice(), false);
    }
    recordRate(gameId, seedMonth, properties.mortgage().baseBp(), false);
    seedIndicators(gameId, seedMonth);
    for (int month = currentMonth(gameId) + 1; month <= target; month++) {
      prices = tick(gameId, month, prices, cycle, random.forKey("market", "month", month));
      // 주식과 다른 키를 써서 아파트·금리·지표를 더해도 주가의 난수 순서가 바뀌지 않는다.
      tickHomes(gameId, month, cycle, random.forKey("market", "home", month));
      tickIndicators(gameId, month, cycle, random);
    }
    return quotes(gameId);
  }

  /** 거시 지표 코드. 화면 순서이기도 하다. */
  static final List<String> INDICATOR_CODES = List.of("fx", "debt", "sentiment", "turnover");

  /** 경기 흐름의 어느 구간에 있는지. 지표의 목표가 여기서 정해진다 (매매창 설계 3.1절). */
  private record Mood(Kind kind, String crisisCode, int monthsInto) {
    enum Kind {
      CALM,
      ALARM,
      FALL,
      RECOVERY
    }
  }

  /**
   * 거시 지표의 한 달 (매매창 설계 3.1절). 값 = 지난달 + (목표 − 지난달) × revertPercent / 100 + 잡음. 난수는
   * ("market","indicator",m) 키에서 코드 순서로 뽑는다. 가짜 신호는 달마다 자기 키로 굴려 상태를 들고 있지 않는다.
   */
  private void tickIndicators(UUID gameId, int month, MarketCycle cycle, SeededRandom random) {
    MarketProperties.Indicators settings = properties.indicators();
    Mood mood = moodOf(cycle, month);
    if (mood.kind() == Mood.Kind.CALM && fakeSignalAt(month, random)) {
      mood = new Mood(Mood.Kind.ALARM, null, 0);
    }
    RandomGenerator rng = random.forKey("market", "indicator", month);
    Map<String, Long> current = currentIndicators(gameId);
    for (String code : INDICATOR_CODES) {
      MarketProperties.Indicator indicator = settings.of(code);
      long target = targetOf(indicator, mood, settings.panicMonths());
      long last = current.getOrDefault(code, (long) indicator.base());
      long next =
          last
              + (target - last) * settings.revertPercent() / 100
              + rng.nextInt(-indicator.noise(), indicator.noise() + 1);
      recordIndicator(
          gameId, month, code, Math.clamp(next, indicator.min(), indicator.max()), true);
    }
  }

  /**
   * 빠지는 중이면 FALL, 회복 중이면 RECOVERY, 전조 구간이면(결과와 상관없이) ALARM, 그 밖은 CALM. 전조 없는 위기는 빠지기 전까지 CALM이다.
   */
  private static Mood moodOf(MarketCycle cycle, int month) {
    for (MarketCycle.Crisis crisis : cycle.crises()) {
      if (month >= crisis.startMonth() && month <= crisis.bottomMonth()) {
        return new Mood(Mood.Kind.FALL, crisis.crisisCode(), month - crisis.startMonth());
      }
      if (month > crisis.bottomMonth() && month <= crisis.revealMonth()) {
        return new Mood(Mood.Kind.RECOVERY, crisis.crisisCode(), month - crisis.bottomMonth());
      }
    }
    for (MarketCycle.Alarm alarm : cycle.alarms()) {
      if (month >= alarm.firstOmenMonth() && month < alarm.startMonth()) {
        return new Mood(Mood.Kind.ALARM, alarm.crisisCode(), month - alarm.firstOmenMonth());
      }
    }
    return new Mood(Mood.Kind.CALM, null, 0);
  }

  /**
   * 가짜 신호: 최근 fakeMonths 최대치 안의 어느 달에 시작된 신호가 아직 이어지고 있는가. 달마다 ("market","fake",m) 키로 시작 여부와 길이를
   * 굴린다.
   */
  private boolean fakeSignalAt(int month, SeededRandom random) {
    MarketProperties.Indicators settings = properties.indicators();
    for (int start = Math.max(1, month - settings.fakeMonths().max() + 1);
        start <= month;
        start++) {
      RandomGenerator rng = random.forKey("market", "fake", start);
      boolean started = rng.nextInt(100) < settings.fakeStartPercent();
      int length = between(rng, settings.fakeMonths());
      if (started && month < start + length) {
        return true;
      }
    }
    return false;
  }

  private static long targetOf(MarketProperties.Indicator indicator, Mood mood, int panicMonths) {
    boolean strong =
        mood.crisisCode() != null && indicator.strongScenarios().contains(mood.crisisCode());
    return switch (mood.kind()) {
      case CALM -> indicator.base();
      case ALARM -> strong ? indicator.alarmStrong() : indicator.alarm();
      case FALL ->
          indicator.panic() != 0 && mood.monthsInto() < panicMonths
              ? indicator.panic()
              : strong ? indicator.fallStrong() : indicator.fall();
      case RECOVERY -> indicator.recovery();
    };
  }

  private Map<String, Long> currentIndicators(UUID gameId) {
    Map<String, Long> values = new LinkedHashMap<>();
    jdbc.sql(
            """
            SELECT DISTINCT ON (code) code, value FROM market_indicator_history
            WHERE game_id = :gameId ORDER BY code, month DESC
            """)
        .param("gameId", gameId)
        .query((rs, i) -> values.put(rs.getString("code"), rs.getLong("value")))
        .list();
    return values;
  }

  private void recordIndicator(UUID gameId, int month, String code, long value, boolean overwrite) {
    jdbc.sql(
            """
            INSERT INTO market_indicator_history (game_id, month, code, value)
            VALUES (:gameId, :month, :code, :value)
            ON CONFLICT (game_id, month, code) DO
            """
                + (overwrite ? " UPDATE SET value = EXCLUDED.value" : " NOTHING"))
        .param("gameId", gameId)
        .param("month", month)
        .param("code", code)
        .param("value", value)
        .update();
  }

  @Override
  @Transactional(readOnly = true)
  public List<IndicatorSeries> indicators(UUID gameId) {
    Map<String, List<PricePoint>> byCode = new LinkedHashMap<>();
    for (String code : INDICATOR_CODES) {
      byCode.put(code, new ArrayList<>());
    }
    jdbc.sql(
            """
            SELECT code, month, value FROM market_indicator_history
            WHERE game_id = :gameId ORDER BY month, code
            """)
        .param("gameId", gameId)
        .query(
            (rs, i) -> {
              List<PricePoint> points = byCode.get(rs.getString("code"));
              if (points != null) {
                points.add(new PricePoint(rs.getInt("month"), rs.getLong("value")));
              }
              return null;
            })
        .list();
    return byCode.entrySet().stream()
        .map(e -> new IndicatorSeries(e.getKey(), List.copyOf(e.getValue())))
        .toList();
  }

  @Override
  @Transactional(readOnly = true)
  public List<PricePoint> indexHistory(UUID gameId) {
    Map<String, Long> base = new LinkedHashMap<>();
    for (StockDefinition stock : content.stocks()) {
      base.put(stock.code(), stock.basePrice());
    }
    // 달마다 종목별 (가격 / 기준가 × 1000)의 평균. 종목이 몇십 개, 달이 몇백이라 메모리에서 모은다.
    Map<Integer, long[]> sums = new TreeMap<>();
    jdbc.sql("SELECT stock_code, month, price FROM market_price_history WHERE game_id = :gameId")
        .param("gameId", gameId)
        .query(
            (rs, i) -> {
              Long basePrice = base.get(rs.getString("stock_code"));
              if (basePrice != null && basePrice > 0) {
                long[] acc = sums.computeIfAbsent(rs.getInt("month"), m -> new long[2]);
                acc[0] += rs.getLong("price") * INDEX_BASE / basePrice;
                acc[1]++;
              }
              return null;
            })
        .list();
    return sums.entrySet().stream()
        .map(e -> new PricePoint(e.getKey(), e.getValue()[0] / e.getValue()[1]))
        .toList();
  }

  @Override
  @Transactional(readOnly = true)
  public List<PricePoint> rateHistory(UUID gameId) {
    return jdbc.sql(
            "SELECT month, rate_bp FROM market_rate_history WHERE game_id = :gameId ORDER BY month")
        .param("gameId", gameId)
        .query((rs, i) -> new PricePoint(rs.getInt("month"), rs.getLong("rate_bp")))
        .list();
  }

  @Override
  @Transactional(readOnly = true)
  public List<PricePoint> homeHistory(UUID gameId, String region) {
    return jdbc.sql(
            """
            SELECT month, price FROM market_home_history
            WHERE game_id = :gameId AND region = :region ORDER BY month
            """)
        .param("gameId", gameId)
        .param("region", region)
        .query((rs, i) -> new PricePoint(rs.getInt("month"), rs.getLong("price")))
        .list();
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

  /** 아파트 시세와 금리의 한 달. 시세 = 지난달 × (추세/12 + 잡음 + 위기 변동 × 갈래의 부동산 비율), 금리는 위기 가산 쪽으로 되돌아간다. */
  private void tickHomes(UUID gameId, int month, MarketCycle cycle, RandomGenerator rng) {
    int vol = properties.homes().volatilityBp();
    int crisisBp = 0;
    int rateTarget = properties.mortgage().baseBp();
    for (MarketCycle.Crisis crisis : cycle.crises()) {
      int realEstate = crisisDefinition(crisis.crisisCode()).realEstatePercent();
      if (month >= crisis.startMonth() && month <= crisis.bottomMonth()) {
        crisisBp -= crisis.fallBp() * realEstate / 100;
        rateTarget += properties.mortgage().crisisBp();
      } else if (month > crisis.bottomMonth() && month <= crisis.revealMonth()) {
        crisisBp += crisis.recoveryBp() * realEstate / 100;
        rateTarget += properties.mortgage().recoveryBp();
      }
    }
    Map<String, Long> current = homePrices(gameId);
    for (HomeRegion region : content.homeRegions()) {
      int change =
          region.driftBpPerYear() / MONTHS_PER_YEAR + rng.nextInt(-vol, vol + 1) + crisisBp;
      recordHome(
          gameId,
          region.code(),
          month,
          floor(current.get(region.code()) * (BP + change) / BP),
          true);
    }
    MarketProperties.Mortgage mortgage = properties.mortgage();
    int rate = mortgageRateBp(gameId);
    int next =
        rate
            + (rateTarget - rate) * mortgage.revertPercent() / 100
            + rng.nextInt(-mortgage.noiseBp(), mortgage.noiseBp() + 1);
    recordRate(gameId, month, Math.clamp(next, mortgage.minBp(), mortgage.maxBp()), true);
  }

  @Override
  @Transactional(readOnly = true)
  public List<HomeQuote> homeQuotes(UUID gameId) {
    List<HomeQuote> quotes = new ArrayList<>();
    for (HomeRegion region : content.homeRegions()) {
      List<Long> history =
          jdbc.sql(
                  """
                  SELECT price FROM market_home_history
                  WHERE game_id = :gameId AND region = :region
                  ORDER BY month DESC LIMIT 13
                  """)
              .param("gameId", gameId)
              .param("region", region.code())
              .query(Long.class)
              .list()
              .reversed();
      if (history.isEmpty()) {
        history = List.of(region.basePrice());
      }
      long price = history.getLast();
      long yearAgo = history.getFirst();
      quotes.add(
          new HomeQuote(
              region.code(),
              price,
              yearAgo <= 0 ? 0 : (int) ((price - yearAgo) * BP / yearAgo),
              List.copyOf(
                  history.subList(Math.max(0, history.size() - SPARK_MONTHS), history.size()))));
    }
    return quotes;
  }

  @Override
  @Transactional(readOnly = true)
  public Map<String, Long> homePrices(UUID gameId) {
    Map<String, Long> prices = new LinkedHashMap<>();
    jdbc.sql(
            """
            SELECT DISTINCT ON (region) region, price FROM market_home_history
            WHERE game_id = :gameId ORDER BY region, month DESC
            """)
        .param("gameId", gameId)
        .query((rs, i) -> prices.put(rs.getString("region"), rs.getLong("price")))
        .list();
    Map<String, Long> ordered = new LinkedHashMap<>();
    for (HomeRegion region : content.homeRegions()) {
      // 아파트가 생기기 전에 시작해 아직 한 달도 지나지 않은 판은 기준가로 본다.
      ordered.put(region.code(), prices.getOrDefault(region.code(), region.basePrice()));
    }
    return ordered;
  }

  @Override
  @Transactional(readOnly = true)
  public int mortgageRateBp(UUID gameId) {
    return jdbc.sql(
            "SELECT rate_bp FROM market_rate_history WHERE game_id = :gameId ORDER BY month DESC LIMIT 1")
        .param("gameId", gameId)
        .query(Integer.class)
        .optional()
        .orElse(properties.mortgage().baseBp());
  }

  private void recordHome(UUID gameId, String region, int month, long price, boolean overwrite) {
    jdbc.sql(
            """
            INSERT INTO market_home_history (game_id, region, month, price)
            VALUES (:gameId, :region, :month, :price)
            ON CONFLICT (game_id, region, month) DO
            """
                + (overwrite ? " UPDATE SET price = EXCLUDED.price" : " NOTHING"))
        .param("gameId", gameId)
        .param("region", region)
        .param("month", month)
        .param("price", price)
        .update();
  }

  private void recordRate(UUID gameId, int month, int rateBp, boolean overwrite) {
    jdbc.sql(
            """
            INSERT INTO market_rate_history (game_id, month, rate_bp)
            VALUES (:gameId, :month, :rate)
            ON CONFLICT (game_id, month) DO
            """
                + (overwrite ? " UPDATE SET rate_bp = EXCLUDED.rate_bp" : " NOTHING"))
        .param("gameId", gameId)
        .param("month", month)
        .param("rate", rateBp)
        .update();
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
    List<MarketCycle.Alarm> alarms = new ArrayList<>();
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
      if (!told.isEmpty()) {
        alarms.add(new MarketCycle.Alarm(scenario.code(), told.getFirst().month(), start));
      }
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
    // 헛소문은 불안한 시기를 모두 정한 뒤에 뽑는다. 난수를 뒤에 더한 것이라 앞의 전조·위기는 바뀌지 않는다.
    omens.addAll(rumors(rng, settings, scenarios, alarms, crises));
    omens.sort(Comparator.comparingInt(MarketCycle.Omen::month));
    return new MarketCycle(List.copyOf(omens), List.copyOf(alarms), List.copyOf(crises));
  }

  /**
   * 헛소문 (매매창 설계 3.2절). 평온한 달에도 같은 전조 풀에서 1~2년에 하나꼴로 흘린다. 불안한 시기(전조 구간)나 위기와 겹치는 달은 건너뛰어 진짜 전조와 섞이지
   * 않게 한다. 풀을 다 쓰면 다시 채운다.
   */
  private List<MarketCycle.Omen> rumors(
      RandomGenerator rng,
      MarketProperties.Cycle settings,
      List<CrisisDefinition> scenarios,
      List<MarketCycle.Alarm> alarms,
      List<MarketCycle.Crisis> crises) {
    List<String> pool = new ArrayList<>();
    List<MarketCycle.Omen> told = new ArrayList<>();
    int month = settings.rumorFirstMonth();
    while (true) {
      month += between(rng, settings.rumorGapMonths());
      if (month > settings.rumorLastMonth()) {
        return told;
      }
      if (pool.isEmpty()) {
        scenarios.forEach(s -> pool.addAll(s.omens()));
        pool.addAll(content.commonOmens());
      }
      if (pool.isEmpty()) {
        return told;
      }
      String text = pool.remove(rng.nextInt(pool.size()));
      if (busyAt(month, alarms, crises)) {
        continue;
      }
      told.add(new MarketCycle.Omen(month, text));
    }
  }

  private static boolean busyAt(
      int month, List<MarketCycle.Alarm> alarms, List<MarketCycle.Crisis> crises) {
    for (MarketCycle.Alarm alarm : alarms) {
      if (month >= alarm.firstOmenMonth() && month <= alarm.startMonth()) {
        return true;
      }
    }
    for (MarketCycle.Crisis crisis : crises) {
      if (month >= crisis.startMonth() && month <= crisis.revealMonth()) {
        return true;
      }
    }
    return false;
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
