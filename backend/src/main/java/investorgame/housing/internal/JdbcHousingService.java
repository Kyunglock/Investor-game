package investorgame.housing.internal;

import investorgame.common.GameProperties;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.housing.HomeSale;
import investorgame.housing.HousingService;
import investorgame.housing.HousingView;
import investorgame.housing.Lease;
import investorgame.housing.MonthlyHousingCost;
import investorgame.housing.Tenure;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 금액은 원. 금리는 연 만분율이며 월 이자는 잔액 × 금리 / 12 / 10000 (버림). 주담대는 남은 달 수로 다시 계산하는 원리금균등이다. */
@Service
class JdbcHousingService implements HousingService {

  private static final long BP = 10_000;
  private static final int MONTHS_PER_YEAR = 12;

  private final JdbcClient jdbc;
  private final Clock clock;
  private final HousingProperties properties;
  private final GameProperties calendar;

  JdbcHousingService(
      JdbcClient jdbc, Clock clock, HousingProperties properties, GameProperties calendar) {
    this.jdbc = jdbc;
    this.clock = clock;
    this.properties = properties;
    this.calendar = calendar;
  }

  @Override
  @Transactional
  public void create(UUID gameId) {
    jdbc.sql(
            """
            INSERT INTO housing_state (game_id, tenure, updated_at)
            VALUES (:gameId, :tenure, :now)
            ON CONFLICT (game_id) DO NOTHING
            """)
        .param("gameId", gameId)
        .param("tenure", Tenure.PARENTS.name())
        .param("now", now())
        .update();
  }

  @Override
  @Transactional(readOnly = true)
  public HousingView get(UUID gameId) {
    State state = state(gameId);
    return new HousingView(
        Tenure.valueOf(state.tenure()),
        state.region(),
        state.deposit(),
        state.monthlyRent(),
        state.jeonseLoan(),
        state.insured(),
        state.leaseEndDay(),
        homes(gameId));
  }

  @Override
  @Transactional
  public Lease rent(
      UUID gameId,
      Tenure tenure,
      String region,
      long deposit,
      long monthlyRent,
      long jeonseLoan,
      boolean insured,
      int day) {
    if (tenure == Tenure.PARENTS || tenure == Tenure.OWN) {
      throw new InvalidRequestException("세가 아니다: " + tenure);
    }
    Lease ended = endedLease(gameId);
    // 살던 집을 두고 세로 나가면 그 집은 비워 둔 채로 남는다: 내가 사는 집 표시만 뗀다.
    jdbc.sql("UPDATE housing_home SET residence = FALSE WHERE game_id = :gameId AND residence")
        .param("gameId", gameId)
        .update();
    setState(gameId, tenure, region, deposit, monthlyRent, jeonseLoan, insured, leaseEnd(day));
    return ended;
  }

  @Override
  @Transactional
  public void renew(UUID gameId, long deposit, long monthlyRent, long jeonseLoan, int day) {
    State state = state(gameId);
    Tenure tenure = Tenure.valueOf(state.tenure());
    if (tenure == Tenure.PARENTS || tenure == Tenure.OWN) {
      throw new InvalidRequestException("세입자가 아니면 연장할 수 없다");
    }
    setState(
        gameId,
        tenure,
        state.region(),
        deposit,
        monthlyRent,
        jeonseLoan,
        state.insured(),
        leaseEnd(day));
  }

  @Override
  @Transactional
  public Lease buyResidence(UUID gameId, String region, long price, long mortgage, int day) {
    requireRoom(gameId);
    Lease ended = endedLease(gameId);
    jdbc.sql("UPDATE housing_home SET residence = FALSE WHERE game_id = :gameId AND residence")
        .param("gameId", gameId)
        .update();
    insertHome(gameId, region, price, day, mortgage, true, 0, null);
    setState(gameId, Tenure.OWN, region, 0, 0, 0, false, null);
    return ended;
  }

  @Override
  @Transactional
  public void buyGap(UUID gameId, String region, long price, long tenantDeposit, int day) {
    requireRoom(gameId);
    insertHome(gameId, region, price, day, 0, false, tenantDeposit, leaseEnd(day));
  }

