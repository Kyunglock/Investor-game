package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.offset;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
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

  @Test
  void removedBakeryFieldsDoNotBreakExistingSaves() {
    JsonMapper json = JsonMapper.builder().build();
    CompanyState saved =
        json.readValue(
            """
        {"capital":12345,"diamonds":80,"idle":{"wall":25,"bread":120,"bakingMillis":1234,"bundleMillis":1800000}}
        """,
            CompanyState.class);
    assertThat(engine.view(saved).wall()).isEqualTo(25);
    assertThat(saved.capital).isEqualTo(12345);
    assertThat(saved.diamonds).isEqualTo(80);
    assertThat(json.writeValueAsString(saved))
        .doesNotContain("bread", "bakingMillis", "bundleMillis");
  }

  @Test
  void bulkMergeUsesOnlySparesAndChainsAcrossGrades() {
    company.mental.initWeapons(state);
    engine.view(state);
    state.weapon.count = 7;
    state.idle.catWeapons.put("night", new CompanyState.Weapon("pistol", "F"));
    var highest = new CompanyState.Weapon("rifle", "LR");
    highest.count = 2;
    state.weapons.add(highest);

    assertThat(engine.mergeAllWeapons(state)).isEqualTo(3);
    assertThat(state.weapon.count).isEqualTo(3);
    assertThat(state.idle.catWeapons.get("night").grade).isEqualTo("F");
    assertThat(highest.count).isEqualTo(2);
    assertThat(state.weapons).anyMatch(w -> w.same("revolver", "D") && w.count == 1);
    assertThat(engine.mergeAllWeapons(state)).isZero();
  }

  @Test
  void onboardingResumesAndOnlyGrantsEachGiftOnce() {
    CompanyState c = company.open(new HashSeededRandom(3), company.openingCapital());
    assertThat(engine.view(c).onboarding().step()).isEqualTo(-1);
    engine.tutorial(c, "next", -1);
    long diamonds = c.diamonds;
    // 첫 매도벽 구경 단계 없이 바로 공격력 강화로 간다.
    assertThat(engine.view(c).onboarding().step()).isEqualTo(1);
    engine.tutorial(c, "next", -1); // lost response retry
    assertThat(engine.view(c).onboarding().step()).isEqualTo(1);
    assertThatThrownBy(() -> engine.tutorial(c, "next", 1))
        .isInstanceOf(InvalidRequestException.class);
    c.battleLevels.put("damage", 1);
    engine.tutorial(c, "next", 1);
    engine.tutorial(c, "draw-cat", 2);
    engine.tutorial(c, "draw-cat", 2); // lost response retry
    assertThat(c.idle.cats.get("night")).isEqualTo(1);
    assertThat(
            engine.view(c).cats().stream()
                .filter(cat -> cat.code().equals("night"))
                .findFirst()
                .orElseThrow()
                .grade())
        .isEqualTo("A");
    JsonMapper json = JsonMapper.builder().build();
    CompanyState resumed = json.readValue(json.writeValueAsString(c), CompanyState.class);
    assertThat(engine.view(resumed).onboarding().step()).isEqualTo(3);
    assertThatThrownBy(() -> engine.tutorial(resumed, "next", 3))
        .isInstanceOf(InvalidRequestException.class);
    engine.fieldCat(resumed, "night", true);
    engine.tutorial(resumed, "next", 3);
    engine.tutorial(resumed, "draw-weapon", 4);
    assertThatThrownBy(() -> engine.tutorial(resumed, "next", 5))
        .isInstanceOf(InvalidRequestException.class);
    engine.equipCat(resumed, "night", "smg", "B");
    engine.tutorial(resumed, "next", 5);
    assertThat(engine.view(resumed).onboarding().step()).isEqualTo(7);
    resumed.tutorialStep = 6;
    assertThat(engine.view(resumed).onboarding().step()).isEqualTo(7);
    engine.tutorial(resumed, "next", 7);
    engine.tutorial(resumed, "draw-cat", 2);
    engine.tutorial(resumed, "draw-weapon", 4);
    assertThat(resumed.diamonds).isEqualTo(diamonds);
    assertThat(resumed.idle.cats.get("night")).isEqualTo(1);
    assertThat(
            resumed.weapons.stream()
                .filter(w -> w.grade.equals("B"))
                .findFirst()
                .orElseThrow()
                .count)
        .isEqualTo(1);
    resumed.idle.wall = 101;
    engine.rebirth(resumed);
    assertThat(engine.view(resumed).onboarding().step()).isEqualTo(8);
    assertThat(engine.view(resumed).onboarding().skillsUnlocked()).isTrue();
  }

  @Test
  void legacyPlayersOptInAndCannotSkipOrClaimWithoutDrawing() {
    assertThat(engine.view(state).onboarding().step()).isEqualTo(8);
    engine.tutorial(state, "start", 8);
    assertThat(engine.view(state).onboarding().step()).isEqualTo(-1);
    for (String action : List.of("skip", "claim", "draw-cat", "draw-weapon")) {
      assertThatThrownBy(() -> engine.tutorial(state, action, -1))
          .isInstanceOf(InvalidRequestException.class);
    }
    state.tutorialStep = 2;
    assertThatThrownBy(() -> engine.tutorial(state, "next", 2))
        .isInstanceOf(InvalidRequestException.class);
    engine.tutorial(state, "draw-cat", 2);
    assertThat(state.idle.cats.get("night")).isEqualTo(1);
    assertThat(state.idle.fielded).doesNotContain("night");
    assertThat(state.idle.lastDraws.getFirst().kind).isEqualTo("night");
    state.tutorialStep = 4;
    assertThatThrownBy(() -> engine.tutorial(state, "next", 4))
        .isInstanceOf(InvalidRequestException.class);
    engine.tutorial(state, "draw-weapon", 4);
    assertThat(state.lastWeaponDraw.kind).isEqualTo("smg");
    assertThat(state.lastWeaponDraw.grade).isEqualTo("B");
    assertThat(state.idle.catWeapons).doesNotContainKey("night");
  }

  @Test
  void legacyUnlockedPlayersSkipTheGuideButLaterUnlocksStillGetIt() {
    CompanyState veteran = new CompanyState();
    veteran.idle = new CompanyState.Idle();
    veteran.idle.wall = 101;
    assertThat(engine.view(veteran).onboarding().skillGuideSeen()).isTrue();
    assertThat(engine.view(veteran).onboarding().step()).isEqualTo(8);
    CompanyState newcomer = new CompanyState();
    assertThat(engine.view(newcomer).onboarding().skillGuideSeen()).isFalse();
    newcomer.idle.wall = 101;
    assertThat(engine.view(newcomer).onboarding().skillsUnlocked()).isTrue();
    assertThat(engine.view(newcomer).onboarding().skillGuideSeen()).isFalse();
  }

  @Test
  void activeSkillsRequireClearingWall100ButCatMeteorDoesNot() {
    start(100);
    assertThat(engine.view(state).onboarding().skillsUnlocked()).isFalse();
    assertThatThrownBy(() -> engine.useActive(state, "barrage"))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> engine.useActive(state, "boostFire", true))
        .isInstanceOf(InvalidRequestException.class);
    state.tutorialStep = 2;
    engine.tutorial(state, "draw-cat", 2);
    engine.fieldCat(state, "night", true);
    assertThat(
            engine.view(state).skills().stream()
                .filter(skill -> skill.code().equals("meteor"))
                .findFirst()
                .orElseThrow()
                .owned())
        .isTrue();
    state.idle.wall = 101;
    assertThat(engine.view(state).onboarding().skillsUnlocked()).isTrue();
    engine.useActive(state, "boostFire", true);
    engine.tutorial(state, "skills", 8);
    assertThat(engine.view(state).onboarding().skillGuideSeen()).isTrue();
    engine.rebirth(state);
    assertThat(engine.view(state).onboarding().skillsUnlocked()).isTrue();
  }

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

  /** The fight's speed on screen (580): IdleEngine.SPEED. */
  private static final double SPEED = 1.5;

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
    assertThat(state.idle.activeSeconds).isEqualTo(30); // Foreground time runs at 1.5x (580).
    // Time income is the first wall's times the wall's price level: 4% more per wall, the same
    // rate as the upgrade prices (decisions.md 553).
    assertThat(state.capital).isEqualTo(Math.floor(40 * 1000 * StrictMath.pow(1.04, 50)));
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
    // A bullet reported on the next wall is a pierce (520): half a bullet, queued on that wall.
    assertThat(state.idle.nextDamage).isEqualTo(1);
  }

  /** 극광의 밤은 뒤 매도벽도 친다 (673번): 총알의 관통과 같은 비율(절반·4분의 1)까지. 다른 스킬은 맨 앞 벽에서 멈춘다. */
  @Test
  void auroraNightAlsoHitsTheQueuedWalls() {
    start(1);
    state.idle.cats.putAll(java.util.Map.of("aurora", 1, "night", 1));
    state.idle.fielded.addAll(List.of("aurora", "night"));
    tick(
        3000,
        new IdleHit(1, "auroraNight", 1, 0.01, 0),
        new IdleHit(2, "auroraNight", 1, 0.005, 1),
        new IdleHit(3, "auroraNight", 1, 1e12, 2),
        new IdleHit(2, "meteor", 1, 0.01, 1));
    // 명중 예산(쿨타임)만큼만 받으므로 비율로 본다: 뒤 벽은 맨 앞 벽의 절반, 메테오는 뒤 벽에 닿지 않는다.
    assertThat(state.idle.damage).isPositive();
    assertThat(state.idle.nextDamage)
        .isCloseTo(state.idle.damage / 2, org.assertj.core.data.Offset.offset(1e-9));
    // 한 번의 명중은 맨 앞 벽에 줄 수 있는 피해의 4분의 1까지만 받는다.
    assertThat(state.idle.afterNextDamage).isPositive().isLessThan(1e9);
  }

  @Test
  void collisionAmountsMatchDisplayWithoutHiddenMultiplier() {
    start(51);
    // Only A and S grade cats have skills (561): the ocean cat casts water, the night cat meteors.
    state.idle.cats.putAll(java.util.Map.of("ocean", 1, "night", 1));
    state.idle.fielded.addAll(List.of("ocean", "night"));
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
    state.idle.cats.put("night", 1);
    state.idle.fielded.add("night");
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
    // The day away pays time income up to eight hours (decisions.md 523), never damage.
    double away = 8 * 3600 * 2000.0;
    assertThat(state.capital).isEqualTo(2000 + away);
    engine.beat(state, "one", ++sequence, "stop");
    tick(1000, new IdleHit(1, "bullet", 1000));
    assertThat(state.idle.damage).isZero();
    assertThat(state.capital)
        .as("the second after the stop is paid as time away")
        .isEqualTo(4000 + away);
  }

  @Test
  void slowBeatsKeepEveryRealHitButALongSilenceKeepsNone() {
    start(1);
    tick(1000);
    // Four seconds between beats on a slow link: the pistol fired about 15 bullets meanwhile.
    tick(4000, new IdleHit(1, "bullet", 9, 9.0));
    assertThat(state.idle.damage).isEqualTo(9);
    assertThat(state.capital).isEqualTo(5 * 2000);
    tick(10001, new IdleHit(1, "bullet", 3, 3.0));
    assertThat(state.idle.damage).isEqualTo(9);
    // The silence keeps no hits, but its time income is still paid (523).
    assertThat(state.capital).isEqualTo(5 * 2000 + Math.floor(10.001 * 2000));
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
    start(10);
    tick(1000, new IdleHit(10, "bullet", 1000), new IdleHit(10, "meteor", 1000));
    double dps = 1000.0 / 260;
    assertThat(state.idle.damage).isCloseTo(dps * SPEED, org.assertj.core.data.Offset.offset(1e-9));
    assertThat(state.idle.wall).isEqualTo(10);
    for (int i = 0; i < 10; i++) tick(1000);
    double before = state.idle.damage;
    tick(1, new IdleHit(10, "bullet", 1000));
    // The hit budget holds at most the grace time's worth of shots (497): twenty of them here.
    assertThat(state.idle.damage - before).isLessThanOrEqualTo(dps * 20 + 1e-9);
  }

  @Test
  void bulletsPierceIntoTheTwoWallsBehindAtHalfAndQuarterDamageAndPersist() {
    // 총알 관통 (decisions.md 520번): 맨 앞 벽 100% → 다음 벽 50% → 그다음 벽 25%.
    start(1);
    tick(
        1000,
        new IdleHit(1, "bullet", 1),
        new IdleHit(2, "bullet", 1),
        new IdleHit(3, "bullet", 1));
    assertThat(state.idle.damage).isEqualTo(2);
    assertThat(state.idle.nextDamage).isEqualTo(1);
    assertThat(state.idle.afterNextDamage).isEqualTo(0.5);
    // A wall past the third is out of reach.
    tick(1000, new IdleHit(4, "bullet", 1));
    assertThat(state.idle.damage).isEqualTo(2);
    // The queued damage stays until the wall comes to the front, and survives a save.
    tick(1000);
    assertThat(state.idle.nextDamage).isEqualTo(1);
    JsonMapper json = JsonMapper.builder().build();
    CompanyState saved = json.readValue(json.writeValueAsString(state), CompanyState.class);
    assertThat(engine.view(saved)).isEqualTo(engine.view(state));
  }

  @Test
  void theBestWallSurvivesARebirthAndIsShown() {
    // 최고 기록 (654번): 통과한 가장 높은 벽을 화면에 보인다. 환생해 벽 1로 돌아가도 남는다.
    start(1);
    state.idle.best = 120;
    state.idle.wall = 5;
    assertThat(engine.view(state).bestWall()).isEqualTo(120);
    state.idle.wall = 140;
    assertThat(engine.view(state).bestWall()).isEqualTo(139);
  }

  @Test
  void aBossWallCannotBePierced() {
    // 대량 매도벽(보스, 50번째 벽마다)은 뚫리지 않는다: 맞지도 않고 그 뒤로 가지도 않는다.
    assertThat(IdleEngine.pierceBlocked(50, 1)).isTrue();
    assertThat(IdleEngine.pierceBlocked(51, 1)).isTrue();
    assertThat(IdleEngine.pierceBlocked(51, 2)).isTrue();
    assertThat(IdleEngine.pierceBlocked(52, 2)).isTrue();
    assertThat(IdleEngine.pierceBlocked(49, 1)).isFalse();
    assertThat(IdleEngine.pierceBlocked(53, 2)).isFalse();
    // 열 번째 벽은 이제 보통 벽이다 (550번).
    assertThat(IdleEngine.pierceBlocked(10, 1)).isFalse();
    assertThat(IdleEngine.pierceBlocked(11, 2)).isFalse();
  }

  @Test
  void piercedDamageIsCappedAtTheWallsShareOfOneBullet() {
    start(1);
    // A forged pierce report as strong as a full bullet: only 50% and 25% of the best bullet count.
    tick(1000, new IdleHit(2, "bullet", 1, 1000.0), new IdleHit(3, "bullet", 1, 1000.0));
    double best = 2 * 2; // One pistol bullet (2) at the default critical multiplier (x2).
    assertThat(state.idle.damage).isZero();
    assertThat(state.idle.nextDamage).isEqualTo(best * IdleEngine.PIERCE[1]);
    assertThat(state.idle.afterNextDamage).isEqualTo(best * IdleEngine.PIERCE[2]);
    assertThat(IdleEngine.PIERCE).containsExactly(1, 0.5, 0.25);
  }

  @Test
  void oneBulletThroughThreeWallsSpendsOneHitOfTheBudget() {
    start(1);
    tick(
        1000,
        new IdleHit(1, "bullet", 1000),
        new IdleHit(2, "bullet", 1000),
        new IdleHit(3, "bullet", 1000));
    // The same number of bullets is accepted on each wall: the fire rate's budget, not three times.
    double bullets = state.idle.damage / 2;
    assertThat(bullets)
        .isCloseTo(SPEED / 2 * 1000.0 / 260, org.assertj.core.data.Offset.offset(1e-9));
    assertThat(state.idle.nextDamage).isCloseTo(bullets, org.assertj.core.data.Offset.offset(1e-9));
    assertThat(state.idle.afterNextDamage)
        .isCloseTo(bullets / 2, org.assertj.core.data.Offset.offset(1e-9));
  }

  @Test
  void explosionsAndSkillsNeverReachTheWallsBehind() {
    // 폭발 무기와 고양이 스킬의 광역 피해는 맨 앞 벽만 (520번).
    start(1);
    state.idle.wall = 100;
    state.idle.cats =
        new java.util.LinkedHashMap<>(
            java.util.Map.of("ocean", 9, "night", 9, "silver", 9, "panda", 9));
    state.idle.fielded = new java.util.ArrayList<>(List.of("ocean", "night", "silver", "panda"));
    tick(
        3000,
        new IdleHit(100, "water", 1),
        new IdleHit(100, "meteor", 1),
        new IdleHit(100, "bolt", 1),
        new IdleHit(100, "ram", 1));
    double front = state.idle.damage;
    assertThat(front).isPositive();
    tick(
        3000,
        new IdleHit(101, "water", 1),
        new IdleHit(101, "meteor", 1),
        new IdleHit(101, "bolt", 1),
        new IdleHit(101, "ram", 1),
        new IdleHit(102, "water", 1),
        new IdleHit(102, "meteor", 1));
    assertThat(state.idle.wall).isEqualTo(100);
    assertThat(state.idle.damage).isEqualTo(front);
    assertThat(state.idle.nextDamage).isZero();
    assertThat(state.idle.afterNextDamage).isZero();
  }

  @Test
  void aWallBehindNeverBreaksBeforeTheOneInFront() {
    start(1);
    state.battleLevels.put("damage", 10000);
    for (int i = 0; i < 30; i++) {
      tick(1000, new IdleHit(2, "bullet", 1000), new IdleHit(3, "bullet", 1000));
    }
    assertThat(state.idle.wall).isEqualTo(1);
    assertThat(state.idle.nextDamage).isEqualTo(IdleEngine.maxHp(2) - 1);
    assertThat(state.idle.afterNextDamage).isEqualTo(IdleEngine.maxHp(3) - 1);
    assertThat(engine.view(state).upcoming()).allMatch(wall -> wall.hp() == 1);
    // Breaking the front wall brings the next one forward with its last point of health: it needs
    // a hit of its own, and so does the one after it.
    tick(1000, new IdleHit(1, "bullet", 1, IdleEngine.maxHp(1)));
    assertThat(state.idle.wall).isEqualTo(2);
    assertThat(engine.view(state).hp()).isEqualTo(1);
    tick(1000);
    assertThat(state.idle.wall).isEqualTo(2);
    tick(1000, new IdleHit(2, "bullet", 1, 1.0));
    assertThat(state.idle.wall).isEqualTo(3);
    assertThat(engine.view(state).hp()).isEqualTo(1);
  }

  @Test
  void savesWithAQueuedWallAlreadyAtZeroKeepItsLastPoint() {
    start(1);
    state.idle.nextDamage = IdleEngine.maxHp(2);
    state.idle.afterNextDamage = IdleEngine.maxHp(3) + 5;
    assertThat(engine.view(state).upcoming()).allMatch(wall -> wall.hp() == 1);
    assertThat(state.idle.nextDamage).isEqualTo(IdleEngine.maxHp(2) - 1);
    assertThat(state.idle.afterNextDamage).isEqualTo(IdleEngine.maxHp(3) - 1);
  }

  @Test
  void whatIsLeftOfTheBreakingDamageGoesOnToTheNextWall() {
    // 화면이 먼저 벽을 부순다 (532번): 넘친 피해와 그 뒤의 명중은 다음 벽의 것이다.
    state.battleLevels.put("damage", 10000);
    start(1);
    tick(1000, new IdleHit(1, "bullet", 1, IdleEngine.maxHp(1) + 5));
    assertThat(state.idle.wall).isEqualTo(2);
    assertThat(state.idle.damage).isEqualTo(5);
    // The screen was already two walls on when it sent these: direct hits are damage to the front
    // wall here, whichever wall the screen names.
    tick(
        1000,
        new IdleHit(3, "bullet", 1, IdleEngine.maxHp(2), 0),
        new IdleHit(4, "bullet", 1, 3.0, 1));
    assertThat(state.idle.wall).isEqualTo(3);
    assertThat(state.idle.damage).isCloseTo(5, offset(1e-9));
    assertThat(state.idle.nextDamage).isEqualTo(3);
    // One huge hit runs through several walls, and no circuit breaker stops it at 6 (533).
    tick(1000, new IdleHit(3, "bullet", 1000));
    assertThat(state.idle.wall).isGreaterThan(6);
    assertThat(state.idle.circuitSeconds).isZero();
  }

  @Test
  void piercedHitsKeepToTheWallTheyNameEvenFarBehind() {
    start(1);
    state.battleLevels.put("damage", 10000);
    tick(
        1000,
        new IdleHit(4, "bullet", 1, 2.0, 2),
        new IdleHit(6, "bullet", 1, 4.0, 1),
        new IdleHit(8, "bullet", 1, 4.0, 1),
        new IdleHit(1, "bullet", 1, 4.0, 1));
    assertThat(state.idle.wall).isEqualTo(1);
    assertThat(state.idle.damage).isZero();
    assertThat(state.idle.farDamage).containsExactly(2, 0, 4, 0);
    // They come forward as the walls in front break.
    tick(1000, new IdleHit(1, "bullet", 1, IdleEngine.maxHp(1), 0));
    assertThat(state.idle.afterNextDamage).isEqualTo(2);
    assertThat(state.idle.farDamage).containsExactly(0, 4, 0, 0);
  }

  @Test
  void alreadyHitRearWallsClearInOrderWithoutCircuit() {
    start(5);
    state.idle.damage = IdleEngine.maxHp(5) - 1;
    state.idle.nextDamage = IdleEngine.maxHp(6) - 1;
    state.idle.afterNextDamage = IdleEngine.maxHp(7) - 1;
    tick(1000, new IdleHit(5, "bullet", 1, 1.0));
    assertThat(state.idle.wall).isEqualTo(6);
    // Wall 6 does not halt trading (533): only a boss challenge does (547).
    assertThat(state.idle.circuitSeconds).isZero();
    long paid = (long) state.capital;
    tick(1000);
    // Pierced walls keep their last point of health (520): each needs one hit as the front wall.
    assertThat(state.idle.wall).isEqualTo(6);
    tick(1000, new IdleHit(6, "bullet", 1, 1.0));
    assertThat(state.idle.wall).isEqualTo(7);
    tick(1000, new IdleHit(7, "bullet", 1, 1.0));
    assertThat(state.idle.wall).isEqualTo(8);
    assertThat(state.idle.damage).isZero();
    // A cleared wall pays REWARD_UPGRADES upgrade steps at its price level (decisions.md 553):
    // 4% more per wall, as the upgrade prices grow per step.
    assertThat(state.capital - paid)
        .isGreaterThanOrEqualTo(
            Math.floor(1_000_000 * IdleEngine.REWARD_UPGRADES * StrictMath.pow(1.04, 5))
                + Math.floor(1_000_000 * IdleEngine.REWARD_UPGRADES * StrictMath.pow(1.04, 6)));
  }

  @Test
  void powerIsOneNumberThatEveryUpgradeRaisesAndTheWallDoesNotChange() {
    // 전투력 (538·635번): 권총·강화 없음이면 100 × √(2배속 × 초당 피해와 매수 주문의 합 5.69) = 337 (688번: 매수 주문이 1.5에서 1.0이
    // 되어 6.69·365에서).
    start(1);
    double base = engine.view(state).power();
    assertThat(base).isEqualTo(337);
    state.idle.wall = 500;
    assertThat(engine.view(state).power()).as("the wall is not in it").isEqualTo(base);
    double last = base;
    for (String kind : List.of("damage", "fire", "hp")) {
      state.battleLevels.put(kind, 10);
      double now = engine.view(state).power();
      assertThat(now).as(kind).isGreaterThan(last);
      last = now;
    }
    state.idle.cats.put("mint", 1);
    engine.fieldCat(state, "mint", true);
    assertThat(engine.view(state).power()).as("a fielded cat").isGreaterThan(last);
  }

  @Test
  void catsHaveAFixedGradeThatStrengthensTheirGunAndMakesThemRarer() {
    // 등급별 종 수와 총 공격력 배율을 확인한다.
    start(1);
    var cats = engine.view(state).cats();
    assertThat(cats).hasSize(45);
    java.util.Map<String, Long> count =
        cats.stream()
            .collect(
                java.util.stream.Collectors.groupingBy(
                    c -> c.grade(), java.util.stream.Collectors.counting()));
    assertThat(count)
        .containsOnly(
            java.util.Map.entry("C", 16L),
            java.util.Map.entry("B", 12L),
            java.util.Map.entry("A", 7L),
            java.util.Map.entry("S", 9L),
            java.util.Map.entry("SS", 1L));
    java.util.function.Function<String, investorgame.raising.CompanyView.IdleCat> cat =
        code ->
            engine.view(state).cats().stream().filter(c -> c.code().equals(code)).findFirst().get();
    // 특성으로 공격력이 붙지 않은 고양이끼리 견준다: 하늘냥 C, 카라멜냥 B, 바다냥 A, 별빛냥 S.
    // 등급 배수 (656번): C 1 · B 1.15 · A 1.35 · S 1.6 · SS 3.2.
    // 680번: 무기의 100%(SS는 200%)를 기본으로 받고 그 위에 전의 몫(25% x 등급 배수)이 더해진다.
    assertThat(cat.apply("sky").damagePercent()).isEqualTo(125);
    assertThat(cat.apply("caramel").damagePercent()).isEqualTo(129);
    assertThat(cat.apply("ocean").damagePercent()).isEqualTo(134);
    assertThat(cat.apply("star").damagePercent()).isEqualTo(140);
    // 극광냥은 고유 공격 특성 1.25에 SS 등급 배수 3.2를 곱한 100%에 SS의 기본 200%를 더한다.
    assertThat(cat.apply("aurora").damagePercent()).isEqualTo(300);
    // 마법은 A등급부터다 (561번): C·B는 없고 A는 하나, S는 둘이다. 모든 스킬이 쓰인다.
    for (var c : cats) {
      int want =
          c.grade().equals("SS") ? 1 : c.grade().equals("S") ? 2 : c.grade().equals("A") ? 1 : 0;
      assertThat(c.skills()).as(c.code()).hasSize(want);
      assertThat(c.skills().stream().map(skill -> skill.code()).distinct().count()).isEqualTo(want);
    }
    assertThat(
            cats.stream().flatMap(c -> c.skills().stream()).map(skill -> skill.code()).distinct())
        .containsExactlyInAnyOrder(
            "water",
            "meteor",
            "bolt",
            "ram",
            "ice",
            "wind",
            "fire",
            "poison",
            "starArrow",
            "dark",
            "sand",
            "star",
            "hail",
            "blossom",
            "lightArrow",
            "auroraNight",
            "poisonArrow",
            "iceArrow",
            "fireArrow",
            "waterArrow",
            "sandArrow",
            "shadowArrow",
            "petalArrow");
    assertThat(cat.apply("star").skills())
        .extracting(skill -> skill.code())
        .containsExactly("star", "starArrow");
    assertThat(cat.apply("silver").skills())
        .extracting(skill -> skill.code())
        .containsExactly("bolt", "lightArrow");
    assertThat(cat.apply("wisteria").skills())
        .extracting(skill -> skill.code())
        .containsExactly("poison", "poisonArrow");
    assertThat(cat.apply("frost").skills())
        .extracting(skill -> skill.code())
        .containsExactly("hail", "iceArrow");
    assertThat(cat.apply("ruby").skills())
        .extracting(skill -> skill.code())
        .containsExactly("fire", "fireArrow");
    assertThat(cat.apply("abyss").skills())
        .extracting(skill -> skill.code())
        .containsExactly("water", "waterArrow");
    assertThat(cat.apply("dune").skills())
        .extracting(skill -> skill.code())
        .containsExactly("sand", "sandArrow");
    assertThat(cat.apply("veil").skills())
        .extracting(skill -> skill.code())
        .containsExactly("dark", "shadowArrow");
    assertThat(cat.apply("flora").skills())
        .extracting(skill -> skill.code())
        .containsExactly("blossom", "petalArrow");
    assertThat(cat.apply("aurora").skills())
        .containsExactly(new investorgame.raising.CompanyView.CatSkill("auroraNight", "극광의 밤"));
    // 동료 45종의 고유 스킬은 모두 26칸이다.
    assertThat(cats.stream().mapToInt(c -> c.skills().size()).sum()).isEqualTo(26);
    // 뽑기: 등급의 몫은 C 60.8 · B 28 · A 10 · S 1 · SS 0.2%(651번, 전에는 C 59.8 · S 2%)이고 등급 안에서는 고르다.
    var random = new HashSeededRandom(7);
    java.util.Map<String, Integer> drawn = new java.util.HashMap<>();
    int draws = 20_000;
    for (int i = 0; i < draws; i++) {
      drawn.merge(IdleEngine.catGrade(engine.grantCat(state, random).kind), 1, Integer::sum);
    }
    assertThat(drawn.get("C") * 100.0 / draws).isCloseTo(60.8, offset(2.0));
    assertThat(drawn.get("B") * 100.0 / draws).isCloseTo(28, offset(2.0));
    assertThat(drawn.get("A") * 100.0 / draws).isCloseTo(10, offset(1.5));
    assertThat(drawn.get("SS") * 100.0 / draws).isCloseTo(0.2, offset(0.15));
    assertThat(drawn.get("S") * 100.0 / draws).isCloseTo(1, offset(0.4));
    assertThat(engine.view(state).lastDraws()).isEmpty();
  }

  @Test
  void aWallPaysThreeUpgradeStepsAtItsPriceLevelAndABossWallThreeTimes() {
    // 553번: 벽 보상은 그 벽 물가의 강화 세 단계 값이다. 첫 벽 3b, 10벽 3b × 1.04^9, 보스 벽(50번째)은 그 세 배.
    start(1);
    state.capital = 0;
    state.idle.damage = IdleEngine.maxHp(1) - 1;
    // 틱 1초(게임 2초)의 시간 수입 40,000이 함께 들어온다.
    tick(1000, new IdleHit(1, "bullet", 1, 1.0));
    assertThat(state.idle.wall).isEqualTo(2);
    assertThat(state.capital).isBetween(1_500_000.0, 1_550_000.0);
    state.idle.wall = 10;
    state.idle.damage = IdleEngine.maxHp(10) - 1;
    state.capital = 0;
    tick(1000, new IdleHit(10, "bullet", 1, 1.0));
    assertThat(state.idle.wall).isEqualTo(11);
    // The tenth wall is an ordinary wall now (550): no three-fold reward.
    double tenth = 1_000_000 * IdleEngine.REWARD_UPGRADES * StrictMath.pow(1.04, 9);
    assertThat(state.capital).isBetween(tenth, tenth * 1.05);
    // (10 + 2d + 1.010571e-10·d⁴) × (1 + 4d ÷ (d + 625)) (653; 10 + 2d + 9.065e-11·d⁴ in 646,
    // 10 + 5d + 0.035d² + 3.897e-9·d⁴ in 644, × 1.003^d before, 636). The first wall is still 10.
    assertThat(IdleEngine.maxHp(1)).isEqualTo(10);
    // d = 9: (10 + 18 + 1.010571e-10 × 6,561) × (1 + 36 ÷ 634) = 28.00000066 × 1.0567823.
    assertThat(IdleEngine.maxHp(10))
        .isCloseTo((28 + 1.010571e-10 * 6_561) * (1 + 36.0 / 634), offset(1e-9));
    // The boss wall (every 50th) has three times the health and pays three times the reward.
    // d = 49: (10 + 98 + 1.010571e-10 × 5,764,801) × (1 + 196 ÷ 674).
    assertThat(IdleEngine.maxHp(50))
        .isCloseTo(3 * (108 + 1.010571e-10 * 5_764_801) * (1 + 196.0 / 674), offset(1e-9));
    // The 5,001st wall (a plain wall) shows ten million shares (653: health 333,333 x 30 shares;
    // 646: 66,666 x 150): d = 5,000, (10,010 + 63,160.69) × (1 + 20,000 ÷ 5,625) = 333,333.1.
    assertThat(IdleEngine.maxHp(5001) * IdleEngine.SHARES_PER_HP).isCloseTo(1e7, offset(10.0));
    assertThat(IdleEngine.SHARES_PER_HP).isEqualTo(30);
    state.idle.wall = 50;
    state.idle.damage = IdleEngine.maxHp(50) - 1;
    // Its own clear reward (549) was paid before: only the wall reward is counted here.
    state.idle.bossCleared = 50;
    double before = state.capital;
    tick(1000, new IdleHit(50, "bullet", 1, 1.0));
    assertThat(state.idle.wall).isEqualTo(51);
    double paid = state.capital - before;
    state.idle.wall = 49;
    state.idle.damage = IdleEngine.maxHp(49) - 1;
    before = state.capital;
    tick(1000, new IdleHit(49, "bullet", 1, 1.0));
    double plain = state.capital - before;
    assertThat(paid).isBetween(plain * 2.9, plain * 3.5);
  }

  @Test
  void bossRewardsAndUnlocksRequireRealWallClear() {
    start(10);
    state.idle.damage = IdleEngine.maxHp(10) - 1;
    tick(1000);
    long diamonds = state.diamonds;
    tick(1000, new IdleHit(10, "bullet", 1));
    assertThat(state.idle.wall).isEqualTo(11);
    // 벽을 깨도 뽑기 재화는 나오지 않는다 (526번): 전에는 다섯 벽마다 뽑기권이 나왔다.
    assertThat(state.diamonds).isEqualTo(diamonds);
    tick(1000, new IdleHit(10, "bullet", 1));
    assertThat(state.diamonds).isEqualTo(diamonds);
    // Walls no longer unlock skills (decisions.md 501): without a cat nothing is cast.
    assertThat(engine.view(state).skills()).hasSize(23).noneMatch(skill -> skill.owned());
  }

  @Test
  void theBossChallengeComesEveryFiftiethWallAndStartsWithACircuitBreaker() {
    start(9);
    state.battleLevels.put("damage", 1_000_000);
    // The tenth wall is an ordinary wall (550): no boss, no halt.
    tick(1000, new IdleHit(9, "bullet", 1, IdleEngine.maxHp(9), 0));
    assertThat(state.idle.wall).isEqualTo(10);
    assertThat(state.idle.cleared).isEqualTo(1);
    assertThat(state.idle.circuitSeconds).isZero();
    assertThat(engine.view(state).boss()).isFalse();
    assertThat(engine.view(state).bossChallenge()).isFalse();
    tick(1000, new IdleHit(10, "bullet", 1, IdleEngine.maxHp(10), 0));
    assertThat(state.idle.wall).isEqualTo(11);
    assertThat(state.idle.circuitSeconds).isZero();

    // The 50th wall: one hit through wall 49 and the whole boss stops in front of the boss.
    start(49);
    tick(1000, new IdleHit(49, "bullet", 1, IdleEngine.maxHp(49) + IdleEngine.maxHp(50) + 5, 0));
    assertThat(state.idle.wall).isEqualTo(50);
    assertThat(state.idle.circuitSeconds).isEqualTo(IdleEngine.CIRCUIT_SECONDS);
    assertThat(engine.view(state).bossChallenge()).isTrue();
    double waiting = state.idle.damage;
    assertThat(waiting).isCloseTo(IdleEngine.maxHp(50) + 5, offset(1e-9));
    // No hit counts during the halt: two real seconds are three of its four game seconds.
    tick(2000, new IdleHit(50, "bullet", 1, 100.0, 0));
    assertThat(state.idle.circuitSeconds).isEqualTo(1);
    assertThat(state.idle.damage).isEqualTo(waiting);
    assertThat(state.idle.wall).isEqualTo(50);
    // Trading resumes: what waited on the boss breaks it, and wall 51 does not halt.
    tick(1000);
    assertThat(state.idle.circuitSeconds).isZero();
    assertThat(state.idle.wall).isEqualTo(51);
    assertThat(state.idle.damage).isCloseTo(5, offset(1e-9));

    // 이미 깬 보스는 다시 지날 때 멈추지 않는다 (663번): 환생한 뒤 49번 벽에서 한 방에 보스까지 뚫는다.
    assertThat(state.idle.bossCleared).isEqualTo(50);
    start(49);
    tick(1000, new IdleHit(49, "bullet", 1, IdleEngine.maxHp(49) + IdleEngine.maxHp(50) + 5, 0));
    assertThat(state.idle.circuitSeconds).isZero();
    assertThat(state.idle.wall).isEqualTo(51);
    // 아직 깨지 않은 다음 보스(100)는 그대로 서킷브레이커로 시작한다.
    start(99);
    tick(1000, new IdleHit(99, "bullet", 1, IdleEngine.maxHp(99) + 5, 0));
    assertThat(state.idle.wall).isEqualTo(100);
    assertThat(state.idle.circuitSeconds).isEqualTo(IdleEngine.CIRCUIT_SECONDS);
  }

  @Test
  void clearingABossPaysItsOwnRewardOnce() {
    start(49);
    state.battleLevels.put("damage", 1_000_000);
    assertThat(engine.view(state).bossReward()).isNull();
    tick(1000, new IdleHit(49, "bullet", 1, IdleEngine.maxHp(49), 0));
    assertThat(state.idle.wall).isEqualTo(50);
    for (int i = 0; i < 3; i++) tick(1000);
    long diamonds = state.diamonds;
    double before = state.capital;
    tick(1000, new IdleHit(50, "bullet", 1, IdleEngine.maxHp(50), 0));
    assertThat(state.idle.wall).isEqualTo(51);
    // Apart from the wall's reward: diamonds, and five times that reward in money.
    assertThat(state.diamonds).isEqualTo(diamonds + IdleEngine.BOSS_CLEAR_DIAMONDS);
    var reward = engine.view(state).bossReward();
    assertThat(reward.wall()).isEqualTo(50);
    assertThat(reward.diamonds()).isEqualTo(IdleEngine.BOSS_CLEAR_DIAMONDS);
    double money = reward.money().doubleValue();
    assertThat(money).isPositive();
    // The wall reward, its five-fold boss bonus and a second of time income.
    assertThat(state.capital - before).isBetween(money * 1.2, money * 1.25);
    // The same boss broken again (the jump tool) pays its wall reward only.
    engine.jump(state, 50);
    diamonds = state.diamonds;
    before = state.capital;
    tick(1000, new IdleHit(50, "bullet", 1, IdleEngine.maxHp(50), 0));
    assertThat(state.idle.wall).isEqualTo(51);
    assertThat(state.diamonds).isEqualTo(diamonds);
    assertThat(state.capital - before).isLessThan(money * 0.3);
    // A tenth wall that is no boss challenge pays no boss reward.
    engine.jump(state, 60);
    tick(1000, new IdleHit(60, "bullet", 1, IdleEngine.maxHp(60), 0));
    assertThat(state.idle.wall).isEqualTo(61);
    assertThat(state.diamonds).isEqualTo(diamonds);
    assertThat(engine.view(state).bossReward().wall()).isEqualTo(50);
  }

  @Test
  void theBossCatWithoutAWeaponShootsTheStartingPistol() {
    // 585: the boss cat's weapon comes off like a cat's, and it then shoots the F pistol.
    start(1);
    company.mental.grant(state, "A", 1);
    double armed = engine.view(state).dps();
    company.mental.unequip(state);
    double bare = engine.view(state).dps();
    assertThat(bare).isLessThan(armed);
    company.mental.equip(state, "pistol", "F");
    assertThat(engine.view(state).dps()).isEqualTo(bare);
    // 사장냥도 출전 칸 하나를 차지한다 (704번): 고양이 넷과 사장냥, 다섯 칸이다.
    assertThat(engine.view(state).fieldSlots()).isEqualTo(4);
    assertThat(engine.view(state).bossSlot()).isZero();
  }

  @Test
  void circuitStopsClocksAndSurvivesOffline() {
    start(6);
    state.idle.circuitSeconds = 4;
    tick(2000, new IdleHit(6, "bullet", 1000));
    assertThat(state.idle.circuitSeconds).isEqualTo(1);
    assertThat(state.idle.activeSeconds).isZero();
    assertThat(state.capital).isZero();
    engine.beat(state, "one", ++sequence, "stop");
    clock.now += 86400000;
    engine.beat(state, "two", 0, "start");
    assertThat(state.idle.circuitSeconds).isEqualTo(1);
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
    // 10연차 (517·526번): 다이아가 1,000 없으면 한 마리도 뽑지 않는다.
    state.diamonds = (9) * 100L;
    assertThatThrownBy(() -> engine.drawCats(state, random, 10))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    assertThat(state.diamonds).isEqualTo(900);
    assertThat(engine.view(state).cats()).allMatch(cat -> cat.level() == 0);

    state.diamonds = (10) * 100L;
    engine.drawCats(state, random, 10);
    assertThat(state.diamonds).isZero();
    var view = engine.view(state);
    // 10연차는 1,000다이아에 열한 마리다 (526번).
    assertThat(view.lastDraws()).hasSize(11);
    assertThat(view.cats().stream().mapToInt(cat -> cat.level()).sum()).isEqualTo(11);
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
    state.diamonds = (1) * 100L;
    engine.drawCat(state, random);
    assertThat(engine.view(state).lastDraws()).hasSize(1);
  }

  private static final List<String> GRADES = List.of("C", "B", "A", "S", "SS");

  @Test
  void 십연차로_빈_출전_칸을_채울_때는_등급이_높은_고양이부터_세운다() {
    int reordered = 0;
    for (long seed = 1; seed <= 40; seed++) {
      CompanyState fresh = new CompanyState();
      engine.view(fresh);
      fresh.diamonds = 1000;
      engine.drawCats(fresh, new HashSeededRandom(seed), 10);
      var view = engine.view(fresh);
      var owned = view.cats().stream().filter(cat -> cat.level() > 0).toList();
      var fielded = owned.stream().filter(cat -> cat.fielded()).toList();
      assertThat(fielded).as("seed %d", seed).hasSize(Math.min(4, owned.size()));
      int weakest = fielded.stream().mapToInt(cat -> GRADES.indexOf(cat.grade())).min().orElse(0);
      assertThat(owned.stream().filter(cat -> !cat.fielded()))
          .as("seed %d: 대기석에 출전한 고양이보다 등급이 높은 고양이가 없다", seed)
          .allMatch(cat -> GRADES.indexOf(cat.grade()) <= weakest);
      // 칸 번호순으로도 등급이 높은 고양이가 앞에 선다.
      var seated =
          fielded.stream().sorted(java.util.Comparator.comparing(cat -> cat.slot())).toList();
      assertThat(seated.stream().map(cat -> GRADES.indexOf(cat.grade())).toList())
          .as("seed %d", seed)
          .isSortedAccordingTo(java.util.Comparator.reverseOrder());
      var firstFour =
          view.lastDraws().stream().map(d -> d.code()).distinct().limit(4).sorted().toList();
      if (!firstFour.equals(fielded.stream().map(cat -> cat.code()).sorted().toList())) {
        reordered++;
      }
    }
    assertThat(reordered).as("뽑힌 차례대로 채웠다면 달랐을 판이 있어야 검사가 된다").isPositive();
  }

  @Test
  void 십연차는_이미_출전해_있던_고양이를_밀어내지_않는다() {
    start(1);
    for (String code : List.of("sky", "mint", "lilac")) {
      state.idle.cats.put(code, 1);
      engine.fieldCat(state, code, true);
    }
    state.diamonds = 1000;
    engine.drawCats(state, new HashSeededRandom(11), 10);
    var view = engine.view(state);
    assertThat(view.cats().stream().filter(cat -> cat.fielded()).map(cat -> cat.code()))
        .hasSize(4)
        .contains("sky", "mint", "lilac");
    var joined =
        view.lastDraws().stream().filter(d -> d.isNew()).map(d -> d.code()).distinct().toList();
    var best = joined.stream().mapToInt(code -> GRADES.indexOf(IdleEngine.catGrade(code))).max();
    assertThat(
            view.cats().stream()
                .filter(cat -> cat.fielded() && joined.contains(cat.code()))
                .map(cat -> GRADES.indexOf(cat.grade())))
        .as("남은 한 칸에는 이번에 처음 얻은 고양이 가운데 등급이 가장 높은 고양이가 선다")
        .containsExactly(best.orElseThrow());
  }

  @Test
  void expandedRosterPreservesOwnedCatsAndEveryNewCompanionCanFight() {
    start(1);
    state.idle.cats.put("sky", 17);
    state.idle.fielded.add("sky");
    var before = engine.view(state).cats().getFirst();
    var roster = engine.view(state).cats();
    assertThat(roster).hasSize(45);
    assertThat(roster.stream().map(cat -> cat.code()).distinct().count()).isEqualTo(45);
    assertThat(roster.getFirst()).isEqualTo(before);
    assertThat(roster.subList(6, 45)).allMatch(cat -> cat.level() == 0 && !cat.fielded());
    // Each new ID is accepted for fielding and participates in both gun and skill calculations.
    for (var cat : roster.subList(6, 45)) {
      state.idle.cats.put(cat.code(), 1);
      engine.fieldCat(state, cat.code(), true);
      var view = engine.view(state);
      assertThat(
              view.cats().stream()
                  .filter(c -> c.code().equals(cat.code()))
                  .findFirst()
                  .orElseThrow()
                  .fielded())
          .isTrue();
      assertThat(view.dps()).isPositive();
      for (var own : cat.skills()) {
        assertThat(view.skills())
            .anyMatch(skill -> skill.code().equals(own.code()) && skill.owned());
      }
      assertThat(view.skills().stream().filter(skill -> skill.owned()).count())
          .as(cat.code())
          .isEqualTo(cat.skills().size());
      engine.fieldCat(state, cat.code(), false);
    }
    assertThat(engine.view(state).cats().getFirst()).isEqualTo(before);
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
    assertThat(engine.view(state).skills()).hasSize(23).noneMatch(skill -> skill.owned());
    assertThatThrownBy(() -> engine.drawCat(state, random))
        .as("no diamonds, no cat")
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);

    // 100 diamonds, one cat (decisions.md 493, 526). Capital is not spent.
    state.diamonds = (1) * 100L;
    long capital = (long) state.capital;
    engine.drawCat(state, random);
    assertThat(state.diamonds).isZero();
    assertThat(state.capital).isEqualTo(capital);
    var drawn = engine.view(state).cats().stream().filter(cat -> cat.level() == 1).toList();
    assertThat(drawn).as("a new cat is fielded at once").hasSize(1).allMatch(cat -> cat.fielded());

    // Duplicates raise the level; with enough draws all 45 companions are owned, four of them
    // fielded.
    state.diamonds = (6000) * 100L;
    for (int i = 0; i < 6000; i++) engine.drawCat(state, random);
    var cats = engine.view(state).cats();
    assertThat(cats).hasSize(45).allMatch(cat -> cat.level() >= 1);
    assertThat(cats.stream().mapToInt(cat -> cat.level()).sum()).isEqualTo(6001);
    assertThat(cats.stream().filter(cat -> cat.fielded()).count())
        .isEqualTo(engine.view(state).fieldSlots())
        .isEqualTo(4);
    // A cat's gun: the whole weapon plus a quarter, plus a tenth a level above 1 (705; a quarter
    // times the level to the 0.1 in 646, to the 0.3 in 644), times its trait.
    var sky = cats.getFirst();
    assertThat(sky.damagePercent()).isEqualTo(100 + 25 + 10 * (sky.level() - 1));
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
        .as("the sky cat is C grade: no skill (561)")
        .matches(cat -> cat.code().equals("sky") && cat.skills().isEmpty());
    assertThat(engine.view(state).skills()).noneMatch(skill -> skill.owned());
    // The night cat (A grade) has one skill of its own: the meteor.
    engine.fieldCat(state, "sky", false);
    state.idle.cats.put("night", 1);
    engine.fieldCat(state, "night", true);
    double withCat = engine.view(state).dps();
    engine.fieldCat(state, "night", false);
    assertThat(engine.view(state).dps()).isLessThan(withCat);
    assertThat(engine.view(state).skills()).noneMatch(skill -> skill.owned());
    tick(3000, new IdleHit(16, "meteor", 1));
    assertThat(state.idle.damage).as("a resting cat's skill does nothing").isZero();
    engine.fieldCat(state, "night", true);
    tick(3000, new IdleHit(16, "meteor", 1), new IdleHit(16, "water", 1));
    assertThat(state.idle.damage).as("only the fielded cat's own skill lands").isEqualTo(9.6);
    assertThat(engine.view(state).skills())
        .filteredOn(skill -> skill.owned())
        .extracting(skill -> skill.code())
        .containsExactly("meteor");
    engine.fieldCat(state, "sky", false);
    // A resting cat's gun no longer adds to the bullet budget. The wall's damage is cleared before
    // each volley: wall 16 has only 10 + 2 x 15 = 40 health since 646, and two volleys would
    // break it.
    for (int i = 0; i < 3; i++) tick(1000);
    state.idle.damage = 0;
    tick(1000, new IdleHit(16, "bullet", 1000, 1000.0));
    double alone = state.idle.damage;
    engine.fieldCat(state, "sky", true);
    for (int i = 0; i < 3; i++) tick(1000);
    state.idle.damage = 0;
    tick(1000, new IdleHit(16, "bullet", 1000, 1000.0));
    assertThat(state.idle.wall).isEqualTo(16);
    assertThat(state.idle.damage).isGreaterThan(alone);
    assertThatThrownBy(() -> engine.fieldCat(state, "mint", true))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
  }

  @Test
  void payGrowsWithTheWallPastWhatALongHoldsWhileUpgradePricesStayFixed() {
    // 물가 (decisions.md 505·553번): 벽마다 보상·수입이 4%씩 커진다. 강화 값은 단계로만 정한다 (519번).
    start(1);
    company.mental.initWeapons(state);
    double first = engine.view(state).dps();
    long firstPrice = company.mental.upgradeViews(state).getFirst().price().longValue();
    state.idle.wall = 2001;
    double level = StrictMath.pow(1.04, 2000);
    assertThat(level).as("far beyond a long").isGreaterThan(1e30);
    assertThat(company.mental.upgradeViews(state).getFirst().price().longValue())
        .as("the upgrade costs what it cost at the first wall")
        .isEqualTo(firstPrice);
    assertThat(engine.view(state).dps()).as("the fight itself is unchanged").isEqualTo(first);
    tick(1000);
    tick(500);
    double income = state.capital;
    assertThat(income).isGreaterThan(1e30);
    assertThat(engine.view(state).earned().doubleValue()).isEqualTo(income);
    // The wall's reward is on the same scale, with no cap.
    state.idle.damage = IdleEngine.maxHp(2001) - 1;
    state.idle.hitCredits = new double[18];
    tick(500, new IdleHit(2001, "bullet", 1, 4.0));
    assertThat(state.idle.wall).isEqualTo(2002);
    // 벽 보상은 그 벽 물가의 강화 세 단계 값이다 (553번).
    double reward = 1_000_000 * IdleEngine.REWARD_UPGRADES * level;
    assertThat(state.capital - income).isBetween(reward * 0.999, reward * 1.05);
    // Buying costs the level's price only, however deep the wall.
    state.capital = 10 * firstPrice;
    int bought = company.mental.buyUpgrade(state, "damage", 5);
    assertThat(bought).isEqualTo(5);
    double spent = 0;
    for (int i = 0; i < 5; i++) spent += company.mental.upgradePrice(i);
    assertThat(state.capital).isEqualTo(10 * firstPrice - spent);
  }

  @Test
  void theBossCatsOwnSkillsAreGoneFromTheIdleBattle() {
    // 667: the six 고유 스킬 are level-up cards of the assault stage now. Here only the three ad
    // skills are left, and nothing a screen reports for the old ones is credited.
    start(1);
    state.idle.best = 100;
    state.idle.wall = 100;
    tick(1000);
    assertThat(engine.view(state).actives())
        .extracting(a -> a.code())
        .containsExactly("boostFire", "boostDamage", "boostBuy");
    assertThat(engine.view(state).actives()).allMatch(a -> a.ad() && a.readyIn() == 0);
    for (String code :
        List.of("barrage", "rally", "fortify", "limitUp", "stopLoss", "averaging", "nope")) {
      assertThatThrownBy(() -> engine.useActive(state, code))
          .isInstanceOf(InvalidRequestException.class);
    }
    tick(1000, new IdleHit(100, "barrage", 10, 22.5));
    tick(1000, new IdleHit(100, "stoploss", 1, 1e9));
    assertThat(state.idle.damage).isZero();
  }

  /** What one beat of far too many hits of a kind is accepted for, with fresh credits. */
  private double accepted(String kind) {
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(1000, new IdleHit(100, kind, 1000, 1e9));
    return state.idle.damage;
  }

  @Test
  void adSkillChoiceUnlocksExactlyAfterThreeMinutes() {
    start(1);
    state.idle.best = 100; // 스킬 해금 이후의 사용·대기시간 검사.
    tick(1000);
    for (String chosen : List.of("boostFire", "boostDamage", "boostBuy")) {
      double pressedAt = state.idle.activeSeconds;
      engine.useActive(state, chosen, true);
      state.idle.activeSeconds = pressedAt + 179 * SPEED;
      assertThat(engine.view(state).actives())
          .filteredOn(a -> a.code().equals(chosen))
          .allMatch(a -> Math.abs(a.left() - 1) < 1e-9);
      for (String other : List.of("boostFire", "boostDamage", "boostBuy")) {
        assertThatThrownBy(() -> engine.useActive(state, other, true))
            .isInstanceOf(InvalidRequestException.class);
      }
      state.idle.activeSeconds = pressedAt + 180 * SPEED;
      assertThat(engine.view(state).actives()).filteredOn(a -> a.ad()).allMatch(a -> a.left() == 0);
    }
    engine.useActive(state, "boostBuy", true);
  }

  @Test
  void adSkillsDoubleOnePartForThreeMinutesAfterAnAd() {
    // 588: 공격속도·공격력·매수공격 2배. They need the ad, are never equipped, and last 180 real
    // seconds (270 game seconds at 1.5x) with a 180 second cooldown.
    start(1);
    state.idle.best = 100; // 스킬 해금 이후의 사용·대기시간 검사.
    state.idle.wall = 100;
    for (int i = 0; i < 3; i++) tick(1000);
    double bullets = accepted("bullet");
    double buys = accepted("buy");
    assertThat(bullets).isPositive();
    assertThat(buys).isPositive();

    assertThatThrownBy(() -> engine.useActive(state, "boostDamage"))
        .isInstanceOf(InvalidRequestException.class)
        .hasMessageContaining("광고");
    engine.useActive(state, "boostDamage", true);
    var boost = engine.view(state).actives().get(1);
    assertThat(boost.ad()).isTrue();
    assertThat(boost.seconds()).isEqualTo(180);
    assertThat(boost.left()).isEqualTo(180);
    assertThat(boost.readyIn()).isEqualTo(180);
    assertThat(accepted("bullet")).isCloseTo(2 * bullets, offset(1e-9));
    assertThat(accepted("buy")).as("only the guns and skills").isCloseTo(buys, offset(1e-9));
    assertThatThrownBy(() -> engine.useActive(state, "boostDamage", true))
        .isInstanceOf(InvalidRequestException.class);

    for (String other : List.of("boostBuy", "boostFire")) {
      assertThatThrownBy(() -> engine.useActive(state, other, true))
          .isInstanceOf(InvalidRequestException.class)
          .hasMessageContaining("하나만");
    }
    for (int i = 0; i < 182; i++) tick(1000);
    engine.useActive(state, "boostBuy", true);
    assertThat(accepted("buy")).isCloseTo(2 * buys, offset(1e-9));

    // 공격속도 2배 doubles the bullet budget.
    for (int i = 0; i < 182; i++) tick(1000);
    engine.useActive(state, "boostFire", true);
    assertThat(accepted("bullet")).isCloseTo(2 * bullets, offset(1e-6));

    // Three minutes after the last press everything is back to plain.
    for (int i = 0; i < 182; i++) tick(1000);
    assertThat(engine.view(state).actives().get(0).left()).isZero();
    assertThat(accepted("bullet")).isCloseTo(bullets, offset(1e-9));
    assertThat(accepted("buy")).isCloseTo(buys, offset(1e-9));
  }

  @Test
  void aSkillIsCastOncePerCooldownByItsOneCat() {
    start(1);
    state.idle.wall = 100;
    state.idle.cats.put("night", 1);
    state.idle.fielded.add("night");
    // 2.4 s at the fight's 1.5x (580) is one 3.6 s cooldown: a second reported meteor is not
    // credited. No two cats share a skill (563), so one cat is all a skill ever has.
    tick(2400, new IdleHit(100, "meteor", 2));
    assertThat(state.idle.damage)
        .as("one caster, one meteor per cooldown")
        .isCloseTo(9.6, offset(1e-9));
  }

  @Test
  void savesThatUnlockedSkillsByWallsKeepThemAsCats() {
    engine.view(state);
    state.idle.wall = 31;
    state.idle.cats = new java.util.LinkedHashMap<>();
    state.idle.fielded.clear();
    state.idle.catSkills = false;
    var view = engine.view(state);
    // Water, meteor and bolt were unlocked at walls 5, 15 and 30; the ram (50) was not. The cats
    // are kept, but C grade cats no longer have a skill (561).
    assertThat(view.skills()).noneMatch(skill -> skill.owned());
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
    // One copy: a weapon in another cat's paws cannot be taken (decisions.md 530).
    assertThatThrownBy(() -> engine.equipCat(state, "mint", "rifle", "S"))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    assertThat(weaponOf("sky")).isNotNull();
    assertThat(weaponOf("mint")).isNull();
    // Nor by the boss cat, and held copies are not merged away.
    assertThatThrownBy(() -> engine.requireFreeForBoss(state, "rifle", "S"))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    state.weapons.getLast().count = 3;
    assertThatThrownBy(() -> engine.requireFreeForMerge(state, "rifle", "S", 3))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    // Equipping the same weapon again keeps it, and spare copies can be shared.
    engine.equipCat(state, "sky", "rifle", "S");
    engine.equipCat(state, "mint", "rifle", "S");
    engine.requireFreeForBoss(state, "rifle", "S");
    assertThat(weaponOf("mint")).isNotNull();
    engine.equipCat(state, "mint", null, null);
    assertThat(weaponOf("mint")).isNull();
    state.weapons.getLast().count = 4;
    engine.requireFreeForMerge(state, "rifle", "S", 3);
  }

  @Test
  void aCatsBulletIsLimitedByItsOwnGunAndLevel() {
    company.mental.initWeapons(state);
    start(16);
    // Boss cat and sky (fires 25% faster), both with the starting pistol.
    tick(1000, new IdleHit(16, "bullet", 1000, 1000.0));
    assertThat(state.idle.damage)
        .as("half as many bullets as the guns' stats say")
        .isCloseTo(2.25 * SPEED / 2 * 1000.0 / 260, org.assertj.core.data.Offset.offset(1e-9));
    assertThat(engine.view(state).wallDps()).as("what the wall really took lately").isPositive();
    // A forged bullet may claim the strongest gun's critical. A level 4 cat's own share is 25% plus
    // 10% a level above 1 = 55% (705; 25% x 4^0.1 = 29% in 646, 25% x 4^0.3 = 38% in 644, 50% x √4
    // = 100% before, 636).
    state.idle.cats.put("sky", 4);
    double before = state.idle.damage;
    for (int i = 0; i < 3; i++) tick(1000);
    tick(1000, new IdleHit(16, "bullet", 1, 1e12));
    // 680번: the cat's gun is the whole pistol plus that share (155%), so it is the strongest gun
    // and sets the cap: one doubled bullet x critical 2 x 1.55.
    assertThat(state.idle.damage - before).isCloseTo(4 * (1 + 0.25 + 0.1 * 3), offset(1e-9));
    // Level 10: 100% + 25% + 9 x 10% = 215% of the pistol.
    state.idle.cats.put("sky", 10);
    before = state.idle.damage;
    tick(1000, new IdleHit(16, "bullet", 1, 1e12));
    assertThat(state.idle.damage - before)
        .as("level 10 cat: 215% of the pistol's critical")
        .isCloseTo(4 * 2.15, offset(1e-9));
  }

  @Test
  void buyOrdersMatchTheSellOrdersOfTheirWall() {
    // 710·711번: 매수 주문 한 장 = 그 벽의 시장가 매도 한 장(40주 × 매도 물량 세기 6 × 물량 배율).
    start(1);
    assertThat(IdleEngine.threat(1)).isEqualTo(1.0);
    assertThat(IdleEngine.buyOrder(1)).as("첫 벽: 240주").isCloseTo(240 / 30.0, offset(1e-9));
    // The order scale follows the wall's health (653): d = 99, health 208.0097 × (1 + 396 ÷ 724) =
    // 321.78, 1 + 321.78 / 380 = 1.847, two digits 1.8.
    assertThat(IdleEngine.threat(100)).isEqualTo(1.8);
    double order = 432 / 30.0;
    assertThat(IdleEngine.buyOrder(100))
        .as("벽 100: 240주 × 1.8 = 432주")
        .isCloseTo(order, offset(1e-9));
    assertThat(IdleEngine.buyOrder(5001)).as("깊은 벽일수록 매도 주문과 함께 커진다").isGreaterThan(order);
    state.idle.wall = 100;
    tick(1000);
    // A buy order is capped at its wall's sell order, whatever the screen reports.
    tick(1000, new IdleHit(100, "buy", 2, 2 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(2 * order, offset(1e-9));
    // 무기·동료·공격력 강화는 매수 주문을 바꾸지 않는다: 팀의 덤(638·689번)도 없앴다.
    state.capital = 1e18;
    company.mental.buyUpgrade(state, "damage", 20);
    state.idle.cats.put("sky", 4);
    engine.fieldCat(state, "sky", true);
    state.idle.damage = 0;
    tick(1000, new IdleHit(100, "buy", 2, 2 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(2 * order, offset(1e-9));
    // 매수벽 공격 강화는 없다: 살 수 없고 화면 값에도 없다.
    assertThat(engine.upgradeViews(state)).extracting(u -> u.kind()).doesNotContain("buy");
    assertThatThrownBy(() -> company.mental.buyUpgrade(state, "buy", 1))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> engine.buyFishUpgrade(state, "buy"))
        .isInstanceOf(InvalidRequestException.class);
    // Buy orders do not spend the bullets' budget, and the reverse.
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(1000, new IdleHit(100, "bullet", 1000, 1000.0));
    double bullets = state.idle.damage;
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(1000, new IdleHit(100, "bullet", 1000, 1000.0), new IdleHit(100, "buy", 1, 1000.0));
    assertThat(state.idle.damage).isCloseTo(bullets + order, offset(1e-9));
    // The budget is the buy wall's fastest fire: far more than that is not accepted.
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(1000, new IdleHit(100, "buy", 1000, 1000 * 1000.0));
    assertThat(state.idle.damage).isLessThan(30 * order);
  }

  @Test
  void 없앤_매수벽_공격_강화는_쓴_돈과_생선을_돌려준다() {
    // 710번: 전투 강화 buy는 쓴 돈을(556번의 치명타 피해와 같은 길), 영구 강화 buy는 쓴 생선을 돌려주고 지운다.
    start(1);
    state.battleLevels.put("buy", 3);
    double capital = state.capital;
    assertThat(company.mental.hasRemovedUpgrades(state)).isTrue();
    assertThat(company.mental.refundRemovedUpgrades(state)).isTrue();
    assertThat(state.battleLevels).doesNotContainKey("buy");
    assertThat(state.capital)
        .isEqualTo(
            capital
                + company.mental.upgradePrice(0)
                + company.mental.upgradePrice(1)
                + company.mental.upgradePrice(2));
    state.fish = 5;
    state.fishLevels.put("buy", 4);
    engine.view(state);
    assertThat(state.fishLevels).doesNotContainKey("buy");
    assertThat(state.fish).as("1 + 2 + 3 + 4마리를 돌려받는다").isEqualTo(15);
    assertThat(engine.view(state).rebirth().upgrades())
        .extracting(u -> u.kind())
        .containsExactly("damage", "hp", "gold");
  }

  @Test
  void aSkillLevelsUpWithItsCat() {
    assertThat(IdleEngine.skillLevel(1)).isEqualTo(1);
    assertThat(IdleEngine.skillLevel(9)).isEqualTo(1);
    assertThat(IdleEngine.skillLevel(10)).isEqualTo(2);
    assertThat(IdleEngine.skillLevel(19)).isEqualTo(2);
    assertThat(IdleEngine.skillLevel(20)).isEqualTo(3);
    assertThat(IdleEngine.skillLevel(39)).isEqualTo(4);
    assertThat(IdleEngine.skillLevel(40)).isEqualTo(5);
    assertThat(IdleEngine.skillLevel(1000)).isEqualTo(5);
    start(1);
    state.idle.wall = 100;
    state.idle.cats.put("ocean", 1);
    state.idle.fielded.add("ocean");
    var cat = engine.view(state).cats().stream().filter(c -> "ocean".equals(c.code())).findFirst();
    assertThat(cat.orElseThrow().skillLevel()).isEqualTo(1);
    assertThat(cat.orElseThrow().skillNextLevel()).isEqualTo(10);
    // Level 1 water: 3 times the gun (696), once per 2.4 s. 1.6 s at 1.5x (580) is one cooldown.
    tick(1600, new IdleHit(100, "water", 3, 3 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(3, offset(1e-9));
    // Cat level 20 is skill level 3: 5.2 times the gun, once per 1.8 s.
    state.idle.cats.put("ocean", 20);
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(1200, new IdleHit(100, "water", 3, 3 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(5.2, offset(1e-9));
    cat = engine.view(state).cats().stream().filter(c -> "ocean".equals(c.code())).findFirst();
    assertThat(cat.orElseThrow().skillLevel()).isEqualTo(3);
    assertThat(cat.orElseThrow().skillNextLevel()).isEqualTo(30);
    assertThat(engine.view(state).skills().getFirst().level()).isEqualTo(3);
    // The top level has no next level.
    state.idle.cats.put("mint", 40);
    cat = engine.view(state).cats().stream().filter(c -> "mint".equals(c.code())).findFirst();
    assertThat(cat.orElseThrow().skillLevel()).isEqualTo(5);
    assertThat(cat.orElseThrow().skillNextLevel()).isZero();
    // A level 3 meteor shower drops three rocks per cast: three hits per 3 s.
    state.idle.cats.put("night", 20);
    state.idle.fielded.add("night");
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(2000, new IdleHit(100, "meteor", 10, 10 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(3 * 8.4, offset(1e-9));
  }

  @Test
  void anSGradeCatCastsBothOfItsSkills() {
    // 마법은 A등급부터, S등급은 둘 (561번). 서리냥은 우박과 서리화살을 쓴다.
    start(1);
    state.idle.wall = 100;
    state.idle.cats.put("frost", 1);
    state.idle.fielded.add("frost");
    assertThat(engine.view(state).skills())
        .filteredOn(skill -> skill.owned())
        .extracting(skill -> skill.code())
        .containsExactly("hail", "iceArrow");
    // 2.3 s at 1.5x (580) is 3.45 game seconds: one 3.4 s hail cooldown (two stones at level 1)
    // and enough credit for the reported frost arrow.
    tick(
        2300,
        new IdleHit(100, "hail", 2, 1000.0),
        new IdleHit(100, "iceArrow", 1, 1000.0),
        new IdleHit(100, "fire", 1, 1000.0),
        new IdleHit(100, "wind", 1, 1000.0));
    assertThat(state.idle.damage)
        .as("hail 2 x 4 + ice 32, no fire or wind")
        .isCloseTo(40, offset(1e-9));
    // The tiger cat (A grade) has the one skill: the wind.
    state.idle.cats.put("tiger", 1);
    state.idle.fielded.add("tiger");
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(1900, new IdleHit(100, "wind", 1, 1000.0));
    assertThat(state.idle.damage).isCloseTo(3.6, offset(1e-9));
    // A level 5 light arrow is one hit of two hundred times the gun (696), once per real second.
    state.idle.cats.put("silver", 40);
    state.idle.fielded.add("silver");
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(1000, new IdleHit(100, "lightArrow", 3, 1000.0), new IdleHit(100, "bomb", 1, 1000.0));
    assertThat(state.idle.damage).isCloseTo(200, offset(1e-9));
  }

  @Test
  void 꽉_찬_팀의_고양이를_한번에_교체한다() {
    start(16);
    for (String code : List.of("sky", "mint", "lilac", "sunset", "night"))
      state.idle.cats.put(code, 1);
    state.idle.fielded = new java.util.ArrayList<>(List.of("sky", "mint", "lilac", "sunset"));
    engine.fieldCat(state, "night", true, "mint");
    assertThat(state.idle.fielded).containsExactly("sky", "night", "lilac", "sunset");
    assertThat(state.idle.cats).containsKey("mint");
  }

  @Test
  void 고양이는_놓은_출전_칸에_그대로_선다() {
    start(16);
    for (String code : List.of("sky", "mint", "lilac", "night")) state.idle.cats.put(code, 1);
    state.idle.fielded = new java.util.ArrayList<>();
    state.idle.seats.clear();
    // 빈 칸 어디에든 놓은 자리에 선다 (599번): 사이에 빈 칸이 남아도 된다. 0번 칸에는 사장냥이 서 있다 (704번).
    assertThat(engine.view(state).bossSlot()).isZero();
    engine.fieldCat(state, "night", true, null, 4);
    engine.fieldCat(state, "sky", true, null, 2);
    assertThat(state.idle.fielded).as("칸 번호순으로 줄을 선다").containsExactly("sky", "night");
    assertThat(slot("night")).isEqualTo(4);
    assertThat(slot("sky")).isEqualTo(2);
    assertThat(slot("mint")).as("쉬는 고양이는 칸이 없다").isNull();
    // 칸을 정하지 않으면 빈 칸 가운데 가장 앞에 선다.
    engine.fieldCat(state, "mint", true);
    assertThat(slot("mint")).isEqualTo(1);
    assertThat(state.idle.fielded).containsExactly("mint", "sky", "night");
    // 출전 중인 고양이를 다른 고양이의 칸에 놓으면 자리를 맞바꾼다. 무기는 그대로 든다.
    state.idle.catWeapons.put("mint", new CompanyState.Weapon("rifle", "S"));
    engine.fieldCat(state, "mint", true, null, 4);
    assertThat(slot("mint")).isEqualTo(4);
    assertThat(slot("night")).isEqualTo(1);
    assertThat(state.idle.catWeapons).containsKey("mint");
    // 빈 칸으로 옮긴다.
    engine.fieldCat(state, "night", true, null, 3);
    assertThat(state.idle.fielded).containsExactly("sky", "night", "mint");
    // 쉬던 고양이를 찬 칸에 놓으면 그 고양이와 교체한다: 빠진 고양이는 무기를 내려놓는다.
    engine.fieldCat(state, "lilac", true, null, 4);
    assertThat(slot("lilac")).isEqualTo(4);
    assertThat(slot("mint")).isNull();
    assertThat(state.idle.catWeapons).doesNotContainKey("mint");
    // 교체(replaceCode)는 그 칸을 물려받는다.
    engine.fieldCat(state, "mint", true, "sky");
    assertThat(slot("mint")).isEqualTo(2);
    // 빼면 그 칸만 비고 나머지는 제자리다.
    engine.fieldCat(state, "night", false);
    assertThat(slot("lilac")).isEqualTo(4);
    assertThat(slot("mint")).isEqualTo(2);
    assertThatThrownBy(() -> engine.fieldCat(state, "sky", true, null, 5))
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 사장냥의_칸도_다른_출전_칸과_같다() {
    // 704번: 사장냥도 칸 하나를 차지하고, 고양이와 교체하고 자리를 옮긴다.
    start(16);
    for (String code : List.of("sky", "mint", "lilac", "night", "sunset")) {
      state.idle.cats.put(code, 1);
    }
    state.idle.fielded = new java.util.ArrayList<>();
    state.idle.seats.clear();
    for (String code : List.of("sky", "mint", "lilac", "night")) engine.fieldCat(state, code, true);
    assertThat(List.of(slot("sky"), slot("mint"), slot("lilac"), slot("night")))
        .containsExactly(1, 2, 3, 4);
    // 다섯 칸이 다 찼다: 사장냥이 서 있으면 고양이는 넷까지다.
    assertThatThrownBy(() -> engine.fieldCat(state, "sunset", true))
        .isInstanceOf(InvalidRequestException.class);
    // 쉬던 고양이를 사장냥 칸에 놓으면 사장냥과 교체한다: 사장냥은 쉬고 고양이가 다섯이 된다.
    engine.fieldCat(state, "sunset", true, null, 0);
    assertThat(slot("sunset")).isZero();
    assertThat(engine.view(state).bossFielded()).isFalse();
    assertThat(engine.view(state).bossSlot()).isNull();
    assertThat(state.idle.fielded).hasSize(5);
    // 칸이 다 찼으면 사장냥은 뺄 고양이를 골라야 선다.
    assertThatThrownBy(() -> engine.fieldBoss(state, true))
        .isInstanceOf(InvalidRequestException.class);
    engine.fieldCat(state, IdleEngine.BOSS, true, "lilac", null);
    assertThat(engine.view(state).bossSlot()).isEqualTo(3);
    assertThat(slot("lilac")).isNull();
    // 서 있는 사장냥은 다른 칸으로 옮기면 그 칸의 고양이와 자리를 맞바꾼다.
    engine.fieldCat(state, IdleEngine.BOSS, true, null, 0);
    assertThat(engine.view(state).bossSlot()).isZero();
    assertThat(slot("sunset")).isEqualTo(3);
    // 고양이를 사장냥 칸으로 옮겨도 맞바꾼다.
    engine.fieldCat(state, "sky", true, null, 0);
    assertThat(slot("sky")).isZero();
    assertThat(engine.view(state).bossSlot()).isEqualTo(1);
    // 쉬던 고양이가 사장냥과 교체(replaceCode)하면 사장냥의 칸을 물려받는다.
    engine.fieldCat(state, "lilac", true, IdleEngine.BOSS, null);
    assertThat(slot("lilac")).isEqualTo(1);
    assertThat(engine.view(state).bossFielded()).isFalse();
  }

  @Test
  void 사장냥_칸이_따로_있던_저장은_사장냥이_맨_앞에_서고_고양이가_한_칸씩_뒤로_간다() {
    start(16);
    for (String code : List.of("sky", "mint")) state.idle.cats.put(code, 1);
    state.idle.fielded = new java.util.ArrayList<>(List.of("sky", "mint"));
    state.idle.seats = new java.util.LinkedHashMap<>(java.util.Map.of("sky", 0, "mint", 3));
    state.idle.bossSeat = null;
    assertThat(engine.view(state).bossSlot()).isZero();
    assertThat(slot("sky")).isEqualTo(1);
    assertThat(slot("mint")).isEqualTo(4);
  }

  private Integer slot(String code) {
    return engine.view(state).cats().stream()
        .filter(cat -> cat.code().equals(code))
        .findFirst()
        .orElseThrow()
        .slot();
  }

  @Test
  void 출전에서_빠진_고양이는_무기를_내려놓는다() {
    start(16);
    for (String code : List.of("sky", "mint", "night")) state.idle.cats.put(code, 1);
    state.idle.fielded = new java.util.ArrayList<>(List.of("sky", "mint"));
    for (String code : List.of("sky", "mint", "night"))
      state.idle.catWeapons.put(code, new CompanyState.Weapon("rifle", "S"));
    // 빼면 그 고양이의 무기만 풀린다 (598번).
    engine.fieldCat(state, "sky", false);
    assertThat(state.idle.catWeapons).containsOnlyKeys("mint", "night");
    // 교체로 빠져도 풀린다. 새로 들어온 고양이가 들던 무기는 그대로다.
    engine.fieldCat(state, "night", true, "mint");
    assertThat(state.idle.catWeapons).containsOnlyKeys("night");
    // 쉬는 고양이를 다시 빼도(이미 쉬는 중) 아무 일도 없다.
    state.idle.catWeapons.put("sky", new CompanyState.Weapon("rifle", "S"));
    engine.fieldCat(state, "sky", false);
    assertThat(state.idle.catWeapons).containsOnlyKeys("night", "sky");
  }

  @Test
  void 교체_대상이_바뀌었거나_미보유이면_기존_팀을_보존한다() {
    start(16);
    state.idle.cats.put("sky", 1);
    state.idle.cats.put("mint", 1);
    state.idle.fielded = new java.util.ArrayList<>(List.of("sky"));
    assertThatThrownBy(() -> engine.fieldCat(state, "mint", true, "night"))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    assertThatThrownBy(() -> engine.fieldCat(state, "night", true, "sky"))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    assertThatThrownBy(() -> engine.fieldCat(state, "mint", false, "sky"))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    assertThatThrownBy(() -> engine.fieldCat(state, "sky", true, "sky"))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    assertThat(state.idle.fielded).containsExactly("sky");
  }

  private investorgame.raising.CompanyView.CatWeapon weaponOf(String code) {
    return engine.view(state).cats().stream()
        .filter(cat -> cat.code().equals(code))
        .findFirst()
        .orElseThrow()
        .weapon();
  }

  /** 광고를 보고 환생하면 생선이 3배다 (586번). 횟수 한도는 없고, 첫 보스를 깨기 전에는 광고를 봐도 못 한다. */
  @Test
  void 광고를_보고_환생하면_생선을_세_배로_받는다() {
    CompanyState c = company.open(new HashSeededRandom(3), company.openingCapital());
    engine.beat(c, "one", 0, "start");
    c.idle.wall = 50;
    assertThatThrownBy(() -> engine.rebirth(c, true)).isInstanceOf(InvalidRequestException.class);
    c.idle.wall = 101;
    engine.rebirth(c, true);
    // 101번째 벽: 100 ÷ 5 × 104% = 20 (644번), 그 3배.
    assertThat(c.fish).isEqualTo(60);
    assertThat(c.idle.wall).isEqualTo(1);
    // 다음 환생에도 다시 3배를 받는다. 그냥 환생은 1배다.
    c.idle.wall = 101;
    engine.rebirth(c, true);
    assertThat(c.fish).isEqualTo(120);
    c.idle.wall = 101;
    engine.rebirth(c, false);
    assertThat(c.fish).isEqualTo(140);
    assertThat(c.rebirths).isEqualTo(3);
  }

  @Test
  void 환생하면_처음으로_돌아가고_생선을_받아_영구_강화를_올린다() {
    CompanyState c = company.open(new HashSeededRandom(3), company.openingCapital());
    engine.beat(c, "one", 0, "start");
    // 첫 보스를 깨기 전에는 못 한다.
    c.idle.wall = 50;
    assertThat(engine.rebirthFish(c)).isZero();
    assertThatThrownBy(() -> engine.rebirth(c)).isInstanceOf(InvalidRequestException.class);
    // 깬 벽 다섯 개마다 한 마리 (625번)에, 깬 보스마다 2%씩 덤을 얹는다 (644번, 내림. 633번에는 +5%, +10%, +15% …로 쌓였다).
    // 51번째 벽 10 × 102% = 10, 101번째 20 × 104% = 20, 301번째 60 × 112% = 67, 501번째 100 × 120% = 120.
    c.idle.wall = 51;
    assertThat(engine.rebirthFish(c)).isEqualTo(10);
    c.idle.wall = 101;
    assertThat(engine.rebirthFish(c)).isEqualTo(20);
    c.idle.wall = 301;
    assertThat(engine.rebirthFish(c)).isEqualTo(67);
    assertThat(engine.view(c).rebirth().gain()).isEqualTo(67);
    c.idle.wall = 501;
    assertThat(engine.rebirthFish(c)).isEqualTo(120);
    c.idle.wall = 301;
    assertThat(engine.view(c).rebirth().adGain()).as("광고를 보면 3배 (586번)").isEqualTo(201);
    assertThat(engine.view(c).rebirth().fromWall()).isEqualTo(51);
    // 환생: 벽 1, 강화와 돈은 처음으로. 고양이·무기·다이아·받은 보스 보상은 그대로다.
    c.idle.cats.put("sky", 3);
    c.idle.bossCleared = 300;
    c.idle.damage = 12;
    c.capital = 9e15;
    c.diamonds = 777;
    c.battleLevels.put("damage", 40);
    long epoch = c.idle.epoch;
    engine.rebirth(c);
    assertThat(c.idle.wall).isEqualTo(1);
    assertThat(c.idle.damage).isZero();
    assertThat(c.idle.epoch).as("화면이 새 벽으로 안다").isEqualTo(epoch + 1);
    assertThat(c.capital).isEqualTo((double) company.openingCapital());
    assertThat(c.battleLevels).isEmpty();
    assertThat(c.fish).isEqualTo(67);
    assertThat(c.rebirths).isEqualTo(1);
    assertThat(c.diamonds).isEqualTo(777);
    assertThat(c.idle.cats.get("sky")).isEqualTo(3);
    assertThat(c.idle.bossCleared).isEqualTo(300);
    assertThat(engine.view(c).rebirth().count()).isEqualTo(1);
    assertThat(engine.view(c).rebirth().gain()).isZero();
    // 한 번 환생한 뒤에는 첫 보스를 다시 깨지 않아도 깬 벽만큼 받는다 (603번): 벽 다섯 개를 깨면 한 마리.
    assertThat(engine.view(c).rebirth().fromWall()).isEqualTo(6);
    c.idle.wall = 5;
    assertThat(engine.rebirthFish(c)).isZero();
    assertThatThrownBy(() -> engine.rebirth(c)).isInstanceOf(InvalidRequestException.class);
    c.idle.wall = 31;
    assertThat(engine.rebirthFish(c)).as("벽 50개를 깨기 전에는 덤이 없다").isEqualTo(6);
    engine.rebirth(c);
    assertThat(c.fish).isEqualTo(73);
    assertThat(c.rebirths).isEqualTo(2);
    c.fish = 30;
    c.rebirths = 1;
    // 생선으로 영구 강화를 올린다 (600번): 값은 다음 단계의 번호만큼(1, 2, 3 …)이고, 고양이 레벨은 생선으로 올리지 않는다.
    // 한 단계에 1% (644번, 전에는 3%), 매수벽 공격은 30주 그대로.
    assertThat(fishUpgrade(c, "damage").cost()).isEqualTo(1);
    assertThat(upgrade(c, "damage").bonusPercent()).isZero();
    engine.buyFishUpgrade(c, "damage");
    engine.buyFishUpgrade(c, "damage");
    assertThat(c.fish).isEqualTo(27);
    assertThat(fishUpgrade(c, "damage").level()).isEqualTo(2);
    assertThat(fishUpgrade(c, "damage").bonus()).isEqualTo(2);
    assertThat(fishUpgrade(c, "damage").nextBonus()).isEqualTo(3);
    assertThat(fishUpgrade(c, "damage").cost()).isEqualTo(3);
    assertThat(upgrade(c, "damage").bonusPercent()).as("전투 강화가 없으면 영구 강화만큼").isEqualTo(2);
    assertThat(upgrade(c, "damage").level()).as("전투 강화의 단계는 그대로다").isZero();
    engine.buyFishUpgrade(c, "hp");
    assertThat(upgrade(c, "hp").bonusPercent()).isEqualTo(1);
    assertThat(upgrade(c, "fire").bonusPercent()).as("공격 속도는 영구 강화가 없다").isZero();
    assertThat(c.fish).isEqualTo(26);
    assertThat(c.idle.cats.get("sky")).isEqualTo(3);
    // 환생해도 남는다.
    c.idle.wall = 51;
    engine.rebirth(c);
    assertThat(c.fishLevels).containsEntry("damage", 2).containsEntry("hp", 1);
    assertThat(upgrade(c, "damage").bonusPercent()).isEqualTo(2);
    // 없는 강화와 생선이 모자랄 때는 400.
    assertThatThrownBy(() -> engine.buyFishUpgrade(c, "fire"))
        .isInstanceOf(InvalidRequestException.class);
    c.fish = 2;
    assertThatThrownBy(() -> engine.buyFishUpgrade(c, "damage"))
        .isInstanceOf(InvalidRequestException.class);
    assertThat(c.fish).isEqualTo(2);
    // 영구 강화는 전투 강화에 곱한다 (636번): 전투 강화 10단계(+10%, 653번) × 영구 강화 2단계(+2%, 644번) = +12.2%.
    c.capital = 1e18;
    company.mental.buyUpgrade(c, "damage", 10);
    assertThat(upgrade(c, "damage").bonusPercent()).isEqualTo(12.2);
    assertThat(upgrade(c, "damage").nextBonusPercent())
        .as("11단계 +11% × 1.02 = +13.22%")
        .isEqualTo(13.22);
    // 성장 화면은 이 강화만의 값을 보인다 (661번): 영구 강화가 있어도 한 단계에 꼭 1%씩이다.
    assertThat(upgrade(c, "damage").stepBonusPercent()).isEqualTo(10);
    assertThat(upgrade(c, "damage").nextStepBonusPercent()).isEqualTo(11);
    // 묶어 올리기 (663번): 2단계에서 열 단계는 3 + 4 + … + 12 = 75개. 생선이 닿는 데까지만 오르고, 한 단계도 못 사면 400.
    c.fish = 80;
    engine.buyFishUpgrade(c, "damage", 10);
    assertThat(c.fishLevels).containsEntry("damage", 12);
    assertThat(c.fish).isEqualTo(5);
    c.fish = 30;
    engine.buyFishUpgrade(c, "damage", 100);
    assertThat(c.fishLevels).as("13 + 14 = 27개로 두 단계만").containsEntry("damage", 14);
    assertThat(c.fish).isEqualTo(3);
    assertThatThrownBy(() -> engine.buyFishUpgrade(c, "damage", 10))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> engine.buyFishUpgrade(c, "damage", 101))
        .isInstanceOf(InvalidRequestException.class);
    c.fishLevels.put("damage", 2);
    // 벽 1,000쯤(+3,000%)에서 영구 강화 +300%는 네 배다: 더하면 +3,300%뿐이었다.
    assertThat(MentalEngine.withFish(3000, 300)).isEqualTo(12_300);
    assertThat(c.fishLevels).containsEntry("damage", 2);
  }

  @Test
  void 영구_강화_골드_획득량은_벽_보상과_시간_수입을_늘린다() {
    // 706번: 한 단계에 2%. 벽·보스 보상과 시간 수입(화면의 초당 수입)에 곱한다.
    start(1);
    CompanyState c = state;
    double income = engine.perSecond(c);
    assertThat(fishUpgrade(c, "gold").bonus()).isZero();
    assertThat(fishUpgrade(c, "gold").nextBonus()).isEqualTo(2);
    c.fish = 100;
    engine.buyFishUpgrade(c, "gold", 5);
    assertThat(fishUpgrade(c, "gold").bonus()).isEqualTo(10);
    assertThat(IdleEngine.goldScale(c)).isCloseTo(1.1, offset(1e-9));
    assertThat(engine.perSecond(c)).isCloseTo(income * 1.1, offset(1e-6));
    // 벽 하나를 깬 보상도 10% 더 받는다.
    c.idle.damage = IdleEngine.maxHp(c.idle.wall) - 1e-9;
    double reward = c.capital;
    tick(1000);
    double withGold = c.capital - reward;
    c.fishLevels.put("gold", 0);
    reward = c.capital;
    c.idle.damage = IdleEngine.maxHp(c.idle.wall) - 1e-9;
    tick(1000);
    double without = c.capital - reward;
    assertThat(withGold).isGreaterThan(without);
    // 공격력에는 더하지 않는다.
    assertThat(upgrade(c, "damage").bonusPercent()).isZero();
  }

  private investorgame.raising.CompanyView.FishUpgrade fishUpgrade(CompanyState c, String kind) {
    return engine.view(c).rebirth().upgrades().stream()
        .filter(u -> u.kind().equals(kind))
        .findFirst()
        .orElseThrow();
  }

  @Test
  void 옛_강화_곡선의_단계는_효과가_같게_옮기고_벽에_견주어_넘친_단계는_줄인다() {
    // 648번: 새 회사는 지금 곡선(값 5%, 한 단계 0.2%)으로 시작한다.
    CompanyState fresh = company.open(new HashSeededRandom(4), company.openingCapital());
    assertThat(company.mental.needsUpgradeCurve(fresh)).isFalse();
    assertThat(company.mental.adoptUpgradeCurve(fresh)).isFalse();

    start(1000);
    assertThat(company.mental.needsUpgradeCurve(state)).as("곡선 칸이 없는 옛 저장").isTrue();
    // 벽 1,000까지 버는 돈으로 한 종류를 올릴 수 있는 단계: 840쯤.
    int fair = company.mental.fairLevel(1000);
    assertThat(fair).isBetween(800, 900);
    assertThat(company.mental.fairLevel(1)).isBetween(1, 5);
    // 30% 때(646번) 벽 1,000에서 산 공격력 150단계(+150%), 상한까지 산 연사, 4% 때(553번)처럼 너무 많이 산 체력.
    state.battleLevels.put("damage", 150);
    state.battleLevels.put("fire", 100);
    state.battleLevels.put("hp", 2_000);
    assertThat(company.mental.adoptUpgradeCurve(state)).isTrue();
    assertThat(state.battleLevels)
        .containsEntry("damage", 750)
        .containsEntry("fire", 100)
        .containsEntry("hp", fair);
    // 653번: 한 단계가 다시 1%라 750단계는 +750%다. 벽 체력도 그만큼 커졌다(벽 1,000에서 3.5배).
    assertThat(upgrade(state, "damage").bonusPercent()).isEqualTo(750);
    assertThat(upgrade(state, "fire").bonusPercent()).isEqualTo(100);
    assertThat(company.mental.adoptUpgradeCurve(state)).as("한 번만 옮긴다").isFalse();
    // 옮긴 뒤에는 벽 몇 개 어치로 다음 단계를 산다: 다음 공격력 값이 벽 보상의 10배를 넘지 않는다.
    assertThat(company.mental.upgradePrice(750))
        .isLessThan(10 * IdleEngine.REWARD_UPGRADES * 1e6 * CompanyEngine.inflation(state));
  }

  private investorgame.raising.CompanyView.BattleUpgrade upgrade(CompanyState c, String kind) {
    return company.mental.upgradeViews(c).stream()
        .filter(u -> u.kind().equals(kind))
        .findFirst()
        .orElseThrow();
  }

  /** 사장냥도 쉴 수 있다 (672번): 고양이가 있을 때만, 쉬면 그 총은 쏘지 않는다. 마지막 고양이는 뺄 수 없다. */
  @Test
  void bossCatRestsOnlyWhileACatIsFielded() {
    start(1);
    assertThat(engine.view(state).bossFielded()).isTrue();
    assertThatThrownBy(() -> engine.fieldBoss(state, false))
        .isInstanceOf(InvalidRequestException.class);
    state.idle.cats.put("sky", 1);
    engine.fieldCat(state, "sky", true);
    double together = engine.view(state).dps();
    double power = engine.view(state).power();

    engine.fieldBoss(state, false);
    assertThat(engine.view(state).bossFielded()).isFalse();
    assertThat(engine.view(state).dps()).isPositive().isLessThan(together);
    assertThat(engine.view(state).power()).isLessThan(power);
    assertThatThrownBy(() -> engine.fieldCat(state, "sky", false))
        .isInstanceOf(InvalidRequestException.class);
    assertThat(state.idle.fielded).containsExactly("sky");

    engine.fieldBoss(state, true);
    assertThat(engine.view(state).dps()).isEqualTo(together);
    engine.fieldCat(state, "sky", false);
    assertThat(engine.view(state).bossFielded()).isTrue();
  }
}
