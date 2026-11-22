package investorgame.raising.internal;

import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.RaisingContent;
import investorgame.raising.CompanyView;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.random.RandomGenerator;

/**
 * 멘탈 전투 (decisions.md 328번). 분기마다 결산 직전에 멘탈 카드를 고르고 나쁜 투자 습관(패닉셀·투매·투기·손절매)을 쏘아 물리치는 한 판. 한 판은
 * 클라이언트가 돌리고, 서버는 장르·머리글을 정하고 결과를 한 번 받아 그 분기 강화율을 매긴다. 설계는
 * docs/superpowers/specs/2026-11-07-mental-battle-design.md.
 */
class MentalEngine {

  static final String ASSAULT = "ASSAULT";
  static final String DEFENSE = "DEFENSE";
  static final List<String> GENRES = List.of(ASSAULT, DEFENSE);

  /** 폭락이 터지는 분기의 가중치 열쇠. 시장 갈래(boom·normal·crash)와 나란히 쓴다. */
  static final String BURST = "burst";

  /** 무기 등급, 낮은 것부터 (346번). */
  static final List<String> WEAPON_GRADES =
      List.of("F", "E", "D", "C", "B", "A", "S", "SS", "SSS", "SR", "UR", "LR");

  /** 뽑기는 A까지. 상위 등급은 설정에 가중치가 들어가도 합성으로만 얻는다. */
  static final List<String> DRAW_GRADES = List.of("F", "E", "D", "C", "B", "A");

  /** 자본으로 사는 전투 강화 (367·394·410번): 공격력·연사·체력(최대 멘탈). 고양이 속도는 394번에서 뺐다. */
  static final List<String> UPGRADES = List.of("damage", "fire", "hp", "buy");

  /** 없앤 강화 (556번): 치명타 피해. 저장에 남은 단계는 쓴 돈을 돌려주고 지운다. */
  static final List<String> REMOVED_UPGRADES = List.of("crit");

  /** 처음 드는 무기: 일반 권총. */
  static final String PISTOL = "pistol";

  private final ContentCatalog content;
  private final CompanyProperties properties;

  MentalEngine(ContentCatalog content, CompanyProperties properties) {
    this.content = content;
    this.properties = properties;
  }

  private RaisingContent.Mental text() {
    return content.raising().company().mental();
  }

  /** 무기 전에 차린 회사면 일반 권총을, 무기 뽑기 전에 차린 회사면 처음 뽑기권을 준다. 바꿨으면 true. 분기마다 만들던 멘탈 전투는 없앴다 (523번). */
  boolean adopt(CompanyState c) {
    return initWeapons(c) | initWeaponGacha(c);
  }

  /** 무기가 없는 회사에 일반 권총 하나를 주고 들게 한다 (346번). 줬으면 true. */
  boolean initWeapons(CompanyState c) {
    // 출시 전 무기 저장은 변환하지 않고 초기화한다. 회사의 나머지 진행은 보존한다.
    if (needsWeaponReset(c)) {
      c.weapons = null;
      c.weapon = null;
      c.weaponOff = false;
      c.lastWeaponDraw = null;
      c.lastWeaponDrawNew = false;
      c.lastWeaponDraws = new ArrayList<>();
      c.weaponDraws = 0;
      c.weaponGachaReady = true;
    }
    // 사장냥이 무기를 뺀 회사 (585번)는 빈손 그대로 둔다.
    if (c.weapons != null && !c.weapons.isEmpty() && (c.weapon != null || c.weaponOff)) {
      return false;
    }
    if (c.weapons == null || c.weapons.isEmpty()) {
      c.weapons =
          new ArrayList<>(List.of(new CompanyState.Weapon(PISTOL, WEAPON_GRADES.getFirst())));
    }
    c.weapon = c.weapons.getFirst();
    c.weaponOff = false;
    return true;
  }

  boolean needsWeaponReset(CompanyState c) {
    return (c.weapons != null && c.weapons.stream().anyMatch(w -> !validWeapon(w.kind, w.grade)))
        || (c.weapon != null && !validWeapon(c.weapon.kind, c.weapon.grade))
        || (c.lastWeaponDraw != null
            && !validWeapon(c.lastWeaponDraw.kind, c.lastWeaponDraw.grade));
  }

