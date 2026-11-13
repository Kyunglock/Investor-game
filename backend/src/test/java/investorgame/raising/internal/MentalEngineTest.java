package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import investorgame.raising.CompanyView;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 멘탈 전투 (decisions.md 328번, #420). 실제 콘텐츠와 application.yml 수치로 돌린다. */
class MentalEngineTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final CompanyEngine ENGINE =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);

  private static Map<String, Integer> stats(int value) {
    return Map.of(
        "insight", value, "patience", value, "courage", value, "conviction", value, "luck", value);
  }

  private static CompanyState company(long seed) {
    CompanyState company = new CompanyState();
    company.number = 2;
    company.capital = 150_000_000L;
    company.era = "plain";
    ENGINE.mental.initWeapons(company);
    ENGINE.startYear(company, new HashSeededRandom(seed));
    ENGINE.hire(company, stats(50));
    ENGINE.place(company, Map.of(1, "bio"));
    return company;
  }

  @Test
  void 분기마다_장르와_머리글이_오고_같은_시드면_같다() {
    for (int seed = 0; seed < 50; seed++) {
      CompanyState c = company(seed);
      assertThat(c.mental).isNotNull();
      assertThat(c.mental.genre).isIn(MentalEngine.GENRES);
      assertThat(c.mental.headline).isNotBlank();
      assertThat(c.mental.cards).isNull();
      CompanyState again = company(seed);
      assertThat(again.mental.genre).isEqualTo(c.mental.genre);
      assertThat(again.mental.headline).isEqualTo(c.mental.headline);
      String first = c.mental.genre;
      ENGINE.settleQuarter(c, new HashSeededRandom(seed));
      assertThat(c.quarter).isEqualTo(2);
      assertThat(c.mental.cards).as("새 분기면 새 전투").isNull();
      // 분기마다 다른 열쇠로 뽑으므로 늘 같은 장르가 나오지는 않는다(시드 50개 가운데 하나라도 바뀌면 된다).
      if (!first.equals(c.mental.genre)) {
        return;
      }
    }
    throw new AssertionError("분기가 바뀌어도 장르가 그대로다");
  }

  @Test
  void 폭락이_터지는_분기에는_디펜스가_잦다() {
    Map<String, Integer> burst = new HashMap<>();
    Map<String, Integer> calm = new HashMap<>();
    for (int seed = 0; seed < 600; seed++) {
      CompanyState c = company(seed);
      if (!CompanyEngine.CRASH.equals(c.phase)) {
        continue;
      }
      while (c.year == 1) {
        boolean bursting = c.crashQuarter != null && c.crashQuarter == c.quarter;
        (bursting ? burst : calm).merge(c.mental.genre, 1, Integer::sum);
        ENGINE.settleQuarter(c, new HashSeededRandom(seed));
      }
    }
    int burstTotal = burst.values().stream().mapToInt(Integer::intValue).sum();
    assertThat(burstTotal).isGreaterThan(50);
    assertThat(burst.getOrDefault(MentalEngine.DEFENSE, 0))
        .isGreaterThan(burst.getOrDefault(MentalEngine.ASSAULT, 0) * 3);
    // 터지는 분기에도 공격이, 터지지 않는 분기에도 디펜스가 나와서 장르만으로는 폭락을 알 수 없다.
    assertThat(burst.getOrDefault(MentalEngine.ASSAULT, 0)).isPositive();
    assertThat(calm.getOrDefault(MentalEngine.DEFENSE, 0)).isPositive();
  }

  @Test
  void 결과를_보내면_강화율을_매기고_상한으로_자르며_두_번_보내도_한_번이다() {
    CompanyState c = company(1);
    ENGINE.mental.report(c, new HashSeededRandom(1), 1, 1, List.of("steel", "hold"), 120, 80);
    assertThat(c.mental.cards).containsExactly("steel", "hold");
    assertThat(c.mental.bonusPercent).isEqualTo(20 + 8);
    ENGINE.mental.report(c, new HashSeededRandom(1), 1, 1, List.of("hold"), 500, 150);
    assertThat(c.mental.cards).as("이미 보냈으면 그대로").containsExactly("steel", "hold");
    assertThat(c.mental.bonusPercent).isEqualTo(28);

    CompanyState big = company(2);
    ENGINE.mental.report(big, new HashSeededRandom(1), 1, 1, List.of("hold"), 9_999, 9_999);
    assertThat(big.mental.kills).isEqualTo(PROPERTIES.mental().maxKills());
    assertThat(big.mental.mentalLeft).isEqualTo(PROPERTIES.mental().maxMental());
    assertThat(big.mental.bonusPercent).isEqualTo(PROPERTIES.mental().maxPercent());

    CompanyState none = company(3);
    ENGINE.mental.report(none, new HashSeededRandom(1), 1, 1, List.of("calm"), 0, 0);
    assertThat(none.mental.bonusPercent).isZero();
    assertThat(ENGINE.mental.line(none)).as("강화가 없으면 소식도 없다").isNull();
  }

  @Test
  void 멘탈_전투_전에_연_분기면_불러올_때_이번_분기의_전투를_만든다() {
    CompanyState c = company(7);
    c.mental = null;
    assertThat(ENGINE.mental.adopt(c, new HashSeededRandom(7))).isTrue();
    assertThat(c.mental.genre).isIn(MentalEngine.GENRES);
    assertThat(c.mental.cards).isNull();
    assertThat(ENGINE.mental.adopt(c, new HashSeededRandom(7))).as("이미 있으면 그대로").isFalse();
  }

  @Test
  void 이번_분기가_아니거나_없는_카드면_400이다() {
    CompanyState c = company(1);
    assertThatThrownBy(
            () -> ENGINE.mental.report(c, new HashSeededRandom(1), 1, 2, List.of("hold"), 10, 10))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(
            () -> ENGINE.mental.report(c, new HashSeededRandom(1), 2, 1, List.of("hold"), 10, 10))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(
            () ->
                ENGINE.mental.report(
                    c, new HashSeededRandom(1), 1, 1, List.of("hold", "yolo"), 10, 10))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(
            () -> ENGINE.mental.report(c, new HashSeededRandom(1), 1, 1, List.of(), 10, 10))
        .isInstanceOf(InvalidRequestException.class);
    assertThat(c.mental.cards).isNull();
  }

  @Test
  void 깬_최고_스테이지만큼_그_분기_결산에서_더_벌게_하고_소식_줄을_남긴다() {
    int compared = 0;
    CompanyProperties.Stages rule = PROPERTIES.mental().stages();
    for (int seed = 0; seed < 200; seed++) {
      CompanyState plain = company(seed);
      CompanyState trained = company(seed);
      for (int stage = 1; stage <= rule.perChapter(); stage++) {
        ENGINE.mental.reportStage(trained, stage, true, 1);
      }
      assertThat(ENGINE.mental.bonusPercent(trained)).isEqualTo(rule.maxBonus());
      // 보상으로 받은 자본은 빼고 견준다: 같은 판돈으로 굴려야 버는 몫만 다르다.
      trained.capital = plain.capital;
      trained.yearRewards = 0;
      CompanyState.Quarter p = ENGINE.settleQuarter(plain, new HashSeededRandom(seed));
      CompanyState.Quarter t = ENGINE.settleQuarter(trained, new HashSeededRandom(seed));
      assertThat(p.mentalBonusPercent).isNull();
      assertThat(t.mentalBonusPercent).isEqualTo(rule.maxBonus());
      assertThat(t.mentalCard).isEqualTo("1-10");
      assertThat(t.lines).anyMatch(l -> l.contains("1-10") && l.contains("+30%"));
      assertThat(p.lines).noneMatch(l -> l.contains("멘탈 수련"));
      CompanyState.Result pr = p.results.getFirst();
      CompanyState.Result tr = t.results.getFirst();
      // 둘 다 손이 뒤집히지 않고 맞힌 분기만 견준다: 같은 난수라 버는 몫만 다르다.
      if (pr.flips.isEmpty() && tr.flips.isEmpty() && pr.pnl > 0 && tr.pnl > 0) {
        assertThat(tr.pnl).isGreaterThan(pr.pnl);
        compared++;
      }
    }
    assertThat(compared).isGreaterThan(20);
  }

  /** 매도벽 돌파 스테이지 (#698): 멘탈 스테이지와 따로 차례로 열리고, 보상 규칙은 같으며, 분기 강화율에는 들어가지 않는다. */
  @Test
  void 매도벽_돌파_스테이지는_멘탈_스테이지와_따로_차례로_열린다() {
    CompanyState c = company(9);
    CompanyProperties.Stages rule = PROPERTIES.mental().stages();
    assertThatThrownBy(() -> ENGINE.mental.reportAssault(c, 2, true, 3))
        .as("아직 안 열린 스테이지")
        .isInstanceOf(InvalidRequestException.class);
    long capital = c.capital;
    int tickets = c.weaponTickets;
    ENGINE.mental.reportAssault(c, 1, false, 0);
    assertThat(ENGINE.mental.bestAssault(c)).as("못 깨면 그대로").isZero();
    assertThat(c.capital).isEqualTo(capital);
    assertThat(c.lastAssault.cleared).isFalse();

    ENGINE.mental.reportAssault(c, 1, true, 2);
    assertThat(ENGINE.mental.bestAssault(c)).isEqualTo(1);
    assertThat(c.capital).isEqualTo(capital + rule.capitalPerStage());
    assertThat(c.weaponTickets).isEqualTo(tickets + rule.clearTickets() + 2 * rule.starTickets());
    assertThat(c.lastAssault.firstClear).isTrue();
    assertThat(ENGINE.mental.bestStage(c)).as("멘탈 스테이지와 따로다").isZero();
    assertThat(ENGINE.mental.bonusPercent(c)).as("분기 강화율에는 안 든다").isZero();
    assertThat(c.lastStage).isNull();

    ENGINE.mental.reportAssault(c, 2, true, 3);
    CompanyView.Assaults view = ENGINE.mental.assaultsView(c);
    assertThat(view.best()).isEqualTo(2);
    assertThat(view.stars()).containsExactly(2, 3);
    assertThat(view.lastResult().stage()).isEqualTo(2);
    assertThat(view.last()).isEqualTo(ENGINE.mental.lastStage());

    CompanyState old = company(10);
    old.assaultStars = null;
    assertThat(ENGINE.mental.assaultsView(old).best()).as("옛 회사").isZero();
    ENGINE.mental.reportAssault(old, 1, true, 1);
    assertThat(ENGINE.mental.bestAssault(old)).isEqualTo(1);
  }

  @Test
  void 스테이지는_차례로_열리고_처음_깨면_자본과_뽑기권_별을_처음_얻으면_뽑기권을_더_준다() {
    CompanyState c = company(8);
    CompanyProperties.Stages rule = PROPERTIES.mental().stages();
    assertThatThrownBy(() -> ENGINE.mental.reportStage(c, 2, true, 3))
        .as("아직 안 열린 스테이지")
        .isInstanceOf(InvalidRequestException.class);
    long capital = c.capital;
    int tickets = c.weaponTickets;
    ENGINE.mental.reportStage(c, 1, false, 0);
    assertThat(ENGINE.mental.bestStage(c)).as("못 깨면 그대로").isZero();
    assertThat(c.capital).isEqualTo(capital);

    ENGINE.mental.reportStage(c, 1, true, 2);
    assertThat(ENGINE.mental.bestStage(c)).isEqualTo(1);
    assertThat(c.capital).isEqualTo(capital + rule.capitalPerStage());
    assertThat(c.yearRewards).isEqualTo(rule.capitalPerStage());
    assertThat(c.weaponTickets).isEqualTo(tickets + rule.clearTickets() + 2 * rule.starTickets());
    assertThat(c.lastStage.firstClear).isTrue();

    // 다시 깨면 늘어난 별만큼만, 자본은 없다
    ENGINE.mental.reportStage(c, 1, true, 3);
    assertThat(c.capital).isEqualTo(capital + rule.capitalPerStage());
    assertThat(c.lastStage.firstClear).isFalse();
    assertThat(c.lastStage.tickets).isEqualTo(rule.starTickets());
    assertThat(c.stageStars).containsExactly(3);
    ENGINE.mental.reportStage(c, 1, true, 1);
    assertThat(c.lastStage.tickets).as("별이 줄면 아무것도 없다").isZero();
    assertThat(c.stageStars).containsExactly(3);

    for (int stage = 2; stage < rule.perChapter(); stage++) {
      ENGINE.mental.reportStage(c, stage, true, 1);
    }
    ENGINE.mental.reportStage(c, rule.perChapter(), true, 1);
    assertThat(c.lastStage.tickets)
        .as("보스 스테이지")
        .isEqualTo(rule.bossTickets() + rule.starTickets());
    // 챕터 보스를 깨면 다음 챕터가 열린다 (407번): 2-1을 깰 수 있고, 그 다음 칸(2-3)은 아직이다.
    assertThat(ENGINE.mental.stagesView(c).last()).isEqualTo(rule.perChapter() * rule.chapters());
    ENGINE.mental.reportStage(c, rule.perChapter() + 1, true, 1);
    assertThat(ENGINE.mental.bestStage(c)).isEqualTo(rule.perChapter() + 1);
    assertThat(c.lastStage.firstClear).isTrue();
    assertThatThrownBy(() -> ENGINE.mental.reportStage(c, rule.perChapter() + 3, true, 1))
        .as("아직 안 열린 스테이지")
        .isInstanceOf(InvalidRequestException.class);
    // 마지막 챕터 보스 너머는 없다.
    for (int stage = rule.perChapter() + 2; stage <= ENGINE.mental.lastStage(); stage++) {
      ENGINE.mental.reportStage(c, stage, true, 1);
    }
    assertThatThrownBy(() -> ENGINE.mental.reportStage(c, ENGINE.mental.lastStage() + 1, true, 1))
        .as("마지막 챕터 너머")
        .isInstanceOf(InvalidRequestException.class);
    assertThat(ENGINE.mental.bonusPercent(c)).as("강화율 상한은 그대로").isEqualTo(rule.maxBonus());
    assertThat(ENGINE.mental.stageLabel(3)).isEqualTo("1-3");
    assertThat(ENGINE.mental.stageLabel(rule.perChapter() + 1)).isEqualTo("2-1");
  }

  @Test
  void EX_디펜스는_분기에_한_번_적을_많이_잡을수록_뽑기권을_더_준다() {
    CompanyProperties.Stages rule = PROPERTIES.mental().stages();
    CompanyState c = company(9);
    int before = c.weaponTickets;
    ENGINE.mental.reportEx(c, rule.exKillsPerTicket() * 10);
    assertThat(c.weaponTickets).isEqualTo(before + rule.exMaxTickets());
    assertThat(ENGINE.mental.stagesView(c).exAvailable()).isFalse();
    ENGINE.mental.reportEx(c, 999);
    assertThat(c.weaponTickets).as("두 번째는 없다").isEqualTo(before + rule.exMaxTickets());

    CompanyState few = company(10);
    int fewBefore = few.weaponTickets;
    ENGINE.mental.reportEx(few, 0);
    assertThat(few.weaponTickets).isEqualTo(fewBefore + 1);
  }

  @Test
  void 처음엔_일반_권총_하나를_들고_옛_회사도_불러올_때_받는다() {
    CompanyState c = ENGINE.open(new HashSeededRandom(1), 150_000_000L);
    assertThat(c.weapons).hasSize(1);
    assertThat(c.weapons.getFirst().kind).isEqualTo(MentalEngine.PISTOL);
    assertThat(c.weapons.getFirst().grade).isEqualTo("F");
    assertThat(c.weapon).isSameAs(c.weapons.getFirst());

    CompanyState old = company(2);
    old.weapons = null;
    old.weapon = null;
    assertThat(ENGINE.mental.adopt(old, new HashSeededRandom(2))).isTrue();
    assertThat(old.weapon.kind).isEqualTo(MentalEngine.PISTOL);
    assertThat(ENGINE.mental.adopt(old, new HashSeededRandom(2))).as("이미 있으면 그대로").isFalse();
  }

  @Test
  void 무기_수치는_등급이_오를수록_세고_빨라진다() {
    double previous = 0;
    for (String grade : MentalEngine.WEAPON_GRADES) {
      String kind = PROPERTIES.mental().weaponGrades().get(grade).kind();
      CompanyProperties.Weapon stats = ENGINE.mental.stats(kind, grade);
      // 실효 화력: 탄 강화(1 + 0.4 × power)와 리볼버 치명타(40% × 3)·여섯 발마다 1초 재장전을 넣는다.
      double dps = stats.damagePercent() * 1000.0 / stats.fireMs() * (1 + 0.4 * stats.power());
      if (kind.equals("revolver"))
        dps *= 1.8 * (6.0 * stats.fireMs()) / (6.0 * stats.fireMs() + 1000);
      assertThat(dps).as(grade + " 지속 화력").isGreaterThan(previous);
      if (previous > 0)
        assertThat(dps / previous).as(grade + " 한 등급 오름폭 (461번)").isBetween(1.6, 1.9);
      previous = dps;
    }
    assertThat(ENGINE.mental.stats("shotgun", "A").power()).isEqualTo(2);
    assertThat(ENGINE.mental.stats("rifle", "S").power()).isEqualTo(3);
  }

  @Test
  void 전투를_마치면_무기_뽑기권을_받고_무기는_떨어지지_않는다() {
    CompanyState c = company(3);
    ENGINE.mental.initWeaponGacha(c);
    int before = c.weaponTickets;
    assertThat(before).as("처음 뽑기권").isEqualTo(PROPERTIES.mental().weaponGacha().startTickets());
    ENGINE.mental.report(c, new HashSeededRandom(3), 1, 1, List.of("hold"), 90, 50);
    assertThat(c.weaponTickets)
        .isEqualTo(before + PROPERTIES.mental().weaponGacha().battleTickets());
    assertThat(c.weapons).as("전투에서 무기가 떨어지지 않는다").hasSize(1);
    ENGINE.mental.report(c, new HashSeededRandom(3), 1, 1, List.of("hold"), 90, 50);
    assertThat(c.weaponTickets).as("두 번 보내도 한 번").isEqualTo(before + 1);
    assertThat(ENGINE.mental.initWeaponGacha(c)).as("처음 뽑기권은 한 번만").isFalse();
  }

  @Test
  void 무기_뽑기는_뽑기권을_쓰고_등급은_가중치대로_같은_무기는_수가_는다() {
    Map<String, Integer> grades = new HashMap<>();
    for (int seed = 0; seed < 300; seed++) {
      CompanyState c = company(seed);
      c.weaponTickets = 1;
      ENGINE.mental.drawWeapon(c, new HashSeededRandom(seed));
      assertThat(c.weaponTickets).isZero();
      CompanyState.Weapon d = c.lastWeaponDraw;
      grades.merge(d.grade, 1, Integer::sum);
      boolean pistolN = d.kind.equals(MentalEngine.PISTOL) && d.grade.equals("F");
      assertThat(c.lastWeaponDrawNew).isEqualTo(!pistolN);
      assertThat(c.weapons).hasSize(pistolN ? 1 : 2);
      if (pistolN) {
        assertThat(c.weapons.getFirst().count).as("이미 가진 무기는 수가 는다").isEqualTo(2);
      }
    }
    assertThat(grades.getOrDefault("F", 0)).isGreaterThan(grades.getOrDefault("E", 0));
    assertThat(grades.getOrDefault("E", 0)).isGreaterThan(grades.getOrDefault("C", 0));
    CompanyState empty = company(1);
    empty.weaponTickets = 0;
    assertThatThrownBy(() -> ENGINE.mental.drawWeapon(empty, new HashSeededRandom(1)))
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 뽑기의_모든_가중치_구간은_A_이하이고_상위_등급은_합성_전용이다() {
    assertThat(MentalEngine.DRAW_GRADES).containsExactly("F", "E", "D", "C", "B", "A");
    assertThat(PROPERTIES.mental().weaponGacha().gradeWeights().keySet())
        .containsExactlyInAnyOrderElementsOf(MentalEngine.DRAW_GRADES);
    int total =
        PROPERTIES.mental().weaponGacha().gradeWeights().values().stream()
            .mapToInt(Integer::intValue)
            .sum();
    Map<String, Integer> drawn = new HashMap<>();
    for (int roll = 0; roll < total; roll++) {
      final int value = roll;
      CompanyState c = company(1);
      c.weaponTickets = 1;
      ENGINE.mental.drawWeapon(
          c,
          keys ->
              new java.util.Random() {
                @Override
                public int nextInt(int bound) {
                  assertThat(bound).isEqualTo(total);
                  return value;
                }
              });
      drawn.merge(c.lastWeaponDraw.grade, 1, Integer::sum);
    }
    assertThat(drawn).isEqualTo(PROPERTIES.mental().weaponGacha().gradeWeights());
  }

  @Test
  void 새_상위_무기는_불러와도_보존되고_장착할_수_있다() {
    for (String grade : List.of("S", "SS", "SSS", "SR", "UR", "LR")) {
      CompanyState c = company(4);
      CompanyState.Weapon weapon = new CompanyState.Weapon("rifle", grade);
      c.weapons.add(weapon);
      ENGINE.mental.adopt(c, new HashSeededRandom(4));
      assertThat(c.weapons).contains(weapon);
      ENGINE.mental.equip(c, "rifle", grade);
      assertThat(c.weapon).isSameAs(weapon);
      assertThat(ENGINE.mental.weaponViews(c))
          .anySatisfy(
              view -> {
                assertThat(view.grade()).isEqualTo(grade);
                assertThat(view.gradeName()).isEqualTo(grade);
                assertThat(view.equipped()).isTrue();
              });
    }
  }

  @Test
  void 전투_강화는_자본으로_끝없이_사고_값은_완만하게_오른다() {
    CompanyState c = company(5);
    CompanyProperties.Upgrades rule = PROPERTIES.mental().upgrades();
    assertThat(MentalEngine.UPGRADES)
        .as("고양이 속도 강화는 뺐고(394번) 체력(410번)과 치명타 피해(487번)를 넣었다")
        .containsExactly("damage", "fire", "hp", "crit");
    assertThat(rule.stepPercent())
        .as("공격력·체력 3%, 연사 2%, 치명타 피해 6% (492번)")
        .containsEntry("damage", 3)
        .containsEntry("fire", 2)
        .containsEntry("hp", 3)
        .containsEntry("crit", 6);
    assertThat(rule.maxPercent()).as("연사만 100%에서 멈춘다 (487번)").containsOnly(Map.entry("fire", 100));
    long before = c.capital;
    assertThat(ENGINE.mental.buyUpgrade(c, "damage", 1)).isEqualTo(1);
    assertThat(c.capital).isEqualTo(before - rule.basePrice());
    assertThat(c.yearUpgrades).as("강화 비용은 따로 적는다").isEqualTo(rule.basePrice());
    // 단계마다 몇 %씩만 오른다: 두 배씩이면 끝없이 살 수 없다.
    assertThat(ENGINE.mental.upgradePrice(0)).isEqualTo(rule.basePrice());
    assertThat(ENGINE.mental.upgradePrice(1)).isEqualTo(1_040_000L);
    assertThat(ENGINE.mental.upgradePrice(100))
        .as("100단계째 약 0.5억")
        .isBetween(40_000_000L, 60_000_000L);
    assertThat(ENGINE.mental.upgradePrice(200))
        .as("200단계째 약 25억")
        .isBetween(2_000_000_000L, 3_000_000_000L);
    assertThat(ENGINE.mental.upgradePrice(5_000)).as("long을 넘으면 못 사는 값").isEqualTo(Long.MAX_VALUE);
    CompanyView.BattleUpgrade damage = view(c, "damage");
    assertThat(damage.level()).isEqualTo(1);
    assertThat(damage.bonusPercent()).isEqualTo(3);
    assertThat(damage.nextBonusPercent()).isEqualTo(6);
    assertThat(damage.price()).isEqualTo(ENGINE.mental.upgradePrice(1));
    assertThat(damage.priceGrowthPercent()).isEqualTo(rule.priceGrowthPercent());

    // 꾹 눌러 모은 단계는 묶어 산다. 최대 단계는 없다.
    c.capital = Long.MAX_VALUE / 4;
    long spent = c.yearUpgrades;
    long expected = 0;
    for (int level = 0; level < 250; level++) {
      expected += ENGINE.mental.upgradePrice(level);
    }
    assertThat(ENGINE.mental.buyUpgrade(c, "hp", 100)).isEqualTo(100);
    assertThat(ENGINE.mental.buyUpgrade(c, "hp", 100)).isEqualTo(100);
    assertThat(ENGINE.mental.buyUpgrade(c, "hp", 50)).isEqualTo(50);
    assertThat(c.battleLevels.get("hp")).isEqualTo(250);
    assertThat(c.yearUpgrades - spent).as("묶어 사도 한 단계씩 산 값의 합").isEqualTo(expected);
    assertThat(view(c, "hp").bonusPercent()).isEqualTo(750);
    assertThat(view(c, "hp").maxLevel()).as("0이면 끝없이 산다").isZero();
    assertThatThrownBy(() -> ENGINE.mental.buyUpgrade(c, "fire", 0))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> ENGINE.mental.buyUpgrade(c, "fire", rule.maxBatch() + 1))
        .isInstanceOf(InvalidRequestException.class);

    // 연사는 100%(50단계)에서 멈춘다 (487·492번): 넘치게 보내도 상한까지만 사고, 닿은 뒤에는 400.
    assertThat(ENGINE.mental.buyUpgrade(c, "fire", 30)).isEqualTo(30);
    long atThirty = c.capital;
    assertThat(ENGINE.mental.buyUpgrade(c, "fire", 100)).as("남은 20단계만 산다").isEqualTo(20);
    long twenty = 0;
    for (int level = 30; level < 50; level++) {
      twenty += ENGINE.mental.upgradePrice(level);
    }
    assertThat(atThirty - c.capital).isEqualTo(twenty);
    assertThat(view(c, "fire").bonusPercent()).isEqualTo(100);
    assertThat(view(c, "fire").nextBonusPercent()).isEqualTo(100);
    assertThat(view(c, "fire").maxLevel()).isEqualTo(50);
    assertThatThrownBy(() -> ENGINE.mental.buyUpgrade(c, "fire", 1))
        .isInstanceOf(InvalidRequestException.class);
    // 상한이 생기기 전에 넘겨 산 단계는 상한으로 읽는다.
    c.battleLevels.put("fire", 250);
    assertThat(view(c, "fire").level()).isEqualTo(50);
    assertThat(view(c, "fire").bonusPercent()).isEqualTo(100);

    // 치명타 피해는 한 단계에 6%씩 끝없이 (487·492번).
    assertThat(ENGINE.mental.buyUpgrade(c, "crit", 5)).isEqualTo(5);
    assertThat(view(c, "crit").bonusPercent()).isEqualTo(30);
    assertThat(view(c, "crit").maxLevel()).isZero();

    // 자본이 닿는 데까지만 산다. 한 단계도 못 사면 400.
    CompanyState poor = company(6);
    poor.capital = rule.basePrice() + 1_040_000L + 1_000L;
    assertThat(ENGINE.mental.buyUpgrade(poor, "fire", 10)).as("두 단계까지만 닿는다").isEqualTo(2);
    assertThat(poor.capital).isEqualTo(1_000L);
    assertThat(poor.battleLevels.get("fire")).isEqualTo(2);
    assertThatThrownBy(() -> ENGINE.mental.buyUpgrade(poor, "fire", 1))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> ENGINE.mental.buyUpgrade(poor, "speed", 1))
        .as("고양이 속도 강화는 없다")
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> ENGINE.mental.buyUpgrade(poor, "armor", 1))
        .isInstanceOf(InvalidRequestException.class);

    // 체력(최대 멘탈)도 같은 규칙으로 산다 (410번).
    CompanyState tough = company(7);
    assertThat(ENGINE.mental.buyUpgrade(tough, "hp", 3)).isEqualTo(3);
    assertThat(view(tough, "hp").bonusPercent()).isEqualTo(9);
    assertThat(view(tough, "hp").price()).isEqualTo(ENGINE.mental.upgradePrice(3));
  }

  @Test
  void 옛_전투_강화_단계는_돌려주지_않고_0단계로_돌아간다() throws Exception {
    String old =
        """
        {"year": 2, "capital": 5000000000, "battleUpgrades": {"damage": 10, "fire": 7, "speed": 3}}
        """;
    CompanyState c = JsonMapper.builder().build().readValue(old, CompanyState.class);
    assertThat(c.battleLevels).as("출시 전이라 리셋한다 (394번)").isEmpty();
    assertThat(c.capital).as("쓴 돈도 돌려주지 않는다").isEqualTo(5_000_000_000L);
    assertThat(ENGINE.mental.upgradeViews(c))
        .extracting(CompanyView.BattleUpgrade::level)
        .containsExactly(0, 0, 0, 0);
  }

  private static CompanyView.BattleUpgrade view(CompanyState c, String kind) {
    return ENGINE.mental.upgradeViews(c).stream()
        .filter(u -> u.kind().equals(kind))
        .findFirst()
        .orElseThrow();
  }

  @Test
  void 모든_등급을_합성하면_종류도_등급에_맞춰_바뀐다() {
    CompanyState c = company(4);
    for (int i = 0; i < MentalEngine.WEAPON_GRADES.size() - 1; i++) {
      String grade = MentalEngine.WEAPON_GRADES.get(i);
      String next = MentalEngine.WEAPON_GRADES.get(i + 1);
      c.weapon.count = PROPERTIES.mental().weaponGacha().mergeCount();
      ENGINE.mental.mergeWeapon(c, c.weapon.kind, grade);
      assertThat(c.weapons).hasSize(1);
      assertThat(c.weapon.grade).isEqualTo(next);
      assertThat(c.weapon.kind).isEqualTo(PROPERTIES.mental().weaponGrades().get(next).kind());
    }
    assertThatThrownBy(() -> ENGINE.mental.mergeWeapon(c, "rifle", "LR"))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> ENGINE.mental.equip(c, "pistol", "S"))
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 옛_무기만_리셋하고_회사의_나머지_진행은_보존한다() throws Exception {
    CompanyState c = company(4);
    long capital = c.capital;
    c.weapons = new ArrayList<>(List.of(new CompanyState.Weapon("rifle", "OBSOLETE")));
    c.weapon = c.weapons.getFirst();
    c.lastWeaponDraw = c.weapon;
    c.weaponTickets = 99;
    assertThat(ENGINE.mental.adopt(c, new HashSeededRandom(4))).isTrue();
    assertThat(c.weapon.same("pistol", "F")).isTrue();
    assertThat(c.weapons).hasSize(1);
    assertThat(c.lastWeaponDraw).isNull();
    assertThat(c.weaponTickets).isEqualTo(PROPERTIES.mental().weaponGacha().startTickets());
    assertThat(c.capital).isEqualTo(capital);
    assertThat(ENGINE.mental.adopt(c, new HashSeededRandom(4))).isFalse();
  }

  @Test
  void 같은_무기를_합치면_한_등급_올라가고_든_무기도_따라간다() {
    CompanyState c = company(4);
    int need = PROPERTIES.mental().weaponGacha().mergeCount();
    assertThatThrownBy(() -> ENGINE.mental.mergeWeapon(c, MentalEngine.PISTOL, "F"))
        .as("하나뿐이면 못 합친다")
        .isInstanceOf(InvalidRequestException.class);
    c.weapons.getFirst().count = need;
    ENGINE.mental.mergeWeapon(c, MentalEngine.PISTOL, "F");
    assertThat(c.weapons).hasSize(1);
    assertThat(c.weapons.getFirst().grade).isEqualTo("E");
    assertThat(c.weapon.same(MentalEngine.PISTOL, "E")).as("들고 있던 무기를 다 썼으면 합친 것을 든다").isTrue();
    c.weapons.getFirst().grade = "LR";
    c.weapons.getFirst().kind = "rifle";
    c.weapons.getFirst().count = need;
    assertThatThrownBy(() -> ENGINE.mental.mergeWeapon(c, "rifle", "LR"))
        .as("가장 높은 등급은 못 합친다")
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 가진_무기만_들_수_있고_화면_값은_든_것을_표시한다() {
    CompanyState c = company(1);
    c.weapons.add(new CompanyState.Weapon("smg", "C"));
    ENGINE.mental.equip(c, "smg", "C");
    assertThat(c.weapon.kind).isEqualTo("smg");
    assertThat(ENGINE.mental.weaponViews(c))
        .extracting(w -> w.kind() + ":" + w.equipped())
        .containsExactly("pistol:false", "smg:true");
    assertThat(ENGINE.mental.weaponViews(c).getLast().name()).isEqualTo("기관단총");
    assertThat(ENGINE.mental.weaponViews(c).getLast().gradeName()).isEqualTo("C");
    assertThatThrownBy(() -> ENGINE.mental.equip(c, "rifle", "F"))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> ENGINE.mental.equip(c, "bazooka", "F"))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> ENGINE.mental.equip(c, "smg", "XX"))
        .isInstanceOf(InvalidRequestException.class);
    assertThat(c.weapon.kind).isEqualTo("smg");
  }
}
