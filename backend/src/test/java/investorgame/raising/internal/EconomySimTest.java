package investorgame.raising.internal;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * 밸런스 시뮬레이션 (decisions.md 644번): 최적으로 플레이하는 한 사람의 N일. 뽑기·합성·강화·환생·영구 강화는 실제 엔진이 하고, 이 루프는 시간과 전투(벽
 * 체력 ÷ fieldDps)를 돌린다. 하루에 SIM_HOURS시간 화면을 켜 두고, 8시간 방치 수입을 받고, 출석·상점·시즌패스(25일에 마지막 단계)·금고 다이아(주 한
 * 번)·광고 뽑기(종류마다 하루 세 번)를 받는다. 한 벽이 30초를 넘으면 막힌 것으로 보고, 받을 생선이 지금까지 쓴 생선의 4분의 1을 넘으면 (광고 보고) 환생한다.
 *
 * <p>CI에서는 돌지 않는다. {@code SIM=1 ./gradlew test --tests '*EconomySimTest' -i --rerun}으로 돌리고,
 * SIM_SEEDS(뽑기 운, 기본 1)·SIM_DAYS(30)·SIM_HOURS(3)·SIM_ADS(1)·SIM_STUCK(30초)로 바꾼다. 출력은 "SIM "으로
 * 시작한다.
 */
@org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named = "SIM", matches = "1")
class EconomySimTest {
  static final CompanyProperties P = TestBehavior.bind("raising.company", CompanyProperties.class);

  final CompanyEngine company = new CompanyEngine(TestContent.load(), TestBehavior.create(), P);
  final IdleEngineTest.MutableClock clock = new IdleEngineTest.MutableClock();
  final IdleEngine idle = new IdleEngine(clock, company);
  final Method reward;

  EconomySimTest() throws Exception {
    reward = IdleEngine.class.getDeclaredMethod("reward", CompanyState.class);
    reward.setAccessible(true);
  }

  static int intProp(String k, int d) {
    return Integer.parseInt(System.getProperty(k, System.getenv().getOrDefault(k, "" + d)));
  }

  static final String[] GRADES = {"F", "E", "D", "C", "B", "A", "S", "SS", "SSS", "SR", "UR", "LR"};

  static String kind(String g) {
    return switch (g) {
      case "F", "E" -> "pistol";
      case "D" -> "revolver";
      case "C", "B" -> "smg";
      case "A" -> "shotgun";
      default -> "rifle";
    };
  }

  static int gi(String g) {
    return java.util.Arrays.asList(GRADES).indexOf(g);
  }

  Map<String, Long> got = new LinkedHashMap<>();

  void gain(CompanyState c, String source, long d) {
    c.diamonds += d;
    got.merge(source, d, Long::sum);
  }

  static double dbl(String k, double d) {
    return Double.parseDouble(System.getenv().getOrDefault(k, "" + d));
  }

  double stuckSec = 30;
  Map<Integer, Integer> reached = new LinkedHashMap<>();

  @Test
  void sim() throws Exception {
    System.out.printf(
        "SIM hp(401)=%.0f hp(1001)=%.0f hp(2001)=%.0f hp(5000)=%.0f hp(10001)=%.0f%n",
        IdleEngine.maxHp(401),
        IdleEngine.maxHp(1001),
        IdleEngine.maxHp(2001),
        IdleEngine.maxHp(5000),
        IdleEngine.maxHp(10001));
    stuckSec = dbl("SIM_STUCK", 30);
    System.out.printf(
        "SIM shares wall 101 %.0f | 1001 %.0f | 2001 %.0f | 5001 %.0f | 5000boss %.0f | 10001 %.0f %n",
        IdleEngine.SHARES_PER_HP * IdleEngine.maxHp(101),
        IdleEngine.SHARES_PER_HP * IdleEngine.maxHp(1001),
        IdleEngine.SHARES_PER_HP * IdleEngine.maxHp(2001),
        IdleEngine.SHARES_PER_HP * IdleEngine.maxHp(5001),
        IdleEngine.SHARES_PER_HP * IdleEngine.maxHp(5000),
        IdleEngine.SHARES_PER_HP * IdleEngine.maxHp(10001));
    int seeds = intProp("SIM_SEEDS", 1);
    for (int seed = 1; seed <= seeds; seed++) run(seed, seeds == 1);
  }