  /** 무기 뽑기 전에 차린 회사(이 칸이 거짓)면 처음 무기 뽑기권을 준다 (366번). 줬으면 true. */
  boolean initWeaponGacha(CompanyState c) {
    if (c.weaponGachaReady) {
      return false;
    }
    c.weaponGachaReady = true;
    return true;
  }

  /**
   * 무기 뽑기 (decisions.md 366번): 뽑기권 한 장으로 하나. 등급은 가중치로, 종류는 등급에 따라. 이미 가진 종류·등급이면 그 무기의 수가 하나 늘어 합성
   * 재료가 된다. 뽑기권이 없으면 400.
   */
  void drawWeapon(CompanyState c, SeededRandom random) {
    drawWeapons(c, random, 1);
  }

  /** 무기 count개를 한꺼번에 뽑는다 (517번 10연속 뽑기). 뽑기권이 count장보다 적으면 하나도 뽑지 않고 400. */
  void drawWeapons(CompanyState c, SeededRandom random, int count) {
    initWeapons(c);
    if (count < 1) {
      throw new InvalidRequestException("뽑을 수가 1보다 작다");
    }
    // 다이아로 뽑는다 (526번): 한 번 100, 10연차는 1,000에 열한 개.
    CompanyEngine.spend(c, properties.diamonds().cost(count));
    List<CompanyState.Pulled> drawn = new ArrayList<>();
    for (int i = 0; i < properties.diamonds().items(count); i++) {
      drawn.add(drawOne(c, random));
    }
    c.lastWeaponDraws = drawn;
  }

  /** 무기 하나를 뽑는다. 값은 여기서 받지 않는다: 다이아 뽑기(526번)와 시즌패스의 무기 보상(529번)이 함께 쓴다. */
  CompanyState.Pulled drawOne(CompanyState c, SeededRandom random) {
    c.weaponDraws++;
    RandomGenerator rng = random.forKey("weapon-draw", c.weaponDraws);
    Map<String, Integer> weights = properties.mental().weaponGacha().gradeWeights();
    int total = DRAW_GRADES.stream().mapToInt(g -> weights.getOrDefault(g, 0)).sum();
    int roll = rng.nextInt(total);
    String grade = WEAPON_GRADES.getFirst();
    for (String g : DRAW_GRADES) {
      roll -= weights.getOrDefault(g, 0);
      if (roll < 0) {
        grade = g;
        break;
      }
    }
    String kind = kindOf(grade);
    CompanyState.Weapon owned = find(c, kind, grade);
    if (owned != null) {
      owned.count++;
    } else {
      c.weapons.add(new CompanyState.Weapon(kind, grade));
    }
    c.lastWeaponDraw = new CompanyState.Weapon(kind, grade);
    c.lastWeaponDrawNew = owned == null;
    return new CompanyState.Pulled(kind, grade, 0, owned == null);
  }

  /**
   * 무기 합성 (decisions.md 366번): 같은 무기(종류+등급) mergeCount개를 합쳐 한 등급 위의 등급에 해당하는 종류 하나로. 가장 높은 등급이거나
   * 모자라면 400. 들고 있던 무기를 다 썼으면 합쳐 만든 무기를 든다.
   */
  int mergeCount() {
    return properties.mental().weaponGacha().mergeCount();
  }

  void mergeWeapon(CompanyState c, String kind, String grade) {
    initWeapons(c);
    int at = WEAPON_GRADES.indexOf(grade);
    if (!validWeapon(kind, grade) || at < 0) {
      throw new InvalidRequestException("없는 무기다: " + kind + " " + grade);
    }
    if (at == WEAPON_GRADES.size() - 1) {
      throw new InvalidRequestException("가장 높은 등급이라 더 합칠 수 없다: " + kind + " " + grade);
    }
    int need = properties.mental().weaponGacha().mergeCount();
    CompanyState.Weapon owned = find(c, kind, grade);
    if (owned == null || owned.count < need) {
      throw new InvalidRequestException("같은 무기가 " + need + "개 있어야 합친다: " + kind + " " + grade);
    }
    promoteWeapons(c, owned, at, 1);
  }

