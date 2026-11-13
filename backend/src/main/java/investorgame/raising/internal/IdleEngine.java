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
  private static final double[] COOLDOWNS = {3, 6, 4, 8};
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
    if (c.idle.hitVersion == 0) {
      // Old queued damage came from elapsed time, without any area contact.
      c.idle.nextDamage = 0;
      c.idle.afterNextDamage = 0;
      c.idle.damage = Math.min(c.idle.damage, maxHp(c.idle.wall) - 1);
      c.idle.hitVersion = 1;
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
            .mapToDouble(w -> 12.0 * w.damagePercent() / 100 * 1000 / w.fireMs())
            .findFirst()
            .orElse(12);
    for (CompanyView.BattleUpgrade u : engine.mental.upgradeViews(c)) {
      if (!"hp".equals(u.kind())) base *= 1 + u.bonusPercent() / 100.0;
    }
    return Math.min(1_000_000_000, Math.max(1, base));
  }

  private double dps(CompanyState c) {
    long owned = viewSkills(c).stream().filter(CompanyView.IdleSkill::owned).count();
    return SPEED * baseDps(c) * (1 + owned * 0.25);
  }

  private List<CompanyView.IdleSkill> viewSkills(CompanyState c) {
    long wall = state(c).wall;
    return java.util.stream.IntStream.range(0, UNLOCKS.length)
        .mapToObj(i -> new CompanyView.IdleSkill(CODES[i], NAMES[i], UNLOCKS[i], wall > UNLOCKS[i]))
        .toList();
  }

  private double bulletDamage(CompanyState c) {
    double damage =
        engine.mental.weaponViews(c).stream()
            .filter(CompanyView.Weapon::equipped)
            .mapToDouble(w -> 12.0 * w.damagePercent() / 100)
            .findFirst()
            .orElse(12);
    for (CompanyView.BattleUpgrade u : engine.mental.upgradeViews(c)) {
      if ("damage".equals(u.kind())) damage *= 1 + u.bonusPercent() / 100.0;
    }
    return Math.max(1, Math.min(1_000_000_000, damage));
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
    // Contact counts identify actual hits, never damage or rewards. Per-kind credits
    // bound them by server weapon stats and acquired skills; unused time alone cannot hurt a wall.
    boolean explosive =
        engine.mental.weaponViews(c).stream().anyMatch(w -> w.equipped() && w.power() >= 2);
    long front = s.wall;
    for (int kind = 0; kind < 5 && active > 0; kind++) {
      if (kind > 0 && front <= UNLOCKS[kind - 1]) continue;
      double damage = kind == 0 ? bulletDamage(c) : s.dps * COOLDOWNS[kind - 1] * 0.25;
      double interval = kind == 0 ? damage / s.dps : COOLDOWNS[kind - 1];
      s.hitCredits[kind] =
          Math.min(Math.max(2, 6 / interval), s.hitCredits[kind] + active / interval);
      String code = kind == 0 ? "bullet" : CODES[kind - 1];
      int[] counts = new int[3];
      for (IdleHit hit : hits) {
        if (hit == null || !code.equals(hit.kind()) || hit.count() <= 0) continue;
        long offset = hit.wall() - front;
        if (offset < 0 || offset > 2) continue;
        // Only actual area contacts may affect queued walls, and only with an owned area attack.
        if (offset > 0 && !(kind == 1 || kind == 2 || (kind == 0 && explosive))) continue;
        counts[(int) offset] = Math.min(1000, counts[(int) offset] + Math.min(1000, hit.count()));
      }
      int most = Math.max(counts[0], Math.max(counts[1], counts[2]));
      double accepted = Math.min(most, s.hitCredits[kind]);
      s.hitCredits[kind] -= accepted;
      s.damage += Math.min(counts[0], accepted) * damage;
      s.nextDamage =
          Math.min(maxHp(front + 1), s.nextDamage + Math.min(counts[1], accepted) * damage * 0.5);
      s.afterNextDamage =
          Math.min(
              maxHp(front + 2), s.afterNextDamage + Math.min(counts[2], accepted) * damage * 0.25);
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
