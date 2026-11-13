package investorgame.raising.internal;

import investorgame.common.error.InvalidRequestException;
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
    return c.idle;
  }

  void beat(CompanyState c, String runId, long sequence, String action) {
    CompanyState.Idle s = state(c);
    long now = clock.millis();
    if ("start".equals(action)) {
      if (runId.equals(s.runId)) return; // Retried start must never reset the sequence.
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
      return;
    }
    long elapsed = now - s.lastBeat;
    if (s.lastBeat > 0 && elapsed > 0 && elapsed <= 3000 && serverId.equals(s.serverId)) {
      double seconds = elapsed / 1000.0 * SPEED;
      double attackSeconds = Math.max(0, seconds - s.circuitSeconds);
      double extra = 0;
      boolean explosive =
          engine.mental.weaponViews(c).stream().anyMatch(w -> w.equipped() && w.power() >= 2);
      double near = explosive ? s.dps * 0.5 : 0;
      double far = 0;
      for (int i = 0; i < UNLOCKS.length; i++) {
        if (s.wall <= UNLOCKS[i]) continue;
        double casts =
            Math.floor((s.activeSeconds + attackSeconds) / COOLDOWNS[i])
                - Math.floor(s.activeSeconds / COOLDOWNS[i]);
        double skillDamage = casts * s.dps * COOLDOWNS[i] * 0.25;
        extra += skillDamage;
        if (attackSeconds > 0 && i <= 1) near += skillDamage * 0.5 / attackSeconds;
        if (attackSeconds > 0 && i == 1) far += skillDamage * 0.25 / attackSeconds;
      }
      advance(c, seconds, s.dps + (attackSeconds > 0 ? extra / attackSeconds : 0), near, far);
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

  void advance(CompanyState c, double seconds, double power) {
    advance(c, seconds, power, 0, 0);
  }

  // Upcoming walls retain splash damage, but only the front wall can pay a reward.
  void advance(CompanyState c, double seconds, double power, double near, double far) {
    CompanyState.Idle s = state(c);
    double activeSeconds = 0;
    long earned = 0;
    int cleared = 0;
    while ((seconds > 0 || (s.circuitSeconds == 0 && s.damage >= maxHp(s.wall)))
        && cleared < 1000) {
      if (s.circuitSeconds > 0) {
        double stopped = Math.min(seconds, s.circuitSeconds);
        s.circuitSeconds -= stopped;
        seconds -= stopped;
        continue;
      }
      double remaining = Math.max(0, maxHp(s.wall) - s.damage);
      double attacking = Math.min(seconds, remaining / power);
      s.damage += attacking * power;
      s.nextDamage = Math.min(maxHp(s.wall + 1), s.nextDamage + attacking * near);
      s.afterNextDamage = Math.min(maxHp(s.wall + 2), s.afterNextDamage + attacking * far);
      seconds -= attacking;
      activeSeconds += attacking;
      if (s.damage + 1e-7 < maxHp(s.wall)) break;
      earned =
          CompanyEngine.plus(earned, (long) Math.min(1_000_000_000L, 100_000.0 + s.wall * 10_000));
      if (s.wall % 10 == 0 && c.weaponTickets < Integer.MAX_VALUE) c.weaponTickets++;
      s.wall++;
      s.damage = s.nextDamage;
      s.nextDamage = s.afterNextDamage;
      s.afterNextDamage = 0;
      cleared++;
      // Repeat the former mid-stage trading halt in the endless battle.
      if (s.wall % 10 == 6) s.circuitSeconds = 4;
    }
    // Trading halts freeze attack income and skill clocks as well as wall damage.
    s.activeSeconds += activeSeconds;
    double income = s.incomeRemainder + activeSeconds * 20_000;
    long attackIncome = (long) income;
    s.incomeRemainder = income - attackIncome;
    earned = CompanyEngine.plus(earned, attackIncome);
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