  void promoteWeapons(CompanyState c, CompanyState.Weapon owned, int at, int batches) {
    owned.count -= batches * mergeCount();
    String up = WEAPON_GRADES.get(at + 1);
    String nextKind = kindOf(up);
    CompanyState.Weapon upgraded = find(c, nextKind, up);
    if (upgraded != null) {
      upgraded.count += batches;
    } else {
      upgraded = new CompanyState.Weapon(nextKind, up);
      upgraded.count = batches;
      c.weapons.add(upgraded);
    }
    if (owned.count == 0) {
      c.weapons.remove(owned);
      if (c.weapon != null && c.weapon.same(owned.kind, owned.grade)) {
        c.weapon = upgraded;
      }
    }
  }

  private static CompanyState.Weapon find(CompanyState c, String kind, String grade) {
    return c.weapons.stream().filter(w -> w.same(kind, grade)).findFirst().orElse(null);
  }

  private String kindOf(String grade) {
    return properties.mental().weaponGrades().get(grade).kind();
  }

  private boolean validWeapon(String kind, String grade) {
    return WEAPON_GRADES.contains(grade) && kindOf(grade).equals(kind);
  }

  /**
   * 전투 강화 level단계에서 다음 단계로 가는 값 (394번): 처음 basePrice, 단계마다 priceGrowthPercent%씩 오른다(끝없이 살 수 있게
   * 완만하게). 값은 단계로만 정한다: 벽의 물가(505번)는 곱하지 않는다 (519번). 수백 단계 뒤에는 long을 넘으므로 실수로 준다(소수 없는 수).
   */
  double upgradePrice(int level) {
    CompanyProperties.Upgrades rule = properties.mental().upgrades();
    double growth = 1 + rule.priceGrowthPercent() / 100.0;
    return Math.rint(rule.basePrice() * StrictMath.pow(growth, level));
  }

  /**
   * 자본으로 전투 강화를 levels단계까지 산다 (decisions.md 367·394번). 최대 단계는 없고, 자본이 닿는 데까지 한 단계씩 사서 산 단계 수를 돌려준다.
   * 없는 강화거나 한 단계도 못 사면 400. 쓴 돈은 올해 강화 비용으로 따로 적는다(분기 실적에서 인사 비용으로 읽히지 않게). 꾹 눌러 연속으로 올릴 때 화면이 모아 둔
   * 단계를 한 번에 보낸다.
   */
  int buyUpgrade(CompanyState c, String kind, int levels) {
    if (!UPGRADES.contains(kind)) {
      throw new InvalidRequestException("없는 강화다: " + kind);
    }
    if (c.closed) {
      throw new InvalidRequestException("끝난 회사다");
    }
    int batch = properties.mental().upgrades().maxBatch();
    if (levels < 1 || levels > batch) {
      throw new InvalidRequestException("한 번에 1~" + batch + "단계까지 올린다: " + levels);
    }
    int level = upgradeLevel(c, kind);
    int max = maxLevel(kind);
    if (level >= max) {
      throw new InvalidRequestException("더 올릴 수 없는 강화다: " + kind);
    }
    levels = Math.min(levels, max - level);
    int bought = 0;
    while (bought < levels) {
      double price = upgradePrice(level + bought);
      if (c.capital < price) {
        break;
      }
      c.capital -= price;
      bought++;
    }
    if (bought == 0) {
      throw new InvalidRequestException("자본이 모자라다");
    }
    c.battleLevels.put(kind, level + bought);
    return bought;
  }

  /** 지금 강화 곡선 (648번): 값이 단계마다 5% 오르고 한 단계 효과가 0.2%·매수 4주다. */
  static final int UPGRADE_CURVE = 648;

  /** 옛 곡선(1%·20주)의 한 단계는 지금 곡선의 다섯 단계와 효과가 같다. */
  static final int OLD_CURVE_LEVELS = 5;

