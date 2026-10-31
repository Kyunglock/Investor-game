package investorgame.asset.internal;

import investorgame.asset.AccountView;
import investorgame.asset.AssetService;
import investorgame.asset.IncomeResult;
import investorgame.asset.InterestResult;
import investorgame.asset.SpendResult;
import investorgame.asset.StockTotals;
import investorgame.asset.TradeResult;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.random.RandomGenerator;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 금액은 모두 정수(원)이며 0 방향으로 버린다. 호출하는 쪽(진행)이 판을 잠근 상태에서 부르므로 여기서는 잠그지 않는다. 멱등은 장부의 부분 유니크 인덱스 (game_id,
 * game_day, kind)로 지킨다.
 */
@Service
class JdbcAssetService implements AssetService {

  private static final long BP = 10_000;
  static final String BUY = "BUY";
  static final String SELL = "SELL";
  static final String INTEREST = "INTEREST";
  private static final long MONTHS_PER_YEAR = 12;
  static final String DEBT_REPAY = "DEBT_REPAY";
  static final String LOAN = "LOAN";

  /** 같은 날 한 번만 처리하는 종류. 마이그레이션의 부분 유니크 인덱스와 같은 목록이다. */
  private static final Set<String> ONCE_PER_DAY =
      Set.of("SALARY", "SPOUSE_INCOME", "SEVERANCE", "EXPENSE", INTEREST);

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
            INSERT INTO asset_account (game_id, cash, initial_cash, debt, updated_at)
            VALUES (:gameId, :cash, :cash, 0, :now)
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
    Map<String, AccountView.Holding> holdings = new LinkedHashMap<>();
    jdbc.sql(
            """
            SELECT stock_code, quantity, cost_basis FROM asset_holding
            WHERE game_id = :gameId AND quantity > 0
            ORDER BY stock_code
            """)
        .param("gameId", gameId)
        .query(HoldingRow.class)
        .list()
        .forEach(
            h -> holdings.put(h.stockCode(), new AccountView.Holding(h.quantity(), h.costBasis())));
    return new AccountView(
        gameId, account.cash(), account.initialCash(), account.debt(), Map.copyOf(holdings));
  }

  @Override
  @Transactional
  public TradeResult buy(
      UUID gameId, String stockCode, long quantity, long price, int gameDay, UUID eventId) {
    requirePositive(quantity, price);
    Account account = account(gameId);
    // 곱하기 전에 비교해 long 오버플로로 현금이 늘어나는 일을 막는다 (수량 × 가격 > 현금이면 살 수 없다).
    if (quantity > account.cash() / price) {
      return new TradeResult(TradeResult.Status.INSUFFICIENT_CASH, 0, price, 0, 0, account.cash());
    }
    long amount = quantity * price;
    long cashAfter = account.cash() - amount;
    AccountView.Holding held = holding(gameId, stockCode);
    setCash(gameId, cashAfter);
    setHolding(gameId, stockCode, held.quantity() + quantity, held.costBasis() + amount);
    ledger(
        gameId,
        gameDay,
        BUY,
        stockCode,
        -amount,
        quantity,
        price,
        cashAfter,
        account.debt(),
        eventId);
    return new TradeResult(TradeResult.Status.EXECUTED, quantity, price, amount, 0, cashAfter);
  }

  @Override
  @Transactional
  public TradeResult sell(
      UUID gameId, String stockCode, long quantity, long price, int gameDay, UUID eventId) {
    requirePositive(quantity, price);
    Account account = account(gameId);
    AccountView.Holding held = holding(gameId, stockCode);
    if (held.quantity() == 0) {
      return new TradeResult(TradeResult.Status.NOTHING_TO_SELL, 0, price, 0, 0, account.cash());
    }
    long sold = Math.min(quantity, held.quantity());
    long amount = sold * price;
    long costOut =
        sold == held.quantity()
            ? held.costBasis()
            : proportion(held.costBasis(), sold, held.quantity());
    // 마이너스 통장처럼 판 돈은 빚부터 갚는다. 현금을 쥔 채 빚에 이자가 붙는 일이 없게 한다 (decisions.md 39번).
    long repaid = Math.min(account.debt(), amount);
    long cashAfter = account.cash() + amount - repaid;
    long debtAfter = account.debt() - repaid;
    setBalance(gameId, cashAfter, debtAfter);
    setHolding(gameId, stockCode, held.quantity() - sold, held.costBasis() - costOut);
    ledger(gameId, gameDay, SELL, stockCode, amount, sold, price, cashAfter, debtAfter, eventId);
    if (repaid > 0) {
      ledger(gameId, gameDay, DEBT_REPAY, null, -repaid, null, null, cashAfter, debtAfter, eventId);
    }
    return new TradeResult(
        TradeResult.Status.EXECUTED, sold, price, amount, amount - costOut, cashAfter);
  }

  @Override
  @Transactional
  public IncomeResult credit(UUID gameId, String kind, long amount, int gameDay) {
    Account account = account(gameId);
    long repaid = Math.min(account.debt(), amount);
    long cashAfter = account.cash() + amount - repaid;
    long debtAfter = account.debt() - repaid;
    if (!ledger(gameId, gameDay, kind, null, amount, null, null, cashAfter, debtAfter, null)) {
      return new IncomeResult(false, 0, 0, account.cash());
    }
    if (repaid > 0) {
      ledger(gameId, gameDay, DEBT_REPAY, null, -repaid, null, null, cashAfter, debtAfter, null);
    }
    setBalance(gameId, cashAfter, debtAfter);
    return new IncomeResult(true, amount, repaid, cashAfter);
  }

  @Override
  @Transactional
  public void borrow(UUID gameId, long amount, int gameDay, UUID eventId) {
    if (amount < 1) {
      throw new InvalidRequestException("대출 금액은 1원 이상이어야 한다");
    }
    Account account = account(gameId);
    long cashAfter = account.cash() + amount;
    long debtAfter = account.debt() + amount;
    ledger(gameId, gameDay, LOAN, null, amount, null, null, cashAfter, debtAfter, eventId);
    setBalance(gameId, cashAfter, debtAfter);
  }

  @Override
  @Transactional
  public SpendResult spend(UUID gameId, String kind, long amount, int gameDay, UUID eventId) {
    Account account = account(gameId);
    long fromCash = Math.min(account.cash(), amount);
    long toDebt = amount - fromCash;
    long cashAfter = account.cash() - fromCash;
    long debtAfter = account.debt() + toDebt;
    if (!ledger(gameId, gameDay, kind, null, -amount, null, null, cashAfter, debtAfter, eventId)) {
      return new SpendResult(false, 0, 0, account.cash(), account.debt());
    }
    setBalance(gameId, cashAfter, debtAfter);
    return new SpendResult(true, fromCash, toDebt, cashAfter, debtAfter);
  }

  @Override
  @Transactional
  public InterestResult accrueInterest(UUID gameId, int gameDay) {
    Account account = account(gameId);
    if (account.debt() == 0) {
      return new InterestResult(false, 0, 0);
    }
    // 연이자의 1/12이 매월 붙는다 (decisions.md 72번).
    long interest = account.debt() * properties.debtAnnualInterestBp() / MONTHS_PER_YEAR / BP;
    long debtAfter = account.debt() + interest;
    if (!ledger(
        gameId, gameDay, INTEREST, null, -interest, null, null, account.cash(), debtAfter, null)) {
      return new InterestResult(false, 0, account.debt());
    }
    setBalance(gameId, account.cash(), debtAfter);
    return new InterestResult(true, interest, debtAfter);
  }

  @Override
  @Transactional(readOnly = true)
  public long holdingsValue(UUID gameId, Map<String, Long> prices) {
    long value = 0;
    for (Map.Entry<String, AccountView.Holding> e : get(gameId).holdings().entrySet()) {
      value += e.getValue().quantity() * prices.getOrDefault(e.getKey(), 0L);
    }
    return value;
  }

  @Override
  @Transactional(readOnly = true)
  public long totalAsset(UUID gameId, Map<String, Long> prices) {
    Account account = account(gameId);
    return account.cash() + holdingsValue(gameId, prices) - account.debt();
  }

  @Override
  @Transactional(readOnly = true)
  public StockTotals stockTotals(UUID gameId) {
    // 원장의 매수 금액은 현금이 나가므로 음수로 쌓인다.
    return jdbc.sql(
            """
            SELECT COALESCE(-SUM(amount) FILTER (WHERE kind = :buy), 0) AS bought,
                   COALESCE(SUM(amount) FILTER (WHERE kind = :sell), 0) AS sold
            FROM asset_ledger
            WHERE game_id = :gameId
            """)
        .param("buy", BUY)
        .param("sell", SELL)
        .param("gameId", gameId)
        .query((rs, rowNum) -> new StockTotals(rs.getLong("bought"), rs.getLong("sold")))
        .single();
  }

  @Override
  @Transactional(readOnly = true)
  public Map<String, Integer> lastBuyDays(UUID gameId) {
    Map<String, Integer> days = new HashMap<>();
    jdbc.sql(
            """
            SELECT l.stock_code, MAX(l.game_day) AS last_day
            FROM asset_ledger l
            JOIN asset_holding h ON h.game_id = l.game_id AND h.stock_code = l.stock_code
            WHERE l.game_id = :gameId AND l.kind = :buy AND h.quantity > 0
            GROUP BY l.stock_code
            """)
        .param("gameId", gameId)
        .param("buy", BUY)
        .query((rs, rowNum) -> Map.entry(rs.getString("stock_code"), rs.getInt("last_day")))
        .list()
        .forEach(e -> days.put(e.getKey(), e.getValue()));
    return days;
  }

  /** total × part / whole 을 오버플로 없이 계산한다 (몫과 나머지로 나눠 곱한다). part ≤ whole. */
  private static long proportion(long total, long part, long whole) {
    return total / whole * part + (total % whole) * part / whole;
  }

  private static void requirePositive(long quantity, long price) {
    if (quantity < 1) {
      throw new InvalidRequestException("수량은 1 이상이어야 한다");
    }
    if (price < 1) {
      throw new InvalidRequestException("가격은 1 이상이어야 한다");
    }
  }

  private Account account(UUID gameId) {
    return jdbc.sql("SELECT cash, initial_cash, debt FROM asset_account WHERE game_id = :gameId")
        .param("gameId", gameId)
        .query(Account.class)
        .optional()
        .orElseThrow(() -> new NotFoundException("자산 계정이 없다"));
  }

  private AccountView.Holding holding(UUID gameId, String stockCode) {
    return jdbc.sql(
            """
            SELECT quantity, cost_basis FROM asset_holding
            WHERE game_id = :gameId AND stock_code = :stock
            """)
        .param("gameId", gameId)
        .param("stock", stockCode)
        .query(
            (rs, rowNum) ->
                new AccountView.Holding(rs.getLong("quantity"), rs.getLong("cost_basis")))
        .optional()
        .orElse(new AccountView.Holding(0, 0));
  }

  private void setCash(UUID gameId, long cash) {
    jdbc.sql("UPDATE asset_account SET cash = :cash, updated_at = :now WHERE game_id = :gameId")
        .param("cash", cash)
        .param("now", now())
        .param("gameId", gameId)
        .update();
  }

  private void setBalance(UUID gameId, long cash, long debt) {
    jdbc.sql(
            """
            UPDATE asset_account SET cash = :cash, debt = :debt, updated_at = :now
            WHERE game_id = :gameId
            """)
        .param("cash", cash)
        .param("debt", debt)
        .param("now", now())
        .param("gameId", gameId)
        .update();
  }

  private void setHolding(UUID gameId, String stockCode, long quantity, long costBasis) {
    jdbc.sql(
            """
            INSERT INTO asset_holding (game_id, stock_code, quantity, cost_basis, updated_at)
            VALUES (:gameId, :stock, :quantity, :costBasis, :now)
            ON CONFLICT (game_id, stock_code)
              DO UPDATE SET quantity = EXCLUDED.quantity, cost_basis = EXCLUDED.cost_basis,
                            updated_at = EXCLUDED.updated_at
            """)
        .param("gameId", gameId)
        .param("stock", stockCode)
        .param("quantity", quantity)
        .param("costBasis", costBasis)
        .param("now", now())
        .update();
  }

  /** 장부에 한 행. 같은 날 한 번만 처리하는 종류가 이미 있으면 false를 돌려주고 아무것도 쓰지 않는다. */
  private boolean ledger(
      UUID gameId,
      int gameDay,
      String kind,
      String stockCode,
      long amount,
      Long quantity,
      Long price,
      long cashAfter,
      long debtAfter,
      UUID eventId) {
    String conflict =
        ONCE_PER_DAY.contains(kind)
            ? "ON CONFLICT (game_id, game_day, kind) WHERE kind IN ('SALARY', 'SPOUSE_INCOME', 'SEVERANCE', 'EXPENSE', 'INTEREST') DO NOTHING"
            : "";
    try {
      int inserted =
          jdbc.sql(
                  """
                  INSERT INTO asset_ledger
                    (game_id, game_day, kind, stock_code, amount, quantity, price, cash_after, debt_after,
                     event_id, created_at)
                  VALUES (:gameId, :gameDay, :kind, :stock, :amount, :quantity, :price, :cashAfter,
                          :debtAfter, :eventId, :now)
                  """
                      + conflict)
              .param("gameId", gameId)
              .param("gameDay", gameDay)
              .param("kind", kind)
              .param("stock", stockCode)
              .param("amount", amount)
              .param("quantity", quantity)
              .param("price", price)
              .param("cashAfter", cashAfter)
              .param("debtAfter", debtAfter)
              .param("eventId", eventId)
              .param("now", now())
              .update();
      return inserted > 0;
    } catch (DuplicateKeyException e) {
      return false;
    }
  }

  private OffsetDateTime now() {
    return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
  }

  private record Account(long cash, long initialCash, long debt) {}

  private record HoldingRow(String stockCode, long quantity, long costBasis) {}
}
