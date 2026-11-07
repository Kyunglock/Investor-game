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

  /** 멘탈 전투 전에 연 분기(이 칸이 없다)면 이번 분기의 전투를 만들고, 무기 전에 차린 회사면 일반 권총을 쥐여 준다. 바꿨으면 true. */
  boolean adopt(CompanyState c, SeededRandom random) {
    boolean changed = initWeapons(c);
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

  /** 떨어진 무기의 화면 값. 없으면 null. */
  CompanyView.Drop dropView(CompanyState c) {
    CompanyState.Weapon d = c.mental == null ? null : c.mental.drop;
    if (d == null) {
      return null;
    }
    return new CompanyView.Drop(
        d.kind,
        text().weapons().get(d.kind),
        d.grade,
        text().weaponGrades().get(d.grade),
        c.mental.dropNew);
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
                  s.streams(),
                  s.bulletSpeed(),
                  c.weapon != null && c.weapon.same(w.kind, w.grade));
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
        base.streams(),
        base.bulletSpeed());
  }

  /**
   * 한 판 결과에 무기가 떨어지는가 (346번): 확률 = min(최대, 적 × percentPerKill). 등급 가중치는 적 수 띠(low·mid·high)로, 종류는
   * 고르게. 이미 가진 종류·등급이면 새로 얻지 못한 것으로 적고 목록은 그대로다.
   */
  private void dropWeapon(CompanyState c, RandomGenerator rng) {
    CompanyProperties.Drop rule = properties.mental().drop();
    int chance = Math.min(rule.maxPercent(), c.mental.kills * rule.percentPerKill());
    if (rng.nextInt(100) >= chance) {
      return;
    }
    String band =
        c.mental.kills < rule.midKills()
            ? "low"
            : c.mental.kills < rule.highKills() ? "mid" : "high";
    Map<String, Integer> weights = rule.gradeWeights().get(band);
    int total = WEAPON_GRADES.stream().mapToInt(g -> weights.getOrDefault(g, 0)).sum();
    int roll = rng.nextInt(total);
    String picked = WEAPON_GRADES.getFirst();
    for (String g : WEAPON_GRADES) {
      roll -= weights.getOrDefault(g, 0);
      if (roll < 0) {
        picked = g;
        break;
      }
    }
    String grade = picked;
    List<String> kinds = properties.mental().weapons().keySet().stream().sorted().toList();
    String kind = kinds.get(rng.nextInt(kinds.size()));
    initWeapons(c);
    boolean owned = c.weapons.stream().anyMatch(w -> w.same(kind, grade));
    CompanyState.Weapon drop = new CompanyState.Weapon(kind, grade);
    c.mental.drop = drop;
    c.mental.dropNew = !owned;
    if (!owned) {
      c.weapons.add(drop);
    }
  }

  /**
   * 한 판 결과를 받는다: 레벨이 오를 때마다 고른 카드(처음 한 장 포함, 330번)와 물리친 적·남은 멘탈. 이번 분기가 아니거나 없는 카드면 400, 이미 받았으면
   * 그대로 둔다(같은 요청 두 번). 보고 값은 상한으로 자르고 강화율 = min(최대, 적 ÷ a + 멘탈 ÷ b). 그 뒤 무기가 떨어지는지 굴린다 (346번).
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
    dropWeapon(c, random.forKey("weapon", c.year, c.quarter));
  }

  /** 이번 분기 강화율(%). 치르지 않았거나 이 칸이 없던 분기면 0. */
  int bonusPercent(CompanyState c) {
    return c.mental == null || c.mental.cards == null ? 0 : c.mental.bonusPercent;
  }

  /** 분기 실적 소식 줄. 치르지 않았으면 null. */
  String line(CompanyState c) {
    if (bonusPercent(c) == 0) {
      return null;
    }
    return Korean.fill(
        text().line(),
        Map.of(
            "level", String.valueOf(c.mental.cards.size()),
            "cards", String.join("·", c.mental.cards.stream().map(text().cards()::get).toList()),
            "kills", String.valueOf(c.mental.kills),
            "left", String.valueOf(c.mental.mentalLeft),
            "percent", String.valueOf(c.mental.bonusPercent)));
  }
}
