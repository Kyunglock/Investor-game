package investorgame.raising.internal;

import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.SeededRandom;
import investorgame.raising.CompanyService.IdleHit;
import investorgame.raising.CompanyView;
import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Visible-client lease. No scheduler, offline catch-up, or client-supplied damage/rewards. */
@Component
class IdleEngine {
  private final Clock clock;
  private final CompanyEngine engine;
  private final String serverId = UUID.randomUUID().toString();
  // The fight's speed on screen (580): matches the app's IdleCanvas speed. Hit budgets, skill
  // cooldowns and the wall's progress follow it.
  private static final double SPEED = 1.5;
  // The income and the 전투력 number were set when the fight ran at 2. They keep that scale so that
  // slowing the fight (580) does not cut what a company earns or shrink the number it is shown.
  private static final double INCOME_SPEED = 2;

  /**
   * 서킷브레이커 (decisions.md 547번): 보스 도전이 시작될 때 건다. 보스 도전은 BOSS_EVERY번째 벽마다 저절로 나오고, 그 벽 앞에 서는 순간 거래가
   * 멈춘다. 화면 예측 idlePredict.ts의 CIRCUIT_ENABLED·BOSS_EVERY와 같이 바꾼다.
   */
  static final boolean CIRCUIT_ENABLED = true;

  /** Game seconds one trading halt lasts. */
  static final double CIRCUIT_SECONDS = 4;

  /**
   * 보스 도전이 나오는 간격 (547번): 50번째 벽마다. 대량 매도벽(체력·보상 3배, 큰손, 관통되지 않음)은 이 벽에만 선다: 열 번째 벽마다 서던 것(518번)은
   * 없앴다 (550번).
   */
  static final long BOSS_EVERY = 50;

  /** 보스를 처음 깨면 따로 주는 보상 (549번): 다이아, 그리고 그 벽 보상(대량 매도벽의 3배가 든 값)의 이 배수만큼의 돈. 같은 보스는 한 번만 준다. */
  static final long BOSS_CLEAR_DIAMONDS = 100;

  static final double BOSS_CLEAR_REWARDS = 5;

  /** 보스 도전의 벽 (547번). */
  static boolean bossWall(long wall) {
    return wall % BOSS_EVERY == 0;
  }

  // Credit buckets: the bullet, the fifteen cat skills, the buy barrage (decisions.md 503), and the
  // buy wall's own buy orders (514).
  private static final int SKILLS = 15;
  private static final int KINDS = SKILLS + 4;
  private static final int BARRAGE = SKILLS + 1;
  private static final int BUY = SKILLS + 2;
  // 손절 (591): one hit per press.
  private static final int STOP_LOSS = SKILLS + 3;
  // Active skills (503): the player presses them. Seconds are game seconds (SPEED times real time).
  // barrage: the buy wall pours buy orders; rally: every gun fires twice as fast; fortify: the buy
  // wall is rebuilt and cannot be hurt (the wall is the screen's, so the server only keeps time).
  // Three more came in 591. limitUp (상한가): every bullet is a critical hit; a critical hit is
  // already the most one bullet may do here, so the server only keeps time. stopLoss (손절): the
  // screen gives up half of the buy wall for one big hit on the sell wall. averaging (물타기): the
  // buy orders hit harder the more the buy wall has lost.
  // Those six are the boss cat's 고유 스킬 (587): only the equipped ones can be used.
  // The three after them are the 광고 스킬 (588), used after watching an ad: for a while the guns
  // fire, the guns and skills hit, or the buy orders hit BOOST times as much.
  private static final List<String> ACTIVES =
      List.of(
          "barrage",
          "rally",
          "fortify",
          "limitUp",
          "stopLoss",
          "averaging",
          "boostFire",
          "boostDamage",
          "boostBuy");
  private static final String[] ACTIVE_NAMES = {
    "매수세례", "불장", "방어선 구축", "상한가", "손절", "물타기", "공격속도 3배", "공격력 3배", "매수공격 3배"
  };
  private static final double[] ACTIVE_COOLDOWN = {60, 90, 90, 90, 90, 90, 270, 270, 270};
  private static final double[] ACTIVE_SECONDS = {6, 10, 6, 12, 0, 15, 270, 270, 270};

  /** The first UNIQUE actives are 고유 스킬, the rest are 광고 스킬. */
  private static final int UNIQUE = 6;

  /** The 고유 스킬 a company starts with equipped (587): the first three. */
  private static final int STARTING = 3;

  /** 손절 (591번): 매수벽을 가득 찬 채로 절반 버렸을 때의 한 방이 매수 주문 이만큼이다. Matches the app's mental/actives.ts. */
  static final double STOP_LOSS_ORDERS = 240;

  /** 물타기 (591번): 매수 주문이 가장 세질 때의 배수. Matches the app's mental/actives.ts. */
  static final double AVERAGING_MAX = 3;

  /** 고유 스킬 장착 칸 (587번). */
  static final int ACTIVE_SLOTS = 3;

  /** 광고 스킬의 배수 (588번). Matches the app's mental/actives.ts. */
  static final double BOOST = 3;

  // A boosted bullet or buy order may land a moment after its boost ended.
  private static final double BOOST_GRACE = 2;
  // Matches the app's mental/actives.ts.
  private static final int BARRAGE_SHOTS = 40;
  // One barrage order is a plain buy order (601): it was three times one before.
  private static final double BARRAGE_POWER = 1;
  // A buy order's damage is its own number (514): this base times the wall's order scale (the
  // same scale the sell orders and the buy wall's health use, 498) times the buy upgrade. It does
  // not follow the weapon. Matches the app's mental/buyWall.ts BUY_WALL.orderDamage.
  // Doubled from 0.75 in 594.
  private static final double BUY_ORDER_DAMAGE = 1.5;
  // The buy wall answers every sell order with two buy orders, a pair every 0.15 game seconds at
  // the fastest (buyWall.ts shotSeconds - shotJitter).
  private static final double BUY_ORDERS_PER_SECOND = 2 / 0.15;
  // Matches the app's mental/assault.ts idleThreat.
  // Halved with the wall health (562) so the buy side's scale stays what it was.
  private static final double THREAT_HP = 380;
  // Wall health (518): base + linear x depth + square x depth^2, every 50th wall (the boss, 550) x
  // BOSS_HP.
  // Halved in 562: 20 + 12 x depth + 0.2 x depth^2 before.
  private static final double HP_BASE = 10;
  private static final double HP_LINEAR = 6;
  private static final double HP_SQUARE = 0.1;
  private static final double BOSS_HP = 3;

  /**
   * Bullet pierce (520): every bullet goes through the front wall into the two behind it, weaker at
   * each wall. The app's IDLE_PIERCE holds the same shares.
   */
  static final double[] PIERCE = {1, 0.5, 0.25};

  /**
   * Walls behind the two shown ones that keep pierce damage, and how far the screen may be ahead.
   */
  static final int FAR = 4;

  private static final long AHEAD = 20;

  private static final double RALLY_FIRE = 2;
  // A beat this late still counts in full (decisions.md 497): on a slow link the screen sends the
  // next beat only after the last answer, and dropping those hits refilled the wall. A longer
  // silence is a closed or sleeping app and pays nothing.
  private static final long GRACE_MS = 10_000;
  // Attack kinds after the bullet (kind 0): skills. A cat's skills are its own and it casts them
  // while fielded (decisions.md 501). Only A and S grade cats have any (561): A one, S two.
  // Ice and wind joined the first four in 561: a slow heavy lance and a quick gust.
  // A skill has five levels (515), the renderer's tables (mental/magic.ts): cooldown, damage per
  // hit as a multiple of the boss cat's gun, and hits on the wall per cast (meteors per cast; a
  // bolt and one chain per lightning stroke). The level follows the cat's level.
  private static final int SKILL_MAX_LEVEL = 5;
  private static final int SKILL_CAT_LEVELS = 10;

  /** A stat that changes evenly from its level 1 value to its level 5 value (563). */
  private static double[] ramp(double from, double to) {
    double[] values = new double[SKILL_MAX_LEVEL];
    for (int i = 0; i < values.length; i++) values[i] = from + (to - from) * i / 4;
    return values;
  }

  private static double[] hits(double... perLevel) {
    return perLevel;
  }

