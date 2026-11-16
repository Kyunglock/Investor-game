package investorgame.raising.internal;

import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.SeededRandom;
import investorgame.raising.CompanyService.IdleHit;
import investorgame.raising.CompanyView;
import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Visible-client lease. No scheduler, offline catch-up, or client-supplied damage/rewards. */
@Component
class IdleEngine {
  private final Clock clock;
  private final CompanyEngine engine;
  private final String serverId = UUID.randomUUID().toString();
  private static final double SPEED = 2;

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

  /** 매수벽이 무너지면 이만큼 앞의 벽으로 돌아간다 (546번). */
  static final long RETREAT_WALLS = 10;

  /** 보스 도전의 벽 (547번). */
  static boolean bossWall(long wall) {
    return wall % BOSS_EVERY == 0;
  }

  // Credit buckets: the bullet, the four cat skills, the buy barrage (decisions.md 503), and the
  // buy wall's own buy orders (514).
  private static final int KINDS = 7;
  private static final int BARRAGE = 5;
  private static final int BUY = 6;
  // Active skills (503): the player presses them. Seconds are game seconds (twice real time).
  // barrage: the buy wall pours buy orders; rally: every gun fires twice as fast; fortify: the buy
  // wall is rebuilt and cannot be hurt (the wall is the screen's, so the server only keeps time).
  private static final List<String> ACTIVES = List.of("barrage", "rally", "fortify");
  private static final String[] ACTIVE_NAMES = {"매수세례", "불장", "방어선 구축"};
  private static final double[] ACTIVE_COOLDOWN = {60, 90, 90};
  private static final double[] ACTIVE_SECONDS = {6, 10, 6};
  // Matches the app's mental/actives.ts.
  private static final int BARRAGE_SHOTS = 40;
  private static final double BARRAGE_POWER = 3;
  // A buy order's damage is its own number (514): this base times the wall's order scale (the
  // same scale the sell orders and the buy wall's health use, 498) times the buy upgrade. It does
  // not follow the weapon. Matches the app's mental/buyWall.ts BUY_WALL.orderDamage.
  private static final double BUY_ORDER_DAMAGE = 0.75;
  // The buy wall answers every sell order with two buy orders, a pair every 0.15 game seconds at
  // the fastest (buyWall.ts shotSeconds - shotJitter).
  private static final double BUY_ORDERS_PER_SECOND = 2 / 0.15;
  // Matches the app's mental/assault.ts idleThreat.
  private static final double THREAT_HP = 760;
  // Wall health (518): base + linear x depth + square x depth^2, every 50th wall (the boss, 550) x
  // BOSS_HP.
  private static final double HP_BASE = 20;
  private static final double HP_LINEAR = 12;
  private static final double HP_SQUARE = 0.2;
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
  // Attack kinds after the bullet (kind 0): skills. Each cat has one as its own ability and casts
  // it while fielded (decisions.md 501). Walls no longer unlock skills.
  // A skill has five levels (515), the renderer's tables (mental/magic.ts): cooldown, damage per
  // hit as a multiple of the boss cat's gun, and hits on the wall per cast (meteors per cast; a
  // bolt and one chain per lightning stroke). The level follows the cat's level.
  private static final int SKILL_MAX_LEVEL = 5;
  private static final int SKILL_CAT_LEVELS = 10;
  private static final double[][] COOLDOWNS = {
    {2.4, 2.1, 1.8, 1.6, 1.4},
    {3.6, 3.3, 3, 2.8, 2.6},
    {2.6, 2.3, 2, 1.8, 1.6},
    {3.6, 3.2, 3, 2.8, 2.6}
  };
  private static final double[][] SKILL_DAMAGE = {
    {1.5, 2, 2.6, 3, 3.4},
    {4.8, 8.25, 4.2, 5.05, 4.42},
    {2.5, 3.5, 4.5, 5.2, 6},
    {1.2 * 3.4, 1.6 * 3.6, 2.1 * 3.8, 2.5 * 4, 2.9 * 4.2}
  };
  private static final double[][] SKILL_HITS = {
    {1, 1, 1, 1, 1},
    {1, 1, 3, 3, 4},
    {2, 2, 2, 3, 3},
    {1, 1, 1, 1, 1}
  };
  private static final String[] CODES = {"water", "meteor", "bolt", "ram"};
  private static final String[] NAMES = {"물 스킬", "메테오 스킬", "번개 스킬", "충차 스킬"};
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
  // Each cat's own skill, as an index into CODES (501): sky meteor, mint water, lilac bolt,
  // sunset ram, night meteor, snow water. Matches the app's idle/loadout.ts CAT_SKILLS.
  private static final int[] CAT_SKILL = {
    1, 0, 2, 3, 1, 0, 1, 0, 2, 3, 1, 0, 1, 0, 2, 3, 1, 0, 1, 0, 2, 3, 1, 0, 1, 0, 2, 3, 1, 0, 1, 0,
    2, 3, 1, 0, 1, 0, 2
  };
  private static final long[] OLD_UNLOCKS = {5, 15, 30, 50};
  private static final String[] OLD_SKILL_CATS = {"mint", "sky", "lilac", "sunset"};
  // Cats used to join at these walls. Saves from then keep them.
  private static final long[] CAT_LEGACY_WALLS = {15, 50};
  private static final int FIELD_SLOTS = 4;
  // A cat's gun hits for this share of the weapon's damage; each level above 1 adds the bonus.
  private static final double CAT_POWER = 0.5;
  private static final double CAT_LEVEL_BONUS = 0.2;
  // A cleared wall pays this many game seconds of its own time income, a boss wall BOSS_REWARD
  // times that (537). It used to pay per point of wall health, which outgrew the time income.
  static final double REWARD_SECONDS = 30;
  private static final double BOSS_REWARD = 3;
  // Capital per active game second at wall 1 (492).
  private static final double INCOME = 20_000;
  private static final double INCOME_GROWTH = 0.05;
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
        int skill = i;
        boolean has =
            c.idle.cats.keySet().stream().anyMatch(k -> CAT_SKILL[CATS.indexOf(k)] == skill);
        if (c.idle.wall > OLD_UNLOCKS[i] && !has) {
          c.idle.cats.put(OLD_SKILL_CATS[i], 1);
          if (c.idle.fielded.size() < FIELD_SLOTS) c.idle.fielded.add(OLD_SKILL_CATS[i]);
        }
      }
      c.idle.catSkills = true;
    }
    return c.idle;
  }

  private List<Shooter> shooters(CompanyState c) {
    CompanyState.Idle s = state(c);
    double damageUp = 1;
    double fireUp = 1;
    double criticalUp = 1;
    for (CompanyView.BattleUpgrade u : engine.mental.upgradeViews(c)) {
      double bonus = 1 + u.bonusPercent() / 100.0;
      switch (u.kind()) {
        case "damage" -> damageUp = bonus;
        case "fire" -> fireUp = bonus;
        case "crit" -> criticalUp = bonus;
        default -> {}
      }
    }
    List<Shooter> shooters = new ArrayList<>();
    shooters.add(shooter(c.weapon, damageUp, fireUp, criticalUp));
    for (String code : s.fielded) {
      int cat = CATS.indexOf(code);
      shooters.add(
          shooter(
              s.catWeapons.get(code),
              damageUp * power(s.cats.get(code)) * CAT_DAMAGE[cat] * GRADE_DAMAGE[CAT_GRADE[cat]],
              fireUp * CAT_FIRE[cat],
              criticalUp * CAT_CRITICAL[cat]));
    }
    return shooters;
  }

  private static double power(int level) {
    return CAT_POWER * (1 + CAT_LEVEL_BONUS * (level - 1));
  }

  /** A cat without a gun, and a company from before weapons, shoots the starting pistol. */
  private Shooter shooter(
      CompanyState.Weapon weapon, double damageUp, double fireUp, double criticalUp) {
    String kind = weapon == null ? MentalEngine.PISTOL : weapon.kind;
    CompanyProperties.Weapon stats =
        engine.mental.stats(
            kind, weapon == null ? MentalEngine.WEAPON_GRADES.getFirst() : weapon.grade);
    return new Shooter(
        Math.min(1_000_000_000, stats.damagePercent() / 100.0 * damageUp),
        1000.0 / stats.fireMs() * fireUp,
        1 + Math.max(0, Math.min(3, stats.power())) * 0.4,
        ("revolver".equals(kind) ? REVOLVER_CRITICAL : CRITICAL) * criticalUp,
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
    double income = s.incomeRemainder + seconds * SPEED * incomeRate(c);
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
   * What clearing the front wall pays (537): REWARD_SECONDS of the wall's own time income at its
   * price level, three times that on a boss wall. Employees and the stage bonus are not in it.
   */
  private static double reward(CompanyState c) {
    CompanyState.Idle s = c.idle;
    return Math.floor(
        wallIncome(s)
            * REWARD_SECONDS
            * (bossWall(s.wall) ? BOSS_REWARD : 1)
            * CompanyEngine.inflation(c));
  }

  /** The wall's own time income per game second, before the price level (492). */
  private static double wallIncome(CompanyState.Idle s) {
    return INCOME * (1 + INCOME_GROWTH * Math.min(s.wall - 1, 10_000));
  }

  /**
   * The company's income per game second (523): (the wall's time income + every employee's income)
   * x the wall's price level (505) x (1 + the mental stage bonus).
   */
  double incomeRate(CompanyState c) {
    return (wallIncome(state(c)) + engine.staffIncome(c))
        * CompanyEngine.inflation(c)
        * (1 + engine.mental.bonusPercent(c) / 100.0);
  }

  /** The company's income per real second on screen (the fight runs at SPEED). */
  double perSecond(CompanyState c) {
    return SPEED * incomeRate(c);
  }

  /** One employee's share of that income, per real second on screen. */
  double incomeOf(CompanyState c, CompanyState.Employee e) {
    return SPEED
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
      int skill = CAT_SKILL[cat];
      int level = skillLevel(s.cats.getOrDefault(code, 1)) - 1;
      total +=
          shooters.getFirst().damage()
              * SKILL_DAMAGE[skill][level]
              * (skill == 1 ? SKILL_HITS[skill][level] : 1)
              / COOLDOWNS[skill][level];
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
      int skill = CAT_SKILL[cat];
      int level = skillLevel(s.cats.getOrDefault(code, 1)) - 1;
      total +=
          shooters.getFirst().damage()
              * SKILL_DAMAGE[skill][level]
              * SKILL_HITS[skill][level]
              / COOLDOWNS[skill][level];
    }
    total += BUY_ORDER_DAMAGE * POWER_BUY_ORDERS * buyUp(c);
    double hpUp = 0;
    for (CompanyView.BattleUpgrade u : engine.mental.upgradeViews(c)) {
      if ("hp".equals(u.kind())) hpUp = u.bonusPercent() / 100.0;
    }
    return Math.floor(POWER_SCALE * SPEED * total * (1 + POWER_HP_WEIGHT * hpUp));
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

  /** One buy order's damage at this wall (514). The weapon is not in it. */
  private double buyOrder(CompanyState c, long wall) {
    return BUY_ORDER_DAMAGE * threat(wall) * buyUp(c);
  }

  private double buyUp(CompanyState c) {
    for (CompanyView.BattleUpgrade u : engine.mental.upgradeViews(c)) {
      if ("buy".equals(u.kind())) return 1 + u.bonusPercent() / 100.0;
    }
    return 1;
  }

  /**
   * 액티브 스킬을 쓴다 (decisions.md 503번). 없는 스킬이거나 아직 재사용 대기 중이면 400. 대기 시간은 전투가 돌아가는 동안만 흐른다(접속 신호의 활성
   * 시간).
   */
  void useActive(CompanyState c, String code) {
    CompanyState.Idle s = state(c);
    int at = ACTIVES.indexOf(code);
    if (at < 0) throw new InvalidRequestException("없는 스킬이다: " + code);
    if (s.activeReady.getOrDefault(code, 0.0) > s.activeSeconds + 1e-9) {
      throw new InvalidRequestException("아직 쓸 수 없다");
    }
    if (s.circuitSeconds > 0) throw new InvalidRequestException("거래 정지 중에는 쓸 수 없다");
    s.activeReady.put(code, s.activeSeconds + ACTIVE_COOLDOWN[at]);
    if (s.hitCredits == null || s.hitCredits.length != KINDS) s.hitCredits = new double[KINDS];
    if (at == 0) s.hitCredits[BARRAGE] = BARRAGE_SHOTS;
    if (at == 1) s.rallyUntil = s.activeSeconds + ACTIVE_SECONDS[at];
  }

  /** How many fielded cats cast each skill (501). A resting cat's skill does nothing. */
  private static int[] casters(CompanyState.Idle s) {
    int[] casters = new int[CODES.length];
    for (String code : s.fielded) {
      int cat = CATS.indexOf(code);
      if (cat >= 0) casters[CAT_SKILL[cat]]++;
    }
    return casters;
  }

  private void tick(CompanyState c, double seconds, List<IdleHit> hits) {
    CompanyState.Idle s = state(c);
    double stopped = Math.min(seconds, s.circuitSeconds);
    s.circuitSeconds -= stopped;
    double active = seconds - stopped;
    // 불장 (503): bullets come twice as often while it burns. A beat that starts inside it counts.
    double rally = s.activeSeconds < s.rallyUntil ? RALLY_FIRE : 1;
    s.activeSeconds += active;
    // 물가 (505번): 시간 수입과 벽 보상은 그 벽의 물가만큼 크다.
    // 직원의 초당 수입과 멘탈 보호 보너스도 같은 틱에 들어온다 (523번).
    double income = s.incomeRemainder + active * incomeRate(c);
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
              bulletMax, BULLET_WEIGHT * shooter.damage() * shooter.power() * shooter.critical());
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
    for (int kind = 0; kind < 5 && active > 0; kind++) {
      if (kind > 0 && casters[kind - 1] == 0) continue;
      // A skill is cast by each fielded cat that has it, at that cat's level (515): the hit budget
      // adds up over them and one hit may be as strong as the highest level's.
      double perHit = kind == 0 ? BULLET_WEIGHT * hero.power() : 0;
      double perSecond = kind == 0 ? bulletsPerSecond : 0;
      double gained = kind == 0 ? active / (1 / bulletsPerSecond) : 0;
      for (String cat : kind == 0 ? List.<String>of() : s.fielded) {
        int at = CATS.indexOf(cat);
        if (at < 0 || CAT_SKILL[at] != kind - 1) continue;
        int level = skillLevel(s.cats.getOrDefault(cat, 1)) - 1;
        perHit = Math.max(perHit, SKILL_DAMAGE[kind - 1][level]);
        perSecond += SKILL_HITS[kind - 1][level] / COOLDOWNS[kind - 1][level];
        gained += active * SKILL_HITS[kind - 1][level] / COOLDOWNS[kind - 1][level];
      }
      double damage = hero.damage() * perHit;
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
    double barrageMax = buyOrder(c, front) * BARRAGE_POWER;
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
    // The buy wall's own buy orders that got past the sell orders to the front wall (514). They
    // have their own budget and their own damage: they no longer spend the bullets' budget.
    if (active > 0) {
      s.hitCredits[BUY] =
          Math.min(
              SPEED * GRACE_MS / 1000 * BUY_ORDERS_PER_SECOND,
              s.hitCredits[BUY] + active * BUY_ORDERS_PER_SECOND);
      double buyMax = buyOrder(c, front);
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
      // 시즌패스 경험치 (529번): 벽 하나에 exp.wall.
      engine.pass.gain(c, engine.pass.rule().exp().wall(), todayDate());
      double left = Math.max(0, s.damage - maxHp(s.wall));
      // 보스 클리어 보상 (549번): 벽 보상과 따로, 그 보스를 처음 깼을 때 한 번.
      if (bossWall(s.wall) && s.wall > s.bossCleared) {
        double money = Math.floor(reward(c) * BOSS_CLEAR_REWARDS);
        s.bossCleared = s.wall;
        s.bossRewardMoney = money;
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
    for (int i = 0; i < engine.diamonds().items(count); i++) {
      drawn.add(grantCat(c, random));
    }
    s.lastDraws = drawn;
  }

  /** One random cat at no cost: the gacha (526) and the season pass's last step (529) share it. */
  CompanyState.Pulled grantCat(CompanyState c, SeededRandom random) {
    CompanyState.Idle s = state(c);
    s.catDraws++;
    int roll =
        random.forKey("cat-draw", s.catDraws).nextInt(java.util.Arrays.stream(CAT_WEIGHTS).sum());
    int cat = 0;
    while (roll >= CAT_WEIGHTS[cat]) roll -= CAT_WEIGHTS[cat++];
    String code = CATS.get(cat);
    int level = s.cats.merge(code, 1, Integer::sum);
    if (level == 1 && s.fielded.size() < FIELD_SLOTS) {
      s.fielded.add(code);
    }
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

  /**
   * Where a broken buy wall sends the fight from this wall (546): ten walls back, but never behind
   * the last boss already cleared (548). The wall right after that boss is the checkpoint: 51 for
   * walls 51 to 100, the first wall before any boss is cleared.
   */
  static long retreatWall(long wall) {
    long checkpoint = (Math.max(1, wall) - 1) / BOSS_EVERY * BOSS_EVERY + 1;
    return Math.max(checkpoint, wall - RETREAT_WALLS);
  }

  /**
   * 매수벽이 무너졌다 (decisions.md 546번): 열 벽 앞으로 돌아간다. 깬 보스의 다음 벽보다 앞으로는 가지 않는다 (548번). 매수벽은 화면의 것이라 서버는
   * 무너졌는지 따지지 않는다: 돌아가면 수입과 보상이 줄 뿐이다.
   */
  void retreat(CompanyState c) {
    CompanyState.Idle s = state(c);
    move(s, retreatWall(s.wall));
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

  void fieldCat(CompanyState c, String code, boolean fielded) {
    CompanyState.Idle s = state(c);
    if (!s.cats.containsKey(code)) throw new InvalidRequestException("가지지 않은 고양이다: " + code);
    s.fielded.remove(code);
    if (fielded && s.fielded.size() >= FIELD_SLOTS) {
      throw new InvalidRequestException("출전 칸이 꽉 찼다: " + FIELD_SLOTS + "마리까지 출전한다");
    }
    if (fielded) s.fielded.add(code);
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
                          .filter(k -> CATS.contains(k) && CAT_SKILL[CATS.indexOf(k)] == skill)
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
                      weapon == null ? null : new CompanyView.CatWeapon(weapon.kind, weapon.grade),
                      CODES[CAT_SKILL[cat]],
                      NAMES[CAT_SKILL[cat]],
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
                            / SPEED))
            .toList(),
        (s.lastDraws == null ? List.<CompanyState.Pulled>of() : s.lastDraws)
            .stream()
                .filter(d -> CATS.contains(d.kind))
                .map(d -> new CompanyView.CatDraw(d.kind, d.level, d.isNew, catGrade(d.kind)))
                .toList(),
        new CompanyView.Income(
            CompanyView.money(SPEED * incomeRate(c)),
            CompanyView.money(
                SPEED
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
        power(c));
  }
}
