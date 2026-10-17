package investorgame.asset.internal;

import investorgame.asset.AccountView;
import investorgame.asset.AssetService;
import investorgame.asset.PriceChangeResult;
import investorgame.asset.SalaryResult;
import investorgame.asset.TradeResult;
import investorgame.common.Action;
import investorgame.common.Direction;
import investorgame.common.error.NotFoundException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.random.RandomGenerator;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 금액은 모두 정수(원)이며 반올림하지 않고 0 방향으로 버린다 (specs/asset.md 4절). 호출하는 쪽(진행)이 판을 잠근 상태에서 부르므로 여기서는 잠그지 않는다.
 */
@Service
class JdbcAssetService implements AssetService {

  private static final long BP = 10_000;
  private static final long PERCENT = 100;

  private final JdbcClient jdbc;
  private final Clock clock;
  private final AssetProperties properties;

  JdbcAssetService(JdbcClient jdbc, Clock clock, AssetProperties properties) {
    this.jdbc = jdbc;
    this.clock = clock;
    this.properties = properties;
  }

  @Override
  @Transactional
  public AccountView create(UUID gameId, RandomGenerator rng) {
    AssetProperties.InitialCash range = properties.initialCash();
    long initialCash = rng.nextInt(range.minUnit(), range.maxUnit() + 1) * range.unit();
    jdbc.sql(
            """
            INSERT INTO asset_account (game_id, cash, initial_cash, updated_at)
            VALUES (:gameId, :cash, :cash, :now)
            ON CONFLICT (game_id) DO NOTHING
            """)
        .param("gameId", gameId)
        .param("cash", initialCash)
        .param("now", now())
        .update();
    return get(gameId);
  }

  @Override
  @Transactional(readOnly = true)
  public AccountView get(UUID gameId) {
    Account account = account(gameId);
    Map<String, Long> holdings = new LinkedHashMap<>();
    jdbc.sql(
            """
            SELECT sector_code, amount FROM asset_holding
            WHERE game_id = :gameId AND amount > 0
            ORDER BY sector_code
            """)
        .param("gameId", gameId)
        .query(Holding.class)
        .list()
        .forEach(h -> holdings.put(h.sectorCode(), h.amount()));
    return new AccountView(gameId, account.cash(), account.initialCash(), Map.copyOf(holdings));
  }

  @Override
  @Transactional
  public TradeResult trade(
      UUID gameId, Action action, String sectorCode, int gameDay, UUID eventId) {
    long cash = account(gameId).cash();
    return switch (action) {
      case HOLD -> new TradeResult(TradeResult.Status.HELD, action, 0, cash);
      case BUY -> {
        long amount = cash * properties.buyRatioBp() / BP;
        if (amount < properties.minTrade()) {
          yield new TradeResult(TradeResult.Status.INSUFFICIENT_CASH, action, 0, cash);
        }
        long cashAfter = cash - amount;
        setCash(gameId, cashAfter);
        setHolding(gameId, sectorCode, holding(gameId, sectorCode) + amount);
        ledger(gameId, gameDay, "BUY", sectorCode, -amount, cashAfter, eventId);
        yield new TradeResult(TradeResult.Status.EXECUTED, action, amount, cashAfter);
      }
      case SELL -> {
        long held = holding(gameId, sectorCode);
        if (held == 0) {
          yield new TradeResult(TradeResult.Status.NOTHING_TO_SELL, action, 0, cash);
        }
        long cashAfter = cash + held;
        setCash(gameId, cashAfter);
        setHolding(gameId, sectorCode, 0);
        ledger(gameId, gameDay, "SELL", sectorCode, held, cashAfter, eventId);
        yield new TradeResult(TradeResult.Status.EXECUTED, action, held, cashAfter);
      }
    };
  }