  /** 옛 곡선으로 산 강화를 지금 곡선으로 옮겨야 하는가 (648번). */
  boolean needsUpgradeCurve(CompanyState c) {
    return c.upgradeCurve != UPGRADE_CURVE;
  }

  /**
   * 옛 곡선으로 산 강화를 지금 곡선으로 옮긴다 (648번). 효과가 같도록 단계를 다섯 배로 늘리되, 그 벽까지 벌 수 있는 돈으로 살 수 있는 단계(fairLevel)를
   * 넘지 않는다. 값 오름폭이 4%·8%이던 때(553·644번)에 산 단계는 지금 벽에 견주어 너무 많아, 그대로 두면 다음 단계 값이 영영 닿지 않는다. 넘친 단계의 돈은
   * 돌려주지 않는다(그때의 싼 값으로 산 것이다). 옮겼으면 true.
   */
  boolean adoptUpgradeCurve(CompanyState c) {
    if (!needsUpgradeCurve(c)) {
      return false;
    }
    int fair = fairLevel(c.idle == null ? 1 : c.idle.wall);
    for (String kind : UPGRADES) {
      int level = c.battleLevels.getOrDefault(kind, 0);
      if (level <= 0) {
        continue;
      }
      long scaled = (long) level * OLD_CURVE_LEVELS;
      c.battleLevels.put(kind, (int) Math.min(Math.min(scaled, fair), maxLevel(kind)));
    }
    c.upgradeCurve = UPGRADE_CURVE;
    return true;
  }

  /**
   * wall번째 벽까지 버는 돈(벽 보상의 세 배: 시간 수입과 보스 벽을 넉넉히 셈)으로 강화 한 종류를 올릴 수 있는 단계 (648번). 옛 저장을 옮길 때의 상한이다.
   */
  int fairLevel(long wall) {
    double earned = 0;
    double price = 1;
    for (long w = 1; w <= wall; w++) {
      earned += price;
      if (w < 6_000) price *= CompanyEngine.INFLATION;
    }
    earned *= 3 * IdleEngine.REWARD_UPGRADES * upgradePrice(0);
    double growth = 1 + properties.mental().upgrades().priceGrowthPercent() / 100.0;
    double levels = Math.log(1 + earned * (growth - 1) / upgradePrice(0)) / Math.log(growth);
    return (int) Math.min(Integer.MAX_VALUE, Math.floor(levels));
  }

  /** 없앤 강화의 단계가 저장에 남아 있는가 (556번). */
  boolean hasRemovedUpgrades(CompanyState c) {
    return REMOVED_UPGRADES.stream().anyMatch(c.battleLevels::containsKey);
  }

  /** 없앤 강화(556번)를 저장에서 지우고, 그 단계들을 살 때 쓴 돈을 자본으로 돌려준다. 지웠으면 true. */
  boolean refundRemovedUpgrades(CompanyState c) {
    boolean changed = false;
    for (String kind : REMOVED_UPGRADES) {
      Integer level = c.battleLevels.remove(kind);
      if (level == null) {
        continue;
      }
      for (int i = 0; i < level; i++) {
        c.capital += upgradePrice(i);
      }
      changed = true;
    }
    return changed;
  }

  /** 효과 상한(487번)에 닿는 단계. 상한이 없으면 Integer.MAX_VALUE. */
  private int maxLevel(String kind) {
    CompanyProperties.Upgrades rule = properties.mental().upgrades();
    Integer cap = rule.maxPercent().get(kind);
    return cap == null
        ? Integer.MAX_VALUE
        : (int) Math.floor(cap / rule.stepPercent().get(kind) + 1e-9);
  }

  /** 지금 단계. 상한이 생기기 전에 넘겨 산 단계는 상한으로 읽는다 (487번). */
  private int upgradeLevel(CompanyState c, String kind) {
    return Math.min(c.battleLevels.getOrDefault(kind, 0), maxLevel(kind));
  }

