package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.content.internal.TestContent;
import investorgame.raising.CompanyService.IdleHit;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
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
  private long sequence;

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

  private void start(long wall) {
    engine.view(state);
    state.idle.wall = wall;
    engine.beat(state, "one", 0, "start");
  }

  private void tick(long millis, IdleHit... hits) {
    clock.now += millis;
    engine.beat(state, "one", ++sequence, "tick", List.of(hits));
  }

  @Test
  void timeAndAcquiredSkillsAloneNeverDamageWalls() {
    start(51);
    for (int i = 0; i < 20; i++) tick(1000);
    assertThat(state.idle.wall).isEqualTo(51);
    assertThat(state.idle.damage).isZero();
    assertThat(state.idle.nextDamage).isZero();
    assertThat(state.idle.afterNextDamage).isZero();
    assertThat(state.idle.activeSeconds).isEqualTo(40); // Foreground time still runs at 2x.
    assertThat(state.capital).isEqualTo(800000);
  }

  @Test
  void contactsDamageOnlyTheirWallAndDuplicatesCannotPayTwice() {
    start(1);
    tick(1000, new IdleHit(1, "bullet", 1));
    assertThat(state.idle.damage).isEqualTo(12);
    assertThat(state.idle.nextDamage).isZero();
    engine.beat(state, "one", sequence, "tick", List.of(new IdleHit(1, "bullet", 1)));
    assertThat(state.idle.damage).isEqualTo(12);
    tick(1000, new IdleHit(2, "bullet", 1), new IdleHit(50, "meteor", 10));
    assertThat(state.idle.damage).isEqualTo(12);
    assertThat(state.idle.nextDamage).isZero();
  }

  @Test
  void damageCannotAccumulateOfflineOrAfterStop() {
    start(1);
    tick(1000);
    tick(86400000, new IdleHit(1, "bullet", 1000));
    assertThat(state.idle.damage).isZero();
    assertThat(state.capital).isEqualTo(40000);
    engine.beat(state, "one", ++sequence, "stop");
    tick(1000, new IdleHit(1, "bullet", 1000));
    assertThat(state.idle.damage).isZero();
    assertThat(state.capital).isEqualTo(40000);
  }

  @Test
  void restartAndSecondTabCannotDoublePay() {
    start(1);
    clock.now += 1000;
    new IdleEngine(clock, company)
        .beat(state, "one", ++sequence, "tick", List.of(new IdleHit(1, "bullet", 1000)));
    assertThat(state.idle.damage).isZero();
    engine.beat(state, "two", 0, "start");
    assertThatThrownBy(() -> engine.beat(state, "one", ++sequence, "tick"))
        .isInstanceOf(RuntimeException.class);
  }

  @Test
  void forgedHitCountsAreBoundedByWeaponRateAndSkillsMustBeOwned() {
    start(1);
    tick(1000, new IdleHit(1, "bullet", 1000), new IdleHit(1, "meteor", 1000));
    assertThat(state.idle.damage).isEqualTo(state.idle.dps * 2);
    assertThat(state.idle.wall).isEqualTo(1);
    for (int i = 0; i < 10; i++) tick(1000);
    double before = state.idle.damage;
    tick(1, new IdleHit(1, "bullet", 1000));
    assertThat(state.idle.damage - before).isLessThanOrEqualTo(state.idle.dps * 6);
  }

  @Test
  void splashRequiresAnActualContactForEachRearWallAndPersists() {
    start(16);
    tick(3000, new IdleHit(16, "meteor", 1));
    assertThat(state.idle.damage).isPositive();
    assertThat(state.idle.nextDamage).isZero();
    assertThat(state.idle.afterNextDamage).isZero();
    tick(3000, new IdleHit(17, "meteor", 1), new IdleHit(18, "meteor", 1));
    assertThat(state.idle.nextDamage).isPositive();
    assertThat(state.idle.afterNextDamage).isPositive();
    double near = state.idle.nextDamage;
    tick(1000);
    assertThat(state.idle.nextDamage).isEqualTo(near);
    JsonMapper json = JsonMapper.builder().build();
    CompanyState saved = json.readValue(json.writeValueAsString(state), CompanyState.class);
    assertThat(engine.view(saved)).isEqualTo(engine.view(state));
  }

  @Test
  void highPowerDoesNotRollOverIntoUntouchedWalls() {
    state.battleLevels.put("damage", 1000);
    start(1);
    tick(1000, new IdleHit(1, "bullet", 1000));
    assertThat(state.idle.wall).isEqualTo(2);
    assertThat(state.idle.damage).isZero();
    tick(1000, new IdleHit(1, "bullet", 1000)); // In-flight old-wall events are stale.
    assertThat(state.idle.wall).isEqualTo(2);
    assertThat(state.idle.damage).isZero();
  }

  @Test
  void alreadyHitRearWallsClearInOrderButCannotSkipCircuit() {
    start(5);
    state.idle.damage = IdleEngine.maxHp(5) - 1;
    state.idle.nextDamage = IdleEngine.maxHp(6);
    state.idle.afterNextDamage = IdleEngine.maxHp(7);
    tick(1000, new IdleHit(5, "bullet", 1));
    assertThat(state.idle.wall).isEqualTo(6);
    assertThat(state.idle.circuitSeconds).isEqualTo(4);
    long paid = state.capital;
    tick(1000, new IdleHit(6, "bullet", 1000));
    assertThat(state.idle.wall).isEqualTo(6);
    assertThat(state.capital).isEqualTo(paid);
    tick(1000);
    assertThat(state.idle.wall).isEqualTo(8);
    assertThat(state.idle.damage).isZero();
    assertThat(state.capital).isEqualTo(paid + 160000 + 170000);
  }

  @Test
  void bossRewardsAndUnlocksRequireRealWallClear() {
    start(10);
    state.idle.damage = IdleEngine.maxHp(10) - 1;
    tick(1000);
    assertThat(state.weaponTickets).isZero();
    tick(1000, new IdleHit(10, "bullet", 1));
    assertThat(state.idle.wall).isEqualTo(11);
    assertThat(state.weaponTickets).isEqualTo(1);
    tick(1000, new IdleHit(10, "bullet", 1));
    assertThat(state.weaponTickets).isEqualTo(1);
    assertThat(engine.view(state).skills().getFirst().owned()).isTrue();
    assertThat(engine.view(state).skills().get(1).owned()).isFalse();
  }

  @Test
  void circuitStopsClocksAndSurvivesOffline() {
    start(6);
    state.idle.circuitSeconds = 4;
    tick(1000, new IdleHit(6, "bullet", 1000));
    assertThat(state.idle.circuitSeconds).isEqualTo(2);
    assertThat(state.idle.activeSeconds).isZero();
    assertThat(state.capital).isZero();
    engine.beat(state, "one", ++sequence, "stop");
    clock.now += 86400000;
    engine.beat(state, "two", 0, "start");
    assertThat(state.idle.circuitSeconds).isEqualTo(2);
    assertThat(state.idle.damage).isZero();
  }

  @Test
  void legacyUncontactedQueuedDamageIsRepairedOnceWithoutResettingProgress() {
    state.idle = new CompanyState.Idle();
    state.idle.wall = 16;
    state.idle.damage = IdleEngine.maxHp(16);
    state.idle.nextDamage = IdleEngine.maxHp(17);
    state.idle.afterNextDamage = IdleEngine.maxHp(18);
    state.idle.earned = 123456;
    assertThat(engine.view(state).hp()).isEqualTo(1);
    assertThat(state.idle.wall).isEqualTo(16);
    assertThat(state.idle.earned).isEqualTo(123456);
    assertThat(state.idle.nextDamage).isZero();
    assertThat(state.idle.afterNextDamage).isZero();
    state.idle.nextDamage = 12;
    engine.view(state);
    assertThat(state.idle.nextDamage).isEqualTo(12);
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