  private static final double[] ONE_HIT = {1, 1, 1, 1, 1};
  // The first six keep their own tables. The nine after them (563) are the app's
  // mental/spellbook.ts: cooldown and damage ramp from level 1 to level 5, and a falling spell
  // (hail, blossom, bomb) lands as many times as it drops.
  private static final String[] CODES = {
    "water", "meteor", "bolt", "ram", "ice", "wind", "fire", "poison", "light", "dark", "sand",
    "star", "hail", "blossom", "bomb"
  };
  private static final String[] NAMES = {
    "물 스킬", "메테오 스킬", "번개 스킬", "충차 스킬", "얼음 스킬", "바람 스킬", "불 스킬", "독 스킬", "빛 스킬", "어둠 스킬", "모래 스킬",
    "별 스킬", "우박 스킬", "꽃비 스킬", "폭탄 스킬"
  };
  private static final double[][] COOLDOWNS = {
    {2.4, 2.1, 1.8, 1.6, 1.4},
    {3.6, 3.3, 3, 2.8, 2.6},
    {2.6, 2.3, 2, 1.8, 1.6},
    {3.6, 3.2, 3, 2.8, 2.6},
    {3.2, 2.9, 2.6, 2.4, 2.2},
    {2.8, 2.5, 2.2, 2, 1.8},
    ramp(3, 2.2),
    ramp(2.2, 1.4),
    ramp(3.4, 2.4),
    ramp(3, 2.2),
    ramp(2.6, 1.8),
    ramp(2, 1.3),
    ramp(3.4, 2.6),
    ramp(3, 2.2),
    ramp(5, 3.8)
  };
  private static final double[][] SKILL_DAMAGE = {
    {1.5, 2, 2.6, 3, 3.4},
    {4.8, 8.25, 4.2, 5.05, 4.42},
    {2.5, 3.5, 4.5, 5.2, 6},
    {1.2 * 3.4, 1.6 * 3.6, 2.1 * 3.8, 2.5 * 4, 2.9 * 4.2},
    {3.2, 4.4, 5.6, 6.6, 7.6},
    {1.8, 2.4, 3.1, 3.6, 4.1},
    ramp(2.4, 5.6),
    ramp(1.2, 2.8),
    ramp(3.6, 8.4),
    ramp(2.2, 5),
    ramp(1.5, 3.5),
    ramp(1.4, 3.2),
    ramp(2, 2.8),
    ramp(1.6, 2.4),
    ramp(9, 20)
  };
  private static final double[][] SKILL_HITS = {
    ONE_HIT,
    {1, 1, 3, 3, 4},
    {2, 2, 2, 3, 3},
    ONE_HIT,
    ONE_HIT,
    ONE_HIT,
    ONE_HIT,
    ONE_HIT,
    ONE_HIT,
    ONE_HIT,
    ONE_HIT,
    ONE_HIT,
    hits(2, 2, 3, 4, 5),
    hits(2, 2, 3, 3, 4),
    ONE_HIT
  };
  // Cats (decisions.md 488, 492, 493): each has a trait for its own gun. Drawn with a ticket.
  private static final List<String> CATS =
      List.of(
          "sky",
          "mint",
          "lilac",
          "sunset",
          "night",
          "snow",
          "caramel",
          "mocha",
          "peach",
          "silver",
          "panda",
          "biscuit",
          "ocean",
          "lemon",
          "cocoa",
          "rose",
          "tiger",
          "cloud",
          "star",
          "siam",
          "tilt",
          "russet",
          "sage",
          "apricot",
          "plum",
          "patch",
          "drowsy",
          "coral",
          "truffle",
          "frost",
          "butter",
          "terra",
          "wisteria",
          "odd",
          "pistachio",
          "sand",
          "blush",
          "petrol",
          "oat");
  private static final String[] CAT_NAMES = {
    "하늘냥", "민트냥", "라일락냥", "노을냥", "밤냥", "눈꽃냥", "카라멜냥", "모카냥", "복숭아냥", "은빛냥", "판다냥", "비스킷냥", "바다냥",
    "레몬냥", "코코아냥", "로즈냥", "호랑냥", "구름냥", "별빛냥", "샴냥", "짝귀냥", "단풍냥", "세이지냥", "살구냥", "자두냥", "조각냥",
    "졸린냥", "산호냥", "트러플냥", "서리냥", "버터냥", "테라냥", "등꽃냥", "오드냥", "피스타냥", "모래냥", "볼터치냥", "청록냥", "오트냥"
  };
  // 고양이 등급 (decisions.md 539번): 종마다 정해져 있다. C 16 · B 12 · A 7 · S 4종이고 S는 스킬마다 하나다.
  static final List<String> CAT_GRADES = List.of("C", "B", "A", "S");
  private static final java.util.Set<String> GRADE_S =
      java.util.Set.of("star", "silver", "wisteria", "frost");
  private static final java.util.Set<String> GRADE_A =
      java.util.Set.of("tiger", "panda", "night", "snow", "rose", "ocean", "siam");
  private static final java.util.Set<String> GRADE_B =
      java.util.Set.of(
          "caramel", "mocha", "peach", "biscuit", "lemon", "cocoa", "cloud", "tilt", "russet",
          "plum", "coral", "truffle");
  // A grade's share of the draws (percent) and its cats' gun damage (x the level's power).
  private static final int[] GRADE_PERCENT = {60, 28, 10, 2};
  private static final double[] GRADE_DAMAGE = {1, 1.4, 2, 3};
  private static final int[] CAT_GRADE = CATS.stream().mapToInt(IdleEngine::gradeIndex).toArray();
  // Each grade's share is split evenly over its cats: percent x (all cats' common multiple) / n.
  private static final int[] CAT_WEIGHTS = catWeights();

  private static int gradeIndex(String code) {
    return GRADE_S.contains(code) ? 3 : GRADE_A.contains(code) ? 2 : GRADE_B.contains(code) ? 1 : 0;
  }

  private static int[] catWeights() {
    int[] count = new int[CAT_GRADES.size()];
    for (int grade : CAT_GRADE) count[grade]++;
    int common = 1;
    for (int n : count) common *= n;
    int[] weights = new int[CAT_GRADE.length];
    for (int i = 0; i < weights.length; i++) {
      weights[i] = GRADE_PERCENT[CAT_GRADE[i]] * (common / count[CAT_GRADE[i]]);
    }
    return weights;
  }

  /** A cat's grade letter (539). */
  static String catGrade(String code) {
    int at = CATS.indexOf(code);
    return CAT_GRADES.get(at < 0 ? 0 : CAT_GRADE[at]);
  }

  private static final double[] CAT_FIRE = {
    1.25, 1, 1, 1.1, 1, 1.4, 1.25, 1, 1, 1.1, 1, 1.4, 1.25, 1, 1, 1.1, 1, 1.4, 1.25, 1, 1, 1.1, 1,
    1.4, 1.25, 1, 1, 1.1, 1, 1.4, 1.25, 1, 1, 1.1, 1, 1.4, 1.25, 1, 1
  };
  private static final double[] CAT_DAMAGE = {
    1, 1.25, 1, 1.1, 1.1, 1, 1, 1.25, 1, 1.1, 1.1, 1, 1, 1.25, 1, 1.1, 1.1, 1, 1, 1.25, 1, 1.1, 1.1,
    1, 1, 1.25, 1, 1.1, 1.1, 1, 1, 1.25, 1, 1.1, 1.1, 1, 1, 1.25, 1
  };
  private static final double[] CAT_CRITICAL = {
    1, 1, 1.5, 1, 1.25, 1, 1, 1, 1.5, 1, 1.25, 1, 1, 1, 1.5, 1, 1.25, 1, 1, 1, 1.5, 1, 1.25, 1, 1,
    1, 1.5, 1, 1.25, 1, 1, 1, 1.5, 1, 1.25, 1, 1, 1, 1.5
  };
  // Each cat's own skills, as indexes into CODES (501, 561). C and B grade cats have none, an A
  // grade cat has one and an S grade cat has two.
  private static final Map<String, int[]> SKILLED =
      Map.ofEntries(
          // A grade: one skill each.
          Map.entry("night", new int[] {1}),
          Map.entry("snow", new int[] {4}),
          Map.entry("panda", new int[] {3}),
          Map.entry("ocean", new int[] {0}),
          Map.entry("rose", new int[] {13}),
          Map.entry("tiger", new int[] {5}),
          Map.entry("siam", new int[] {10}),
          // S grade: two each. No two cats share a skill (563): fifteen skills, fifteen slots.
          Map.entry("star", new int[] {11, 8}),
          Map.entry("silver", new int[] {2, 14}),
          Map.entry("wisteria", new int[] {7, 9}),
          Map.entry("frost", new int[] {12, 6}));
  private static final int[] NO_SKILLS = {};
  private static final int[][] CAT_SKILLS =
      CATS.stream().map(code -> SKILLED.getOrDefault(code, NO_SKILLS)).toArray(int[][]::new);

  private static boolean casts(int cat, int skill) {
    for (int own : CAT_SKILLS[cat]) if (own == skill) return true;
    return false;
  }

  private static final long[] OLD_UNLOCKS = {5, 15, 30, 50};
  private static final String[] OLD_SKILL_CATS = {"mint", "sky", "lilac", "sunset"};
  // Cats used to join at these walls. Saves from then keep them.
  private static final long[] CAT_LEGACY_WALLS = {15, 50};
  private static final int FIELD_SLOTS = 4;
  // A cat's gun hits for this share of the weapon's damage; each level above 1 adds the bonus.
  private static final double CAT_POWER = 0.5;
  private static final double CAT_LEVEL_BONUS = 0.2;
  // 벽 보상 (553번): 벽 하나를 깨면 그 벽 번호와 같은 단계의 전투 강화 값 REWARD_UPGRADES개 어치를 준다. 물가가 강화 값과 같은
  // 빠르기로 크므로(CompanyEngine.inflation), N번째 벽을 깰 때까지 번 돈이 끝없는 강화(공격력·체력·매수)를 평균 N단계쯤 올린다.
  // 보스 벽은 BOSS_REWARD배. 전에는 그 벽의 시간 수입 10초 어치였다 (537·552번). 세 단계 어치를 한 단계 반으로 낮췄다 (559번).
  static final double REWARD_UPGRADES = 1.5;
  private static final double BOSS_REWARD = 3;
  // Capital per active game second at wall 1 (492). The price level alone grows it (553).
  // 20,000 → 2,000 (554번): 초당 수입을 1/10로. 직원 수입(income.grade-per-second)도 함께 1/10이다.
  // 2,000 → 1,000 (559번): 버는 돈을 모두 절반으로.
  static final double INCOME = 1_000;
  // Matches weaponEffects.ts: revolver 3x, every other weapon 2x (decisions.md 487).
  private static final double REVOLVER_CRITICAL = 3;
  private static final double CRITICAL = 2;
  // Matches weaponEffects.ts CRIT_CHANCE and BASE_CRIT_CHANCE.
  private static final double REVOLVER_CHANCE = 0.4;
  private static final double CRITICAL_CHANCE = 0.2;
  // Matches weaponEffects.ts SHOT_WEIGHT (decisions.md 495): every gun fires this many times
  // slower than its stats and each bullet hits that much harder. Damage per second is unchanged.
  private static final double BULLET_WEIGHT = 2;

