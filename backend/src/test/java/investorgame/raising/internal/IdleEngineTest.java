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
    assertThat(state.idle.damage).isEqualTo(5);
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
    // 전투력 (538번): 권총·강화 없음이면 100 × 2배속 × (1 × 3.846 ÷ 1.25 × 1.2 + 매수 주문 1.5) = 1,038.
    start(1);
    double base = engine.view(state).power();
    assertThat(base).isEqualTo(1038);
    state.idle.wall = 500;
    assertThat(engine.view(state).power()).as("the wall is not in it").isEqualTo(base);
    double last = base;
    for (String kind : List.of("damage", "fire", "hp", "buy")) {
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
    // 고양이 등급 (539번): C 16 · B 12 · A 7 · S 4종. 총 공격력 C 1배 · B 1.4배 · A 2배 · S 3배(레벨 1이면 50%에 곱한다).
    start(1);
    var cats = engine.view(state).cats();
    assertThat(cats).hasSize(39);
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
            java.util.Map.entry("S", 4L));
    java.util.function.Function<String, investorgame.raising.CompanyView.IdleCat> cat =
        code ->
            engine.view(state).cats().stream().filter(c -> c.code().equals(code)).findFirst().get();
    // 특성으로 공격력이 붙지 않은 고양이끼리 견준다: 하늘냥 C, 카라멜냥 B, 바다냥 A, 별빛냥 S.
    assertThat(cat.apply("sky").damagePercent()).isEqualTo(50);
    assertThat(cat.apply("caramel").damagePercent()).isEqualTo(70);
    assertThat(cat.apply("ocean").damagePercent()).isEqualTo(100);
    assertThat(cat.apply("star").damagePercent()).isEqualTo(150);
    // 마법은 A등급부터다 (561번): C·B는 없고 A는 하나, S는 둘이다. 모든 스킬이 쓰인다.
    for (var c : cats) {
      int want = c.grade().equals("S") ? 2 : c.grade().equals("A") ? 1 : 0;
      assertThat(c.skills()).as(c.code()).hasSize(want);
      assertThat(c.skills().stream().map(skill -> skill.code()).distinct().count()).isEqualTo(want);
    }
    assertThat(
            cats.stream().flatMap(c -> c.skills().stream()).map(skill -> skill.code()).distinct())
        .containsExactlyInAnyOrder(
            "water", "meteor", "bolt", "ram", "ice", "wind", "fire", "poison", "light", "dark",
            "sand", "star", "hail", "blossom", "bomb");
    // 열다섯 가지 스킬이 열다섯 칸에 하나씩이다 (563번): 같은 스킬을 가진 고양이는 없다.
    assertThat(cats.stream().mapToInt(c -> c.skills().size()).sum()).isEqualTo(15);
    // 뽑기: 등급의 몫은 C 60 · B 28 · A 10 · S 2%이고 등급 안에서는 고르다.
    var random = new HashSeededRandom(7);
    java.util.Map<String, Integer> drawn = new java.util.HashMap<>();
    int draws = 20_000;
    for (int i = 0; i < draws; i++) {
      drawn.merge(IdleEngine.catGrade(engine.grantCat(state, random).kind), 1, Integer::sum);
    }
    assertThat(drawn.get("C") * 100.0 / draws).isCloseTo(60, offset(2.0));
    assertThat(drawn.get("B") * 100.0 / draws).isCloseTo(28, offset(2.0));
    assertThat(drawn.get("A") * 100.0 / draws).isCloseTo(10, offset(1.5));
    assertThat(drawn.get("S") * 100.0 / draws).isCloseTo(2, offset(0.7));
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
    assertThat(IdleEngine.maxHp(10)).isCloseTo(72.1, offset(1e-9));
    // The boss wall (every 50th) has three times the health and pays three times the reward.
    assertThat(IdleEngine.maxHp(50)).isCloseTo(3 * 544.1, offset(1e-9));
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
    assertThat(engine.view(state).skills()).hasSize(15).noneMatch(skill -> skill.owned());
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
    assertThat(waiting).isEqualTo(IdleEngine.maxHp(50) + 5);
    // No hit counts during the halt: two real seconds are three of its four game seconds.
    tick(2000, new IdleHit(50, "bullet", 1, 100.0, 0));
    assertThat(state.idle.circuitSeconds).isEqualTo(1);
    assertThat(state.idle.damage).isEqualTo(waiting);
    assertThat(state.idle.wall).isEqualTo(50);
    // Trading resumes: what waited on the boss breaks it, and wall 51 does not halt.
    tick(1000);
    assertThat(state.idle.circuitSeconds).isZero();
    assertThat(state.idle.wall).isEqualTo(51);
    assertThat(state.idle.damage).isEqualTo(5);
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

  @Test
  void expandedRosterPreservesOwnedCatsAndEveryNewCompanionCanFight() {
    start(1);
    state.idle.cats.put("sky", 17);
    state.idle.fielded.add("sky");
    var before = engine.view(state).cats().getFirst();
    var roster = engine.view(state).cats();
    assertThat(roster).hasSize(39);
    assertThat(roster.stream().map(cat -> cat.code()).distinct().count()).isEqualTo(39);
    assertThat(roster.getFirst()).isEqualTo(before);
    assertThat(roster.subList(6, 39)).allMatch(cat -> cat.level() == 0 && !cat.fielded());
    // Each new ID is accepted for fielding and participates in both gun and skill calculations.
    for (var cat : roster.subList(6, 39)) {
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
    assertThat(engine.view(state).skills()).hasSize(15).noneMatch(skill -> skill.owned());
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

    // Duplicates raise the level; with enough draws all 39 companions are owned, four of them
    // fielded.
    state.diamonds = (600) * 100L;
    for (int i = 0; i < 600; i++) engine.drawCat(state, random);
    var cats = engine.view(state).cats();
    assertThat(cats).hasSize(39).allMatch(cat -> cat.level() >= 1);
    assertThat(cats.stream().mapToInt(cat -> cat.level()).sum()).isEqualTo(601);
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
    assertThat(engine.view(state).actives().getFirst().readyIn()).isEqualTo(40);
    assertThatThrownBy(() -> engine.useActive(state, "barrage"))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    assertThatThrownBy(() -> engine.useActive(state, "nope"))
        .isInstanceOf(investorgame.common.error.InvalidRequestException.class);
    // Forty buy orders, each at most three times a buy order: 0.75, whatever the wall (514, 573).
    // Neither the weapon nor the wall's order scale is in it.
    double order = 0.75;
    tick(1000, new IdleHit(100, "barrage", 50, 50 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(40 * 3 * order, offset(1e-9));
    tick(1000, new IdleHit(100, "barrage", 10, 22.5));
    assertThat(state.idle.damage).as("the press is spent").isCloseTo(40 * 3 * order, offset(1e-9));

    // The cooldown runs only while the battle runs: 40 real seconds at the fight's 1.5x (580).
    for (int i = 0; i < 37; i++) tick(1000);
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
    state.idle.hitCredits = new double[18];
    tick(1000, new IdleHit(100, "bullet", 1000, 1000.0));
    double plain = state.idle.damage;
    assertThat(plain).isPositive();
    engine.useActive(state, "rally");
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(1000, new IdleHit(100, "bullet", 1000, 1000.0));
    assertThat(state.idle.damage).isCloseTo(2 * plain, org.assertj.core.data.Offset.offset(1e-9));
    // Seven real seconds later it is over: its ten game seconds at 1.5x (580).
    for (int i = 0; i < 7; i++) tick(1000);
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(1000, new IdleHit(100, "bullet", 1000, 1000.0));
    assertThat(state.idle.damage).isCloseTo(plain, org.assertj.core.data.Offset.offset(1e-9));
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
        .isCloseTo(4.8, offset(1e-9));
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
    assertThat(state.idle.damage - before)
        .as("level 11 cat: 150% pistol critical")
        .isCloseTo(6, offset(1e-9));
  }

  @Test
  void buyOrdersHaveTheirOwnDamageAndBudget() {
    start(1);
    state.idle.wall = 100;
    tick(1000);
    // A deep wall does not make a buy order stronger (573): the order scale is not in it.
    double order = 0.75;
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
    // Only the buy upgrade raises it, by a fixed ten shares a level and not by a percentage (579):
    // ten levels add a hundred shares to the 112.5 of one order.
    assertThat(buyBonus()).isZero();
    company.mental.buyUpgrade(state, "buy", 10);
    assertThat(buyBonus()).isEqualTo(100);
    double up = (order + 100 / 150.0) / order;
    state.idle.damage = 0;
    tick(1000, new IdleHit(100, "buy", 2, 2 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(2 * order * up, offset(1e-9));
    // Buy orders do not spend the bullets' budget, and the reverse.
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(1000, new IdleHit(100, "bullet", 1000, 1000.0));
    double bullets = state.idle.damage;
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(1000, new IdleHit(100, "bullet", 1000, 1000.0), new IdleHit(100, "buy", 1, 1000.0));
    assertThat(state.idle.damage).isCloseTo(bullets + order * up, offset(1e-9));
    // The budget is the buy wall's fastest fire: far more than that is not accepted.
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(1000, new IdleHit(100, "buy", 1000, 1000 * 1000.0));
    assertThat(state.idle.damage).isLessThan(30 * order * up);
  }

  private int buyBonus() {
    return company.mental.upgradeViews(state).stream()
        .filter(u -> "buy".equals(u.kind()))
        .findFirst()
        .orElseThrow()
        .bonusShares();
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
    // Level 1 water: 1.5 times the gun, once per 2.4 s. 1.6 s at 1.5x (580) is one cooldown.
    tick(1600, new IdleHit(100, "water", 3, 3 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(1.5, offset(1e-9));
    // Cat level 20 is skill level 3: 2.6 times the gun, once per 1.8 s.
    state.idle.cats.put("ocean", 20);
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(1200, new IdleHit(100, "water", 3, 3 * 1000.0));
    assertThat(state.idle.damage).isCloseTo(2.6, offset(1e-9));
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
    assertThat(state.idle.damage).isCloseTo(3 * 4.2, offset(1e-9));
  }

  @Test
  void anSGradeCatCastsBothOfItsSkills() {
    // 마법은 A등급부터, S등급은 둘 (561번). 서리냥은 우박과 불을 쓴다 (563번).
    start(1);
    state.idle.wall = 100;
    state.idle.cats.put("frost", 1);
    state.idle.fielded.add("frost");
    assertThat(engine.view(state).skills())
        .filteredOn(skill -> skill.owned())
        .extracting(skill -> skill.code())
        .containsExactly("fire", "hail");
    // 2.3 s at 1.5x (580) is 3.45 game seconds: one 3.4 s hail cooldown (two stones at level 1)
    // and one 3 s fire cooldown.
    tick(
        2300,
        new IdleHit(100, "hail", 2, 1000.0),
        new IdleHit(100, "fire", 1, 1000.0),
        new IdleHit(100, "wind", 1, 1000.0));
    assertThat(state.idle.damage).as("hail 2 x 2 + fire 2.4, no wind").isCloseTo(6.4, offset(1e-9));
    // The tiger cat (A grade) has the one skill: the wind.
    state.idle.cats.put("tiger", 1);
    state.idle.fielded.add("tiger");
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(1900, new IdleHit(100, "wind", 1, 1000.0));
    assertThat(state.idle.damage).isCloseTo(1.8, offset(1e-9));
    // A level 5 bomb is one hit of twenty times the gun, once per 3.8 s.
    state.idle.cats.put("silver", 40);
    state.idle.fielded.add("silver");
    state.idle.damage = 0;
    state.idle.hitCredits = new double[18];
    tick(2600, new IdleHit(100, "bomb", 1, 1000.0));
    assertThat(state.idle.damage).isCloseTo(20, offset(1e-9));
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

  @Test
  void 환생하면_처음으로_돌아가고_생선을_받아_고양이_레벨을_올린다() {
    CompanyState c = company.open(new HashSeededRandom(3), company.openingCapital());
    engine.beat(c, "one", 0, "start");
    // 첫 보스를 깨기 전에는 못 한다.
    c.idle.wall = 50;
    assertThat(engine.rebirthFish(c)).isZero();
    assertThatThrownBy(() -> engine.rebirth(c)).isInstanceOf(InvalidRequestException.class);
    // 깊을수록 많이 받는다: (깬 벽 수)² ÷ 500.
    c.idle.wall = 51;
    assertThat(engine.rebirthFish(c)).isEqualTo(5);
    c.idle.wall = 101;
    assertThat(engine.rebirthFish(c)).isEqualTo(20);
    c.idle.wall = 301;
    assertThat(engine.rebirthFish(c)).isEqualTo(180);
    assertThat(engine.view(c).rebirth().gain()).isEqualTo(180);
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
    assertThat(c.fish).isEqualTo(180);
    assertThat(c.rebirths).isEqualTo(1);
    assertThat(c.diamonds).isEqualTo(777);
    assertThat(c.idle.cats.get("sky")).isEqualTo(3);
    assertThat(c.idle.bossCleared).isEqualTo(300);
    assertThat(engine.view(c).rebirth().count()).isEqualTo(1);
    assertThat(engine.view(c).rebirth().gain()).isZero();
    // 생선으로 레벨을 올린다: 지금 레벨 × 5.
    var sky = engine.view(c).cats().stream().filter(cat -> cat.code().equals("sky")).findFirst();
    assertThat(sky.orElseThrow().levelCost()).isEqualTo(15);
    engine.feedCat(c, "sky");
    assertThat(c.idle.cats.get("sky")).isEqualTo(4);
    assertThat(c.fish).isEqualTo(165);
    // 가지지 않은 고양이와 생선이 모자랄 때는 400.
    c.idle.cats.remove("mint");
    assertThatThrownBy(() -> engine.feedCat(c, "mint")).isInstanceOf(InvalidRequestException.class);
    c.fish = 19;
    assertThatThrownBy(() -> engine.feedCat(c, "sky")).isInstanceOf(InvalidRequestException.class);
    assertThat(c.idle.cats.get("sky")).isEqualTo(4);
    assertThat(c.fish).isEqualTo(19);
  }
}
