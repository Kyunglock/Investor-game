package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import investorgame.raising.CompanyService.IdleHit;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
    // An old save at this wall: the cats that used to join at walls 15 and 50 are kept.
    state.idle.cats = null;
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
    // Time income grows 5% per wall past the first (decisions.md 492).
    assertThat(state.capital).isEqualTo(Math.round(40 * 20000 * 3.5));
  }

  @Test
  void contactsDamageOnlyTheirWallAndDuplicatesCannotPayTwice() {
    start(1);
    tick(1000, new IdleHit(1, "bullet", 1));
    assertThat(state.idle.damage).isEqualTo(1);
    assertThat(state.idle.nextDamage).isZero();
    engine.beat(state, "one", sequence, "tick", List.of(new IdleHit(1, "bullet", 1)));
    assertThat(state.idle.damage).isEqualTo(1);
    tick(1000, new IdleHit(2, "bullet", 1), new IdleHit(50, "meteor", 10));
    assertThat(state.idle.damage).isEqualTo(1);
    assertThat(state.idle.nextDamage).isZero();
  }

  @Test
  void collisionAmountsMatchDisplayWithoutHiddenMultiplier() {
    start(51);
    tick(
        3000,
        new IdleHit(51, "bullet", 1, 0.75),
        new IdleHit(51, "water", 1, 1.5),
        new IdleHit(51, "meteor", 1, 2.4));
    assertThat(state.idle.damage).isCloseTo(4.65, org.assertj.core.data.Offset.offset(1e-9));
    double damage = state.idle.damage;
    tick(1000);
    assertThat(state.idle.damage).isEqualTo(damage);
  }

  @Test
  void fireUpgradeCannotMultiplySingleMeteorDamage() {
    state.battleLevels.put("fire", 100);
    start(16);
    tick(3000, new IdleHit(16, "meteor", 1, 4.8));
    assertThat(state.idle.damage).isEqualTo(4.8);
  }

  @Test
  void forgedAmountsAreLimitedByWeaponAndAcquiredSkillStats() {
    start(1);
    tick(1000, new IdleHit(1, "bullet", 1, 1e12), new IdleHit(1, "meteor", 1, 1e12));
    assertThat(state.idle.damage).as("one pistol critical at most").isEqualTo(2);
    tick(1000, new IdleHit(1, "bullet", 1, Double.NaN), new IdleHit(1, "bullet", 1, -1.0));
    assertThat(state.idle.damage).isEqualTo(2);
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
    double dps = 1000.0 / 260;
    assertThat(state.idle.damage).isCloseTo(dps * 2, org.assertj.core.data.Offset.offset(1e-9));
    assertThat(state.idle.wall).isEqualTo(1);
    for (int i = 0; i < 10; i++) tick(1000);
    double before = state.idle.damage;
    tick(1, new IdleHit(1, "bullet", 1000));
    assertThat(state.idle.damage - before).isLessThanOrEqualTo(dps * 6);
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
    state.battleLevels.put("damage", 10000);
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
    // A cleared wall pays by its health (decisions.md 492).
    assertThat(state.capital)
        .isEqualTo(
            paid + (long) (IdleEngine.maxHp(6) * 40000) + (long) (IdleEngine.maxHp(7) * 40000));
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

  @ParameterizedTest
  @ValueSource(ints = {0, 1})
  void legacyInflatedQueuedDamageIsRepairedOnceWithoutResettingProgress(int version) {
    state.idle = new CompanyState.Idle();
    state.idle.hitVersion = version;
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

  @Test
  void catsComeFromTheGachaNotFromWalls() {
    HashSeededRandom random = new HashSeededRandom(7);
    start(1);
    state.idle.wall = 60;
    assertThat(engine.view(state).cats()).allMatch(cat -> cat.level() == 0 && !cat.fielded());
    // Skills are unlocked by walls and do not need a cat (decisions.md 491).
    tick(3000, new IdleHit(60, "meteor", 1));
    assertThat(state.idle.damage).isEqualTo(4.8);
    assertThat(engine.view(state).skills()).hasSize(4).allMatch(skill -> skill.owned());
    assertThatThrownBy(() -> engine.drawCat(state, random))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);

    long first = engine.view(state).catPrice();
    state.capital = first;
    engine.drawCat(state, random);
    assertThat(state.capital).isZero();
    assertThat(state.yearUpgrades).isEqualTo(first);
    assertThat(first).isEqualTo(10_000_000);
    assertThat(engine.view(state).catPrice()).isEqualTo(Math.round(first * 1.3));
    var drawn = engine.view(state).cats().stream().filter(cat -> cat.level() == 1).toList();
    assertThat(drawn).as("a new cat is fielded at once").hasSize(1).allMatch(cat -> cat.fielded());

    // Duplicates raise the level; with enough draws all three cats are owned, two of them fielded.
    state.capital = Long.MAX_VALUE / 4;
    for (int i = 0; i < 30; i++) engine.drawCat(state, random);
    var cats = engine.view(state).cats();
    assertThat(cats).hasSize(3).allMatch(cat -> cat.level() >= 1);
    assertThat(cats.stream().mapToInt(cat -> cat.level()).sum()).isEqualTo(31);
    assertThat(cats.stream().filter(cat -> cat.fielded()).count())
        .isEqualTo(engine.view(state).fieldSlots())
        .isEqualTo(2);
    // A cat's gun: half the weapon's damage, +20% of that per level, times its trait.
    var sky = cats.getFirst();
    assertThat(sky.damagePercent()).isEqualTo((int) Math.round(50 * (1 + 0.2 * (sky.level() - 1))));
    assertThat(sky.firePercent()).isEqualTo(125);
    assertThat(cats.get(1).firePercent()).isEqualTo(100);
    assertThat(cats.get(2).criticalPercent()).isEqualTo(150);
    // The bench is full: resting one cat makes room for another.
    var resting = cats.stream().filter(cat -> !cat.fielded()).findFirst().orElseThrow().code();
    var fielded = cats.stream().filter(cat -> cat.fielded()).findFirst().orElseThrow().code();
    assertThatThrownBy(() -> engine.fieldCat(state, resting, true))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    engine.fieldCat(state, fielded, false);
    engine.fieldCat(state, resting, true);
    assertThat(engine.view(state).cats().stream().filter(cat -> cat.fielded()).count())
        .isEqualTo(2);
  }

  @Test
  void onlyFieldedCatsShootButSkillsDoNotNeedCats() {
    start(16);
    double withCat = engine.view(state).dps();
    engine.fieldCat(state, "sky", false);
    assertThat(engine.view(state).dps()).isLessThan(withCat);
    tick(3000, new IdleHit(16, "meteor", 1));
    assertThat(state.idle.damage).as("the skill fires without the cat").isEqualTo(4.8);
    // A resting cat's gun no longer adds to the bullet budget.
    for (int i = 0; i < 3; i++) tick(1000);
    double before = state.idle.damage;
    tick(1000, new IdleHit(16, "bullet", 1000, 1000.0));
    double alone = state.idle.damage - before;
    engine.fieldCat(state, "sky", true);
    for (int i = 0; i < 3; i++) tick(1000);
    before = state.idle.damage;
    tick(1000, new IdleHit(16, "bullet", 1000, 1000.0));
    assertThat(state.idle.damage - before).isGreaterThan(alone);
    assertThatThrownBy(() -> engine.fieldCat(state, "mint", true))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
  }

  @Test
  void catsBorrowOwnedWeaponsAndTheBossCatKeepsItsOwn() {
    company.mental.initWeapons(state);
    start(51);
    assertThatThrownBy(() -> engine.equipCat(state, "sky", "pistol", "F"))
        .as("the only copy is in the boss cat's paws")
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    assertThatThrownBy(() -> engine.equipCat(state, "sky", "rifle", "S"))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);

    state.weapons.add(new CompanyState.Weapon("rifle", "S"));
    double before = engine.view(state).dps();
    engine.equipCat(state, "sky", "rifle", "S");
    assertThat(engine.view(state).dps()).isGreaterThan(before);
    assertThat(weaponOf("sky"))
        .isEqualTo(new investorgame.raising.CompanyView.CatWeapon("rifle", "S"));
    // One copy: the cat that equips last takes it from the other cat.
    engine.equipCat(state, "mint", "rifle", "S");
    assertThat(weaponOf("sky")).isNull();
    assertThat(weaponOf("mint")).isNotNull();
    // The boss cat takes the last copy back.
    company.mental.equip(state, "rifle", "S");
    engine.releaseWeapons(state);
    assertThat(weaponOf("mint")).isNull();
    // A second copy can be shared.
    state.weapons.getLast().count = 2;
    engine.equipCat(state, "mint", "rifle", "S");
    assertThat(weaponOf("mint")).isNotNull();
    engine.equipCat(state, "mint", null, null);
    assertThat(weaponOf("mint")).isNull();
  }

  @Test
  void aCatsBulletIsLimitedByItsOwnGunAndLevel() {
    company.mental.initWeapons(state);
    start(16);
    // Boss cat and sky (fires 25% faster), both with the starting pistol.
    tick(1000, new IdleHit(16, "bullet", 1000, 1000.0));
    assertThat(state.idle.damage)
        .isCloseTo(2 * 2.25 * 1000.0 / 260, org.assertj.core.data.Offset.offset(1e-9));
    assertThat(engine.view(state).wallDps()).as("what the wall really took lately").isPositive();
    // A forged bullet may claim the strongest gun's critical: here the boss cat's pistol, since
    // a level 6 cat still shoots at 50% x (1 + 0.2 x 5) = 100%.
    state.idle.cats.put("sky", 6);
    double before = state.idle.damage;
    for (int i = 0; i < 3; i++) tick(1000);
    tick(1000, new IdleHit(16, "bullet", 1, 1e12));
    assertThat(state.idle.damage - before).isEqualTo(2);
    state.idle.cats.put("sky", 11);
    before = state.idle.damage;
    tick(1000, new IdleHit(16, "bullet", 1, 1e12));
    assertThat(state.idle.damage - before).as("level 11 cat: 150% pistol critical").isEqualTo(3);
  }

  private investorgame.raising.CompanyView.CatWeapon weaponOf(String code) {
    return engine.view(state).cats().stream()
        .filter(cat -> cat.code().equals(code))
        .findFirst()
        .orElseThrow()
        .weapon();
  }
}