  /** One gun on the field: the boss cat's, then one per fielded cat. */
  private record Shooter(
      double damage, double perSecond, double power, double critical, boolean explosive) {}

  IdleEngine(Clock clock, CompanyEngine engine) {
    this.clock = clock;
    this.engine = engine;
  }

  private CompanyState.Idle state(CompanyState c) {
    if (c.idle == null) {
      c.idle = new CompanyState.Idle();
      // Keep legacy clears, without paying their rewards a second time.
      c.idle.wall = 1L + c.assaultStars.stream().filter(s -> s > 0).count();
    }
    if (c.idle.hitVersion < 2) {
      // Old queued damage used elapsed DPS or inflated per-hit formulas.
      c.idle.nextDamage = 0;
      c.idle.afterNextDamage = 0;
      c.idle.farDamage = null;
      c.idle.damage = Math.min(c.idle.damage, maxHp(c.idle.wall) - 1);
      c.idle.hitVersion = 2;
    }
    // Saves from before 520 could hold a queued wall already at zero health.
    c.idle.nextDamage = Math.min(c.idle.nextDamage, maxHp(c.idle.wall + 1) - 1);
    c.idle.afterNextDamage = Math.min(c.idle.afterNextDamage, maxHp(c.idle.wall + 2) - 1);
    if (c.idle.cats == null) {
      c.idle.cats = new LinkedHashMap<>();
      for (int i = 0; i < CAT_LEGACY_WALLS.length; i++) {
        if (c.idle.wall > CAT_LEGACY_WALLS[i]) {
          c.idle.cats.put(CATS.get(i), 1);
          c.idle.fielded.add(CATS.get(i));
        }
      }
    }
    if (!c.idle.catSkills) {
      // Skills used to unlock at these walls (water, meteor, bolt, ram). A save that had one keeps
      // it as a cat with that skill, fielded while a slot is free (501).
      for (int i = 0; i < OLD_UNLOCKS.length; i++) {
        // The four old skill cats, whether or not they still have a skill (561).
        boolean has = c.idle.cats.containsKey(OLD_SKILL_CATS[i]);
        if (c.idle.wall > OLD_UNLOCKS[i] && !has) {
          c.idle.cats.put(OLD_SKILL_CATS[i], 1);
          if (c.idle.fielded.size() < FIELD_SLOTS) c.idle.fielded.add(OLD_SKILL_CATS[i]);
        }
      }
      c.idle.catSkills = true;
    }
    seat(c.idle);
    c.idle.best = Math.max(c.idle.best, Math.max(c.idle.wall - 1, c.idle.bossCleared));
    if (!c.onboardingInitialized) {
      // 이미 해금 조건을 달성한 기존 유저에게 새 안내를 강제하지 않는다.
      c.skillGuideSeen = c.tutorialStep == null && c.idle.best >= 100;
      c.onboardingInitialized = true;
    }
    return c.idle;
  }

  private List<Shooter> shooters(CompanyState c) {
    CompanyState.Idle s = state(c);
    double damageUp = 1;
    double fireUp = 1;
    for (CompanyView.BattleUpgrade u : engine.mental.upgradeViews(c)) {
      double bonus = 1 + u.bonusPercent() / 100.0;
      switch (u.kind()) {
        case "damage" -> damageUp = bonus;
        case "fire" -> fireUp = bonus;
        default -> {}
      }
    }
    List<Shooter> shooters = new ArrayList<>();
    shooters.add(shooter(c.weapon, damageUp, fireUp, 1.0));
    for (String code : s.fielded) {
      int cat = CATS.indexOf(code);
      shooters.add(
          shooter(
              s.catWeapons.get(code),
              damageUp * power(s.cats.get(code)) * CAT_DAMAGE[cat] * GRADE_DAMAGE[CAT_GRADE[cat]],
              fireUp * CAT_FIRE[cat],
              CAT_CRITICAL[cat]));
    }
    return shooters;
  }

  private static double power(int level) {
    return CAT_POWER * (1 + CAT_LEVEL_BONUS * (level - 1));
  }

  /** A cat without a gun, and a company from before weapons, shoots the starting pistol. */
  private Shooter shooter(
      CompanyState.Weapon weapon, double damageUp, double fireUp, double catCritical) {
    String kind = weapon == null ? MentalEngine.PISTOL : weapon.kind;
    CompanyProperties.Weapon stats =
        engine.mental.stats(
            kind, weapon == null ? MentalEngine.WEAPON_GRADES.getFirst() : weapon.grade);
    return new Shooter(
        Math.min(1_000_000_000, stats.damagePercent() / 100.0 * damageUp),
        1000.0 / stats.fireMs() * fireUp,
        1 + Math.max(0, Math.min(3, stats.power())) * 0.4,
        ("revolver".equals(kind) ? REVOLVER_CRITICAL : CRITICAL) * catCritical,
        stats.power() >= 2);
  }

  void beat(CompanyState c, String runId, long sequence, String action) {
    beat(c, runId, sequence, action, List.of());
  }

  void beat(CompanyState c, String runId, long sequence, String action, List<IdleHit> hits) {
    CompanyState.Idle s = state(c);
    long now = clock.millis();
    if ("start".equals(action)) {
      if (runId.equals(s.runId)) return; // Retried start must never reset the sequence.
      away(c, now);
      s.hitCredits = new double[KINDS];
      s.runId = runId;
      s.sequence = sequence;
      s.lastBeat = now;
      s.serverId = serverId;
      return;
    }
    if (!runId.equals(s.runId)) throw new InvalidRequestException("다른 화면에서 전투 중입니다. 다시 연결해 주세요.");
    if (sequence <= s.sequence) return;
    s.sequence = sequence;
    long elapsed = now - s.lastBeat;
    boolean live =
        s.lastBeat > 0 && elapsed > 0 && elapsed <= GRACE_MS && serverId.equals(s.serverId);
    if ("stop".equals(action)) {
      // The time since the last beat is paid like any other gap, so nothing is lost at the end.
      away(c, now);
      s.lastBeat = 0;
      s.hitCredits = new double[KINDS];
      return;
    }
    if (live) {
      tick(c, elapsed / 1000.0 * SPEED, hits == null ? List.of() : hits);
      s.lastSeen = now;
    } else {
      // A gap (a sleeping phone, a restarted server): the fight did not run, the income did.
      away(c, now);
      s.hitCredits = new double[KINDS];
    }
    s.lastBeat = now;
    s.serverId = serverId;
  }

  /** Away shorter than this is paid without a notice. */
  private static final long NOTICE_MS = 60_000;

  /**
   * Income for the time nobody was playing (decisions.md 523): from the last beat to now at the
   * same rate the screen shows, up to offline-hours. Walls are not broken meanwhile. A first beat
   * ever (no lastSeen) pays nothing.
   */
  private void away(CompanyState c, long now) {
    CompanyState.Idle s = state(c);
    long gone = s.lastSeen > 0 ? now - s.lastSeen : 0;
    s.lastSeen = now;
    if (gone <= 0) return;
    long cap = engine.offlineSeconds() * 1000;
    double seconds = Math.min(gone, cap) / 1000.0;
    double income = s.incomeRemainder + seconds * INCOME_SPEED * incomeRate(c);
    double earned = Math.floor(income);
    s.incomeRemainder = income - earned;
    s.earned += earned;
    c.capital += earned;
    if (gone >= NOTICE_MS) {
      s.offlineAt = now;
      s.offlineSeconds = seconds;
      s.offlineEarned = earned;
      s.offlineCapped = gone > cap;
    }
  }

  /**
   * What clearing the front wall pays (553): REWARD_UPGRADES upgrade steps at the wall's price
   * level, three times that on a boss wall. Employees and the stage bonus are not in it.
   */
  private double reward(CompanyState c) {
    return Math.floor(
        engine.mental.upgradePrice(0)
            * REWARD_UPGRADES
            * (bossWall(c.idle.wall) ? BOSS_REWARD : 1)
            * CompanyEngine.inflation(c));
  }

  /** The company's income per game second: the wall's and the employees', at the price level. */
  double incomeRate(CompanyState c) {
    state(c); // Makes sure the idle state exists before the price level reads it.
    return (INCOME + engine.staffIncome(c))
        * CompanyEngine.inflation(c)
        * (1 + engine.mental.bonusPercent(c) / 100.0);
  }