  /**
   * 영구 강화 (decisions.md 600번): 환생해서 얻은 생선으로 올리고 환생해도 남는다. 전투 강화의 효과에 그대로 더한다: 공격력·매수벽 체력은 한 단계에
   * FISH_STEP_PERCENT%, 매수벽 공격은 한 단계에 FISH_STEP_SHARES주.
   */
  static final List<String> FISH_UPGRADES = List.of("damage", "hp", "buy");

  // 처음의 10분의 1로 낮췄다가 (602번: 10%·100주는 너무 셌다) 세 배로 올렸다 (625번: 1%·10주는 환생의 보람이 없었다).
  // 644번에 1%로 낮췄다: 환생을 되풀이해 수백 단계가 쌓이면 화력이 수십 배가 되었다. 돈으로 사는 공격력 한 단계와 같다.
  static final int FISH_STEP_PERCENT = 1;
  static final int FISH_STEP_SHARES = 30;

  /** 영구 강화를 level에서 한 단계 올리는 값: 다음 단계의 번호만큼의 생선(1, 2, 3 …). */
  static long fishUpgradeCost(int level) {
    return level + 1L;
  }

  /** 영구 강화가 전투 강화에 더하는 양: buy는 주, 나머지는 %. 영구 강화가 없는 종류는 0. */
  private static int fishBonus(CompanyState c, String kind) {
    if (!FISH_UPGRADES.contains(kind)) return 0;
    return c.fishLevels.getOrDefault(kind, 0)
        * ("buy".equals(kind) ? FISH_STEP_SHARES : FISH_STEP_PERCENT);
  }

  List<CompanyView.FishUpgrade> fishUpgradeViews(CompanyState c) {
    return FISH_UPGRADES.stream()
        .map(
            kind -> {
              int level = c.fishLevels.getOrDefault(kind, 0);
              int step = "buy".equals(kind) ? FISH_STEP_SHARES : FISH_STEP_PERCENT;
              return new CompanyView.FishUpgrade(
                  kind, level, fishUpgradeCost(level), level * step, (level + 1) * step);
            })
        .toList();
  }

  /**
   * 전투 강화(%)에 영구 강화(%)를 곱해 얹는다 (636번): (1 + 전투 강화) × (1 + 영구 강화) − 1, 내림. 전에는 더하기만 해서 깊이 갈수록 돈으로 산
   * 강화(벽 1,000이면 +3,000%)에 묻혀 환생의 보람이 1%쯤이었다.
   */
  static int withFish(int percent, int fishPercent) {
    return (int) Math.min(Integer.MAX_VALUE, (100L + percent) * (100L + fishPercent) / 100 - 100);
  }

  /**
   * 소수 효과(648번: 한 단계 0.2%)에 영구 강화를 곱해 얹는다. 정수 효과의 withFish와 같은 셈이고, 소수 둘째 자리에서 내린다(0.2 × 3이
   * 0.6000…01로 보이지 않게).
   */
  static double withFish(double percent, int fishPercent) {
    double v = (100 + percent) * (100 + fishPercent) / 100 - 100;
    return Math.floor(v * 100 + 1e-6) / 100;
  }

  /** 전투 강화의 화면 값 (367·394번): 강화마다 지금 단계·다음 값·효과. 효과에는 영구 강화(600번)가 곱해져 있다(636번, 매수벽 공격의 주는 더한다). */
  List<CompanyView.BattleUpgrade> upgradeViews(CompanyState c) {
    CompanyProperties.Upgrades rule = properties.mental().upgrades();
    return UPGRADES.stream()
        .map(
            kind -> {
              int level = upgradeLevel(c, kind);
              double step = rule.stepPercent().getOrDefault(kind, 0.0);
              int max = maxLevel(kind);
              // 매수벽 공격은 %가 아니라 수량(주)으로 오른다 (579번).
              int shares = "buy".equals(kind) ? rule.buyStepShares() : 0;
              int fishPercent = "buy".equals(kind) ? 0 : fishBonus(c, kind);
              int fishShares = "buy".equals(kind) ? fishBonus(c, kind) : 0;
              return new CompanyView.BattleUpgrade(
                  kind,
                  level,
                  CompanyView.money(upgradePrice(level)),
                  rule.priceGrowthPercent(),
                  withFish(level * step, fishPercent),
                  withFish(Math.min(level + 1, max) * step, fishPercent),
                  level * shares + fishShares,
                  (level + 1) * shares + fishShares,
                  max == Integer.MAX_VALUE ? 0 : max);
            })
        .toList();
  }

