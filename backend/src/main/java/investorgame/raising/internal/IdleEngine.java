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
  private static final int SKILL_CAT_LEVELS = 2;
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
      List.of("sky", "mint", "lilac", "sunset", "night", "snow");
  private static final String[] CAT_NAMES = {"하늘냥", "민트냥", "라일락냥", "노을냥", "밤냥", "눈꽃냥"};
  private static final int[] CAT_WEIGHTS = {25, 25, 10, 15, 15, 10};
  private static final double[] CAT_FIRE = {1.25, 1, 1, 1.1, 1, 1.4};
  private static final double[] CAT_DAMAGE = {1, 1.25, 1, 1.1, 1.1, 1};
  private static final double[] CAT_CRITICAL = {1, 1, 1.5, 1, 1.25, 1};
  // Each cat's own skill, as an index into CODES (501): sky meteor, mint water, lilac bolt,
  // sunset ram, night meteor, snow water. Matches the app's idle/loadout.ts CAT_SKILLS.
  private static final int[] CAT_SKILL = {1, 0, 2, 3, 1, 0};
  private static final long[] OLD_UNLOCKS = {5, 15, 30, 50};
  private static final String[] OLD_SKILL_CATS = {"mint", "sky", "lilac", "sunset"};
  // Cats used to join at these walls. Saves from then keep them.
  private static final long[] CAT_LEGACY_WALLS = {15, 50};
  private static final int FIELD_SLOTS = 4;
  // A cat's gun hits for this share of the weapon's damage; each level above 1 adds the bonus.
  private static final double CAT_POWER = 0.5;
  private static final double CAT_LEVEL_BONUS = 0.2;
  // Capital per point of wall health on a clear, and per active second at wall 1 (492).
  private static final double REWARD_PER_HEALTH = 60_000;
  private static final double INCOME = 20_000;
  private static final double INCOME_GROWTH = 0.05;
  // Matches weaponEffects.ts: revolver 3x, every other weapon 2x (decisions.md 487).
  private static final double REVOLVER_CRITICAL = 3;
  private static final double CRITICAL = 2;
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
      c.idle.damage = Math.min(c.idle.damage, maxHp(c.idle.wall) - 1);
      c.idle.hitVersion = 2;
    }
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
              damageUp * power(s.cats.get(code)) * CAT_DAMAGE[cat],
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
    if ("stop".equals(action)) {
      s.lastBeat = 0;
      s.hitCredits = new double[KINDS];
      return;
    }
    long elapsed = now - s.lastBeat;
    if (s.lastBeat > 0 && elapsed > 0 && elapsed <= GRACE_MS && serverId.equals(s.serverId)) {
      tick(c, elapsed / 1000.0 * SPEED, hits == null ? List.of() : hits);
    } else {
      s.hitCredits = new double[KINDS];
    }
    s.lastBeat = now;
    s.serverId = serverId;
  }

  static double maxHp(long wall) {
    // The first walls fall in seconds; later ones grow faster than linearly so upgrades matter
    // (492).
    long depth = wall - 1;
    return (20 + 12.0 * depth + 0.4 * depth * depth) * (wall % 10 == 0 ? 4 : 1);
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

  /** A cat's skill level (515): one more for every two cat levels, up to five. */
  static int skillLevel(int catLevel) {
    return Math.min(SKILL_MAX_LEVEL, 1 + Math.max(0, catLevel - 1) / SKILL_CAT_LEVELS);
  }

  /** The cat level at which the skill next levels up, or 0 at the top level. */
  private static int nextSkillAt(int catLevel) {
    int level = skillLevel(catLevel);
    return level >= SKILL_MAX_LEVEL ? 0 : 1 + level * SKILL_CAT_LEVELS;
  }

  /**
   * The order scale in front of a wall (498): matches the app's idleThreat, two significant digits.
   */
  static double threat(long wall) {
    double hp = maxHp(wall) / (wall % 10 == 0 ? 4 : 1);
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
    double income =
        s.incomeRemainder
            + active
                * INCOME
                * (1 + INCOME_GROWTH * Math.min(s.wall - 1, 10_000))
                * CompanyEngine.inflation(c);
    double earned = Math.floor(income);
    s.incomeRemainder = income - earned;
    if (s.hitCredits == null || s.hitCredits.length != KINDS) s.hitCredits = new double[KINDS];
    // Match the damage shown at collision, bounded by owned attacks and server stats.
    // A contact is not a second of DPS: fire upgrades must never multiply a single hit.
    List<Shooter> shooters = shooters(c);
    Shooter hero = shooters.getFirst();
    boolean explosive = shooters.stream().anyMatch(Shooter::explosive);
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
      int[] counts = new int[3];
      double[] amounts = new double[3];
      for (IdleHit hit : hits) {
        if (hit == null || !code.equals(hit.kind()) || hit.count() <= 0) continue;
        long offset = hit.wall() - front;
        if (offset < 0 || offset > 2) continue;
        // Only actual area contacts may affect queued walls, and only with an owned area attack.
        if (offset > 0 && !(kind == 1 || kind == 2 || (kind == 0 && explosive))) continue;
        double reported = hit.damage() == null ? damage * hit.count() : hit.damage();
        if (!Double.isFinite(reported) || reported <= 0) continue;
        int index = (int) offset;
        int count = Math.min(hit.count(), 1000 - counts[index]);
        counts[index] += count;
        amounts[index] += Math.min(reported / hit.count(), maxDamage) * count;
      }
      int most = Math.max(counts[0], Math.max(counts[1], counts[2]));
      double accepted = Math.min(most, s.hitCredits[kind]);
      s.hitCredits[kind] -= accepted;
      for (int i = 0; i < 3; i++) {
        if (counts[i] > 0) amounts[i] *= Math.min(counts[i], accepted) / counts[i];
      }
      s.damage += amounts[0];
      dealt += amounts[0] + amounts[1] + amounts[2];
      s.nextDamage = Math.min(maxHp(front + 1), s.nextDamage + amounts[1]);
      s.afterNextDamage = Math.min(maxHp(front + 2), s.afterNextDamage + amounts[2]);
    }
    // 매수세례 (503): its buy orders that reach the front wall. Credits come from the press, not time.
    double barrageMax = buyOrder(c, front) * BARRAGE_POWER;
    for (IdleHit hit : hits) {
      if (active <= 0 || hit == null || !"barrage".equals(hit.kind()) || hit.count() <= 0) continue;
      if (hit.wall() != front) continue;
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
        if (hit.wall() != front) continue;
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
    // Pay only for contacted walls in order. No leftover DPS rolls into an untouched new wall.
    while (s.circuitSeconds == 0 && s.damage + 1e-7 >= maxHp(s.wall)) {
      earned += Math.floor(maxHp(s.wall) * REWARD_PER_HEALTH * CompanyEngine.inflation(c));
      // A ticket every fifth wall (493): tickets now draw cats as well as weapons.
      if (s.wall % 5 == 0 && c.weaponTickets < Integer.MAX_VALUE) c.weaponTickets++;
      s.wall++;
      s.damage = s.nextDamage;
      s.nextDamage = s.afterNextDamage;
      s.afterNextDamage = 0;
      if (s.wall % 10 == 6) {
        s.circuitSeconds = 4;
        s.hitCredits = new double[KINDS];
      }
    }
    s.earned += earned;
    c.capital += earned;
    c.yearRewards = CompanyEngine.plus(c.yearRewards, (long) earned);
  }

  /** Cat gacha (decisions.md 488, 493): one ticket for one cat. A duplicate levels it up. */
  void drawCat(CompanyState c, SeededRandom random) {
    CompanyState.Idle s = state(c);
    if (c.weaponTickets <= 0) {
      throw new InvalidRequestException("뽑기권이 없다");
    }
    c.weaponTickets--;
    s.catDraws++;
    int roll =
        random.forKey("cat-draw", s.catDraws).nextInt(java.util.Arrays.stream(CAT_WEIGHTS).sum());
    int cat = 0;
    while (roll >= CAT_WEIGHTS[cat]) roll -= CAT_WEIGHTS[cat++];
    String code = CATS.get(cat);
    if (s.cats.merge(code, 1, Integer::sum) == 1 && s.fielded.size() < FIELD_SLOTS) {
      s.fielded.add(code);
    }
  }

  /** 테스트판 (decisions.md 499번): 고른 벽 앞에 바로 선다. 그 벽은 새 벽이고 거래 정지와 쌓인 피해는 지운다. */
  void jump(CompanyState c, long wall) {
    CompanyState.Idle s = state(c);
    s.wall = Math.max(1, Math.min(MAX_JUMP_WALL, wall));
    s.damage = 0;
    s.nextDamage = 0;
    s.afterNextDamage = 0;
    s.circuitSeconds = 0;
    s.hitCredits = new double[KINDS];
  }

  static final long MAX_JUMP_WALL = 100_000;

  /** 테스트판 (499번): 고양이 여섯을 모두 그 레벨로 주고, 빈 출전 칸을 차례대로 채운다. */
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
   * A cat takes one copy of an owned weapon; null kind and grade take it off. The boss cat keeps
   * the copy it holds, so the last copy can only be taken from another cat.
   */
  void equipCat(CompanyState c, String code, String kind, String grade) {
    CompanyState.Idle s = state(c);
    if (!s.cats.containsKey(code)) throw new InvalidRequestException("가지지 않은 고양이다: " + code);
    s.catWeapons.remove(code);
    if (kind == null && grade == null) return;
    CompanyState.Weapon owned =
        c.weapons == null
            ? null
            : c.weapons.stream().filter(w -> w.same(kind, grade)).findFirst().orElse(null);
    if (owned == null) throw new InvalidRequestException("가지지 않은 무기다: " + kind + " " + grade);
    int free = owned.count - (c.weapon != null && c.weapon.same(kind, grade) ? 1 : 0);
    if (free < 1) throw new InvalidRequestException("사장냥이 들고 있는 무기다. 같은 무기가 하나 더 있어야 한다");
    s.catWeapons.put(code, new CompanyState.Weapon(kind, grade));
    releaseWeapons(c);
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
                      (int) Math.round(100 * power(Math.max(1, level)) * CAT_DAMAGE[cat]),
                      (int) Math.round(100 * CAT_FIRE[cat]),
                      (int) Math.round(100 * CAT_CRITICAL[cat]),
                      s.fielded.contains(code),
                      weapon == null ? null : new CompanyView.CatWeapon(weapon.kind, weapon.grade),
                      CODES[CAT_SKILL[cat]],
                      NAMES[CAT_SKILL[cat]],
                      skillLevel(Math.max(1, level)),
                      nextSkillAt(Math.max(1, level)));
                })
            .toList();
    return new CompanyView.Idle(
        s.wall,
        Math.max(0, maxHp(s.wall) - s.damage),
        maxHp(s.wall),
        dps(c),
        CompanyView.money(s.earned),
        s.wall % 10 == 0,
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
            .toList());
  }
}