  /** The company's income per real second on screen (the fight runs at SPEED). */
  double perSecond(CompanyState c) {
    return INCOME_SPEED * incomeRate(c);
  }

  /** One employee's share of that income, per real second on screen. */
  double incomeOf(CompanyState c, CompanyState.Employee e) {
    return INCOME_SPEED
        * engine.incomeOf(e)
        * CompanyEngine.inflation(c)
        * (1 + engine.mental.bonusPercent(c) / 100.0);
  }

  long now() {
    return clock.millis();
  }

  private static final java.time.ZoneId SEOUL = java.time.ZoneId.of("Asia/Seoul");

  /** Today in Korea (yyyy-MM-dd): daily things reset at Korean midnight (523). */
  String today() {
    return todayDate().toString();
  }

  java.time.LocalDate todayDate() {
    return java.time.LocalDate.ofInstant(clock.instant(), SEOUL);
  }

  /** The instant (ms) a Korean calendar day starts. */
  static long startOf(java.time.LocalDate day) {
    return day.atStartOfDay(SEOUL).toInstant().toEpochMilli();
  }

  static double maxHp(long wall) {
    // The first walls fall in seconds; later ones grow faster than linearly so upgrades matter
    // (492). The curve was softened in 518: the square term halved, the boss wall x3 (every 50th
    // since 550).
    return plainHp(wall) * (bossWall(wall) ? BOSS_HP : 1);
  }

  /**
   * Whether a bullet that hit the wall {@code depth} walls in front of {@code wall} is stopped by a
   * 대량 매도벽 on the way: that front wall, a wall between, or the target itself.
   */
  static boolean pierceBlocked(long wall, int depth) {
    for (long at = wall - depth; at <= wall; at++) if (bossWall(at)) return true;
    return false;
  }

  /** A wall's health before the every-tenth-wall multiplier. */
  private static double plainHp(long wall) {
    long depth = wall - 1;
    return HP_BASE + HP_LINEAR * depth + HP_SQUARE * depth * depth;
  }

  private double dps(CompanyState c) {
    CompanyState.Idle s = state(c);
    List<Shooter> shooters = shooters(c);
    double total = 0;
    for (Shooter shooter : shooters) {
      total += shooter.damage() * shooter.perSecond() * shooter.power() / 1.25;
    }
    for (String code : s.fielded) {
      int cat = CATS.indexOf(code);
      if (cat < 0) continue;
      int level = skillLevel(s.cats.getOrDefault(code, 1)) - 1;
      for (int skill : CAT_SKILLS[cat]) {
        total +=
            shooters.getFirst().damage()
                * SKILL_DAMAGE[skill][level]
                * (skill == 1 || skill >= 12 ? SKILL_HITS[skill][level] : 1)
                / COOLDOWNS[skill][level];
      }
    }
    return SPEED * total;
  }

  // 전투력 (538): the weights of the parts that are not bullet or skill damage.
  private static final double POWER_SCALE = 100;
  private static final double POWER_BUY_ORDERS = 2;
  private static final double POWER_HP_WEIGHT = 0.25;

  /**
   * 전투력 (decisions.md 538번): 성장 탭이 보여 주는 숫자 하나. 모든 총과 스킬의 초당 피해(치명타 기대값 포함)에 매수 주문의 피해를 더하고, 매수벽 체력
   * 강화의 4분의 1을 곱한다. 벽 번호는 보지 않으므로 강화·무기·고양이가 바뀔 때만 오른다.
   */
  private double power(CompanyState c) {
    CompanyState.Idle s = state(c);
    List<Shooter> shooters = shooters(c);
    double total = 0;
    for (int i = 0; i < shooters.size(); i++) {
      Shooter shooter = shooters.get(i);
      CompanyState.Weapon weapon = i == 0 ? c.weapon : s.catWeapons.get(s.fielded.get(i - 1));
      double chance =
          weapon != null && "revolver".equals(weapon.kind) ? REVOLVER_CHANCE : CRITICAL_CHANCE;
      total +=
          shooter.damage()
              * shooter.perSecond()
              * shooter.power()
              / 1.25
              * (1 + chance * (shooter.critical() - 1));
    }
    for (String code : s.fielded) {
      int cat = CATS.indexOf(code);
      if (cat < 0) continue;
      int level = skillLevel(s.cats.getOrDefault(code, 1)) - 1;
      for (int skill : CAT_SKILLS[cat]) {
        total +=
            shooters.getFirst().damage()
                * SKILL_DAMAGE[skill][level]
                * SKILL_HITS[skill][level]
                / COOLDOWNS[skill][level];
      }
    }
    total += buyOrder(c) * POWER_BUY_ORDERS;
    double hpUp = 0;
    for (CompanyView.BattleUpgrade u : engine.mental.upgradeViews(c)) {
      if ("hp".equals(u.kind())) hpUp = u.bonusPercent() / 100.0;
    }
    return Math.floor(POWER_SCALE * INCOME_SPEED * total * (1 + POWER_HP_WEIGHT * hpUp));
  }

  /** A cat's skill level (515, 534): one more at cat level 10, 20, 30 and 40, up to five. */
  static int skillLevel(int catLevel) {
    return Math.min(SKILL_MAX_LEVEL, 1 + Math.max(0, catLevel) / SKILL_CAT_LEVELS);
  }

  /** The cat level at which the skill next levels up, or 0 at the top level. */
  private static int nextSkillAt(int catLevel) {
    int level = skillLevel(catLevel);
    return level >= SKILL_MAX_LEVEL ? 0 : level * SKILL_CAT_LEVELS;
  }

  /**
   * The order scale in front of a wall (498): matches the app's idleThreat, two significant digits.
   */
  static double threat(long wall) {
    double hp = plainHp(wall);
    return new java.math.BigDecimal(1 + hp / THREAT_HP)
        .round(new java.math.MathContext(2))
        .doubleValue();
  }

  // Matches the app's mental/shares.ts SHARES_PER_HP: shares shown per point of damage.
  static final double SHARES_PER_HP = 150;

  /**
   * One buy order's damage (514, 573, 579). Neither the weapon nor the wall's depth is in it: only
   * the buy wall attack upgrade raises it, by a fixed number of shares a level and not by a
   * percentage.
   */
  private double buyOrder(CompanyState c) {
    return BUY_ORDER_DAMAGE + buyUp(c);
  }

  /** The damage the buy wall attack upgrade has added to one buy order. */
  private double buyUp(CompanyState c) {
    for (CompanyView.BattleUpgrade u : engine.mental.upgradeViews(c)) {
      if ("buy".equals(u.kind())) return u.bonusShares() / SHARES_PER_HP;
    }
    return 0;
  }

  /**
   * 액티브 스킬을 쓴다 (decisions.md 503번). 없는 스킬이거나 아직 재사용 대기 중이면 400. 대기 시간은 전투가 돌아가는 동안만 흐른다(접속 신호의 활성
   * 시간).
   */
  void useActive(CompanyState c, String code) {
    useActive(c, code, false);
  }

  /**
   * 고유 스킬(587번)은 장착한 것만 쓴다. 광고 스킬(588번)은 광고를 본 뒤(ad)에만 쓴다: 아직 광고를 붙이지 않아 화면이 보낸 값을 그대로 믿는다 (#888).
   */
  void useActive(CompanyState c, String code, boolean ad) {
    CompanyState.Idle s = state(c);
    if (!skillsUnlocked(c)) throw new InvalidRequestException("100 매도벽 돌파 시 해금돼요");
    int at = ACTIVES.indexOf(code);
    if (at < 0) throw new InvalidRequestException("없는 스킬이다: " + code);
    if (at < UNIQUE && !equipped(s).contains(code)) {
      throw new InvalidRequestException("장착하지 않은 스킬이다: " + ACTIVE_NAMES[at]);
    }
    if (at >= UNIQUE && !ad) throw new InvalidRequestException("광고를 본 뒤에 쓸 수 있다");
    if (at >= UNIQUE
        && ACTIVES.subList(UNIQUE, ACTIVES.size()).stream()
            .anyMatch(boost -> s.activeUntil.getOrDefault(boost, 0.0) > s.activeSeconds + 1e-9)) {
      throw new InvalidRequestException("광고 스킬은 한 번에 하나만 쓸 수 있다");
    }
    if (s.activeReady.getOrDefault(code, 0.0) > s.activeSeconds + 1e-9) {
      throw new InvalidRequestException("아직 쓸 수 없다");
    }
    if (s.circuitSeconds > 0) throw new InvalidRequestException("거래 정지 중에는 쓸 수 없다");
    s.activeReady.put(code, s.activeSeconds + ACTIVE_COOLDOWN[at]);
    if (s.hitCredits == null || s.hitCredits.length != KINDS) s.hitCredits = new double[KINDS];
    if (at == 0) s.hitCredits[BARRAGE] = BARRAGE_SHOTS;
    if (at == 1) s.rallyUntil = s.activeSeconds + ACTIVE_SECONDS[at];
    if ("stopLoss".equals(code)) s.hitCredits[STOP_LOSS] = 1;
    // The timed ones after the first three keep their end in activeUntil: the screen picks the
    // effect up again from it when it is reopened.
    if (at >= STARTING && ACTIVE_SECONDS[at] > 0) {
      s.activeUntil.put(code, s.activeSeconds + ACTIVE_SECONDS[at]);
    }
  }