  @Override
  @Transactional
  public PriceChangeResult applyPriceChange(
      UUID gameId,
      String sectorCode,
      Direction direction,
      int magnitudeBp,
      int lossFactorPercent,
      int gameDay,
      UUID eventId) {
    long held = holding(gameId, sectorCode);
    if (held == 0) {
      return new PriceChangeResult(0, false, 0);
    }
    long raw = held * (direction == Direction.UP ? magnitudeBp : -magnitudeBp) / BP;
    boolean softened = raw < 0 && lossFactorPercent < PERCENT;
    long pnl = raw < 0 ? raw * lossFactorPercent / PERCENT : raw;
    long holdingAfter = Math.max(0, held + pnl);
    setHolding(gameId, sectorCode, holdingAfter);
    ledger(
        gameId,
        gameDay,
        "PRICE_CHANGE",
        sectorCode,
        holdingAfter - held,
        account(gameId).cash(),
        eventId);
    return new PriceChangeResult(holdingAfter - held, softened, holdingAfter);
  }

  @Override
  @Transactional
  public SalaryResult creditSalary(UUID gameId, long amount, int gameDay) {
    long cash = account(gameId).cash();
    long cashAfter = cash + amount;
    int inserted =
        jdbc.sql(
                """
                INSERT INTO asset_ledger (game_id, game_day, kind, amount, cash_after, created_at)
                VALUES (:gameId, :gameDay, 'SALARY', :amount, :cashAfter, :now)
                ON CONFLICT (game_id, game_day) WHERE kind = 'SALARY' DO NOTHING
                """)
            .param("gameId", gameId)
            .param("gameDay", gameDay)
            .param("amount", amount)
            .param("cashAfter", cashAfter)
            .param("now", now())
            .update();
    if (inserted == 0) {
      return new SalaryResult(false, 0, cash);
    }
    setCash(gameId, cashAfter);
    return new SalaryResult(true, amount, cashAfter);
  }

  @Override
  @Transactional(readOnly = true)
  public long totalAsset(UUID gameId) {
    return jdbc.sql(
            """
            SELECT a.cash + COALESCE((SELECT SUM(h.amount) FROM asset_holding h WHERE h.game_id = a.game_id), 0)
            FROM asset_account a WHERE a.game_id = :gameId
            """)
        .param("gameId", gameId)
        .query(Long.class)
        .optional()
        .orElseThrow(() -> new NotFoundException("자산 계정이 없다"));
  }

  private Account account(UUID gameId) {
    return jdbc.sql("SELECT cash, initial_cash FROM asset_account WHERE game_id = :gameId")
        .param("gameId", gameId)
        .query(Account.class)
        .optional()
        .orElseThrow(() -> new NotFoundException("자산 계정이 없다"));
  }

  private long holding(UUID gameId, String sectorCode) {
    return jdbc.sql(
            "SELECT amount FROM asset_holding WHERE game_id = :gameId AND sector_code = :sector")
        .param("gameId", gameId)
        .param("sector", sectorCode)
        .query(Long.class)
        .optional()
        .orElse(0L);
  }

  private void setCash(UUID gameId, long cash) {
    jdbc.sql("UPDATE asset_account SET cash = :cash, updated_at = :now WHERE game_id = :gameId")
        .param("cash", cash)
        .param("now", now())
        .param("gameId", gameId)
        .update();
  }

  private void setHolding(UUID gameId, String sectorCode, long amount) {
    jdbc.sql(
            """
            INSERT INTO asset_holding (game_id, sector_code, amount, updated_at)
            VALUES (:gameId, :sector, :amount, :now)
            ON CONFLICT (game_id, sector_code)
              DO UPDATE SET amount = EXCLUDED.amount, updated_at = EXCLUDED.updated_at
            """)
        .param("gameId", gameId)
        .param("sector", sectorCode)
        .param("amount", amount)
        .param("now", now())
        .update();
  }

  private void ledger(
      UUID gameId,
      int gameDay,
      String kind,
      String sectorCode,
      long amount,
      long cashAfter,
      UUID eventId) {
    jdbc.sql(
            """
            INSERT INTO asset_ledger
              (game_id, game_day, kind, sector_code, amount, cash_after, event_id, created_at)
            VALUES (:gameId, :gameDay, :kind, :sector, :amount, :cashAfter, :eventId, :now)
            """)
        .param("gameId", gameId)
        .param("gameDay", gameDay)
        .param("kind", kind)
        .param("sector", sectorCode)
        .param("amount", amount)
        .param("cashAfter", cashAfter)
        .param("eventId", eventId)
        .param("now", now())
        .update();
  }

  private OffsetDateTime now() {
    return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
  }

  private record Account(long cash, long initialCash) {}

  private record Holding(String sectorCode, long amount) {}
}