  /** 무기 뽑기의 화면 값 (366번). */
  CompanyView.Armory armoryView(CompanyState c) {
    CompanyState.Weapon d = c.lastWeaponDraw;
    return new CompanyView.Armory(
        properties.mental().weaponGacha().mergeCount(),
        d == null
            ? null
            : new CompanyView.WeaponDraw(
                d.kind,
                text().weapons().get(d.kind),
                d.grade,
                text().weaponGrades().get(d.grade),
                c.lastWeaponDrawNew),
        (c.lastWeaponDraws == null ? List.<CompanyState.Pulled>of() : c.lastWeaponDraws)
            .stream()
                .filter(x -> validWeapon(x.kind, x.grade))
                .map(
                    x ->
                        new CompanyView.WeaponDraw(
                            x.kind,
                            text().weapons().get(x.kind),
                            x.grade,
                            text().weaponGrades().get(x.grade),
                            x.isNew))
                .toList());
  }

  /** 가진 무기 가운데 하나를 든다 (346번). 없는 종류·등급이거나 안 가진 무기면 400. */
  /** 테스트판 (decisions.md 499번): 그 등급의 무기를 count개 주고 사장냥이 든다. 없는 등급이면 400. */
  void grant(CompanyState c, String grade, int count) {
    initWeapons(c);
    if (!WEAPON_GRADES.contains(grade)) {
      throw new InvalidRequestException("없는 무기 등급이다: " + grade);
    }
    String kind = kindOf(grade);
    CompanyState.Weapon owned = find(c, kind, grade);
    if (owned != null) {
      owned.count += count;
    } else {
      CompanyState.Weapon weapon = new CompanyState.Weapon(kind, grade);
      weapon.count = count;
      c.weapons.add(weapon);
    }
    equip(c, kind, grade);
  }

  void equip(CompanyState c, String kind, String grade) {
    initWeapons(c);
    if (!validWeapon(kind, grade)) {
      throw new InvalidRequestException("없는 무기다: " + kind + " " + grade);
    }
    CompanyState.Weapon owned =
        c.weapons.stream().filter(w -> w.same(kind, grade)).findFirst().orElse(null);
    if (owned == null) {
      throw new InvalidRequestException("가지지 않은 무기다: " + kind + " " + grade);
    }
    c.weapon = owned;
    c.weaponOff = false;
  }

  /** 사장냥이 든 무기를 뺀다 (585번): 무기 없는 고양이처럼 기본 권총(F 권총)을 쏜다. 이미 뺐으면 그대로다. */
  void unequip(CompanyState c) {
    initWeapons(c);
    c.weapon = null;
    c.weaponOff = true;
  }

  /** 가진 무기의 화면 값 (346번): 등급을 더한 최종 수치와 든 것 표시. 무기 전에 차린 회사는 불러올 때 권총을 받는다(adopt). */
  List<CompanyView.Weapon> weaponViews(CompanyState c) {
    if (c.weapons == null) {
      return List.of();
    }
    return c.weapons.stream()
        .map(
            w -> {
              CompanyProperties.Weapon s = stats(w.kind, w.grade);
              return new CompanyView.Weapon(
                  w.kind,
                  text().weapons().get(w.kind),
                  w.grade,
                  text().weaponGrades().get(w.grade),
                  s.damagePercent(),
                  s.fireMs(),
                  s.power(),
                  s.bulletSpeed(),
                  c.weapon != null && c.weapon.same(w.kind, w.grade),
                  Math.max(1, w.count));
            })
        .toList();
  }

  /** 무기 종류의 이름. */
  String weaponName(String kind) {
    return text().weapons().get(kind);
  }