  /** 장착한 고유 스킬 (587번). 장착이 생기기 전의 저장은 셋을 모두 장착한 것으로 본다. */
  private static List<String> equipped(CompanyState.Idle s) {
    if (s.activeSlots == null) s.activeSlots = new ArrayList<>(ACTIVES.subList(0, STARTING));
    return s.activeSlots;
  }

  /**
   * 고유 스킬을 장착하거나 뺀다 (587번). ACTIVE_SLOTS개까지 장착한다. 광고 스킬이거나 없는 스킬이거나 칸이 꽉 찼으면 400. 재사용 대기 시간은 뺐다 끼워도
   * 그대로 흐른다.
   */
  void equipActive(CompanyState c, String code, boolean equip) {
    CompanyState.Idle s = state(c);
    if (!skillsUnlocked(c)) throw new InvalidRequestException("100 매도벽 돌파 시 해금돼요");
    int at = ACTIVES.indexOf(code);
    if (at < 0 || at >= UNIQUE) throw new InvalidRequestException("장착할 수 없는 스킬이다: " + code);
    List<String> slots = equipped(s);
    if (!equip) {
      slots.remove(code);
    } else if (!slots.contains(code)) {
      if (slots.size() >= ACTIVE_SLOTS) {
        throw new InvalidRequestException("장착 칸이 꽉 찼다: " + ACTIVE_SLOTS + "개까지 장착한다");
      }
      slots.add(code);
    }
  }

  boolean skillsUnlocked(CompanyState c) {
    CompanyState.Idle s = state(c);
    return Math.max(s.best, Math.max(s.wall - 1, s.bossCleared)) >= 100;
  }

  /** 단계 번호는 재전송 키이기도 하다. 보상과 단계 변경은 회사 행 잠금 안에서 함께 저장한다. */
  void tutorial(CompanyState c, String action, int expected) {
    CompanyState.Idle s = state(c);
    if ("skills".equals(action)) {
      if (!skillsUnlocked(c)) throw new InvalidRequestException("100 매도벽 돌파 시 해금돼요");
      c.skillGuideSeen = true;
      return;
    }
    if ("skip".equals(action) || "claim".equals(action)) {
      tutorialCat(c);
      tutorialWeapon(c);
      c.tutorialStep = 8;
      return;
    }
    if (!"next".equals(action)) throw new InvalidRequestException("없는 안내 동작이에요");
    int step = c.tutorialStep == null ? 8 : c.tutorialStep;
    if (expected < step) return;
    if (expected != step || step >= 8) throw new InvalidRequestException("안내 단계를 다시 확인해 주세요");
    boolean ready =
        switch (step) {
          case 0 -> Math.max(s.best, s.wall - 1) >= 1;
          case 1 -> c.battleLevels.getOrDefault("damage", 0) > 0;
          case 3 -> s.fielded.contains("night");
          case 5 ->
              s.catWeapons.containsKey("night")
                  && "smg".equals(s.catWeapons.get("night").kind)
                  && "B".equals(s.catWeapons.get("night").grade);
          default -> true;
        };
    if (!ready) throw new InvalidRequestException("안내된 행동을 먼저 완료해 주세요");
    if (step == 2) tutorialCat(c);
    if (step == 4) tutorialWeapon(c);
    c.tutorialStep = step + 1;
  }

  private void tutorialCat(CompanyState c) {
    if (c.tutorialCatClaimed) return;
    state(c).cats.merge("night", 1, Integer::sum);
    c.tutorialCatClaimed = true;
  }

  private void tutorialWeapon(CompanyState c) {
    if (c.tutorialWeaponClaimed) return;
    engine.mental.initWeapons(c);
    CompanyState.Weapon owned =
        c.weapons.stream()
            .filter(w -> "smg".equals(w.kind) && "B".equals(w.grade))
            .findFirst()
            .orElse(null);
    if (owned == null) c.weapons.add(new CompanyState.Weapon("smg", "B"));
    else owned.count++;
    c.tutorialWeaponClaimed = true;
  }

  /** Whether an ad skill's boost counts for a beat that starts at this active time (588). */
  private static double boost(CompanyState.Idle s, String code, double start) {
    return running(s, code, start) ? BOOST : 1;
  }

  /** Whether a timed skill counts for a beat that starts at this active time. */
  private static boolean running(CompanyState.Idle s, String code, double start) {
    Double until = s.activeUntil.get(code);
    return until != null && start < until + BOOST_GRACE;
  }

  /** Seconds of effect left, in game seconds: the rally and the ad skills. Zero for the others. */
  private static double effectLeft(CompanyState.Idle s, String code) {
    double until = "rally".equals(code) ? s.rallyUntil : s.activeUntil.getOrDefault(code, 0.0);
    return Math.max(0, until - s.activeSeconds);
  }

  /** How many fielded cats cast each skill (501). A resting cat's skill does nothing. */
  private static int[] casters(CompanyState.Idle s) {
    int[] casters = new int[CODES.length];
    for (String code : s.fielded) {
      int cat = CATS.indexOf(code);
      if (cat < 0) continue;
      for (int skill : CAT_SKILLS[cat]) casters[skill]++;
    }
    return casters;
  }