  @Override
  @Transactional
  public void setListed(UUID gameId, int seq, Integer listedDay) {
    int updated =
        jdbc.sql(
                """
                UPDATE housing_home SET listed_day = :day
                WHERE game_id = :gameId AND seq = :seq AND sold_day IS NULL
                """)
            .param("day", listedDay)
            .param("gameId", gameId)
            .param("seq", seq)
            .update();
    if (updated == 0) {
      throw new NotFoundException("가진 집이 아니다");
    }
  }

  @Override
  @Transactional
  public HomeSale sell(UUID gameId, int seq, long price, int day) {
    HousingView.Home home =
        homes(gameId).stream()
            .filter(h -> h.seq() == seq)
            .findFirst()
            .orElseThrow(() -> new NotFoundException("가진 집이 아니다"));
    jdbc.sql(
            """
            UPDATE housing_home SET sold_day = :day, sale_price = :price, listed_day = NULL
            WHERE game_id = :gameId AND seq = :seq
            """)
        .param("day", day)
        .param("price", price)
        .param("gameId", gameId)
        .param("seq", seq)
        .update();
    if (home.residence()) {
      // 살던 집이 팔리면 우선 보증금 없는 월세로 옮기고, 만기를 오늘로 둬서 바로 살 곳을 고르게 한다.
      setState(gameId, Tenure.MONTHLY, null, 0, 0, 0, false, day);
    }
    return new HomeSale(price, home.mortgage(), home.tenantDeposit(), home.residence());
  }

  @Override
  @Transactional
  public void releaseTenant(UUID gameId, int seq, long tenantDeposit, int day) {
    jdbc.sql(
            """
            UPDATE housing_home SET tenant_deposit = :deposit, tenant_lease_end_day = :end
            WHERE game_id = :gameId AND seq = :seq AND NOT residence AND sold_day IS NULL
            """)
        .param("deposit", tenantDeposit)
        .param("end", leaseEnd(day))
        .param("gameId", gameId)
        .param("seq", seq)
        .update();
  }

  @Override
  @Transactional
  public MonthlyHousingCost settleMonth(UUID gameId, int mortgageRateBp, int day) {
    State state = state(gameId);
    long interest = 0;
    long principal = 0;
    for (HousingView.Home home : homes(gameId)) {
      if (home.mortgage() <= 0) {
        continue;
      }
      long monthInterest = monthlyInterest(home.mortgage(), mortgageRateBp);
      long payment =
          Math.min(
              home.mortgage() + monthInterest,
              payment(home.mortgage(), mortgageRateBp, monthsLeft(home, day)));
      long paidPrincipal = Math.max(0, payment - monthInterest);
      jdbc.sql(
              "UPDATE housing_home SET mortgage = mortgage - :paid WHERE game_id = :gameId AND seq = :seq")
          .param("paid", paidPrincipal)
          .param("gameId", gameId)
          .param("seq", home.seq())
          .update();
      interest += monthInterest;
      principal += paidPrincipal;
    }
    long jeonseInterest = jeonseInterest(state.jeonseLoan(), mortgageRateBp);
    long insurance = insurance(state.deposit(), state.insured());
    return new MonthlyHousingCost(
        state.monthlyRent(), interest, principal, jeonseInterest, insurance);
  }

  @Override
  public long leaseMonthlyCost(
      long monthlyRent, long jeonseLoan, long deposit, boolean insured, int mortgageRateBp) {
    return monthlyRent + jeonseInterest(jeonseLoan, mortgageRateBp) + insurance(deposit, insured);
  }

  private long jeonseInterest(long loan, int mortgageRateBp) {
    return monthlyInterest(loan, Math.max(0, mortgageRateBp + properties.jeonseLoanSpreadBp()));
  }

  private long insurance(long deposit, boolean insured) {
    return insured ? deposit * properties.insuranceBpPerYear() / BP / MONTHS_PER_YEAR : 0;
  }

  @Override
  public long monthlyPayment(long principal, int mortgageRateBp) {
    return payment(principal, mortgageRateBp, properties.mortgageYears() * MONTHS_PER_YEAR);
  }

  /** 원리금균등: P × r / (1 − (1 + r)^−n), r = 월 금리. 금리가 0이면 원금을 n으로 나눈다. */
  private static long payment(long principal, int rateBp, int months) {
    if (principal <= 0) {
      return 0;
    }
    double r = rateBp / (double) BP / MONTHS_PER_YEAR;
    if (r == 0) {
      return principal / Math.max(1, months);
    }
    return (long) Math.ceil(principal * r / (1 - Math.pow(1 + r, -Math.max(1, months))));
  }