  void run(long seed, boolean verbose) throws Exception {
    got = new LinkedHashMap<>();
    reached = new LinkedHashMap<>();
    drawsCount = 0;
    int days = intProp("SIM_DAYS", 30);
    int hours = intProp("SIM_HOURS", 3);
    boolean ads = intProp("SIM_ADS", 1) == 1;
    var random = new HashSeededRandom(seed);
    clock.now = java.time.Instant.parse("2026-11-02T00:00:00Z").toEpochMilli();
    CompanyState c = company.open(random, company.openingCapital());
    company.mental.initWeapons(c);
    idle.view(c);
    CompanyState.Idle s = c.idle;
    long startDiamonds = c.diamonds;
    got.put("start", startDiamonds);
    int draws = 0;
    double wallTime = 0;
    double done = 0;
    long bossDiamonds = 0;
    int tick = 10;
    List<String> log = new ArrayList<>();
    for (int day = 1; day <= days; day++) {
      // Daily diamonds outside the fight.
      var att = P.attendance().days();
      gain(c, "attend", att.get((day - 1) % att.size()).diamonds());
      gain(
          c,
          "shop",
          P.shop().items().stream()
              .filter(i -> i.code().equals("free"))
              .findFirst()
              .orElseThrow()
              .giveDiamonds());
      gain(c, "pass", passDiamonds(day));
      if (day % 7 == 0) gain(c, "vault", VaultEngine.SHOP_DIAMONDS);
      if (ads) {
        for (int i = 0; i < 3; i++) {
          idle.drawCats(c, random, free(c));
          company.mental.drawWeapons(c, random, free(c));
        }
      }
      // Offline income (8 hours) once a day.
      c.capital += idle.perSecond(c) * 8 * 3600;
      for (int t = 0; t < hours * 3600; t += tick) {
        double dps = idle.fieldDps(c);
        double hp = IdleEngine.maxHp(s.wall);
        c.capital += idle.perSecond(c) * tick;
        boolean stuck = hp / dps > stuckSec;
        if (!stuck) {
          done += dps * tick;
          wallTime += tick;
          while (done >= IdleEngine.maxHp(s.wall)) {
            done -= IdleEngine.maxHp(s.wall);
            c.capital += (double) reward.invoke(idle, c);
            if (IdleEngine.bossWall(s.wall) && s.wall > s.bossCleared) {
              s.bossCleared = s.wall;
              gain(c, "boss", IdleEngine.BOSS_CLEAR_DIAMONDS);
            }
            s.best = Math.max(s.best, s.wall);
            for (int mark = 1000; mark <= 8000; mark += 1000)
              if (s.best >= mark) reached.putIfAbsent(mark, day);
            s.wall++;
            wallTime = 0;
          }
        } else {
          done = 0;
          // Stuck: rebirth when it pays (fish now >= a quarter of all fish spent so far).
          long fish = idle.rebirthFish(c) * (ads ? 3 : 1);
          if (fish > 0 && fish >= spentFish(c) / 4) {
            idle.rebirth(c, ads);
            spendFish(c);
          }
        }
        if (t % 60 == 0) manage(c, random);
      }
      if (verbose && (day <= 3 || day % 5 == 0 || day == days)) {
        log.add(
            String.format(
                "day %2d wall %5d best %5d reb %3d fish %4d/%4d/%4d dmgLv %5d dia %6d draws %5d weapon %s cats %s hp %.2e dps %.2e",
                day,
                s.wall,
                s.best,
                c.rebirths,
                c.fishLevels.getOrDefault("damage", 0),
                c.fishLevels.getOrDefault("hp", 0),
                c.fishLevels.getOrDefault("buy", 0),
                c.battleLevels.getOrDefault("damage", 0),
                c.diamonds,
                drawsCount,
                c.weapon.grade,
                s.fielded.stream().map(k -> IdleEngine.catGrade(k) + s.cats.get(k)).toList(),
                IdleEngine.maxHp(s.wall),
                idle.fieldDps(c)));
      }
    }
    log.forEach(l -> System.out.println("SIM " + l));
    breakdown(c);
    System.out.printf(
        "SIM seed %d: best %d reached(wall=day) %s rebirths %d fishDmg %d draws %d weapon %s cats %s diamonds %s total %d (per day %d)%n",
        seed,
        s.best,
        reached,
        c.rebirths,
        c.fishLevels.getOrDefault("damage", 0),
        drawsCount,
        c.weapon == null ? "-" : c.weapon.grade,
        s.fielded.stream().map(k -> IdleEngine.catGrade(k) + s.cats.get(k)).toList(),
        got,
        got.values().stream().mapToLong(x -> x).sum(),
        (got.values().stream().mapToLong(x -> x).sum() - startDiamonds) / days);
  }

  int drawsCount = 0;