  /** 등급을 더한 최종 수치. */
  CompanyProperties.Weapon stats(String kind, String grade) {
    CompanyProperties.Weapon base = properties.mental().weapons().get(kind);
    CompanyProperties.WeaponGrade g = properties.mental().weaponGrades().get(grade);
    return new CompanyProperties.Weapon(
        base.damagePercent() * (100 + g.damagePercent()) / 100,
        Math.max(60, base.fireMs() * (100 - g.firePercent()) / 100),
        base.power(),
        base.bulletSpeed());
  }

  /** 깬 최고 스테이지 (369번). 0이면 아직 없다. */
  int bestStage(CompanyState c) {
    return c.stageStars == null ? 0 : c.stageStars.size();
  }

  /** 마지막 스테이지 (407번): 챕터 수 × 챕터당 스테이지 수. 챕터 보스를 깨면 다음 챕터의 첫 스테이지가 열린다. */
  int lastStage() {
    CompanyProperties.Stages rule = properties.mental().stages();
    return rule.perChapter() * rule.chapters();
  }

  /** 스테이지 이름: 챕터-번호 (예: 1-3). */
  String stageLabel(int stage) {
    int per = properties.mental().stages().perChapter();
    return ((stage - 1) / per + 1) + "-" + ((stage - 1) % per + 1);
  }

  /**
   * 멘탈 보호 보너스(%) (369번): 깬 최고 스테이지 × bonusPerStage, 상한 maxBonus. 회사의 초당 수입에 곱한다 (523번, 전에는 분기 실적에
   * 붙었다).
   */
  int bonusPercent(CompanyState c) {
    CompanyProperties.Stages rule = properties.mental().stages();
    return Math.min(rule.maxBonus(), bestStage(c) * rule.bonusPerStage());
  }

  /**
   * 멘탈 스테이지 한 판의 결과 (decisions.md 369번). 열린 스테이지(1 ~ 깬 최고 + 1, 마지막 스테이지(407번: 챕터 수 × 챕터당)까지)만 받는다.
   * 깼으면: 처음이면 자본(번호 × capitalPerStage)과 뽑기권(보스면 더), 별이 전보다 많으면 늘어난 별마다 뽑기권. 받은 자본은 올해 스테이지 보상으로 따로
   * 적는다. 못 깼으면 보상 없이 결과만 남긴다.
   */
  void reportStage(CompanyState c, int stage, boolean cleared, int stars) {
    CompanyProperties.Stages rule = properties.mental().stages();
    int best = bestStage(c);
    if (stage < 1 || stage > Math.min(best + 1, lastStage())) {
      throw new InvalidRequestException("아직 열리지 않은 스테이지다: " + stage);
    }
    if (c.closed) {
      throw new InvalidRequestException("끝난 회사다");
    }
    CompanyState.StageResult r = new CompanyState.StageResult();
    r.stage = stage;
    r.cleared = cleared;
    r.stars = cleared ? Math.clamp(stars, 1, 3) : 0;
    if (cleared) {
      if (stage == best + 1) {
        c.stageStars.add(0);
        r.firstClear = true;
        r.capital = stage * rule.capitalPerStage();
      }
      int before = c.stageStars.get(stage - 1);
      if (r.stars > before) {
        // 별을 처음 얻을 때마다 다이아 (526번): 이미 얻은 별은 다시 깨도 주지 않는다.
        r.diamonds = properties.diamonds().forStars(stage, before, r.stars);
        c.stageStars.set(stage - 1, r.stars);
      }
      c.capital += r.capital;
      c.diamonds += r.diamonds;
    }
    c.lastStage = r;
  }

  /**
   * EX 디펜스 (369번): 하루에 한 번(한국 시간 자정에 다시 열린다, 523번. 전에는 분기에 한 번), 뽑기권 1 + 적 ÷ exKillsPerTicket장(상한
   * exMaxTickets). 오늘 이미 했으면 보상 없이 그대로 둔다.
   */
  void reportEx(CompanyState c, int kills, String today) {
    if (today.equals(c.exDay)) {
      return;
    }
    c.exDay = today;
    CompanyState.StageResult r = new CompanyState.StageResult();
    r.cleared = true;
    r.diamonds = properties.diamonds().ex();
    c.diamonds += r.diamonds;
    c.lastStage = r;
  }