  private void tick(CompanyState c, double seconds, List<IdleHit> hits) {
    CompanyState.Idle s = state(c);
    double stopped = Math.min(seconds, s.circuitSeconds);
    s.circuitSeconds -= stopped;
    double active = seconds - stopped;
    // 불장 (503): bullets come twice as often while it burns. A beat that starts inside it counts.
    // 광고 스킬 (588): 공격속도 3배 is not stacked on the rally; the larger of the two counts.
    double rally =
        Math.max(
            s.activeSeconds < s.rallyUntil ? RALLY_FIRE : 1,
            boost(s, "boostFire", s.activeSeconds));
    double damageBoost = boost(s, "boostDamage", s.activeSeconds);
    double buyBoost = boost(s, "boostBuy", s.activeSeconds);
    // 물타기 (591): the screen knows how much of the buy wall is gone; here its most counts.
    double averaging = running(s, "averaging", s.activeSeconds) ? AVERAGING_MAX : 1;
    s.activeSeconds += active;
    // 물가 (505번): 시간 수입과 벽 보상은 그 벽의 물가만큼 크다.
    // 직원의 초당 수입과 멘탈 보호 보너스도 같은 틱에 들어온다 (523번).
    // The income keeps its old pace per real second, whatever the fight's speed (580).
    double income = s.incomeRemainder + active * (INCOME_SPEED / SPEED) * incomeRate(c);
    double earned = Math.floor(income);
    s.incomeRemainder = income - earned;
    if (s.hitCredits == null || s.hitCredits.length != KINDS) s.hitCredits = new double[KINDS];
    // Match the damage shown at collision, bounded by owned attacks and server stats.
    // A contact is not a second of DPS: fire upgrades must never multiply a single hit.
    List<Shooter> shooters = shooters(c);
    Shooter hero = shooters.getFirst();
    double bulletMax = 0;
    double bulletsPerSecond = 0;
    for (Shooter shooter : shooters) {
      bulletMax =
          Math.max(
              bulletMax,
              damageBoost
                  * BULLET_WEIGHT
                  * shooter.damage()
                  * shooter.power()
                  * shooter.critical());
      bulletsPerSecond += rally * shooter.perSecond() / BULLET_WEIGHT;
    }
    long front = s.wall;
    int[] casters = casters(s);
    double dealt = 0;
    double[] queued = new double[2 + FAR];
    queued[0] = s.nextDamage;
    queued[1] = s.afterNextDamage;
    for (int i = 0; i < FAR && s.farDamage != null && i < s.farDamage.length; i++) {
      queued[2 + i] = s.farDamage[i];
    }
    for (int kind = 0; kind <= SKILLS && active > 0; kind++) {
      if (kind > 0 && casters[kind - 1] == 0) continue;
      // A skill is cast by each fielded cat that has it, at that cat's level (515): the hit budget
      // adds up over them and one hit may be as strong as the highest level's.
      double perHit = kind == 0 ? BULLET_WEIGHT * hero.power() : 0;
      double perSecond = kind == 0 ? bulletsPerSecond : 0;
      double gained = kind == 0 ? active / (1 / bulletsPerSecond) : 0;
      for (String cat : kind == 0 ? List.<String>of() : s.fielded) {
        int at = CATS.indexOf(cat);
        if (at < 0 || !casts(at, kind - 1)) continue;
        int level = skillLevel(s.cats.getOrDefault(cat, 1)) - 1;
        perHit = Math.max(perHit, SKILL_DAMAGE[kind - 1][level]);
        perSecond += SKILL_HITS[kind - 1][level] / COOLDOWNS[kind - 1][level];
        gained += active * SKILL_HITS[kind - 1][level] / COOLDOWNS[kind - 1][level];
      }
      double damage = damageBoost * hero.damage() * perHit;
      double maxDamage = kind == 0 ? bulletMax : damage;
      s.hitCredits[kind] =
          Math.min(Math.max(2, SPEED * GRACE_MS / 1000 * perSecond), s.hitCredits[kind] + gained);
      String code = kind == 0 ? "bullet" : CODES[kind - 1];
      // The screen breaks walls before the server hears of it (532): a direct hit (depth 0) is
      // damage to whatever wall is in front here, and a pierced hit lands on the wall it names.
      int[] counts = new int[3];
      double direct = 0;
      double[][] pierced = new double[3][queued.length];
      for (IdleHit hit : hits) {
        if (hit == null || !code.equals(hit.kind()) || hit.count() <= 0) continue;
        long offset = hit.wall() - front;
        int depth;
        if (hit.depth() == null) {
          if (offset < 0 || offset > 2) continue;
          depth = (int) offset;
        } else {
          depth = hit.depth();
          if (depth < 0 || depth > 2) continue;
          if (depth == 0 ? Math.abs(offset) > AHEAD : offset < 1 || offset > queued.length)
            continue;
        }
        // Only a bullet's pierce reaches the queued walls (520): explosions and skills stop at the
        // front wall.
        if (depth > 0 && kind != 0) continue;
        // A 대량 매도벽 (the boss, every 50th wall) cannot be pierced: not when it is the screen's front
        // wall,
        // and a pierced bullet neither hits it nor goes past it. Matches the app's idlePierceReach.
        if (depth > 0 && pierceBlocked(hit.wall(), depth)) continue;
        double reported =
            hit.damage() == null ? damage * PIERCE[depth] * hit.count() : hit.damage();
        if (!Double.isFinite(reported) || reported <= 0) continue;
        int count = Math.min(hit.count(), 1000 - counts[depth]);
        counts[depth] += count;
        double amount = Math.min(reported / hit.count(), maxDamage * PIERCE[depth]) * count;
        if (depth == 0) direct += amount;
        else pierced[depth][(int) offset - 1] += amount;
      }
      int most = Math.max(counts[0], Math.max(counts[1], counts[2]));
      double accepted = Math.min(most, s.hitCredits[kind]);
      s.hitCredits[kind] -= accepted;
      if (counts[0] > 0) {
        double amount = direct * Math.min(counts[0], accepted) / counts[0];
        s.damage += amount;
        dealt += amount;
      }
      // A queued wall never breaks before the one in front of it (520): it keeps its last point of
      // health until it is the front wall.
      for (int depth = 1; depth < 3; depth++) {
        if (counts[depth] == 0) continue;
        double share = Math.min(counts[depth], accepted) / counts[depth];
        for (int i = 0; i < queued.length; i++) {
          double before = queued[i];
          queued[i] = Math.min(maxHp(front + 1 + i) - 1, before + pierced[depth][i] * share);
          dealt += Math.max(0, queued[i] - before);
        }
      }
    }
    // 매수세례 (503): its buy orders that reach the front wall. Credits come from the press, not time.
    double barrageMax = averaging * buyBoost * buyOrder(c) * BARRAGE_POWER;
    for (IdleHit hit : hits) {
      if (active <= 0 || hit == null || !"barrage".equals(hit.kind()) || hit.count() <= 0) continue;
      if (Math.abs(hit.wall() - front) > AHEAD) continue;
      double reported = hit.damage() == null ? barrageMax * hit.count() : hit.damage();
      if (!Double.isFinite(reported) || reported <= 0) continue;
      double accepted = Math.min(hit.count(), s.hitCredits[BARRAGE]);
      s.hitCredits[BARRAGE] -= accepted;
      double amount = Math.min(reported / hit.count(), barrageMax) * accepted;
      s.damage += amount;
      dealt += amount;
    }
    // 손절 (591): the one big hit the press paid for. It is a buy-side hit, so 매수공격 3배 counts;
    // 물타기 does not.
    double stopLossMax = buyBoost * buyOrder(c) * STOP_LOSS_ORDERS;
    for (IdleHit hit : hits) {
      if (active <= 0 || hit == null || !"stoploss".equals(hit.kind()) || hit.count() <= 0)
        continue;
      if (Math.abs(hit.wall() - front) > AHEAD || s.hitCredits[STOP_LOSS] < 1) continue;
      double reported = hit.damage() == null ? stopLossMax : hit.damage();
      if (!Double.isFinite(reported) || reported <= 0) continue;
      s.hitCredits[STOP_LOSS] = 0;
      double amount = Math.min(reported, stopLossMax);
      s.damage += amount;
      dealt += amount;
    }
    // The buy wall's own buy orders that got past the sell orders to the front wall (514). They
    // have their own budget and their own damage: they no longer spend the bullets' budget.
    if (active > 0) {
      s.hitCredits[BUY] =
          Math.min(
              SPEED * GRACE_MS / 1000 * BUY_ORDERS_PER_SECOND,
              s.hitCredits[BUY] + active * BUY_ORDERS_PER_SECOND);
      double buyMax = averaging * buyBoost * buyOrder(c);
      for (IdleHit hit : hits) {
        if (hit == null || !"buy".equals(hit.kind()) || hit.count() <= 0) continue;
        if (Math.abs(hit.wall() - front) > AHEAD) continue;
        double reported = hit.damage() == null ? buyMax * hit.count() : hit.damage();
        if (!Double.isFinite(reported) || reported <= 0) continue;
        double accepted = Math.min(hit.count(), s.hitCredits[BUY]);
        s.hitCredits[BUY] -= accepted;
        double amount = Math.min(reported / hit.count(), buyMax) * accepted;
        s.damage += amount;
        dealt += amount;
      }
    }
    // What the walls really took lately, per active second: the stat shown next to the estimate.
    if (active > 0) s.wallDps += (dealt / active - s.wallDps) * Math.min(1, active / 10);
    // Walls break in order, and what is left of the breaking damage goes on to the next wall
    // (532): the screen broke it at that hit and kept shooting.
    while (s.circuitSeconds == 0 && s.damage + 1e-7 >= maxHp(s.wall)) {
      earned += reward(c);
      // 시즌패스 미션 (570번): 통과한 벽을 센다. 최고 기록을 넘긴 벽만 센다 (596번): 환생한 뒤 전에 깬 벽을 다시 부수는 것은 세지 않는다.
      s.best = Math.max(s.best, Math.max(s.wall - 1, s.bossCleared));
      if (s.wall > s.best) {
        s.best = s.wall;
        engine.pass.progress(c, "wall", 1, todayDate());
      }
      double left = Math.max(0, s.damage - maxHp(s.wall));
      // 보스 클리어 보상 (549번): 벽 보상과 따로, 그 보스를 처음 깼을 때 한 번.
      if (bossWall(s.wall) && s.wall > s.bossCleared) {
        double money = Math.floor(reward(c) * BOSS_CLEAR_REWARDS);
        s.bossCleared = s.wall;
        s.bossRewardMoney = money;
        engine.pass.progress(c, "boss", 1, todayDate());
        earned += money;
        c.diamonds += BOSS_CLEAR_DIAMONDS;
      }
      s.cleared++;
      s.wall++;
      s.damage = queued[0] + left;
      System.arraycopy(queued, 1, queued, 0, queued.length - 1);
      queued[queued.length - 1] = 0;
      // 보스 도전은 서킷브레이커로 시작한다 (547번): 넘친 피해는 그 벽에 얹혀 기다리고, 거래가 풀려야 들어간다.
      if (CIRCUIT_ENABLED && bossWall(s.wall)) {
        s.circuitSeconds = CIRCUIT_SECONDS;
        s.hitCredits = new double[KINDS];
      }
    }
    s.nextDamage = queued[0];
    s.afterNextDamage = queued[1];
    s.farDamage = java.util.Arrays.copyOfRange(queued, 2, queued.length);
    s.earned += earned;
    c.capital += earned;
  }

  /** Cat gacha (decisions.md 488, 493): one ticket for one cat. A duplicate levels it up. */
  void drawCat(CompanyState c, SeededRandom random) {
    drawCats(c, random, 1);
  }

  /** Ten-pull (517): count tickets for count cats, all or nothing. */
  void drawCats(CompanyState c, SeededRandom random, int count) {
    CompanyState.Idle s = state(c);
    if (count < 1) {
      throw new InvalidRequestException("뽑을 수가 1보다 작다");
    }
    // Diamonds (526): 100 for one, 1,000 for the ten-pull that gives eleven.
    CompanyEngine.spend(c, engine.diamonds().cost(count));
    List<CompanyState.Pulled> drawn = new ArrayList<>();
    List<String> fresh = new ArrayList<>();
    for (int i = 0; i < engine.diamonds().items(count); i++) {
      CompanyState.Pulled pulled = pull(c, random);
      drawn.add(pulled);
      if (pulled.isNew) fresh.add(pulled.kind);
    }
    // 빈 출전 칸은 이번에 처음 얻은 고양이 가운데 등급이 높은 순으로 채운다 (#909): 뽑힌 차례대로 채우면 10연차의 S등급이 대기석에 남는다.
    // 같은 등급은 뽑힌 차례를 지킨다. 이미 출전해 있던 고양이는 밀어내지 않는다.
    fresh.sort(java.util.Comparator.comparing(IdleEngine::gradeIndex).reversed());
    for (String code : fresh) {
      if (s.fielded.size() < FIELD_SLOTS) s.fielded.add(code);
    }
    s.lastDraws = drawn;
  }

  /**
   * One random cat at no cost, fielded at once while a slot is free: the season pass's last step
   * (529).
   */
  CompanyState.Pulled grantCat(CompanyState c, SeededRandom random) {
    CompanyState.Idle s = state(c);
    CompanyState.Pulled pulled = pull(c, random);
    if (pulled.isNew && s.fielded.size() < FIELD_SLOTS) {
      s.fielded.add(pulled.kind);
    }
    return pulled;
  }

