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
  static final List<String> WEAPON_GRADES = List.of("N", "R", "SR", "UR");

  /** 자본으로 사는 전투 강화 (367번): 데미지·연사·고양이 속도. */
  static final List<String> UPGRADES = List.of("damage", "fire", "speed");

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
   * 무기 뽑기 (decisions.md 366번): 뽑기권 한 장으로 하나. 등급은 가중치로, 종류는 고르게. 이미 가진 종류·등급이면 그 무기의 수가 하나 늘어 합성 재료가
   * 된다. 뽑기권이 없으면 400.
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
    int total = WEAPON_GRADES.stream().mapToInt(g -> weights.getOrDefault(g, 0)).sum();
    int roll = rng.nextInt(total);
    String grade = WEAPON_GRADES.getFirst();
    for (String g : WEAPON_GRADES) {
      roll -= weights.getOrDefault(g, 0);
      if (roll < 0) {
        grade = g;
        break;
      }
    }
    List<String> kinds = properties.mental().weapons().keySet().stream().sorted().toList();
    String kind = kinds.get(rng.nextInt(kinds.size()));
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
   * 무기 합성 (decisions.md 366번): 같은 무기(종류+등급) mergeCount개를 합쳐 한 등급 위의 같은 종류 하나로. 가장 높은 등급이거나 모자라면
   * 400. 들고 있던 무기를 다 썼으면 합쳐 만든 무기를 든다.
   */
  void mergeWeapon(CompanyState c, String kind, String grade) {
    initWeapons(c);
    int at = WEAPON_GRADES.indexOf(grade);
    if (!properties.mental().weapons().containsKey(kind) || at < 0) {
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
    CompanyState.Weapon upgraded = find(c, kind, up);
    if (upgraded != null) {
      upgraded.count++;
    } else {
      upgraded = new CompanyState.Weapon(kind, up);
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

  /** 전투 강화 level단계에서 다음 단계로 가는 값 (367번): 처음 basePrice, 단계마다 priceFactor배. */
  long upgradePrice(int level) {
    CompanyProperties.Upgrades rule = properties.mental().upgrades();
    long price = rule.basePrice();
    for (int i = 0; i < level; i++) {
      price *= rule.priceFactor();
    }
    return price;
  }

  /**
   * 자본으로 전투 강화 한 단계를 산다 (decisions.md 367번). 없는 강화거나 다 올렸거나 자본이 모자라면 400. 쓴 돈은 올해 강화 비용으로 따로 적는다(분기
   * 실적에서 인사 비용으로 읽히지 않게).
   */
  void buyUpgrade(CompanyState c, String kind) {
    if (!UPGRADES.contains(kind)) {
      throw new InvalidRequestException("없는 강화다: " + kind);
    }
    if (c.finished || c.closed) {
      throw new InvalidRequestException("끝난 회사다");
    }
    int level = c.battleUpgrades.getOrDefault(kind, 0);
    if (level >= properties.mental().upgrades().maxLevel()) {
      throw new InvalidRequestException("이미 다 올렸다: " + kind);
    }
    long price = upgradePrice(level);
    if (c.capital < price) {
      throw new InvalidRequestException("자본이 모자라다: " + price + "원 필요");
    }
    c.capital -= price;
    c.yearUpgrades += price;
    c.battleUpgrades.put(kind, level + 1);
  }

  /** 전투 강화의 화면 값 (367번): 강화마다 지금 단계·값·효과. */
  List<CompanyView.BattleUpgrade> upgradeViews(CompanyState c) {
    CompanyProperties.Upgrades rule = properties.mental().upgrades();
    return UPGRADES.stream()
        .map(
            kind -> {
              int level = c.battleUpgrades.getOrDefault(kind, 0);
              int step = rule.stepPercent().getOrDefault(kind, 0);
              boolean max = level >= rule.maxLevel();
              return new CompanyView.BattleUpgrade(
                  kind,
                  level,
                  rule.maxLevel(),
                  max ? null : upgradePrice(level),
                  level * step,
                  max ? null : (level + 1) * step);
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
    if (!properties.mental().weapons().containsKey(kind) || !WEAPON_GRADES.contains(grade)) {
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
   * 멘탈 스테이지 한 판의 결과 (decisions.md 369번). 열린 스테이지(1 ~ 깬 최고 + 1, 마지막 스테이지까지)만 받는다. 깼으면: 처음이면 자본(번호 ×
   * capitalPerStage)과 뽑기권(보스면 더), 별이 전보다 많으면 늘어난 별마다 뽑기권. 받은 자본은 올해 스테이지 보상으로 따로 적는다. 못 깼으면 보상 없이
   * 결과만 남긴다.
   */
  void reportStage(CompanyState c, int stage, boolean cleared, int stars) {
    CompanyProperties.Stages rule = properties.mental().stages();
    int best = bestStage(c);
    if (stage < 1 || stage > Math.min(best + 1, rule.perChapter())) {
      throw new InvalidRequestException("아직 열리지 않은 스테이지다: " + stage);
    }
    if (c.finished || c.closed) {
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

  /** 스테이지 화면 값 (369번). */
  CompanyView.Stages stagesView(CompanyState c) {
    CompanyProperties.Stages rule = properties.mental().stages();
    CompanyState.StageResult r = c.lastStage;
    return new CompanyView.Stages(
        bestStage(c),
        rule.perChapter(),
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
