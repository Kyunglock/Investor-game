package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.content.internal.TestContent;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class IdleEngineTest {
  private final CompanyEngine company =
      new CompanyEngine(
          TestContent.load(),
          TestBehavior.create(),
          TestBehavior.bind("raising.company", CompanyProperties.class));
  private final MutableClock clock = new MutableClock();
  private final IdleEngine engine = new IdleEngine(clock, company);
  private final CompanyState state = new CompanyState();

  static class MutableClock extends Clock {
    long now = 10000;

    public ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    public Clock withZone(ZoneId zone) {
      return this;
    }

    public Instant instant() {
      return Instant.ofEpochMilli(now);
    }
  }

  @Test
  void foregroundOnlyAndDuplicateSafe() {
    engine.beat(state, "one", 0, "start");
    assertThat(state.capital).isZero();
    clock.now += 1000;
    engine.beat(state, "one", 1, "tick");
    assertThat(state.capital).isEqualTo(20000);
    double damage = state.idle.damage;
    engine.beat(state, "one", 1, "tick");
    assertThat(state.idle.damage).isEqualTo(damage);
    clock.now += 86400000;
    engine.beat(state, "one", 2, "tick");
    assertThat(state.capital).isEqualTo(20000);
    engine.beat(state, "one", 3, "stop");
    clock.now += 1000;
    engine.beat(state, "one", 4, "tick");
    assertThat(state.capital).isEqualTo(20000);
  }

  @Test
  void restartAndSecondTabCannotDoublePay() {
    engine.beat(state, "one", 0, "start");
    clock.now += 1000;
    new IdleEngine(clock, company).beat(state, "one", 1, "tick");
    assertThat(state.capital).isZero();
    engine.beat(state, "two", 0, "start");
    assertThatThrownBy(() -> engine.beat(state, "one", 2, "tick"))
        .isInstanceOf(RuntimeException.class);
    assertThat(state.capital).isZero();
  }

  @Test
  void wallsBossRewardsAndAcquisitionPersist() {
    assertThat(engine.view(state).skills()).noneMatch(s -> s.owned());
    engine.advance(state, 1, 120);
    assertThat(state.idle.wall).isEqualTo(2);
    assertThat(state.capital).isEqualTo(130000);
    state.idle.wall = 5;
    engine.advance(state, 1, IdleEngine.maxHp(5));
    assertThat(engine.view(state).skills().getFirst().owned()).isTrue();
    assertThat(engine.view(state).skills().get(1).owned()).isFalse();
    engine.advance(state, 4, 120); // Finish the foreground trading halt.
    state.idle.wall = 10;
    assertThat(engine.view(state).boss()).isTrue();
    engine.advance(state, 1, IdleEngine.maxHp(10));
    assertThat(state.weaponTickets).isEqualTo(1);
    assertThat(state.idle.wall).isEqualTo(11);
    JsonMapper json = JsonMapper.builder().build();
    CompanyState saved = json.readValue(json.writeValueAsString(state), CompanyState.class);
    assertThat(engine.view(saved)).isEqualTo(engine.view(state));
  }

  @Test
  void acquiredSkillsCastOnlyDuringForegroundTime() {
    state.idle = new CompanyState.Idle();
    state.idle.wall = 6;
    engine.beat(state, "one", 0, "start");
    double base = state.idle.dps;
    for (int i = 1; i <= 3; i++) {
      clock.now += 1000;
      engine.beat(state, "one", i, "tick");
    }
    assertThat(state.idle.damage).isEqualTo(base * 3.75);
    double before = state.idle.damage;
    clock.now += 100000;
    engine.beat(state, "one", 4, "tick");
    assertThat(state.idle.damage).isEqualTo(before);
  }

  @Test
  void circuitStopsDamageIncomeAndSkillTimeAndSurvivesOffline() {
    engine.view(state);
    state.idle.wall = 5;
    engine.advance(state, 1, IdleEngine.maxHp(5));
    assertThat(state.idle.wall).isEqualTo(6);
    assertThat(engine.view(state).circuitSeconds()).isEqualTo(4);
    long capital = state.capital;
    double active = state.idle.activeSeconds;
    engine.beat(state, "one", 0, "start");
    clock.now += 1000;
    engine.beat(state, "one", 1, "tick");
    assertThat(state.idle.circuitSeconds).isEqualTo(3);
    assertThat(state.idle.damage).isZero();
    assertThat(state.capital).isEqualTo(capital);
    assertThat(state.idle.activeSeconds).isEqualTo(active);
    engine.beat(state, "one", 1, "tick");
    assertThat(state.idle.circuitSeconds).isEqualTo(3);
    engine.beat(state, "one", 2, "stop");
    clock.now += 86400000;
    engine.beat(state, "two", 0, "start");
    assertThat(state.idle.circuitSeconds).isEqualTo(3);
    clock.now += 3000;
    engine.beat(state, "two", 1, "tick");
    assertThat(state.idle.circuitSeconds).isZero();
    assertThat(state.capital).isEqualTo(capital);
    clock.now += 1000;
    engine.beat(state, "two", 2, "tick");
    assertThat(state.idle.damage).isPositive();
    assertThat(state.capital).isGreaterThan(capital);
  }

  @Test
  void highDamageCannotSkipCircuitAndLaterCircuitsRepeat() {
    engine.advance(state, 1, 1_000_000);
    assertThat(state.idle.wall).isEqualTo(6);
    assertThat(state.idle.damage).isZero();
    assertThat(state.idle.circuitSeconds).isBetween(3.0, 4.0);
    JsonMapper json = JsonMapper.builder().build();
    CompanyState saved = json.readValue(json.writeValueAsString(state), CompanyState.class);
    assertThat(engine.view(saved)).isEqualTo(engine.view(state));
    engine.advance(saved, saved.idle.circuitSeconds, 1_000_000);
    assertThat(saved.idle.damage).isZero();
    engine.advance(saved, 1, 1_000_000);
    assertThat(saved.idle.wall).isEqualTo(16);
    assertThat(saved.idle.circuitSeconds).isBetween(3.0, 4.0);
    assertThat(saved.weaponTickets).isEqualTo(1);
  }

  @Test
  void existingWeaponsAndUpgradesIncreasePower() {
    company.mental.initWeapons(state);
    double before = engine.view(state).dps();
    state.battleLevels.put("damage", 10);
    assertThat(engine.view(state).dps()).isGreaterThan(before);
    double damage = engine.view(state).dps();
    state.battleLevels.put("fire", 10);
    assertThat(engine.view(state).dps()).isGreaterThan(damage);
  }
}