  /** One random cat joins or levels up. Fielding it is the caller's. */
  private CompanyState.Pulled pull(CompanyState c, SeededRandom random) {
    CompanyState.Idle s = state(c);
    s.catDraws++;
    int roll =
        random.forKey("cat-draw", s.catDraws).nextInt(java.util.Arrays.stream(CAT_WEIGHTS).sum());
    int cat = 0;
    while (roll >= CAT_WEIGHTS[cat]) roll -= CAT_WEIGHTS[cat++];
    String code = CATS.get(cat);
    int level = s.cats.merge(code, 1, Integer::sum);
    return new CompanyState.Pulled(code, null, level, level == 1);
  }

  String catName(String code) {
    int at = CATS.indexOf(code);
    return at < 0 ? code : CAT_NAMES[at];
  }

  /** 테스트판 (decisions.md 499번): 고른 벽 앞에 바로 선다. 그 벽은 새 벽이고 거래 정지와 쌓인 피해는 지운다. */
  void jump(CompanyState c, long wall) {
    move(state(c), Math.max(1, Math.min(MAX_JUMP_WALL, wall)));
  }

  /** Stand in front of another wall without breaking the one in front: a fresh wall, no halt. */
  private static void move(CompanyState.Idle s, long wall) {
    s.wall = wall;
    s.damage = 0;
    s.nextDamage = 0;
    s.afterNextDamage = 0;
    s.farDamage = null;
    s.circuitSeconds = 0;
    s.hitCredits = new double[KINDS];
    s.epoch++;
  }

  static final long MAX_JUMP_WALL = 100_000;

  /** 테스트판 (499번): 동료 고양이 39종을 모두 그 레벨로 주고, 빈 출전 칸을 차례대로 채운다. */
  void grantCats(CompanyState c, int level) {
    CompanyState.Idle s = state(c);
    for (String code : CATS) {
      s.cats.put(code, Math.max(1, Math.min(MAX_CAT_LEVEL, level)));
      if (s.fielded.size() < FIELD_SLOTS && !s.fielded.contains(code)) s.fielded.add(code);
    }
    s.hitCredits = new double[KINDS];
  }

  static final int MAX_CAT_LEVEL = 1000;

  // 환생 (decisions.md 571번): 첫 보스(50번째 벽)를 깬 뒤부터 할 수 있고, 지금 선 벽이 깊을수록 생선을 많이 준다.
  static final long REBIRTH_WALL = 51;

  /** 환생하면 깬 벽 이만큼마다 생선 한 마리다 (600번): 진행한 만큼 비례해서 준다. */
  static final long REBIRTH_WALLS_PER_FISH = 10;

  /** 환생할 때 광고를 보면 생선을 이 배수로 받는다 (586번). 볼 수 있는 횟수에는 한도가 없다. */
  static final long REBIRTH_AD_MULTIPLIER = 3;

  /**
   * 지금 환생하면 받는 생선 (571·600번): 깬 벽 수 ÷ 10. 51번째 벽에서 5, 101번째 10, 301번째 30. 아직 못 하면 0. 첫 보스를 깨야 하는 것은
   * 첫 환생뿐이다 (603번): 한 번 환생한 뒤에는 어느 벽에서든 깬 벽만큼 받는다.
   */
  long rebirthFish(CompanyState c) {
    long cleared = state(c).wall - 1;
    return state(c).wall < rebirthWall(c) ? 0 : cleared / REBIRTH_WALLS_PER_FISH;
  }

  /** 이 벽에 서야 환생할 수 있다: 첫 환생은 첫 보스를 깬 다음 벽, 그 뒤로는 생선 한 마리가 나오는 벽 (603번). */
  long rebirthWall(CompanyState c) {
    return c.rebirths > 0 ? REBIRTH_WALLS_PER_FISH + 1 : REBIRTH_WALL;
  }

  void rebirth(CompanyState c) {
    rebirth(c, false);
  }

  /**
   * 광고를 보고 환생하면(ad) 생선을 REBIRTH_AD_MULTIPLIER배로 받는다 (586번). 아직 광고를 붙이지 않아 화면이 보낸 값을 그대로 믿는다: 광고를 붙일
   * 때(#888) 광고 서버의 확인으로 바꾼다.
   */
  void rebirth(CompanyState c, boolean ad) {
    CompanyState.Idle s = state(c);
    long fish = rebirthFish(c) * (ad ? REBIRTH_AD_MULTIPLIER : 1);
    if (fish <= 0) {
      throw new InvalidRequestException(
          c.rebirths > 0
              ? "환생은 매도벽 " + rebirthWall(c) + "부터 할 수 있어요"
              : "환생은 " + (REBIRTH_WALL - 1) + "번째 벽의 보스를 깬 뒤에 할 수 있어요");
    }
    c.fish += fish;
    c.rebirths++;
    c.capital = engine.openingCapital();
    c.battleLevels.clear();
    move(s, 1);
    s.earned = 0;
    s.wallDps = 0;
  }

  /**
   * 생선으로 영구 강화를 한 단계 올린다 (600번): 환생해도 남는다. 값은 다음 단계의 번호(1, 2, 3 …)만큼의 생선이다. 없는 강화이거나 생선이 모자라면 400.
   */
  void buyFishUpgrade(CompanyState c, String kind) {
    state(c);
    if (!MentalEngine.FISH_UPGRADES.contains(kind)) {
      throw new InvalidRequestException("없는 영구 강화다: " + kind);
    }
    int level = c.fishLevels.getOrDefault(kind, 0);
    long cost = MentalEngine.fishUpgradeCost(level);
    if (c.fish < cost) throw new InvalidRequestException("생선이 모자라요");
    c.fish -= cost;
    c.fishLevels.put(kind, level + 1);
  }

  void fieldCat(CompanyState c, String code, boolean fielded) {
    fieldCat(c, code, fielded, null, null);
  }

  void fieldCat(CompanyState c, String code, boolean fielded, String replaceCode) {
    fieldCat(c, code, fielded, replaceCode, null);
  }

  /**
   * 출전 칸을 맞춘다 (599번): 출전한 고양이마다 칸 하나, 칸 번호순으로 줄을 선다. 칸이 없는 고양이(없던 저장, 뽑아서 저절로 출전)는 빈 칸 가운데 가장 앞에
   * 선다.
   */
  private static void seat(CompanyState.Idle s) {
    if (s.seats == null) s.seats = new LinkedHashMap<>();
    s.seats.keySet().retainAll(s.fielded);
    java.util.Set<Integer> taken = new java.util.HashSet<>();
    for (String code : s.fielded) {
      Integer at = s.seats.get(code);
      if (at == null || at < 0 || at >= FIELD_SLOTS || !taken.add(at)) s.seats.remove(code);
    }
    for (String code : s.fielded) {
      if (s.seats.containsKey(code)) continue;
      int free = 0;
      while (taken.contains(free)) free++;
      taken.add(free);
      s.seats.put(code, free);
    }
    s.fielded.sort(java.util.Comparator.comparing(s.seats::get));
  }

  /** Validate the whole swap before changing the team; a stale target must not remove anyone. */
  /**
   * slot(0부터)을 주면 그 출전 칸에 세운다 (599번): 빈 칸이면 거기에, 다른 고양이가 있으면 쉬던 고양이는 그 고양이와 교체하고 출전 중인 고양이는 자리를
   * 맞바꾼다. slot이 없으면 빈 칸 가운데 가장 앞에 선다.
   */
  void fieldCat(CompanyState c, String code, boolean fielded, String replaceCode, Integer slot) {
    CompanyState.Idle s = state(c);
    if (!s.cats.containsKey(code)) throw new InvalidRequestException("가지지 않은 고양이다: " + code);
    if (slot != null && replaceCode == null && fielded) {
      if (slot < 0 || slot >= FIELD_SLOTS) throw new InvalidRequestException("없는 출전 칸이다: " + slot);
      String there =
          s.fielded.stream().filter(k -> s.seats.get(k).equals(slot)).findFirst().orElse(null);
      if (code.equals(there)) return;
      if (s.fielded.contains(code)) {
        // 출전 중인 고양이를 옮긴다: 그 칸에 있던 고양이는 비운 자리로 간다.
        if (there != null) s.seats.put(there, s.seats.get(code));
        s.seats.put(code, slot);
      } else {
        if (there != null) {
          s.fielded.remove(there);
          s.seats.remove(there);
          // 출전에서 빠진 고양이는 들던 무기를 내려놓는다 (598번).
          s.catWeapons.remove(there);
        }
        s.fielded.add(code);
        s.seats.put(code, slot);
      }
      seat(s);
      s.hitCredits = new double[KINDS];
      return;
    }
    if (replaceCode != null) {
      if (!fielded
          || code.equals(replaceCode)
          || s.fielded.contains(code)
          || !s.fielded.contains(replaceCode)) {
        throw new InvalidRequestException("출전 구성이 바뀌었어요. 다시 골라 주세요");
      }
      s.fielded.set(s.fielded.indexOf(replaceCode), code);
      // 교체한 고양이는 그 칸을 물려받는다 (599번).
      s.seats.put(code, s.seats.remove(replaceCode));
      // 출전에서 빠진 고양이는 들던 무기를 내려놓는다 (598번).
      s.catWeapons.remove(replaceCode);
    } else if (fielded) {
      if (s.fielded.contains(code)) return;
      if (s.fielded.size() >= FIELD_SLOTS) {
        throw new InvalidRequestException("출전 칸이 꽉 찼다: " + FIELD_SLOTS + "마리까지 출전한다");
      }
      s.fielded.add(code);
    } else if (s.fielded.remove(code)) {
      // 출전에서 빠진 고양이는 들던 무기를 내려놓는다 (598번): 그 무기는 다른 고양이가 바로 들 수 있다.
      s.catWeapons.remove(code);
    }
    seat(s);
    s.hitCredits = new double[KINDS];
  }

