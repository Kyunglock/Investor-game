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
  // Attack kinds after the bullet (kind 0): skills, unlocked by wall. Cats are separate and only
  // add their own guns (decisions.md 488, 491).
  private static final long[] UNLOCKS = {5, 15, 30, 50};
  // The acquired skills are level 1 in the renderer (mental/magic.ts).
  private static final double[] COOLDOWNS = {2.4, 3.6, 2.6, 3.6};
  private static final double[] SKILL_DAMAGE = {1.5, 4.8, 2.5, 1.2 * 3.4};
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
      s.hitCredits = new double[5];
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
      s.hitCredits = new double[5];
      return;
    }
    long elapsed = now - s.lastBeat;
    if (s.lastBeat > 0 && elapsed > 0 && elapsed <= 3000 && serverId.equals(s.serverId)) {
      tick(c, elapsed / 1000.0 * SPEED, hits == null ? List.of() : hits);
    } else {
      s.hitCredits = new double[5];
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
    for (int i = 0; i < CODES.length; i++) {
      if (s.wall > UNLOCKS[i]) {
        total += shooters.size() * shooters.getFirst().damage() * SKILL_DAMAGE[i] / COOLDOWNS[i];
      }
    }
    return SPEED * total;
  }

  private void tick(CompanyState c, double seconds, List<IdleHit> hits) {
    CompanyState.Idle s = state(c);
    double stopped = Math.min(seconds, s.circuitSeconds);
    s.circuitSeconds -= stopped;
    double active = seconds - stopped;
    s.activeSeconds += active;
    double income =
        s.incomeRemainder + active * INCOME * (1 + INCOME_GROWTH * Math.min(s.wall - 1, 10_000));
    long earned = (long) income;
    s.incomeRemainder = income - earned;
    if (s.hitCredits == null || s.hitCredits.length != 5) s.hitCredits = new double[5];
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
      bulletsPerSecond += shooter.perSecond() / BULLET_WEIGHT;
    }
    long front = s.wall;
    double dealt = 0;
    for (int kind = 0; kind < 5 && active > 0; kind++) {
      if (kind > 0 && front <= UNLOCKS[kind - 1]) continue;
      double damage =
          hero.damage() * (kind == 0 ? BULLET_WEIGHT * hero.power() : SKILL_DAMAGE[kind - 1]);
      double maxDamage = kind == 0 ? bulletMax : damage;
      double interval = kind == 0 ? 1 / bulletsPerSecond : COOLDOWNS[kind - 1] / shooters.size();
      s.hitCredits[kind] =
          Math.min(Math.max(2, 6 / interval), s.hitCredits[kind] + active / interval);
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
    // What the walls really took lately, per active second: the stat shown next to the estimate.
    if (active > 0) s.wallDps += (dealt / active - s.wallDps) * Math.min(1, active / 10);
    // Pay only for contacted walls in order. No leftover DPS rolls into an untouched new wall.
    while (s.circuitSeconds == 0 && s.damage + 1e-7 >= maxHp(s.wall)) {
      earned =
          CompanyEngine.plus(
              earned, (long) Math.min(1_000_000_000_000L, maxHp(s.wall) * REWARD_PER_HEALTH));
      // A ticket every fifth wall (493): tickets now draw cats as well as weapons.
      if (s.wall % 5 == 0 && c.weaponTickets < Integer.MAX_VALUE) c.weaponTickets++;
      s.wall++;
      s.damage = s.nextDamage;
      s.nextDamage = s.afterNextDamage;
      s.afterNextDamage = 0;
      if (s.wall % 10 == 6) {
        s.circuitSeconds = 4;
        s.hitCredits = new double[5];
      }
    }
    s.earned = CompanyEngine.plus(s.earned, earned);
    c.capital = CompanyEngine.plus(c.capital, earned);
    c.yearRewards = CompanyEngine.plus(c.yearRewards, earned);
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

  void fieldCat(CompanyState c, String code, boolean fielded) {
    CompanyState.Idle s = state(c);
    if (!s.cats.containsKey(code)) throw new InvalidRequestException("가지지 않은 고양이다: " + code);
    s.fielded.remove(code);
    if (fielded && s.fielded.size() >= FIELD_SLOTS) {
      throw new InvalidRequestException("출전 칸이 꽉 찼다: " + FIELD_SLOTS + "마리까지 출전한다");
    }
    if (fielded) s.fielded.add(code);
    s.hitCredits = new double[5];
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
    List<CompanyView.IdleSkill> skills =
        java.util.stream.IntStream.range(0, CODES.length)
            .mapToObj(
                i -> new CompanyView.IdleSkill(CODES[i], NAMES[i], UNLOCKS[i], s.wall > UNLOCKS[i]))
            .toList();
    long next =
        skills.stream()
            .filter(skill -> !skill.owned())
            .mapToLong(CompanyView.IdleSkill::unlockWall)
            .findFirst()
            .orElse(0);
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
                      weapon == null ? null : new CompanyView.CatWeapon(weapon.kind, weapon.grade));
                })
            .toList();
    return new CompanyView.Idle(
        s.wall,
        Math.max(0, maxHp(s.wall) - s.damage),
        maxHp(s.wall),
        dps(c),
        s.earned,
        s.wall % 10 == 0,
        skills,
        next,
        cats,
        FIELD_SLOTS,
        SPEED * s.wallDps,
        s.circuitSeconds,
        List.of(
            new CompanyView.IdleWall(
                s.wall + 1, Math.max(0, maxHp(s.wall + 1) - s.nextDamage), maxHp(s.wall + 1)),
            new CompanyView.IdleWall(
                s.wall + 2, Math.max(0, maxHp(s.wall + 2) - s.afterNextDamage), maxHp(s.wall + 2))),
        s.sequence);
  }
}
