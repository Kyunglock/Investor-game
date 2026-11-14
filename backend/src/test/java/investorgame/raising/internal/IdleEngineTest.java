package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.offset;

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
  void viewCarriesTheLastHandledBeatSoTheScreenKnowsWhichHitsAreInTheHealth() {
    start(1);
    tick(500, new IdleHit(1, "bullet", 1));
    double hp = engine.view(state).hp();
    assertThat(engine.view(state).sequence()).isEqualTo(sequence);
    // A replayed beat changes neither the health nor the acknowledged sequence.
    engine.beat(state, "one", sequence, "tick", List.of(new IdleHit(1, "bullet", 1)));
    assertThat(engine.view(state).sequence()).isEqualTo(sequence);
    assertThat(engine.view(state).hp()).isEqualTo(hp);
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
    // Time income grows 5% per wall past the first (decisions.md 492), times the wall's price
    // level: 10% more per wall (505).
    assertThat(state.capital).isEqualTo(Math.floor(40 * 20000 * 3.5 * StrictMath.pow(1.1, 50)));
  }

  @Test
  void contactsDamageOnlyTheirWallAndDuplicatesCannotPayTwice() {
    start(1);
    tick(1000, new IdleHit(1, "bullet", 1));
    // One pistol bullet: twice the weapon's damage at half its rate (decisions.md 495).
    assertThat(state.idle.damage).isEqualTo(2);
    assertThat(state.idle.nextDamage).isZero();
    engine.beat(state, "one", sequence, "tick", List.of(new IdleHit(1, "bullet", 1)));
    assertThat(state.idle.damage).isEqualTo(2);
    tick(1000, new IdleHit(2, "bullet", 1), new IdleHit(50, "meteor", 10));
    assertThat(state.idle.damage).isEqualTo(2);
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
    assertThat(state.idle.damage).as("one pistol critical at most").isEqualTo(4);
    tick(1000, new IdleHit(1, "bullet", 1, Double.NaN), new IdleHit(1, "bullet", 1, -1.0));
    assertThat(state.idle.damage).isEqualTo(4);
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
  void slowBeatsKeepEveryRealHitButALongSilenceKeepsNone() {
    start(1);
    tick(1000);
    // Four seconds between beats on a slow link: the pistol fired about 15 bullets meanwhile.
    tick(4000, new IdleHit(1, "bullet", 14, 14.0));
    assertThat(state.idle.damage).isEqualTo(14);
    assertThat(state.capital).isEqualTo(5 * 40000);
    tick(10001, new IdleHit(1, "bullet", 3, 3.0));
    assertThat(state.idle.damage).isEqualTo(14);
    assertThat(state.capital).isEqualTo(5 * 40000);
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
    long paid = (long) state.capital;
    tick(1000, new IdleHit(6, "bullet", 1000));
    assertThat(state.idle.wall).isEqualTo(6);
    assertThat(state.capital).isEqualTo(paid);
    tick(1000);
    assertThat(state.idle.wall).isEqualTo(8);
    assertThat(state.idle.damage).isZero();
    // A cleared wall pays by its health (decisions.md 492).
    // The wall's price level multiplies it: 10% more per wall (505).
    assertThat(state.capital)
        .isEqualTo(
            paid
                + Math.floor(IdleEngine.maxHp(6) * 60000 * StrictMath.pow(1.1, 5))
                + Math.floor(IdleEngine.maxHp(7) * 60000 * StrictMath.pow(1.1, 6)));
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
    // Walls no longer unlock skills (decisions.md 501): without a cat nothing is cast.
    assertThat(engine.view(state).skills()).hasSize(4).noneMatch(skill -> skill.owned());
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
  void tenPullDrawsTenCatsInOrderOrNoneAtAll() {
    HashSeededRandom random = new HashSeededRandom(11);
    start(1);
    // 10연속 (517번): 뽑기권이 열 장 없으면 한 마리도 뽑지 않는다.
    state.weaponTickets = 9;
    assertThatThrownBy(() -> engine.drawCats(state, random, 10))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    assertThat(state.weaponTickets).isEqualTo(9);
    assertThat(engine.view(state).cats()).allMatch(cat -> cat.level() == 0);

    state.weaponTickets = 10;
    engine.drawCats(state, random, 10);
    assertThat(state.weaponTickets).isZero();
    var view = engine.view(state);
    assertThat(view.lastDraws()).hasSize(10);
    assertThat(view.cats().stream().mapToInt(cat -> cat.level()).sum()).isEqualTo(10);
    // 나온 차례의 레벨: 같은 고양이가 또 나오면 하나씩 오르고, 처음 나올 때만 새것이다.
    java.util.Map<String, Integer> seen = new java.util.HashMap<>();
    for (var d : view.lastDraws()) {
      int level = seen.merge(d.code(), 1, Integer::sum);
      assertThat(d.level()).isEqualTo(level);
      assertThat(d.isNew()).isEqualTo(level == 1);
    }
    for (var cat : view.cats()) {
      assertThat(cat.level()).isEqualTo(seen.getOrDefault(cat.code(), 0));
    }

    // 한 번 뽑기는 그 한 마리만 남긴다.
    state.weaponTickets = 1;
    engine.drawCat(state, random);
    assertThat(engine.view(state).lastDraws()).hasSize(1);
  }

  @Test
  void catsComeFromTheGachaNotFromWalls() {
    HashSeededRandom random = new HashSeededRandom(7);
    start(1);
    state.idle.wall = 60;
    assertThat(engine.view(state).cats()).allMatch(cat -> cat.level() == 0 && !cat.fielded());
    // A skill is a cat's own ability (decisions.md 501): deep walls alone cast nothing.
    tick(3000, new IdleHit(60, "meteor", 1));
    assertThat(state.idle.damage).isZero();
    assertThat(engine.view(state).skills()).hasSize(4).noneMatch(skill -> skill.owned());
    assertThatThrownBy(() -> engine.drawCat(state, random))
        .as("no ticket, no cat")
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);

    // One ticket, one cat (decisions.md 493). Capital is not spent.
    state.weaponTickets = 1;
    long capital = (long) state.capital;
    engine.drawCat(state, random);
    assertThat(state.weaponTickets).isZero();
    assertThat(state.capital).isEqualTo(capital);
    var drawn = engine.view(state).cats().stream().filter(cat -> cat.level() == 1).toList();
    assertThat(drawn).as("a new cat is fielded at once").hasSize(1).allMatch(cat -> cat.fielded());

    // Duplicates raise the level; with enough draws all six cats are owned, four of them fielded.
    state.weaponTickets = 60;
    for (int i = 0; i < 60; i++) engine.drawCat(state, random);
    var cats = engine.view(state).cats();
    assertThat(cats).hasSize(6).allMatch(cat -> cat.level() >= 1);
    assertThat(cats.stream().mapToInt(cat -> cat.level()).sum()).isEqualTo(61);
    assertThat(cats.stream().filter(cat -> cat.fielded()).count())
        .isEqualTo(engine.view(state).fieldSlots())
        .isEqualTo(4);
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
        .isEqualTo(4);
  }

  @Test
  void onlyFieldedCatsShootAndCastTheirOwnSkill() {
    start(16);
    assertThat(engine.view(state).cats().getFirst())
        .as("the sky cat's own skill is the meteor")
        .matches(cat -> cat.code().equals("sky") && cat.skill().equals("meteor"));
    double withCat = engine.view(state).dps();
    engine.fieldCat(state, "sky", false);
    assertThat(engine.view(state).dps()).isLessThan(withCat);
    assertThat(engine.view(state).skills()).noneMatch(skill -> skill.owned());
    tick(3000, new IdleHit(16, "meteor", 1));
    assertThat(state.idle.damage).as("a resting cat's skill does nothing").isZero();
    engine.fieldCat(state, "sky", true);
    tick(3000, new IdleHit(16, "meteor", 1), new IdleHit(16, "water", 1));
    assertThat(state.idle.damage).as("only the fielded cat's own skill lands").isEqualTo(4.8);
    assertThat(engine.view(state).skills())
        .filteredOn(skill -> skill.owned())
        .extracting(skill -> skill.code())
        .containsExactly("meteor");
    engine.fieldCat(state, "sky", false);
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
  void pricesAndPayGrowTogetherWithTheWallPastWhatALongHolds() {
    // 물가 (decisions.md 505번): 벽마다 보상·수입·강화 값이 함께 10%씩 커진다.
    start(1);
    company.mental.initWeapons(state);
    double first = engine.view(state).dps();
    long firstPrice = company.mental.upgradeViews(state).getFirst().price().longValue();
    state.idle.wall = 2001;
    double level = StrictMath.pow(1.1, 2000);
    assertThat(level).as("far beyond a long, around the z unit").isGreaterThan(1e78);
    assertThat(company.mental.upgradeViews(state).getFirst().price().doubleValue())
        .isCloseTo(firstPrice * level, org.assertj.core.data.Percentage.withPercentage(1e-6));
    assertThat(engine.view(state).dps()).as("the fight itself is unchanged").isEqualTo(first);
    // One second of income at that wall buys what one second bought at the first wall.
    tick(1000);
    tick(500);
    double income = state.capital;
    assertThat(income).isGreaterThan(1e78);
    assertThat(engine.view(state).earned().doubleValue()).isEqualTo(income);
    // The wall's reward is on the same scale, with no cap.
    state.idle.damage = IdleEngine.maxHp(2001) - 1;
    state.idle.hitCredits = new double[7];
    tick(500, new IdleHit(2001, "bullet", 1, 4.0));
    assertThat(state.idle.wall).isEqualTo(2002);
    assertThat(state.capital - income)
        .isGreaterThan(IdleEngine.maxHp(2001) * 60000 * level * 0.999);
    // Buying still works at that size.
    int bought = company.mental.buyUpgrade(state, "damage", 5);
    assertThat(bought).isEqualTo(5);
  }

  @Test
  void activeSkillsArePressedAndWaitOutTheirCooldown() {
    start(1);
    state.idle.wall = 100;
    tick(1000);
    var actives = engine.view(state).actives();
    assertThat(actives).extracting(a -> a.code()).containsExactly("barrage", "rally", "fortify");
    assertThat(actives).allMatch(a -> a.readyIn() == 0);
    // Without the press, barrage hits are worth nothing.
    tick(1000, new IdleHit(100, "barrage", 10, 22.5));
    assertThat(state.idle.damage).isZero();

    engine.useActive(state, "barrage");
    assertThat(engine.view(state).actives().getFirst().readyIn()).isEqualTo(30);
    assertThatThrownBy(() -> engine.useActive(state, "barrage"))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    assertThatThrownBy(() -> engine.useActive(state, "nope"))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    // Forty buy orders, each at most three times a buy order: 0.75 times the wall's order scale
    // (514). The weapon is not in it.
    double order = 0.75 * IdleEngine.threat(100);
    tick(1000, new IdleHit(100, "barrage", 50, 50 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(40 * 3 * order, offset(1e-9));
    tick(1000, new IdleHit(100, "barrage", 10, 22.5));
    assertThat(state.idle.damage).as("the press is spent").isCloseTo(40 * 3 * order, offset(1e-9));

    // The cooldown runs only while the battle runs: 30 real seconds at double speed.
    for (int i = 0; i < 27; i++) tick(1000);
    assertThatThrownBy(() -> engine.useActive(state, "barrage"))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    tick(1000);
    engine.useActive(state, "barrage");
  }

  @Test
  void rallyDoublesTheBulletBudgetWhileItBurns() {
    start(1);
    state.idle.wall = 100;
    for (int i = 0; i < 3; i++) tick(1000);
    state.idle.hitCredits = new double[7];
    tick(1000, new IdleHit(100, "bullet", 1000, 1000.0));
    double plain = state.idle.damage;
    assertThat(plain).isPositive();
    engine.useActive(state, "rally");
    state.idle.damage = 0;
    state.idle.hitCredits = new double[7];
    tick(1000, new IdleHit(100, "bullet", 1000, 1000.0));
    assertThat(state.idle.damage).isCloseTo(2 * plain, org.assertj.core.data.Offset.offset(1e-9));
    // Five real seconds later it is over.
    for (int i = 0; i < 5; i++) tick(1000);
    state.idle.damage = 0;
    state.idle.hitCredits = new double[7];
    tick(1000, new IdleHit(100, "bullet", 1000, 1000.0));
    assertThat(state.idle.damage).isCloseTo(plain, org.assertj.core.data.Offset.offset(1e-9));
  }

  @Test
  void twoCatsWithTheSameSkillCastItTwiceAsOften() {
    start(1);
    state.idle.cats.put("sky", 1);
    state.idle.fielded.add("sky");
    // 1.8 s at double speed is one 3.6 s cooldown.
    tick(1800, new IdleHit(1, "meteor", 2));
    assertThat(state.idle.damage).as("one caster, one meteor per cooldown").isEqualTo(4.8);
    // The night cat's own skill is the meteor too.
    state.idle.cats.put("night", 1);
    state.idle.fielded.add("night");
    state.idle.damage = 0;
    state.idle.hitCredits = new double[7];
    tick(1800, new IdleHit(1, "meteor", 4));
    assertThat(state.idle.damage).isEqualTo(2 * 4.8);
  }

  @Test
  void savesThatUnlockedSkillsByWallsKeepThemAsCats() {
    engine.view(state);
    state.idle.wall = 31;
    state.idle.cats = new java.util.LinkedHashMap<>();
    state.idle.fielded.clear();
    state.idle.catSkills = false;
    var view = engine.view(state);
    // Water, meteor and bolt were unlocked at walls 5, 15 and 30; the ram (50) was not.
    assertThat(view.skills())
        .filteredOn(skill -> skill.owned())
        .extracting(skill -> skill.code())
        .containsExactly("water", "meteor", "bolt");
    assertThat(view.cats())
        .filteredOn(cat -> cat.fielded())
        .extracting(cat -> cat.code())
        .containsExactlyInAnyOrder("mint", "sky", "lilac");
    // Only once: resting a cat afterwards is not undone.
    engine.fieldCat(state, "mint", false);
    assertThat(engine.view(state).skills().getFirst().owned()).isFalse();
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
        .as("half as many bullets as the guns' stats say")
        .isCloseTo(2.25 * 1000.0 / 260, org.assertj.core.data.Offset.offset(1e-9));
    assertThat(engine.view(state).wallDps()).as("what the wall really took lately").isPositive();
    // A forged bullet may claim the strongest gun's critical: here the boss cat's pistol, since
    // a level 6 cat still shoots at 50% x (1 + 0.2 x 5) = 100%.
    state.idle.cats.put("sky", 6);
    double before = state.idle.damage;
    for (int i = 0; i < 3; i++) tick(1000);
    tick(1000, new IdleHit(16, "bullet", 1, 1e12));
    assertThat(state.idle.damage - before).isEqualTo(4);
    state.idle.cats.put("sky", 11);
    before = state.idle.damage;
    tick(1000, new IdleHit(16, "bullet", 1, 1e12));
    assertThat(state.idle.damage - before).as("level 11 cat: 150% pistol critical").isEqualTo(6);
  }

  @Test
  void buyOrdersHaveTheirOwnDamageAndBudget() {
    start(1);
    state.idle.wall = 100;
    tick(1000);
    double order = 0.75 * IdleEngine.threat(100);
    assertThat(IdleEngine.threat(1)).isEqualTo(1.0);
    assertThat(IdleEngine.threat(100)).isEqualTo(5.2);
    // A buy order is capped at its own damage, whatever the screen reports.
    tick(1000, new IdleHit(100, "buy", 2, 2 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(2 * order, offset(1e-9));
    // A stronger weapon and the damage upgrade change nothing: buy damage is its own number (514).
    state.capital = 1e18;
    company.mental.buyUpgrade(state, "damage", 20);
    state.idle.damage = 0;
    tick(1000, new IdleHit(100, "buy", 2, 2 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(2 * order, offset(1e-9));
    // Only the buy upgrade raises it.
    double before = buyBonus();
    company.mental.buyUpgrade(state, "buy", 10);
    double up = (1 + buyBonus() / 100) / (1 + before / 100);
    assertThat(up).isGreaterThan(1);
    state.idle.damage = 0;
    tick(1000, new IdleHit(100, "buy", 2, 2 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(2 * order * up, offset(1e-9));
    // Buy orders do not spend the bullets' budget, and the reverse.
    state.idle.damage = 0;
    state.idle.hitCredits = new double[7];
    tick(1000, new IdleHit(100, "bullet", 1000, 1000.0));
    double bullets = state.idle.damage;
    state.idle.damage = 0;
    state.idle.hitCredits = new double[7];
    tick(1000, new IdleHit(100, "bullet", 1000, 1000.0), new IdleHit(100, "buy", 1, 1000.0));
    assertThat(state.idle.damage).isCloseTo(bullets + order * up, offset(1e-9));
    // The budget is the buy wall's fastest fire: far more than that is not accepted.
    state.idle.damage = 0;
    state.idle.hitCredits = new double[7];
    tick(1000, new IdleHit(100, "buy", 1000, 1000 * 1000.0));
    assertThat(state.idle.damage).isLessThan(30 * order * up);
  }

  private double buyBonus() {
    return company.mental.upgradeViews(state).stream()
        .filter(u -> "buy".equals(u.kind()))
        .findFirst()
        .orElseThrow()
        .bonusPercent();
  }

  @Test
  void aSkillLevelsUpWithItsCat() {
    assertThat(IdleEngine.skillLevel(1)).isEqualTo(1);
    assertThat(IdleEngine.skillLevel(2)).isEqualTo(1);
    assertThat(IdleEngine.skillLevel(3)).isEqualTo(2);
    assertThat(IdleEngine.skillLevel(9)).isEqualTo(5);
    assertThat(IdleEngine.skillLevel(1000)).isEqualTo(5);
    start(1);
    state.idle.wall = 100;
    state.idle.cats.put("mint", 1);
    state.idle.fielded.add("mint");
    var cat = engine.view(state).cats().stream().filter(c -> "mint".equals(c.code())).findFirst();
    assertThat(cat.orElseThrow().skillLevel()).isEqualTo(1);
    assertThat(cat.orElseThrow().skillNextLevel()).isEqualTo(3);
    // Level 1 water: 1.5 times the gun, once per 2.4 s. 1.2 s at double speed is one cooldown.
    tick(1200, new IdleHit(100, "water", 3, 3 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(1.5, offset(1e-9));
    // Cat level 5 is skill level 3: 2.6 times the gun, once per 1.8 s.
    state.idle.cats.put("mint", 5);
    state.idle.damage = 0;
    state.idle.hitCredits = new double[7];
    tick(900, new IdleHit(100, "water", 3, 3 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(2.6, offset(1e-9));
    cat = engine.view(state).cats().stream().filter(c -> "mint".equals(c.code())).findFirst();
    assertThat(cat.orElseThrow().skillLevel()).isEqualTo(3);
    assertThat(cat.orElseThrow().skillNextLevel()).isEqualTo(7);
    assertThat(engine.view(state).skills().getFirst().level()).isEqualTo(3);
    // The top level has no next level.
    state.idle.cats.put("mint", 9);
    cat = engine.view(state).cats().stream().filter(c -> "mint".equals(c.code())).findFirst();
    assertThat(cat.orElseThrow().skillLevel()).isEqualTo(5);
    assertThat(cat.orElseThrow().skillNextLevel()).isZero();
    // A level 3 meteor shower drops three rocks per cast: three hits per 3 s.
    state.idle.cats.put("sky", 5);
    state.idle.fielded.add("sky");
    state.idle.damage = 0;
    state.idle.hitCredits = new double[7];
    tick(1500, new IdleHit(100, "meteor", 10, 10 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(3 * 4.2, offset(1e-9));
  }

  private investorgame.raising.CompanyView.CatWeapon weaponOf(String code) {
    return engine.view(state).cats().stream()
        .filter(cat -> cat.code().equals(code))
        .findFirst()
        .orElseThrow()
        .weapon();
  }
}
