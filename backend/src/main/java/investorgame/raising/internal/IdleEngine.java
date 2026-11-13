package investorgame.raising.internal;

import investorgame.common.error.InvalidRequestException;
import investorgame.raising.CompanyService.IdleHit;
import investorgame.raising.CompanyView;
import java.time.Clock;
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
  private static final long[] UNLOCKS = {5, 15, 30, 50};
  // The acquired skills are level 1 in the renderer (mental/magic.ts).
  private static final double[] COOLDOWNS = {2.4, 3.6, 2.6, 3.6};
  private static final double[] SKILL_DAMAGE = {1.5, 4.8, 2.5, 1.2 * 3.4};
  private static final String[] CODES = {"water", "meteor", "bolt", "ram"};
  private static final String[] NAMES = {"물 스킬", "메테오 고양이", "번개 스킬", "충차 고양이"};

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
    return c.idle;
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
      s.dps = baseDps(c);
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
    s.dps = baseDps(c);
  }

  static double maxHp(long wall) {
    return (120 + 24.0 * (wall - 1)) * (wall % 10 == 0 ? 4 : 1);
  }

  private double baseDps(CompanyState c) {
    double base =
        engine.mental.weaponViews(c).stream()
            .filter(CompanyView.Weapon::equipped)
            .mapToDouble(w -> w.damagePercent() / 100.0 * 1000 / w.fireMs())
            .findFirst()
            .orElse(1000.0 / 260);
    for (CompanyView.BattleUpgrade u : engine.mental.upgradeViews(c)) {
      if (!"hp".equals(u.kind())) base *= 1 + u.bonusPercent() / 100.0;
    }
    return Math.min(1_000_000_000, Math.max(1, base));
  }

  private double dps(CompanyState c) {
    long wall = state(c).wall;
    int casters = 1 + (wall > 15 ? 1 : 0) + (wall > 50 ? 1 : 0);
    double damage = bulletDamage(c);
    double total = baseDps(c) * bulletPower(c) / 1.25;
    for (int i = 0; i < UNLOCKS.length; i++) {
      if (wall > UNLOCKS[i]) total += damage * SKILL_DAMAGE[i] / COOLDOWNS[i];
    }
    return SPEED * casters * total;
  }

  private double bulletDamage(CompanyState c) {
    double damage =
        engine.mental.weaponViews(c).stream()
            .filter(CompanyView.Weapon::equipped)
            .mapToDouble(w -> w.damagePercent() / 100.0)
            .findFirst()
            .orElse(1);
    for (CompanyView.BattleUpgrade u : engine.mental.upgradeViews(c)) {
      if ("damage".equals(u.kind())) damage *= 1 + u.bonusPercent() / 100.0;
    }
    return Math.max(1, Math.min(1_000_000_000, damage));
  }

  private double bulletPower(CompanyState c) {
    return engine.mental.weaponViews(c).stream()
        .filter(CompanyView.Weapon::equipped)
        .mapToDouble(w -> 1 + Math.max(0, Math.min(3, w.power())) * 0.4)
        .findFirst()
        .orElse(1);
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
    boolean explosive =
        engine.mental.weaponViews(c).stream().anyMatch(w -> w.equipped() && w.power() >= 2);
    long front = s.wall;
    int casters = 1 + (front > 15 ? 1 : 0) + (front > 50 ? 1 : 0);
    double weaponDamage = bulletDamage(c);
    boolean critical =
        engine.mental.weaponViews(c).stream()
            .anyMatch(w -> w.equipped() && "revolver".equals(w.kind()));
    for (int kind = 0; kind < 5 && active > 0; kind++) {
      if (kind > 0 && front <= UNLOCKS[kind - 1]) continue;
      double damage = weaponDamage * (kind == 0 ? bulletPower(c) : SKILL_DAMAGE[kind - 1]);
      double maxDamage = damage * (kind == 0 && critical ? 3 : 1);
      double interval = (kind == 0 ? weaponDamage / s.dps : COOLDOWNS[kind - 1]) / casters;
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

  CompanyView.Idle view(CompanyState c) {
    CompanyState.Idle s = state(c);
    List<CompanyView.IdleSkill> skills =
        java.util.stream.IntStream.range(0, UNLOCKS.length)
            .mapToObj(
                i -> new CompanyView.IdleSkill(CODES[i], NAMES[i], UNLOCKS[i], s.wall > UNLOCKS[i]))
            .toList();
    long next =
        skills.stream()
            .filter(skill -> !skill.owned())
            .mapToLong(CompanyView.IdleSkill::unlockWall)
            .findFirst()
            .orElse(0);
    return new CompanyView.Idle(
        s.wall,
        Math.max(0, maxHp(s.wall) - s.damage),
        maxHp(s.wall),
        dps(c),
        s.earned,
        s.wall % 10 == 0,
        skills,
        next,
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
