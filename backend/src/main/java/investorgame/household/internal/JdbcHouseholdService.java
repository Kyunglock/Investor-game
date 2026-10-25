package investorgame.household.internal;

import investorgame.common.GameProperties;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.household.HouseholdService;
import investorgame.household.HouseholdView;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 금액은 정수(원)이며 물가는 (100+p)^n / 100^n 을 정수 곱셈으로 올린다 (연봉 상승과 같은 방식). */
@Service
class JdbcHouseholdService implements HouseholdService {

  private static final long PERCENT = 100;
  private static final int ADULT_FROM = 23;

  private final JdbcClient jdbc;
  private final Clock clock;
  private final HouseholdProperties properties;
  private final GameProperties calendar;

  JdbcHouseholdService(
      JdbcClient jdbc, Clock clock, HouseholdProperties properties, GameProperties calendar) {
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
            INSERT INTO household_state (game_id, updated_at)
            VALUES (:gameId, :now)
            ON CONFLICT (game_id) DO NOTHING
            """)
        .param("gameId", gameId)
        .param("now", now())
        .update();
  }

  @Override
  @Transactional(readOnly = true)
  public HouseholdView get(UUID gameId) {
    State state = state(gameId);
    List<HouseholdView.Child> children =
        jdbc.sql(
                """
                SELECT seq, birth_day, leave_day FROM household_child
                WHERE game_id = :gameId ORDER BY seq
                """)
            .param("gameId", gameId)
            .query(HouseholdView.Child.class)
            .list();
    return new HouseholdView(
        state.marriedDay() != null, state.marriedDay(), children, state.retiredDay());
  }

  @Override
  @Transactional
  public void marry(UUID gameId, int gameDay) {
    state(gameId);
    int updated =
        jdbc.sql(
                """
                UPDATE household_state SET married_day = :day, updated_at = :now
                WHERE game_id = :gameId AND married_day IS NULL
                """)
            .param("day", gameDay)
            .param("now", now())
            .param("gameId", gameId)
            .update();
    if (updated == 0) {
      throw new InvalidRequestException("이미 결혼했다");
    }
  }

  @Override
  @Transactional
  public int addChild(UUID gameId, int gameDay, int leaveAge) {
    state(gameId);
    int seq =
        jdbc.sql("SELECT COALESCE(MAX(seq), 0) + 1 FROM household_child WHERE game_id = :gameId")
            .param("gameId", gameId)
            .query(Integer.class)
            .single();
    jdbc.sql(
            """
            INSERT INTO household_child (game_id, seq, birth_day, leave_day)
            VALUES (:gameId, :seq, :day, :leaveDay)
            """)
        .param("gameId", gameId)
        .param("seq", seq)
        .param("day", gameDay)
        .param("leaveDay", gameDay + leaveAge * calendar.daysPerYear())
        .update();
    return seq;
  }

  @Override
  @Transactional
  public void retire(UUID gameId, int gameDay) {
    jdbc.sql(
            """
            UPDATE household_state SET retired_day = :day, updated_at = :now
            WHERE game_id = :gameId AND retired_day IS NULL
            """)
        .param("day", gameDay)
        .param("now", now())
        .param("gameId", gameId)
        .update();
  }

  @Override
  @Transactional(readOnly = true)
  public long monthlyExpense(UUID gameId, int gameDay) {
    HouseholdView view = get(gameId);
    long base = view.married() ? properties.livingCouple() : properties.livingSingle();
    long children = 0;
    for (HouseholdView.Child child : view.children()) {
      if (!child.leftBy(gameDay)) {
        children += childCost((gameDay - child.birthDay()) / calendar.daysPerYear());
      }
    }
    return inflate(base + children, gameDay);
  }

  @Override
  @Transactional(readOnly = true)
  public long spouseIncome(UUID gameId, int gameDay) {
    HouseholdView view = get(gameId);
    if (!view.married() || view.retiredDay() != null) {
      return 0;
    }
    return inflate(properties.spouseIncome(), gameDay);
  }

  @Override
  @Transactional(readOnly = true)
  public long pension(UUID gameId, int gameDay) {
    HouseholdView view = get(gameId);
    // 은퇴했거나, 정년 없는 직업으로 일하는 중이라도 은퇴 나이가 지났으면 연금이 나온다 (decisions.md 57번). 은퇴한 달은 아직 아니다.
    boolean pastRetireAge =
        gameDay > (properties.retireAge() - properties.startAge()) * calendar.daysPerYear();
    if (view.retiredDay() == null && !pastRetireAge) {
      return 0;
    }
    return inflate(
        view.married() ? properties.pensionCouple() : properties.pensionSingle(), gameDay);
  }

  @Override
  public long weddingCost(int gameDay) {
    return inflate(properties.weddingCost(), gameDay);
  }

  @Override
  public long childbirthCost(int gameDay) {
    return inflate(properties.childbirthCost(), gameDay);
  }

  @Override
  public boolean retireMonth(int gameDay) {
    return gameDay == (properties.retireAge() - properties.startAge()) * calendar.daysPerYear();
  }

  private long childCost(int age) {
    HouseholdProperties.ChildCost cost = properties.childCost();
    if (age <= 6) {
      return cost.toAge6();
    }
    if (age <= 12) {
      return cost.toAge12();
    }
    if (age <= 18) {
      return cost.toAge18();
    }
    if (age < ADULT_FROM) {
      return cost.toAge22();
    }
    return cost.adult();
  }

  @Override
  public long inflated(long amount, int gameDay) {
    return inflate(amount, gameDay);
  }

  /** 기준 나이(취업) 이후 해마다 inflationPercent 복리. 그 전에는 오르지 않는다 (경제 개편 설계 7.2절). */
  private long inflate(long amount, int gameDay) {
    int age = properties.startAge() + gameDay / calendar.daysPerYear();
    int years = Math.max(0, age - properties.inflationBaseAge());
    long value = amount;
    for (int i = 0; i < years; i++) {
      value = value * (PERCENT + properties.inflationPercent()) / PERCENT;
    }
    return value;
  }

  private State state(UUID gameId) {
    return jdbc.sql("SELECT married_day, retired_day FROM household_state WHERE game_id = :gameId")
        .param("gameId", gameId)
        .query(State.class)
        .optional()
        .orElseThrow(() -> new NotFoundException("가계가 없다"));
  }

  private OffsetDateTime now() {
    return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
  }

  private record State(Integer marriedDay, Integer retiredDay) {}
}
