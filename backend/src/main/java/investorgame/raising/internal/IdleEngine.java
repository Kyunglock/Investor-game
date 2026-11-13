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
  // Attack kinds after the bullet (kind 0). Water and bolt unlock by wall; meteor and ram belong
  // to the cat of the same code and work only while that cat is fielded (decisions.md 488).
  private static final long[] UNLOCKS = {5, 15, 30, 50};
  // The acquired skills are level 1 in the renderer (mental/magic.ts).
  private static final double[] COOLDOWNS = {2.4, 3.6, 2.6, 3.6};
  private static final double[] SKILL_DAMAGE = {1.5, 4.8, 2.5, 1.2 * 3.4};
  private static final String[] CODES = {"water", "meteor", "bolt", "ram"};
  private static final String[] NAMES = {"물 스킬", "메테오 고양이", "번개 스킬", "충차 고양이"};
  private static final List<String> CATS = List.of("meteor", "ram");
  private static final long CAT_PRICE = 3_000_000;
  private static final double CAT_PRICE_GROWTH = 1.5;
  // A duplicate draw raises the cat's level: its own gun hits this much harder per level.
  private static final double CAT_LEVEL_BONUS = 0.1;
  // Matches weaponEffects.ts: revolver 3x, every other weapon 2x (decisions.md 487).
  private static final double REVOLVER_CRITICAL = 3;
  private static final double CRITICAL = 2;

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
      // Cats used to join at walls 15 and 50. Keep the ones already earned.
      c.idle.cats = new LinkedHashMap<>();
      for (String code : CATS) {
        if (c.idle.wall > UNLOCKS[List.of(CODES).indexOf(code)]) {
          c.idle.cats.put(code, 1);
          c.idle.fielded.add(code);
        }
      }
    }
    return c.idle;
  }

  private static boolean owned(CompanyState.Idle s, int skill, long wall) {
    return CATS.contains(CODES[skill]) ? s.fielded.contains(CODES[skill]) : wall > UNLOCKS[skill];
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
      double level = 1 + CAT_LEVEL_BONUS * (s.cats.get(code) - 1);
      shooters.add(shooter(s.catWeapons.get(code), damageUp * level, fireUp, criticalUp));
    }
    return shooters;
  }

  /** A cat without a gun, and a company from before weapons, shoots the starting pistol. */
  private Shooter shooter(
      CompanyState.Weapon weapon, double damageUp, double fireUp, double criticalUp) {
    String kind = weapon == null ? MentalEngine.PISTOL : weapon.kind;
    CompanyProperties.Weapon stats =
        engine.mental.stats(
            kind, weapon == null ? MentalEngine.WEAPON_GRADES.getFirst() : weapon.grade);
    return new Shooter(
        Math.max(1, Math.min(1_000_000_000, stats.damagePercent() / 100.0 * damageUp)),
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
    return (120 + 24.0 * (wall - 1)) * (wall % 10 == 0 ? 4 : 1);
  }

  private double dps(CompanyState c) {
    CompanyState.Idle s = state(c);
    List<Shooter> shooters = shooters(c);
    double total = 0;
    for (Shooter shooter : shooters) {
      total += shooter.damage() * shooter.perSecond() * shooter.power() / 1.25;
    }
    for (int i = 0; i < CODES.length; i++) {
      if (owned(s, i, s.wall)) {
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
    double income = s.incomeRemainder + active * 20_000;
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
      bulletMax = Math.max(bulletMax, shooter.damage() * shooter.power() * shooter.critical());
      bulletsPerSecond += shooter.perSecond();
    }
    long front = s.wall;
    for (int kind = 0; kind < 5 && active > 0; kind++) {
      if (kind > 0 && !owned(s, kind - 1, front)) continue;
      double damage = hero.damage() * (kind == 0 ? hero.power() : SKILL_DAMAGE[kind - 1]);
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
      s.nextDamage = Math.min(maxHp(front + 1), s.nextDamage + amounts[1]);
      s.afterNextDamage = Math.min(maxHp(front + 2), s.afterNextDamage + amounts[2]);
    }
    // Pay only for contacted walls in order. No leftover DPS rolls into an untouched new wall.
    while (s.circuitSeconds == 0 && s.damage + 1e-7 >= maxHp(s.wall)) {
      earned =
          CompanyEngine.plus(earned, (long) Math.min(1_000_000_000L, 100_000.0 + s.wall * 10_000));
      if (s.wall % 10 == 0 && c.weaponTickets < Integer.MAX_VALUE) c.weaponTickets++;
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

  private static long catPrice(int draws) {
    return Math.round(CAT_PRICE * StrictMath.pow(CAT_PRICE_GROWTH, draws));
  }

  /** Cat gacha (decisions.md 488): pay capital for one random cat. A duplicate levels it up. */
  void drawCat(CompanyState c, SeededRandom random) {
    CompanyState.Idle s = state(c);
    long price = catPrice(s.catDraws);
    if (c.capital < price) {
      throw new InvalidRequestException("자본이 모자라다: " + price + "원 필요");
    }
    c.capital -= price;
    c.yearUpgrades += price;
    s.catDraws++;
    String code = CATS.get(random.forKey("cat-draw", s.catDraws).nextInt(CATS.size()));
    if (s.cats.merge(code, 1, Integer::sum) == 1) s.fielded.add(code);
  }

  void fieldCat(CompanyState c, String code, boolean fielded) {
    CompanyState.Idle s = state(c);
    if (!s.cats.containsKey(code)) throw new InvalidRequestException("가지지 않은 고양이다: " + code);
    s.fielded.remove(code);
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
            .filter(i -> !CATS.contains(CODES[i]))
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
                  CompanyState.Weapon weapon = s.catWeapons.get(code);
                  return new CompanyView.IdleCat(
                      code,
                      NAMES[List.of(CODES).indexOf(code)],
                      level,
                      (int) Math.round(CAT_LEVEL_BONUS * 100 * Math.max(0, level - 1)),
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
        catPrice(s.catDraws),
        s.circuitSeconds,
        List.of(
            new CompanyView.IdleWall(
                s.wall + 1, Math.max(0, maxHp(s.wall + 1) - s.nextDamage), maxHp(s.wall + 1)),
            new CompanyView.IdleWall(
                s.wall + 2,
                Math.max(0, maxHp(s.wall + 2) - s.afterNextDamage),
                maxHp(s.wall + 2))));
  }
}