  void breakdown(CompanyState c) {
    var json = tools.jackson.databind.json.JsonMapper.builder().build();
    try {
      double full = idle.fieldDps(c);
      CompanyState x = json.readValue(json.writeValueAsString(c), CompanyState.class);
      x.fishLevels.put("damage", 0);
      double noFish = idle.fieldDps(x);
      x = json.readValue(json.writeValueAsString(c), CompanyState.class);
      x.battleLevels.put("damage", 0);
      double noUp = idle.fieldDps(x);
      x = json.readValue(json.writeValueAsString(c), CompanyState.class);
      x.idle.fielded.clear();
      double bossOnly = idle.fieldDps(x);
      x = json.readValue(json.writeValueAsString(c), CompanyState.class);
      for (String k : x.idle.fielded) x.idle.cats.put(k, 1);
      double lv1 = idle.fieldDps(x);
      x = json.readValue(json.writeValueAsString(c), CompanyState.class);
      x.idle.catWeapons.clear();
      x.weapon = null;
      double noWeapons = idle.fieldDps(x);
      System.out.printf(
          "SIM breakdown full %.3e | x fish %.1f | x upgrade %.1f | x cats %.1f | x catLevels %.1f | x weapons %.1f%n",
          full, full / noFish, full / noUp, full / bossOnly, full / lv1, full / noWeapons);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  /** The free ad draw: one cat or weapon without diamonds (the server checks three a day). */
  int free(CompanyState c) {
    c.diamonds += P.diamonds().draw();
    drawsCount++;
    return 1;
  }

  long passDiamonds(int day) {
    // A dedicated player reaches the season's last step on day 25 (643): spread evenly.
    long season = 0;
    for (int step = 1; step <= P.pass().steps(); step++)
      season += company.pass.reward(step).diamonds();
    int seasonDay = (day - 1) % 28 + 1;
    return seasonDay <= 25 ? season / 25 : 0;
  }

  long spentFish(CompanyState c) {
    long total = 0;
    for (int lv : c.fishLevels.values()) total += (long) lv * (lv + 1) / 2;
    return total + c.fish;
  }

  void spendFish(CompanyState c) {
    // Damage first: two damage levels for each buy level, hp left out.
    while (true) {
      int d = c.fishLevels.getOrDefault("damage", 0);
      int b = c.fishLevels.getOrDefault("buy", 0);
      String k = d < 3 * (b + 1) ? "damage" : "buy";
      if (c.fish < MentalEngine.fishUpgradeCost(c.fishLevels.getOrDefault(k, 0))) {
        if (k.equals("buy") && c.fish >= MentalEngine.fishUpgradeCost(d)) k = "damage";
        else break;
      }
      idle.buyFishUpgrade(c, k);
    }
  }

  void manage(CompanyState c, HashSeededRandom random) {
    CompanyState.Idle s = c.idle;
    // Upgrades: the cheaper of attack and fire (fire stops at its maximum).
    int fireMax =
        (int)
            Math.round(
                P.mental().upgrades().maxPercent().get("fire")
                    / P.mental().upgrades().stepPercent().get("fire"));
    for (int i = 0; i < 50; i++) {
      int dl = c.battleLevels.getOrDefault("damage", 0);
      int fl = c.battleLevels.getOrDefault("fire", 0);
      String k = fl < fireMax && fl < dl ? "fire" : "damage";
      try {
        company.mental.buyUpgrade(c, k, 100);
      } catch (Exception e) {
        break;
      }
    }
    // Draws: ten at a time, cats and weapons in turn.
    while (c.diamonds >= P.diamonds().tenDraw()) {
      if (drawsCount / 11 % 2 == 0) idle.drawCats(c, random, 10);
      else company.mental.drawWeapons(c, random, 10);
      drawsCount += 11;
    }
    // Field the four strongest cats (grade, then level).
    List<String> best =
        s.cats.keySet().stream()
            .sorted(
                Comparator.comparingDouble(
                    (String k) -> -(gradeOf(k) * 10 + Math.pow(s.cats.get(k), 0.3))))
            .limit(4)
            .toList();
    s.fielded.clear();
    s.fielded.addAll(best);
    // Weapons: take everything off, merge, then hand out from the best down.
    s.catWeapons.clear();
    c.weapon = null;
    idle.mergeAllWeapons(c);
    List<String[]> pool = new ArrayList<>();
    for (var w : c.weapons)
      for (int i = 0; i < w.count; i++) pool.add(new String[] {w.kind, w.grade});
    pool.sort(Comparator.comparingInt((String[] w) -> -gi(w[1])));
    if (!pool.isEmpty()) company.mental.equip(c, pool.get(0)[0], pool.get(0)[1]);
    for (int i = 0; i < s.fielded.size() && i + 1 < pool.size(); i++) {
      try {
        idle.equipCat(c, s.fielded.get(i), pool.get(i + 1)[0], pool.get(i + 1)[1]);
      } catch (Exception e) {
        // no free copy
      }
    }
  }

  static int gradeOf(String code) {
    return IdleEngine.CAT_GRADES.indexOf(IdleEngine.catGrade(code));
  }
}