  /**
   * A cat takes one free copy of an owned weapon; null kind and grade take it off. A copy in the
   * boss cat's or another cat's paws cannot be taken (decisions.md 530).
   */
  void equipCat(CompanyState c, String code, String kind, String grade) {
    CompanyState.Idle s = state(c);
    if (!s.cats.containsKey(code)) throw new InvalidRequestException("가지지 않은 고양이다: " + code);
    if (kind == null && grade == null) {
      s.catWeapons.remove(code);
      return;
    }
    if (free(c, kind, grade, code) < 1) {
      throw new InvalidRequestException("장착 중인 무기다. 같은 무기가 하나 더 있어야 한다");
    }
    s.catWeapons.put(code, new CompanyState.Weapon(kind, grade));
  }

  /** The boss cat may only pick up a copy no cat is holding (decisions.md 530). */
  void requireFreeForBoss(CompanyState c, String kind, String grade) {
    if (c.weapon != null && c.weapon.same(kind, grade)) return;
    if (owned(c, kind, grade) > 0 && free(c, kind, grade, null) < 1) {
      throw new InvalidRequestException("장착 중인 무기다. 같은 무기가 하나 더 있어야 한다");
    }
  }

  /** Merging only spends copies nobody holds (decisions.md 530). */
  void requireFreeForMerge(CompanyState c, String kind, String grade, int need) {
    int owned = owned(c, kind, grade);
    if (owned >= need && free(c, kind, grade, null) < need) {
      throw new InvalidRequestException("장착 중인 무기는 합칠 수 없다. 장착하지 않은 무기가 " + need + "개 있어야 한다");
    }
  }

  private static int owned(CompanyState c, String kind, String grade) {
    if (c.weapons == null) return 0;
    return c.weapons.stream().filter(w -> w.same(kind, grade)).mapToInt(w -> w.count).sum();
  }

  /** Copies of a weapon nobody holds; the cat `except` does not count as a holder. */
  private int free(CompanyState c, String kind, String grade, String except) {
    int owned = owned(c, kind, grade);
    if (owned == 0) throw new InvalidRequestException("가지지 않은 무기다: " + kind + " " + grade);
    CompanyState.Idle s = state(c);
    long held =
        s.catWeapons.entrySet().stream()
            .filter(e -> !e.getKey().equals(except) && e.getValue().same(kind, grade))
            .count();
    if (c.weapon != null && c.weapon.same(kind, grade)) held++;
    return owned - (int) held;
  }

  /**
   * After the boss cat equips or weapons are merged: cats give back copies that no longer exist.
   * The cat that equipped last keeps its copy.
   */
  void releaseWeapons(CompanyState c) {
    CompanyState.Idle s = state(c);
    List<String> holders = new ArrayList<>(s.catWeapons.keySet());
    java.util.Collections.reverse(holders);
    List<CompanyState.Weapon> held = new ArrayList<>();
    if (c.weapon != null) held.add(c.weapon);
    for (String code : holders) {
      CompanyState.Weapon weapon = s.catWeapons.get(code);
      int count =
          c.weapons == null
              ? 0
              : c.weapons.stream()
                  .filter(w -> w.same(weapon.kind, weapon.grade))
                  .mapToInt(w -> w.count)
                  .sum();
      if (held.stream().filter(w -> w.same(weapon.kind, weapon.grade)).count() >= count) {
        s.catWeapons.remove(code);
      } else {
        held.add(weapon);
      }
    }
  }

  CompanyView.Idle view(CompanyState c) {
    CompanyState.Idle s = state(c);
    int[] casters = casters(s);
    List<CompanyView.IdleSkill> skills =
        java.util.stream.IntStream.range(0, CODES.length)
            .mapToObj(
                i -> {
                  int skill = i;
                  int level =
                      s.fielded.stream()
                          .filter(k -> CATS.contains(k) && casts(CATS.indexOf(k), skill))
                          .mapToInt(k -> skillLevel(s.cats.getOrDefault(k, 1)))
                          .max()
                          .orElse(0);
                  return new CompanyView.IdleSkill(CODES[i], NAMES[i], casters[i] > 0, level);
                })
            .toList();
    List<CompanyView.IdleCat> cats =
        CATS.stream()
            .map(
                code -> {
                  int level = s.cats.getOrDefault(code, 0);
                  int cat = CATS.indexOf(code);
                  CompanyState.Weapon weapon = s.catWeapons.get(code);
                  return new CompanyView.IdleCat(
                      code,
                      CAT_NAMES[cat],
                      level,
                      (int)
                          Math.round(
                              100
                                  * power(Math.max(1, level))
                                  * CAT_DAMAGE[cat]
                                  * GRADE_DAMAGE[CAT_GRADE[cat]]),
                      (int) Math.round(100 * CAT_FIRE[cat]),
                      (int) Math.round(100 * CAT_CRITICAL[cat]),
                      s.fielded.contains(code),
                      s.seats.get(code),
                      weapon == null ? null : new CompanyView.CatWeapon(weapon.kind, weapon.grade),
                      java.util.Arrays.stream(CAT_SKILLS[cat])
                          .mapToObj(skill -> new CompanyView.CatSkill(CODES[skill], NAMES[skill]))
                          .toList(),
                      skillLevel(Math.max(1, level)),
                      nextSkillAt(Math.max(1, level)),
                      CAT_GRADES.get(CAT_GRADE[cat]));
                })
            .toList();
    return new CompanyView.Idle(
        s.wall,
        Math.max(0, maxHp(s.wall) - s.damage),
        maxHp(s.wall),
        dps(c),
        CompanyView.money(s.earned),
        bossWall(s.wall),
        skills,
        cats,
        FIELD_SLOTS,
        SPEED * s.wallDps,
        s.circuitSeconds,
        List.of(
            new CompanyView.IdleWall(
                s.wall + 1, Math.max(0, maxHp(s.wall + 1) - s.nextDamage), maxHp(s.wall + 1)),
            new CompanyView.IdleWall(
                s.wall + 2, Math.max(0, maxHp(s.wall + 2) - s.afterNextDamage), maxHp(s.wall + 2))),
        s.sequence,
        s.cleared,
        s.epoch,
        bossWall(s.wall),
        s.bossCleared <= 0
            ? null
            : new CompanyView.BossReward(
                s.bossCleared, BOSS_CLEAR_DIAMONDS, CompanyView.money(s.bossRewardMoney)),
        java.util.stream.IntStream.range(0, ACTIVES.size())
            .mapToObj(
                i ->
                    new CompanyView.IdleActive(
                        ACTIVES.get(i),
                        ACTIVE_NAMES[i],
                        ACTIVE_COOLDOWN[i] / SPEED,
                        ACTIVE_SECONDS[i] / SPEED,
                        Math.max(
                                0,
                                s.activeReady.getOrDefault(ACTIVES.get(i), 0.0) - s.activeSeconds)
                            / SPEED,
                        effectLeft(s, ACTIVES.get(i)) / SPEED,
                        i < UNIQUE && equipped(s).contains(ACTIVES.get(i)),
                        i >= UNIQUE))
            .toList(),
        ACTIVE_SLOTS,
        (s.lastDraws == null ? List.<CompanyState.Pulled>of() : s.lastDraws)
            .stream()
                .filter(d -> CATS.contains(d.kind))
                .map(d -> new CompanyView.CatDraw(d.kind, d.level, d.isNew, catGrade(d.kind)))
                .toList(),
        new CompanyView.Income(
            CompanyView.money(INCOME_SPEED * incomeRate(c)),
            CompanyView.money(
                INCOME_SPEED
                    * engine.staffIncome(c)
                    * CompanyEngine.inflation(c)
                    * (1 + engine.mental.bonusPercent(c) / 100.0)),
            engine.mental.bonusPercent(c)),
        s.offlineAt <= 0
            ? null
            : new CompanyView.Offline(
                s.offlineAt,
                Math.round(s.offlineSeconds),
                CompanyView.money(s.offlineEarned),
                s.offlineCapped),
        power(c),
        new CompanyView.Rebirth(
            c.rebirths,
            c.fish,
            rebirthFish(c),
            rebirthWall(c),
            rebirthFish(c) * REBIRTH_AD_MULTIPLIER,
            engine.mental.fishUpgradeViews(c)),
        new CompanyView.Onboarding(
            c.tutorialStep == null ? 8 : c.tutorialStep,
            c.tutorialCatClaimed,
            c.tutorialWeaponClaimed,
            skillsUnlocked(c),
            c.skillGuideSeen));
  }
}