  /** 깬 최고 매도벽 돌파 스테이지 (#698). 0이면 아직 없다. */
  int bestAssault(CompanyState c) {
    return c.assaultStars == null ? 0 : c.assaultStars.size();
  }

  /**
   * 매도벽 돌파 스테이지 한 판의 결과 (#698): 주 게임. 멘탈 스테이지(369번)와 따로 진행하며, 열린 스테이지(1 ~ 깬 최고 + 1, 마지막 스테이지까지)만
   * 받는다. 보상 규칙은 멘탈 스테이지와 같다: 처음 깨면 자본(번호 × capitalPerStage)과 무기 뽑기권(챕터 끝이면 더), 별이 전보다 많으면 늘어난 별마다
   * 뽑기권. 분기 강화율(bonusPercent)에는 들어가지 않는다.
   */
  void reportAssault(CompanyState c, int stage, boolean cleared, int stars) {
    CompanyProperties.Stages rule = properties.mental().stages();
    if (c.assaultStars == null) {
      c.assaultStars = new java.util.ArrayList<>();
    }
    int best = bestAssault(c);
    if (stage < 1 || stage > Math.min(best + 1, lastStage())) {
      throw new InvalidRequestException("아직 열리지 않은 매도벽 돌파 스테이지다: " + stage);
    }
    if (c.closed) {
      throw new InvalidRequestException("끝난 회사다");
    }
    CompanyState.StageResult r = new CompanyState.StageResult();
    r.stage = stage;
    r.cleared = cleared;
    r.stars = cleared ? Math.clamp(stars, 1, 3) : 0;
    if (cleared) {
      if (stage == best + 1) {
        c.assaultStars.add(0);
        r.firstClear = true;
        r.capital = stage * rule.capitalPerStage();
      }
      int before = c.assaultStars.get(stage - 1);
      if (r.stars > before) {
        c.assaultStars.set(stage - 1, r.stars);
      }
      c.capital += r.capital;
    }
    c.lastAssault = r;
  }

  /** 매도벽 돌파 스테이지 화면 값 (#698). */
  CompanyView.Assaults assaultsView(CompanyState c) {
    CompanyProperties.Stages rule = properties.mental().stages();
    CompanyState.StageResult r = c.lastAssault;
    return new CompanyView.Assaults(
        bestAssault(c),
        lastStage(),
        rule.perChapter(),
        c.assaultStars == null ? List.of() : List.copyOf(c.assaultStars),
        r == null
            ? null
            : new CompanyView.StageResult(
                r.stage, r.cleared, r.stars, r.firstClear, r.capital, r.diamonds));
  }

  /** 스테이지 화면 값 (369번). */
  private static final int MAX_STARS = 3;

  CompanyView.Stages stagesView(CompanyState c, String today) {
    CompanyProperties.Stages rule = properties.mental().stages();
    CompanyState.StageResult r = c.lastStage;
    List<Integer> stars = c.stageStars == null ? List.of() : List.copyOf(c.stageStars);
    // 스테이지마다 아직 받을 수 있는 다이아 (527번): 얻지 않은 별의 몫. 다 받았으면 0.
    List<Long> remaining = new ArrayList<>();
    for (int stage = 1; stage <= lastStage(); stage++) {
      int earned = stage <= stars.size() ? stars.get(stage - 1) : 0;
      remaining.add(properties.diamonds().forStars(stage, earned, MAX_STARS));
    }
    return new CompanyView.Stages(
        bestStage(c),
        lastStage(),
        rule.perChapter(),
        stars,
        bonusPercent(c),
        !today.equals(c.exDay),
        remaining,
        properties.diamonds().ex(),
        r == null
            ? null
            : new CompanyView.StageResult(
                r.stage, r.cleared, r.stars, r.firstClear, r.capital, r.diamonds));
  }
}