  private static long monthlyInterest(long balance, int rateBp) {
    return balance * rateBp / BP / MONTHS_PER_YEAR;
  }

  private int monthsLeft(HousingView.Home home, int day) {
    // 산 다음 달이 첫 회차다: 그때 남은 회차는 만기 전체(이번 회차 포함).
    int paid = Math.max(1, (day - home.purchaseDay()) / calendar.daysPerMonth()) - 1;
    return Math.max(1, properties.mortgageYears() * MONTHS_PER_YEAR - paid);
  }

  private int leaseEnd(int day) {
    return day + properties.leaseYears() * calendar.daysPerYear();
  }

  private void requireRoom(UUID gameId) {
    if (homes(gameId).size() >= properties.maxHomes()) {
      throw new InvalidRequestException("아파트는 %d채까지 가질 수 있다".formatted(properties.maxHomes()));
    }
  }

  private Lease endedLease(UUID gameId) {
    State state = state(gameId);
    return new Lease(
        Tenure.valueOf(state.tenure()), state.deposit(), state.jeonseLoan(), state.insured());
  }

  private void insertHome(
      UUID gameId,
      String region,
      long price,
      int day,
      long mortgage,
      boolean residence,
      long tenantDeposit,
      Integer tenantLeaseEndDay) {
    jdbc.sql(
            """
            INSERT INTO housing_home
                (game_id, seq, region, purchase_price, purchase_day, mortgage, residence,
                 tenant_deposit, tenant_lease_end_day)
            VALUES (:gameId,
                    (SELECT COALESCE(MAX(seq), 0) + 1 FROM housing_home WHERE game_id = :gameId),
                    :region, :price, :day, :mortgage, :residence, :tenantDeposit, :tenantEnd)
            """)
        .param("gameId", gameId)
        .param("region", region)
        .param("price", price)
        .param("day", day)
        .param("mortgage", mortgage)
        .param("residence", residence)
        .param("tenantDeposit", tenantDeposit)
        .param("tenantEnd", tenantLeaseEndDay)
        .update();
  }

  private void setState(
      UUID gameId,
      Tenure tenure,
      String region,
      long deposit,
      long monthlyRent,
      long jeonseLoan,
      boolean insured,
      Integer leaseEndDay) {
    create(gameId);
    jdbc.sql(
            """
            UPDATE housing_state
            SET tenure = :tenure, region = :region, deposit = :deposit, monthly_rent = :rent,
                jeonse_loan = :loan, insured = :insured, lease_end_day = :end, updated_at = :now
            WHERE game_id = :gameId
            """)
        .param("tenure", tenure.name())
        .param("region", region)
        .param("deposit", deposit)
        .param("rent", monthlyRent)
        .param("loan", jeonseLoan)
        .param("insured", insured)
        .param("end", leaseEndDay)
        .param("now", now())
        .param("gameId", gameId)
        .update();
  }

  private List<HousingView.Home> homes(UUID gameId) {
    return jdbc.sql(
            """
            SELECT seq, region, purchase_price, purchase_day, mortgage, residence, tenant_deposit,
                   tenant_lease_end_day, listed_day
            FROM housing_home WHERE game_id = :gameId AND sold_day IS NULL ORDER BY seq
            """)
        .param("gameId", gameId)
        .query(HousingView.Home.class)
        .list();
  }

  /** 주거가 생기기 전에 시작한 판도 부모님 집에서 시작한다. 쓰기 전에 행을 만든다. */
  private State state(UUID gameId) {
    return find(gameId)
        .orElseGet(() -> new State(Tenure.PARENTS.name(), null, 0, 0, 0, false, null));
  }

  private Optional<State> find(UUID gameId) {
    return jdbc.sql(
            """
            SELECT tenure, region, deposit, monthly_rent, jeonse_loan, insured, lease_end_day
            FROM housing_state WHERE game_id = :gameId
            """)
        .param("gameId", gameId)
        .query(State.class)
        .optional();
  }

  private OffsetDateTime now() {
    return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
  }

  private record State(
      String tenure,
      String region,
      long deposit,
      long monthlyRent,
      long jeonseLoan,
      boolean insured,
      Integer leaseEndDay) {}
}
