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

  /**
   * 보스를 처음 깨면 따로 주는 보상 (549번): 다이아, 그리고 그 벽 보상(대량 매도벽의 3배가 든 값)의 이 배수만큼의 돈. 같은 보스는 한 번만 준다. 다이아는
   * 100에서 10으로 줄였다 (644번): 한 달에 백 개 넘는 보스를 깨 다이아의 절반 넘게가 여기서 나왔다. 다이아를 모두 네 배로 올리며 40이 되었다 (659번).
   */
  static final long BOSS_CLEAR_DIAMONDS = 40;

  static final double BOSS_CLEAR_REWARDS = 5;

  /** 보스 도전의 벽 (547번). */
  static boolean bossWall(long wall) {
    return wall % BOSS_EVERY == 0;
  }

  // Credit buckets: the bullet, the cat skills, the buy barrage (decisions.md 503), and the
  // buy wall's own buy orders (514).
  private static final int SKILLS = 23;
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

  /** 손절 (591번): 매수벽을 가득 찬 채로 절반 버렸을 때의 한 방이 매수 주문 이만큼이다. Matches the app's mental/actives.ts. */
  static final double STOP_LOSS_ORDERS = 240;

  /** 물타기 (591번): 매수 주문이 가장 세질 때의 배수. Matches the app's mental/actives.ts. */
  static final double AVERAGING_MAX = 3;

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
  // 2 a wall and no square term since 646 (5 and 0.035 before, 637).
  private static final double HP_LINEAR = 2;

  /**
   * 벽 체력의 4차 항 (644·646·653번): 벽 체력 = (10 + 2d + 이 값 × d⁴) × (1 + 4d ÷ (d + 625)). 5,001번째 벽(d =
   * 5,000)이 화면에 1,000만주(체력 333,333 × 30주)다. 646번에는 66,666 × 150주였다. 화면 idlePredict.ts의 idleMaxHp와
   * 같이 바꾼다.
   */
  private static final double HP_QUARTIC = 1.010571e-10;

  /**
   * 강화의 몫 (653번): 공격력 강화가 한 단계 1%로(값 오름폭 5% 그대로) 646·648번의 다섯 배가 되어, 벽 체력에 (1 + 4d ÷ (d + 625))를
   * 곱한다. 벽 번호의 0.8배쯤 단계를 사므로 강화의 화력은 (1 + 0.008d)이고 전에는 (1 + 0.0016d)였다: 그 비가 이 값이다(첫 벽 1, 깊을수록 5에
   * 가까워진다).
   */
  private static final double HP_UPGRADE_DEPTH = 625;

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
  // 식빵 공방 (644번에 줄임): 쉬는 고양이 하나가 5분에 식빵 하나(전에는 1분), 팔 때 굽던 30분마다 다이아 넷(659번에 하나에서 네 배로.
  // 644번 전에는 10분에 하나).
  private static final long DIAMOND_MILLIS = 1_800_000;
  private static final long BAKERY_DIAMONDS = 4;
  private static final long LOAF_MILLIS = 300_000;
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
  // (hail, blossom) lands as many times as it drops.
  private static final String[] CODES = {
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
    "petalArrow"
  };
  private static final String[] NAMES = {
    "물 스킬", "메테오 스킬", "번개 스킬", "충차 스킬", "얼음 스킬", "바람 스킬", "불 스킬", "독 스킬", "별빛화살", "어둠 스킬", "모래 스킬",
    "별 스킬", "우박 스킬", "꽃비 스킬", "빛화살", "극광의 밤", "맹독화살", "서리화살", "홍염화살", "심해화살", "모래화살", "그림자화살",
    "꽃잎화살"
  };
  // One real second at the server battle clock rate, for every arrow level.
  private static final double[] ARROW_COOLDOWN = ramp(SPEED, SPEED);
  private static final double[][] COOLDOWNS = {
    {2.4, 2.1, 1.8, 1.6, 1.4},
    {3.6, 3.3, 3, 2.8, 2.6},
    {2.6, 2.3, 2, 1.8, 1.6},
    {3.6, 3.2, 3, 2.8, 2.6},
    {3.2, 2.9, 2.6, 2.4, 2.2},
    {2.8, 2.5, 2.2, 2, 1.8},
    ramp(3, 2.2),
    ramp(2.2, 1.4),
    ARROW_COOLDOWN,
    ramp(3, 2.2),
    ramp(2.6, 1.8),
    ramp(2, 1.3),
    ramp(3.4, 2.6),
    ramp(3, 2.2),
    ARROW_COOLDOWN,
    ramp(6 / 1.5, 4 / 1.5),
    ARROW_COOLDOWN,
    ARROW_COOLDOWN,
    ARROW_COOLDOWN,
    ARROW_COOLDOWN,
    ARROW_COOLDOWN,
    ARROW_COOLDOWN,
    ARROW_COOLDOWN
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
    ramp(9, 20),
    ramp(12, 28),
    ramp(2.2, 5),
    ramp(3.2, 7.6),
    ramp(4.8, 17.68),
    ramp(3.2, 7.6),
    ramp(1.8, 4.1),
    ramp(2.5, 6),
    ramp(1.2, 2.8)
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
    ONE_HIT,
    ONE_HIT,
    ONE_HIT,
    ONE_HIT,
    ONE_HIT,
    ONE_HIT,
    ONE_HIT,
    ONE_HIT,
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
          "oat",
          "ruby",
          "abyss",
          "dune",
          "veil",
          "flora",
          "aurora");
  private static final String[] CAT_NAMES = {
    "하늘냥", "민트냥", "라일락냥", "노을냥", "밤냥", "눈꽃냥", "카라멜냥", "모카냥", "복숭아냥", "은빛냥", "판다냥", "비스킷냥", "바다냥",
    "레몬냥", "코코아냥", "로즈냥", "호랑냥", "구름냥", "별빛냥", "샴냥", "짝귀냥", "단풍냥", "세이지냥", "살구냥", "자두냥", "조각냥",
    "졸린냥", "산호냥", "트러플냥", "서리냥", "버터냥", "테라냥", "등꽃냥", "오드냥", "피스타냥", "모래냥", "볼터치냥", "청록냥", "오트냥",
    "홍염냥", "심해냥", "사막별냥", "그림자냥", "봄꽃냥", "극광냥"
  };
  // 고양이 등급 (decisions.md 539번): 종마다 정해져 있다. C 16 · B 12 · A 7 · S 4종이고 S는 스킬마다 하나다.
  static final List<String> CAT_GRADES = List.of("C", "B", "A", "S", "SS");
  private static final java.util.Set<String> GRADE_S =
      java.util.Set.of(
          "star", "silver", "wisteria", "frost", "ruby", "abyss", "dune", "veil", "flora");
  private static final java.util.Set<String> GRADE_A =
      java.util.Set.of("tiger", "panda", "night", "snow", "rose", "ocean", "siam");
  private static final java.util.Set<String> GRADE_B =
      java.util.Set.of(
          "caramel", "mocha", "peach", "biscuit", "lemon", "cocoa", "cloud", "tilt", "russet",
          "plum", "coral", "truffle");
  // A grade's share of the draws (percent) and its cats' gun damage (x the level's power). The
  // damage was {1, 1.4, 2, 3} before 644, {1, 1.15, 1.35, 1.6} in 644, {1, 1.05, 1.1, 1.2, 1.4}
  // in 646 and returned to the 644 ladder in 656. SS now has twice the S grade multiplier.
  // S was 2% before 651 (its lost share went to C, 59.8%).
  private static final int[] GRADE_PER_THOUSAND = {608, 280, 100, 10, 2};
  private static final double[] GRADE_DAMAGE = {1, 1.15, 1.35, 1.6, 3.2};
  private static final int[] CAT_GRADE = CATS.stream().mapToInt(IdleEngine::gradeIndex).toArray();
  // Each grade's share is split evenly over its cats: percent x (all cats' common multiple) / n.
  private static final int[] CAT_WEIGHTS = catWeights();

  private static int gradeIndex(String code) {
    if (code.equals("aurora")) return 4;
    return GRADE_S.contains(code) ? 3 : GRADE_A.contains(code) ? 2 : GRADE_B.contains(code) ? 1 : 0;
  }

  private static int[] catWeights() {
    int[] count = new int[CAT_GRADES.size()];
    for (int grade : CAT_GRADE) count[grade]++;
    int common = 1;
    for (int n : count) common *= n;
    int[] weights = new int[CAT_GRADE.length];
    for (int i = 0; i < weights.length; i++) {
      weights[i] = GRADE_PER_THOUSAND[CAT_GRADE[i]] * (common / count[CAT_GRADE[i]]);
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
    1.4, 1.25, 1, 1, 1.1, 1, 1.4, 1.25, 1, 1, 1.1, 1, 1.4, 1.25, 1, 1, 1, 1.25, 1.1, 1.4, 1.1, 1.25
  };
  private static final double[] CAT_DAMAGE = {
    1, 1.25, 1, 1.1, 1.1, 1, 1, 1.25, 1, 1.1, 1.1, 1, 1, 1.25, 1, 1.1, 1.1, 1, 1, 1.25, 1, 1.1, 1.1,
    1, 1, 1.25, 1, 1.1, 1.1, 1, 1, 1.25, 1, 1.1, 1.1, 1, 1, 1.25, 1, 1.25, 1, 1.1, 1, 1.1, 1.25
  };
  private static final double[] CAT_CRITICAL = {
    1, 1, 1.5, 1, 1.25, 1, 1, 1, 1.5, 1, 1.25, 1, 1, 1, 1.5, 1, 1.25, 1, 1, 1, 1.5, 1, 1.25, 1, 1,
    1, 1.5, 1, 1.25, 1, 1, 1, 1.5, 1, 1.25, 1, 1, 1, 1.5, 1.25, 1, 1.25, 1, 1.5, 1.5
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
          // S grade cats have two skills each. Aurora has one exclusive spell.
          Map.entry("star", new int[] {11, 8}),
          Map.entry("silver", new int[] {2, 14}),
          Map.entry("wisteria", new int[] {7, 16}),
          Map.entry("frost", new int[] {12, 17}),
          Map.entry("ruby", new int[] {6, 18}),
          Map.entry("abyss", new int[] {0, 19}),
          Map.entry("dune", new int[] {10, 20}),
          Map.entry("veil", new int[] {9, 21}),
          Map.entry("flora", new int[] {13, 22}),
          Map.entry("aurora", new int[] {15}));
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
  // A cat's gun hits for this share of the weapon's damage times its level to CAT_LEVEL_EXPONENT
  // (646): level 10 is 1.26 times level 1, level 100 1.58 times, level 1000 twice. It was the
  // level to the 0.3 (644), half the weapon times the square root (636, level 1000 about 32 times)
  // and 1 + 0.2 per level above 1 before that.
  private static final double CAT_POWER = 0.25;
  private static final double CAT_LEVEL_EXPONENT = 0.1;
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

  /**
   * One gun on the field: the boss cat's, then one per fielded cat. skill is what the cats' skills
   * hit for when this is the boss cat's gun (636): the weapon's effective power against the
   * starting pistol (one bullet x bullets a second x bullet power), times the attack upgrade. It
   * was the one bullet's damage before, so merging an A shotgun into an S rifle made the skills
   * weaker. Matches the app's mental/cards.ts skillPower.
   */
  private record Shooter(
      double damage,
      double perSecond,
      double power,
      double critical,
      boolean explosive,
      double skill) {}

  /**
   * The starting pistol's fire interval (ms): the skill power (636) of the starting pistol is 1.
   */
  static final double PISTOL_FIRE_MS = 260;

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
    // 예전 메테오 확인 단계에 머문 저장도 팀 완성 안내로 이어진다.
    if (Integer.valueOf(6).equals(c.tutorialStep)) c.tutorialStep = 7;
    if (!c.onboardingInitialized) {
      // 이미 해금 조건을 달성한 기존 유저에게 새 안내를 강제하지 않는다.
      c.skillGuideSeen = c.tutorialStep == null && c.idle.best >= 100;
      c.onboardingInitialized = true;
    }
    return c.idle;
  }

  private List<Shooter> shooters(CompanyState c) {
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
    return shooters(c, damageUp, fireUp);
  }

  /** The guns on the field with the given attack and fire upgrades (1 for none). */
  private List<Shooter> shooters(CompanyState c, double damageUp, double fireUp) {
    CompanyState.Idle s = state(c);
    List<Shooter> shooters = new ArrayList<>();
    shooters.add(shooter(c.weapon, damageUp, fireUp, 1.0));
    for (String code : s.fielded) {
      int cat = CATS.indexOf(code);
      shooters.add(
          shooter(
              s.catWeapons.get(code),
              damageUp * catDamage(cat, s.cats.get(code)),
              fireUp * CAT_FIRE[cat],
              CAT_CRITICAL[cat]));
    }
    return shooters;
  }

  /** 사장냥이 쉬고 있다 (672번). 출전한 고양이가 없으면(금고 도전의 빈 파티 포함) 쉬지 못하고 나가 싸운다: 전장에 아무도 없는 일은 없다. */
  private static boolean bossOut(CompanyState.Idle s) {
    return s.bossBenched && !s.fielded.isEmpty();
  }

  /** 실제로 쏘는 총 (672번): shooters의 맨 앞은 늘 사장냥의 총이고(스킬 피해의 바탕이라 쉬어도 남는다), 사장냥이 쉬면 그 총은 쏘지 않는다. */
  private List<Shooter> firing(CompanyState c, List<Shooter> shooters) {
    return bossOut(state(c)) ? shooters.subList(1, shooters.size()) : shooters;
  }

  // 680: every cat's gun gets the whole weapon on top of its old share, and the SS cat twice the
  // weapon. A cat used to shoot a quarter of the weapon, so drawing one added little.
  static final double CAT_BASE = 1;
  static final double CAT_BASE_SS = 2;

  /**
   * 고양이 총의 공격력 (무기 공격력에 곱하는 값, 680번): 무기의 100%(SS등급은 200%)를 기본으로 받고, 그 위에 전의 몫(레벨·특성·등급 배수를 곱한
   * 25%)이 더해진다. 레벨 1 C등급은 125%, S등급은 140%, SS등급 극광냥은 300%다.
   */
  private static double catDamage(int cat, int level) {
    double base = CAT_GRADE[cat] == 4 ? CAT_BASE_SS : CAT_BASE;
    return base + power(level) * CAT_DAMAGE[cat] * GRADE_DAMAGE[CAT_GRADE[cat]];
  }

  private static double power(int level) {
    return CAT_POWER * Math.pow(Math.max(1, level), CAT_LEVEL_EXPONENT);
  }

  /** A cat without a gun, and a company from before weapons, shoots the starting pistol. */
  private Shooter shooter(
      CompanyState.Weapon weapon, double damageUp, double fireUp, double catCritical) {
    String kind = weapon == null ? MentalEngine.PISTOL : weapon.kind;
    CompanyProperties.Weapon stats =
        engine.mental.stats(
            kind, weapon == null ? MentalEngine.WEAPON_GRADES.getFirst() : weapon.grade);
    double damage = Math.min(1_000_000_000, stats.damagePercent() / 100.0 * damageUp);
    double power = 1 + Math.max(0, Math.min(3, stats.power())) * 0.4;
    return new Shooter(
        damage,
        1000.0 / stats.fireMs() * fireUp,
        power,
        ("revolver".equals(kind) ? REVOLVER_CRITICAL : CRITICAL) * catCritical,
        stats.power() >= 2,
        damage * PISTOL_FIRE_MS / stats.fireMs() * power);
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
      long bakers = s.cats.size() - s.fielded.size();
      if (bakers > 0) s.bundleMillis += elapsed;
      long work = s.bakingMillis + elapsed * bakers;
      s.bread += work / LOAF_MILLIS;
      s.bakingMillis = work % LOAF_MILLIS;
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
    double square = (double) depth * depth;
    return (HP_BASE + HP_LINEAR * depth + HP_QUARTIC * square * square)
        * (1 + 4.0 * depth / (depth + HP_UPGRADE_DEPTH));
  }

  /** 금고 도전 (641번): 스킬의 수, 그 등급의 고양이들, 스킬 하나의 코드와 이름("물 스킬"의 "물"). */
  static int skillCount() {
    return CODES.length;
  }

  static List<String> catsOf(String grade) {
    return CATS.stream().filter(code -> catGrade(code).equals(grade)).toList();
  }

  static CompanyView.VaultSkill vaultSkill(int skill) {
    return new CompanyView.VaultSkill(CODES[skill], NAMES[skill].replace(" 스킬", ""));
  }

  /** 지금 출전한 팀의 총과 스킬이 실제 1초에 내는 피해 (641번): 금고 보스전의 피해량 상한에 쓴다. */
  double fieldDps(CompanyState c) {
    return dps(c);
  }

  /**
   * 금고 보스전의 파티 (654번): 출전 칸 대신 party의 고양이(가진 고양이만, 겹치지 않게, 출전 칸 수까지)가 나갔을 때의 초당 피해. 출전 칸은 바꾸지 않는다.
   */
  double partyDps(CompanyState c, List<String> party) {
    CompanyState.Idle s = state(c);
    List<String> fielded = s.fielded;
    s.fielded =
        party.stream()
            .filter(code -> code != null && CATS.contains(code) && s.cats.getOrDefault(code, 0) > 0)
            .distinct()
            .limit(FIELD_SLOTS)
            .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
    try {
      return dps(c);
    } finally {
      s.fielded = fielded;
    }
  }

  private double dps(CompanyState c) {
    CompanyState.Idle s = state(c);
    List<Shooter> shooters = shooters(c);
    double total = 0;
    for (Shooter shooter : firing(c, shooters)) {
      total += shooter.damage() * shooter.perSecond() * shooter.power() / 1.25;
    }
    for (String code : s.fielded) {
      int cat = CATS.indexOf(code);
      if (cat < 0) continue;
      int level = skillLevel(s.cats.getOrDefault(code, 1)) - 1;
      for (int skill : CAT_SKILLS[cat]) {
        total +=
            shooters.getFirst().skill()
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
   * 강화의 4분의 1을 곱한다. 벽 번호는 보지 않으므로 강화·무기·고양이가 바뀔 때만 오른다. 강화끼리 곱해져 숫자가 걷잡을 수 없이 커지므로 제곱근으로 눌러 적는다
   * (635번).
   */
  private double power(CompanyState c) {
    CompanyState.Idle s = state(c);
    List<Shooter> shooters = shooters(c);
    double total = 0;
    for (int i = bossOut(s) ? 1 : 0; i < shooters.size(); i++) {
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
            shooters.getFirst().skill()
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
    return Math.floor(POWER_SCALE * Math.sqrt(INCOME_SPEED * total * (1 + POWER_HP_WEIGHT * hpUp)));
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
  // 653: 30 (150 before). The walls' health grew with the 1% upgrade step, and the 5,001st wall
  // still shows ten million shares.
  static final double SHARES_PER_HP = 30;

  /**
   * One buy order's damage (514, 573, 579, 638). The wall's depth is not in it. The buy wall attack
   * upgrade raises it by a fixed number of shares a level, and the team's guns add their share on
   * top (teamShares).
   */
  private double buyOrder(CompanyState c) {
    return BUY_ORDER_DAMAGE + buyUp(c);
  }

  /** The damage added to one buy order: the buy wall attack upgrade's and the team's shares. */
  private double buyUp(CompanyState c) {
    for (CompanyView.BattleUpgrade u : upgradeViews(c)) {
      if ("buy".equals(u.kind())) return u.bonusShares() / SHARES_PER_HP;
    }
    return 0;
  }

  /**
   * 매수 주문의 팀 덤 (decisions.md 638번): 벽 체력이 지수로 크면서(636번) 고정 수량뿐인 매수 주문은 깊은 벽에서 의미가 없었다. 팀 화력 배율(강화를
   * 뺀 총들의 화력 ÷ 처음 권총)에서 1을 뺀 만큼, 바탕 수량(225주 + 단계당 BUY_TEAM_STEP_SHARES주)의 BUY_TEAM_SHARE배를 얹는다. 처음
   * 권총뿐이면 덤이 없어 전과 같다. 벽의 깊이는 여전히 보지 않는다 (573번): 무기와 동료가 세질수록 커진다.
   */
  static final double BUY_TEAM_SHARE = 0.5;

  // 648번: 강화 단계가 다섯 배로 많아져 2주에서 0.4주로 낮췄다(매수 4주와 같은 비율). 653번에 주의 크기가 5분의 1이 되어 피해로는 646번과 같다.
  static final double BUY_TEAM_STEP_SHARES = 0.4;

  /** 팀 화력 배율 (638번): 강화를 뺀 모든 총의 (한 발 × 초당 발수 × 탄 강화)를 처음 권총의 그것으로 나눈 값. 처음 권총뿐이면 1. */
  double teamScale(CompanyState c) {
    double total = 0;
    for (Shooter shooter : firing(c, shooters(c, 1, 1))) {
      total += shooter.damage() * shooter.perSecond() * shooter.power();
    }
    return total / (1000.0 / PISTOL_FIRE_MS);
  }

  /** 매수벽 공격 level단계에서 팀이 매수 주문 한 장에 얹는 수량(주, 638번). 영구 강화(fish단계)는 한 단계에 3%를 곱한다. */
  private long teamShares(CompanyState c, int level) {
    int fish = c.fishLevels.getOrDefault("buy", 0);
    double shares =
        Math.max(0, teamScale(c) - 1)
            * BUY_TEAM_SHARE
            * (BUY_ORDER_DAMAGE * SHARES_PER_HP + BUY_TEAM_STEP_SHARES * level)
            * (1 + MentalEngine.FISH_STEP_PERCENT / 100.0 * fish);
    return (long) Math.min(Long.MAX_VALUE / 4, Math.floor(shares));
  }

  /** 전투 강화의 화면 값: 매수벽 공격에는 팀의 덤(638번)이 더해져 있다. 화면과 서버가 이 수량으로 매수 주문 한 장을 센다. */
  List<CompanyView.BattleUpgrade> upgradeViews(CompanyState c) {
    return engine.mental.upgradeViews(c).stream()
        .map(
            u ->
                "buy".equals(u.kind())
                    ? new CompanyView.BattleUpgrade(
                        u.kind(),
                        u.level(),
                        u.price(),
                        u.priceGrowthPercent(),
                        u.bonusPercent(),
                        u.nextBonusPercent(),
                        u.stepBonusPercent(),
                        u.nextStepBonusPercent(),
                        u.bonusShares() + teamShares(c, u.level()),
                        u.nextBonusShares() + teamShares(c, u.level() + 1),
                        u.maxLevel())
                    : u)
        .toList();
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
    // 사장냥의 고유 스킬은 자동 전투에서 없앴다 (667번): 매도벽 돌파 스테이지의 레벨업 카드로만 나온다.
    if (at < UNIQUE) {
      throw new InvalidRequestException("스테이지의 레벨업 카드로 쓰는 스킬이다: " + ACTIVE_NAMES[at]);
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
    s.activeUntil.put(code, s.activeSeconds + ACTIVE_SECONDS[at]);
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
    if ("start".equals(action)) {
      if (c.tutorialStep == null || c.tutorialStep >= 8) {
        if (!c.tutorialCatClaimed || !c.tutorialWeaponClaimed) c.tutorialStep = -1;
      }
      return;
    }
    if (!List.of("next", "draw-cat", "draw-weapon").contains(action)) {
      throw new InvalidRequestException("없는 안내 동작이에요");
    }
    int step = c.tutorialStep == null ? 8 : c.tutorialStep;
    if (expected < step) return;
    if (expected != step || step >= 8) throw new InvalidRequestException("안내 단계를 다시 확인해 주세요");
    String required = step == 2 ? "draw-cat" : step == 4 ? "draw-weapon" : "next";
    if (!required.equals(action)) throw new InvalidRequestException("안내된 뽑기를 먼저 완료해 주세요");
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
    c.tutorialStep = step == 5 ? 7 : step + 1;
  }

  private void tutorialCat(CompanyState c) {
    if (c.tutorialCatClaimed) return;
    int level = state(c).cats.merge("night", 1, Integer::sum);
    state(c).lastDraws = List.of(new CompanyState.Pulled("night", null, level, level == 1));
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
    c.lastWeaponDraw = new CompanyState.Weapon("smg", "B");
    c.lastWeaponDrawNew = owned == null;
    c.lastWeaponDraws = List.of(new CompanyState.Pulled("smg", "B", 0, owned == null));
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

  /** Seconds of effect left, in game seconds. Zero for the instant ones. */
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
    // 사장냥이 쉬면 (672번) 총알은 고양이들의 것뿐이다: 한 발의 바탕도 맨 앞 고양이의 총이다. 스킬의 바탕은 그대로 사장냥의 무기다.
    List<Shooter> firing = firing(c, shooters);
    Shooter gunner = firing.getFirst();
    double bulletMax = 0;
    double bulletsPerSecond = 0;
    for (Shooter shooter : firing) {
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
      double perHit = kind == 0 ? BULLET_WEIGHT * gunner.power() : 0;
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
      double damage = damageBoost * (kind == 0 ? gunner.damage() : hero.skill()) * perHit;
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
        // 극광의 밤 (673번) is the one skill that does: its ribbon sweeps the whole lane, so it hits the
        // queued walls at the same halving shares as a pierced bullet.
        if (depth > 0 && kind != 0 && !"auroraNight".equals(code)) continue;
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
      // 이미 깬 보스(환생한 뒤 다시 지나는 벽)는 멈추지 않고 지나간다 (663번).
      if (CIRCUIT_ENABLED && bossWall(s.wall) && s.wall > s.bossCleared) {
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

  /** 테스트판 (499번): 동료 고양이 45종을 모두 그 레벨로 주고, 빈 출전 칸을 차례대로 채운다. */
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

  /** 환생하면 깬 벽 이만큼마다 생선 한 마리다 (600번): 진행한 만큼 비례해서 준다. 열 개에서 다섯 개로 줄여 두 배를 준다 (625번). */
  static final long REBIRTH_WALLS_PER_FISH = 5;

  /** 환생할 때 광고를 보면 생선을 이 배수로 받는다 (586번). 볼 수 있는 횟수에는 한도가 없다. */
  static final long REBIRTH_AD_MULTIPLIER = 3;

  /**
   * 환생의 생선에 얹는 덤 (633·644번): 깬 보스(벽 BOSS_EVERY개)마다 이만큼 더한다. 첫 보스 +2%, 둘째 +4% … 5,000벽이면 +200%.
   * 633번에는 덤이 보스마다 커지며 쌓여(+5%, +10%, +15% …) 5,000벽에서 250배가 되었고, 생선 강화가 화력을 수십 배로 키웠다.
   */
  static final long REBIRTH_DEPTH_BONUS_PERCENT = 2;

  /**
   * 지금 환생하면 받는 생선 (571·600번): 깬 벽 수 ÷ 5에, 깬 보스마다 커지는 덤(+5%, +10%, +15% …)을 쌓아 얹는다 (633번, 내림). 51번째
   * 벽에서 10, 101번째 23, 301번째 123, 501번째 375. 아직 못 하면 0. 첫 보스를 깨야 하는 것은 첫 환생뿐이다 (603번): 한 번 환생한 뒤에는
   * 어느 벽에서든 깬 벽만큼 받는다.
   */
  long rebirthFish(CompanyState c) {
    long cleared = state(c).wall - 1;
    if (state(c).wall < rebirthWall(c)) {
      return 0;
    }
    long bosses = cleared / BOSS_EVERY;
    long percent = 100 + REBIRTH_DEPTH_BONUS_PERCENT * bosses;
    return cleared / REBIRTH_WALLS_PER_FISH * percent / 100;
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
    long base = rebirthFish(c);
    long fish = base * (ad ? REBIRTH_AD_MULTIPLIER : 1);
    if (fish <= 0) {
      throw new InvalidRequestException(
          c.rebirths > 0
              ? "환생은 매도벽 " + rebirthWall(c) + "부터 할 수 있어요"
              : "환생은 " + (REBIRTH_WALL - 1) + "번째 벽의 보스를 깬 뒤에 할 수 있어요");
    }
    c.fish += fish;
    // 시즌패스 미션 (634번): 광고 3배를 뺀 바탕 수로 센다.
    engine.pass.progress(c, "fish", base, todayDate());
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
    buyFishUpgrade(c, kind, 1);
  }

  /** 한 요청에 묶어 사는 영구 강화의 최대 단계 (663번). */
  static final int FISH_MAX_BATCH = 100;

  /** 영구 강화를 levels단계까지 묶어 올린다 (663번): 생선이 닿는 데까지만 오른다. 한 단계도 못 사면 400. */
  void buyFishUpgrade(CompanyState c, String kind, int levels) {
    state(c);
    if (!MentalEngine.FISH_UPGRADES.contains(kind)) {
      throw new InvalidRequestException("없는 영구 강화다: " + kind);
    }
    if (levels < 1 || levels > FISH_MAX_BATCH) {
      throw new InvalidRequestException("한 번에 1~" + FISH_MAX_BATCH + "단계를 올린다");
    }
    int level = c.fishLevels.getOrDefault(kind, 0);
    int bought = 0;
    while (bought < levels && c.fish >= MentalEngine.fishUpgradeCost(level + bought)) {
      c.fish -= MentalEngine.fishUpgradeCost(level + bought);
      bought++;
    }
    if (bought == 0) throw new InvalidRequestException("생선이 모자라요");
    c.fishLevels.put(kind, level + bought);
    engine.pass.progress(c, "forever", bought, todayDate());
  }

  private double bundlePrice(CompanyState.Idle s) {
    return 100.0 * s.wall * s.bread;
  }

  void sellBread(CompanyState c) {
    CompanyState.Idle s = state(c);
    if (s.bread < 1) throw new InvalidRequestException("팔 식빵이 없어요.");
    c.capital += bundlePrice(s);
    c.diamonds += BAKERY_DIAMONDS * (s.bundleMillis / DIAMOND_MILLIS);
    s.bundleMillis %= DIAMOND_MILLIS;
    s.bread = 0;
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

  /**
   * 사장냥을 쉬게 하거나 다시 내보낸다 (672번). 출전한 고양이가 한 마리도 없으면 쉴 수 없다: 누군가는 싸워야 한다. 쉬는 동안 사장냥의 총은 쏘지 않고, 고양이의
   * 스킬은 전처럼 사장냥의 무기를 바탕으로 한다.
   */
  void fieldBoss(CompanyState c, boolean fielded) {
    CompanyState.Idle s = state(c);
    if (!fielded && s.fielded.isEmpty()) {
      throw new InvalidRequestException("출전한 고양이가 있어야 사장냥이 쉴 수 있어요");
    }
    if (s.bossBenched == !fielded) return;
    s.bossBenched = !fielded;
    s.hitCredits = new double[KINDS];
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
    } else if (s.fielded.contains(code)) {
      // 사장냥이 쉬는 동안 (672번) 마지막 고양이는 뺄 수 없다: 최소 한 마리는 싸운다.
      if (s.bossBenched && s.fielded.size() == 1) {
        throw new InvalidRequestException("사장냥이 쉬는 동안 마지막 고양이는 뺄 수 없어요");
      }
      s.fielded.remove(code);
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

  int mergeAllWeapons(CompanyState c) {
    engine.mental.initWeapons(c);
    int total = 0;
    for (int i = 0; i < MentalEngine.WEAPON_GRADES.size() - 1; i++) {
      String grade = MentalEngine.WEAPON_GRADES.get(i);
      var owned = c.weapons.stream().filter(w -> w.grade.equals(grade)).findFirst();
      if (owned.isEmpty()) continue;
      CompanyState.Weapon w = owned.get();
      int batches = free(c, w.kind, grade, null) / engine.mental.mergeCount();
      if (batches > 0) {
        engine.mental.promoteWeapons(c, w, i, batches);
        total += batches;
      }
    }
    return total;
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
                      (int) Math.round(100 * catDamage(cat, level)),
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
        s.bread,
        CompanyView.money(bundlePrice(s)),
        BAKERY_DIAMONDS * (s.bundleMillis / DIAMOND_MILLIS),
        (DIAMOND_MILLIS - s.bundleMillis % DIAMOND_MILLIS + 999) / 1000,
        (int) (100 * s.bakingMillis / LOAF_MILLIS),
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
        // 광고 스킬 셋만 준다 (667번): 사장냥의 고유 스킬은 자동 전투에서 없앴다.
        java.util.stream.IntStream.range(UNIQUE, ACTIVES.size())
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
                        true))
            .toList(),
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
            c.skillGuideSeen),
        // 최고 기록 (654번): 통과한 가장 높은 벽. 환생해도 남는다(best와 같은 셈).
        Math.max(s.best, Math.max(s.wall - 1, s.bossCleared)),
        !bossOut(s));
  }
}
