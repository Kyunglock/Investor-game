package investorgame.raising.internal;

import investorgame.common.Korean;
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
  static final List<String> UPGRADES = List.of("damage", "fire", "hp");

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

  /**
   * 분기를 열 때: 장르를 시장 갈래의 가중치로만 섞어 뽑는다. 폭락이 터지는 분기면 디펜스가 자주 나오지만 꼭 나오지는 않아 숨은 값이 새지 않는다. 머리글은 장르의 것
   * 가운데 하나.
   */
  CompanyState.Mental create(CompanyState c, SeededRandom random) {
    RandomGenerator rng = random.forKey("mental", c.year, c.quarter);
    boolean burst =
        CompanyEngine.CRASH.equals(c.phase)
            && c.crashQuarter != null
            && c.crashQuarter == c.quarter;
    Map<String, Integer> weights = properties.mental().genreWeights().get(burst ? BURST : c.phase);
    int total = GENRES.stream().mapToInt(g -> weights.getOrDefault(g, 0)).sum();
    int roll = rng.nextInt(total);
    CompanyState.Mental mental = new CompanyState.Mental();
    for (String genre : GENRES) {
      roll -= weights.getOrDefault(genre, 0);
      if (roll < 0) {
        mental.genre = genre;
        break;
      }
    }
    List<String> headlines = text().headlines().get(mental.genre);
    mental.headline = headlines.get(rng.nextInt(headlines.size()));
    return mental;
  }

  /**
   * 멘탈 전투 전에 연 분기(이 칸이 없다)면 이번 분기의 전투를 만들고, 무기 전에 차린 회사면 일반 권총을, 무기 뽑기 전에 차린 회사면 처음 뽑기권을 준다. 바꿨으면
   * true.
   */
  boolean adopt(CompanyState c, SeededRandom random) {
    boolean changed = initWeapons(c) | initWeaponGacha(c);
    if (c.mental != null) {
      return changed;
    }
    c.mental = create(c, random);
    return true;
  }

  /** 무기가 없는 회사에 일반 권총 하나를 주고 들게 한다 (346번). 줬으면 true. */
  boolean initWeapons(CompanyState c) {
    // 출시 전 무기 저장은 변환하지 않고 초기화한다. 회사의 나머지 진행은 보존한다.
    if (needsWeaponReset(c)) {
      c.weapons = null;
      c.weapon = null;
      c.lastWeaponDraw = null;
      c.lastWeaponDrawNew = false;
      c.weaponDraws = 0;
      c.weaponTickets = properties.mental().weaponGacha().startTickets();
      c.weaponGachaReady = true;
    }
    if (c.weapons != null && !c.weapons.isEmpty() && c.weapon != null) {
      return false;
    }
    if (c.weapons == null || c.weapons.isEmpty()) {
      c.weapons =
          new ArrayList<>(List.of(new CompanyState.Weapon(PISTOL, WEAPON_GRADES.getFirst())));
    }
    c.weapon = c.weapons.getFirst();
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
    c.weaponTickets += properties.mental().weaponGacha().startTickets();
    return true;
  }

  /**
   * 무기 뽑기 (decisions.md 366번): 뽑기권 한 장으로 하나. 등급은 가중치로, 종류는 등급에 따라. 이미 가진 종류·등급이면 그 무기의 수가 하나 늘어 합성
   * 재료가 된다. 뽑기권이 없으면 400.
   */
  void drawWeapon(CompanyState c, SeededRandom random) {
    initWeapons(c);
    if (c.weaponTickets <= 0) {
      throw new InvalidRequestException("무기 뽑기권이 없다");
    }
    c.weaponTickets--;
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
  }

  /**
   * 무기 합성 (decisions.md 366번): 같은 무기(종류+등급) mergeCount개를 합쳐 한 등급 위의 등급에 해당하는 종류 하나로. 가장 높은 등급이거나
   * 모자라면 400. 들고 있던 무기를 다 썼으면 합쳐 만든 무기를 든다.
   */
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
    owned.count -= need;
    String up = WEAPON_GRADES.get(at + 1);
    String nextKind = kindOf(up);
    CompanyState.Weapon upgraded = find(c, nextKind, up);
    if (upgraded != null) {
      upgraded.count++;
    } else {
      upgraded = new CompanyState.Weapon(nextKind, up);
      c.weapons.add(upgraded);
    }
    if (owned.count == 0) {
      c.weapons.remove(owned);
      if (c.weapon != null && c.weapon.same(kind, grade)) {
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
   * 완만하게). long을 넘으면 Long.MAX_VALUE(못 산다).
   */
  long upgradePrice(int level) {
    CompanyProperties.Upgrades rule = properties.mental().upgrades();
    double growth = 1 + rule.priceGrowthPercent() / 100.0;
    return Math.round(rule.basePrice() * StrictMath.pow(growth, level));
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
    int max = properties.mental().upgrades().maxBatch();
    if (levels < 1 || levels > max) {
      throw new InvalidRequestException("한 번에 1~" + max + "단계까지 올린다: " + levels);
    }
    int level = c.battleLevels.getOrDefault(kind, 0);
    int bought = 0;
    while (bought < levels) {
      long price = upgradePrice(level + bought);
      if (c.capital < price) {
        break;
      }
      c.capital -= price;
      c.yearUpgrades += price;
      bought++;
    }
    if (bought == 0) {
      throw new InvalidRequestException("자본이 모자라다: " + upgradePrice(level) + "원 필요");
    }
    c.battleLevels.put(kind, level + bought);
    return bought;
  }

  /** 전투 강화의 화면 값 (367·394번): 강화마다 지금 단계·다음 값·효과. */
  List<CompanyView.BattleUpgrade> upgradeViews(CompanyState c) {
    CompanyProperties.Upgrades rule = properties.mental().upgrades();
    return UPGRADES.stream()
        .map(
            kind -> {
              int level = c.battleLevels.getOrDefault(kind, 0);
              int step = rule.stepPercent().getOrDefault(kind, 0);
              return new CompanyView.BattleUpgrade(
                  kind,
                  level,
                  upgradePrice(level),
                  rule.priceGrowthPercent(),
                  level * step,
                  (level + 1) * step);
            })
        .toList();
  }

  /** 무기 뽑기의 화면 값 (366번). */
  CompanyView.Armory armoryView(CompanyState c) {
    CompanyState.Weapon d = c.lastWeaponDraw;
    return new CompanyView.Armory(
        c.weaponTickets,
        properties.mental().weaponGacha().mergeCount(),
        d == null
            ? null
            : new CompanyView.WeaponDraw(
                d.kind,
                text().weapons().get(d.kind),
                d.grade,
                text().weaponGrades().get(d.grade),
                c.lastWeaponDrawNew));
  }

  /** 가진 무기 가운데 하나를 든다 (346번). 없는 종류·등급이거나 안 가진 무기면 400. */
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

  /**
   * 한 판 결과를 받는다: 레벨이 오를 때마다 고른 카드(처음 한 장 포함, 330번)와 물리친 적·남은 멘탈. 이번 분기가 아니거나 없는 카드면 400, 이미 받았으면
   * 그대로 둔다(같은 요청 두 번). 보고 값은 상한으로 자르고 강화율 = min(최대, 적 ÷ a + 멘탈 ÷ b). 무기는 떨어지지 않고, 무기 뽑기권을 받는다
   * (366번).
   */
  void report(
      CompanyState c,
      SeededRandom random,
      int year,
      int quarter,
      List<String> cards,
      int kills,
      int mentalLeft) {
    if (c.year != year || c.quarter != quarter) {
      throw new InvalidRequestException("이번 분기가 아니다: " + year + "년 " + quarter + "분기");
    }
    if (c.mental == null) {
      throw new InvalidRequestException("이번 분기에는 멘탈 전투가 없다");
    }
    for (String card : cards) {
      if (!text().cards().containsKey(card)) {
        throw new InvalidRequestException("없는 카드다: " + card);
      }
    }
    if (cards.isEmpty()) {
      throw new InvalidRequestException("카드를 한 장은 골라야 한다");
    }
    if (c.mental.cards != null) {
      return;
    }
    CompanyProperties.Mental rule = properties.mental();
    c.mental.cards = List.copyOf(cards);
    c.mental.kills = Math.clamp(kills, 0, rule.maxKills());
    c.mental.mentalLeft = Math.clamp(mentalLeft, 0, rule.maxMental());
    c.mental.bonusPercent =
        Math.min(
            rule.maxPercent(),
            c.mental.kills / rule.killsPerPercent()
                + c.mental.mentalLeft / rule.mentalPerPercent());
    c.weaponTickets += rule.weaponGacha().battleTickets();
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
   * 이번 분기 강화율(%) (369번): 깬 최고 스테이지 × bonusPerStage, 상한 maxBonus. 그 분기에 싸우지 않아도 매 분기 저절로 붙는다. 한 판
   * 결과로 매기던 것(328번)은 쓰지 않는다.
   */
  int bonusPercent(CompanyState c) {
    CompanyProperties.Stages rule = properties.mental().stages();
    return Math.min(rule.maxBonus(), bestStage(c) * rule.bonusPerStage());
  }

  /** 분기 실적 소식 줄. 깬 스테이지가 없으면 null. */
  String line(CompanyState c) {
    if (bonusPercent(c) == 0) {
      return null;
    }
    return Korean.fill(
        text().line(),
        Map.of(
            "stage", stageLabel(bestStage(c)),
            "percent", String.valueOf(bonusPercent(c))));
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
        r.tickets += stage % rule.perChapter() == 0 ? rule.bossTickets() : rule.clearTickets();
      }
      int before = c.stageStars.get(stage - 1);
      if (r.stars > before) {
        r.tickets += (r.stars - before) * rule.starTickets();
        c.stageStars.set(stage - 1, r.stars);
      }
      c.capital += r.capital;
      c.yearRewards += r.capital;
      c.weaponTickets += r.tickets;
    }
    c.lastStage = r;
  }

  /**
   * EX 디펜스 (369번): 분기에 한 번, 뽑기권 1 + 적 ÷ exKillsPerTicket장(상한 exMaxTickets). 이번 분기에 이미 했으면 보상 없이 그대로
   * 둔다.
   */
  void reportEx(CompanyState c, int kills) {
    if (c.mental == null) {
      throw new InvalidRequestException("이번 분기에는 멘탈 전투가 없다");
    }
    if (c.mental.exDone) {
      return;
    }
    CompanyProperties.Stages rule = properties.mental().stages();
    c.mental.exDone = true;
    CompanyState.StageResult r = new CompanyState.StageResult();
    r.cleared = true;
    r.tickets = Math.min(rule.exMaxTickets(), 1 + Math.max(0, kills) / rule.exKillsPerTicket());
    c.weaponTickets += r.tickets;
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
        r.tickets += stage % rule.perChapter() == 0 ? rule.bossTickets() : rule.clearTickets();
      }
      int before = c.assaultStars.get(stage - 1);
      if (r.stars > before) {
        r.tickets += (r.stars - before) * rule.starTickets();
        c.assaultStars.set(stage - 1, r.stars);
      }
      c.capital += r.capital;
      c.yearRewards += r.capital;
      c.weaponTickets += r.tickets;
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
                r.stage, r.cleared, r.stars, r.firstClear, r.capital, r.tickets));
  }

  /** 스테이지 화면 값 (369번). */
  CompanyView.Stages stagesView(CompanyState c) {
    CompanyProperties.Stages rule = properties.mental().stages();
    CompanyState.StageResult r = c.lastStage;
    return new CompanyView.Stages(
        bestStage(c),
        lastStage(),
        rule.perChapter(),
        c.stageStars == null ? List.of() : List.copyOf(c.stageStars),
        bonusPercent(c),
        c.mental != null && !c.mental.exDone,
        r == null
            ? null
            : new CompanyView.StageResult(
                r.stage, r.cleared, r.stars, r.firstClear, r.capital, r.tickets));
  }
}
