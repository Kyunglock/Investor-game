package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.withinPercentage;

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
    ENGINE.begin(company);
    ENGINE.hire(company, stats(50));
    ENGINE.place(company, Map.of(1, "bio"));
    return company;
  }

  /** 사장냥의 무기 빼기 (585번): 빈손은 다시 채워지지 않고, 뺀 무기는 가진 무기에 남으며, 다시 들 수 있다. */
  @Test
  void 사장냥이_무기를_빼면_빈손으로_남고_다시_들_수_있다() {
    CompanyState c = company(1);
    ENGINE.mental.grant(c, "A", 1);
    assertThat(c.weapon.grade).isEqualTo("A");

    ENGINE.mental.unequip(c);
    assertThat(c.weapon).isNull();
    assertThat(ENGINE.mental.initWeapons(c)).as("빈손을 다시 채우지 않는다").isFalse();
    assertThat(c.weapon).isNull();
    assertThat(ENGINE.mental.weaponViews(c)).hasSize(2).noneMatch(CompanyView.Weapon::equipped);
    ENGINE.mental.unequip(c);
    assertThat(c.weapon).as("두 번 빼도 그대로").isNull();

    ENGINE.mental.equip(c, "pistol", "F");
    assertThat(c.weapon.grade).isEqualTo("F");
    assertThat(c.weaponOff).isFalse();
  }

  /** 매도벽 돌파 스테이지 (#698): 멘탈 스테이지와 따로 차례로 열리고, 보상은 다이아뿐이며 (697번), 분기 강화율에는 들어가지 않는다. */
  @Test
  void 매도벽_돌파_스테이지는_멘탈_스테이지와_따로_차례로_열린다() {
    CompanyState c = company(9);
    assertThatThrownBy(() -> ENGINE.mental.reportAssault(c, 2, true, 3))
        .as("아직 안 열린 스테이지")
        .isInstanceOf(InvalidRequestException.class);
    long capital = (long) c.capital;
    long diamonds = c.diamonds;
    ENGINE.mental.reportAssault(c, 1, false, 0);
    assertThat(ENGINE.mental.bestAssault(c)).as("못 깨면 그대로").isZero();
    assertThat(c.capital).isEqualTo(capital);
    assertThat(c.diamonds).isEqualTo(diamonds);
    assertThat(c.lastAssault.cleared).isFalse();

    ENGINE.mental.reportAssault(c, 1, true, 2);
    assertThat(ENGINE.mental.bestAssault(c)).isEqualTo(1);
    assertThat(c.capital).as("자본은 주지 않는다 (697번)").isEqualTo(capital);
    assertThat(c.diamonds).as("처음 깨면 다이아 100개").isEqualTo(diamonds + 100);
    assertThat(c.lastAssault.diamonds).isEqualTo(100);
    assertThat(c.lastAssault.firstClear).isTrue();
    ENGINE.mental.reportAssault(c, 1, true, 3);
    assertThat(c.diamonds).as("다시 깨거나 별을 더 얻어도 더 주지 않는다").isEqualTo(diamonds + 100);
    assertThat(c.lastAssault.diamonds).isZero();
    assertThat(ENGINE.mental.bestStage(c)).as("멘탈 스테이지와 따로다").isZero();
    assertThat(ENGINE.mental.bonusPercent(c)).as("분기 강화율에는 안 든다").isZero();
    assertThat(c.lastStage).isNull();

    ENGINE.mental.reportAssault(c, 2, true, 3);
    CompanyView.Assaults view = ENGINE.mental.assaultsView(c);
    assertThat(view.best()).isEqualTo(2);
    assertThat(view.stars()).containsExactly(3, 3);
    assertThat(view.lastResult().stage()).isEqualTo(2);
    assertThat(view.last()).isEqualTo(ENGINE.mental.lastStage());

    CompanyState old = company(10);
    old.assaultStars = null;
    assertThat(ENGINE.mental.assaultsView(old).best()).as("옛 회사").isZero();
    ENGINE.mental.reportAssault(old, 1, true, 1);
    assertThat(ENGINE.mental.bestAssault(old)).isEqualTo(1);
  }

  @Test
  void EX_디펜스는_하루에_한_번_다이아_1200개를_준다() {
    // 526번: 무기 뽑기권 대신 다이아. 잡은 적의 수와 상관없다.
    CompanyState c = company(9);
    long before = c.diamonds;
    ENGINE.mental.reportEx(c, 400, "2026-11-15");
    assertThat(c.diamonds).isEqualTo(before + 1200);
    assertThat(c.lastStage.diamonds).isEqualTo(1200);
    assertThat(ENGINE.mental.stagesView(c, "2026-11-15").exAvailable()).isFalse();
    ENGINE.mental.reportEx(c, 999, "2026-11-15");
    assertThat(c.diamonds).as("두 번째는 없다").isEqualTo(before + 1200);

    CompanyState few = company(10);
    long fewBefore = few.diamonds;
    ENGINE.mental.reportEx(few, 0, "2026-11-15");
    assertThat(few.diamonds).isEqualTo(fewBefore + 1200);
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
    assertThat(ENGINE.mental.adopt(old)).isTrue();
    assertThat(old.weapon.kind).isEqualTo(MentalEngine.PISTOL);
    assertThat(ENGINE.mental.adopt(old)).as("이미 있으면 그대로").isFalse();
  }

  @Test
  void 무기_수치는_등급이_오를수록_세고_빨라진다() {
    // 등급별 실효 화력 (660번): F 500을 기준으로 한 비율. 646번에는 한 등급 1.18배(LR이 F의 6배)였다.
    Map<String, Integer> target =
        Map.ofEntries(
            Map.entry("F", 500),
            Map.entry("E", 700),
            Map.entry("D", 1000),
            Map.entry("C", 1400),
            Map.entry("B", 1800),
            Map.entry("A", 2500),
            Map.entry("S", 3500),
            Map.entry("SS", 5000),
            Map.entry("SSS", 7500),
            Map.entry("SR", 10000),
            Map.entry("UR", 12500),
            Map.entry("LR", 15000));
    double pistol = 0;
    double previous = 0;
    for (String grade : MentalEngine.WEAPON_GRADES) {
      String kind = PROPERTIES.mental().weaponGrades().get(grade).kind();
      CompanyProperties.Weapon stats = ENGINE.mental.stats(kind, grade);
      // 실효 화력: 탄 강화(1 + 0.4 × power)와 리볼버 치명타(40% × 3)·여섯 발마다 1초 재장전을 넣는다.
      double dps = stats.damagePercent() * 1000.0 / stats.fireMs() * (1 + 0.4 * stats.power());
      if (kind.equals("revolver"))
        dps *= 1.8 * (6.0 * stats.fireMs()) / (6.0 * stats.fireMs() + 1000);
      assertThat(dps).as(grade + " 지속 화력").isGreaterThan(previous);
      if (pistol == 0) pistol = dps;
      assertThat(dps / pistol * 500)
          .as(grade + " F 500에 견준 화력")
          .isCloseTo(target.get(grade), org.assertj.core.data.Percentage.withPercentage(1));
      previous = dps;
    }
    assertThat(ENGINE.mental.stats("shotgun", "A").power()).isEqualTo(2);
    assertThat(ENGINE.mental.stats("rifle", "S").power()).isEqualTo(3);
  }

  @Test
  void 무기_뽑기는_다이아_100을_쓰고_등급은_가중치대로_같은_무기는_수가_는다() {
    Map<String, Integer> grades = new HashMap<>();
    for (int seed = 0; seed < 300; seed++) {
      CompanyState c = company(seed);
      c.diamonds = (1) * 100L;
      ENGINE.mental.drawWeapon(c, new HashSeededRandom(seed));
      assertThat(c.diamonds).isZero();
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
    empty.diamonds = (0) * 100L;
    assertThatThrownBy(() -> ENGINE.mental.drawWeapon(empty, new HashSeededRandom(1)))
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 무기_10연차는_다이아_1000에_열한_개를_뽑고_모자라면_하나도_뽑지_않는다() {
    CompanyState c = company(5);
    c.diamonds = (9) * 100L;
    assertThatThrownBy(() -> ENGINE.mental.drawWeapons(c, new HashSeededRandom(5), 10))
        .isInstanceOf(InvalidRequestException.class);
    assertThat(c.diamonds).as("거절되면 다이아를 쓰지 않는다").isEqualTo(900);
    assertThat(c.lastWeaponDraws).isEmpty();

    c.diamonds = (10) * 100L;
    int before = c.weapons.stream().mapToInt(w -> w.count).sum();
    ENGINE.mental.drawWeapons(c, new HashSeededRandom(5), 10);
    assertThat(c.diamonds).isZero();
    assertThat(c.lastWeaponDraws).as("10연차는 하나 더 (526번)").hasSize(11);
    assertThat(c.weapons.stream().mapToInt(w -> w.count).sum()).isEqualTo(before + 11);
    var last = c.lastWeaponDraws.getLast();
    assertThat(c.lastWeaponDraw.same(last.kind, last.grade)).isTrue();
    var view = ENGINE.mental.armoryView(c);
    assertThat(view.lastDraws()).hasSize(11);
    // 같은 무기가 두 번 나오면 두 번째는 새것이 아니다.
    java.util.Set<String> seen = new java.util.HashSet<>();
    for (var d : view.lastDraws()) {
      assertThat(d.isNew())
          .isEqualTo(
              seen.add(d.kind() + d.grade())
                  && !(d.kind().equals(MentalEngine.PISTOL) && d.grade().equals("F")));
    }

    c.diamonds = (1) * 100L;
    ENGINE.mental.drawWeapon(c, new HashSeededRandom(5));
    assertThat(c.lastWeaponDraws).hasSize(1);
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
      c.diamonds = (1) * 100L;
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
      ENGINE.mental.adopt(c);
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
    long capital = (long) c.capital;
    c.weapons = new ArrayList<>(List.of(new CompanyState.Weapon("rifle", "OBSOLETE")));
    c.weapon = c.weapons.getFirst();
    c.lastWeaponDraw = c.weapon;
    c.diamonds = (99) * 100L;
    assertThat(ENGINE.mental.adopt(c)).isTrue();
    assertThat(c.weapon.same("pistol", "F")).isTrue();
    assertThat(c.weapons).hasSize(1);
    assertThat(c.lastWeaponDraw).isNull();
    assertThat(c.diamonds).as("다이아는 그대로다").isEqualTo(9900);
    assertThat(c.capital).isEqualTo(capital);
    assertThat(ENGINE.mental.adopt(c)).isFalse();
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

  @Test
  void 스테이지는_차례로_열리고_처음_깨면_자본과_뽑기권_별을_처음_얻으면_뽑기권을_더_준다() {
    CompanyState c = company(8);
    CompanyProperties.Stages rule = PROPERTIES.mental().stages();
    assertThatThrownBy(() -> ENGINE.mental.reportStage(c, 2, true, 3))
        .as("아직 안 열린 스테이지")
        .isInstanceOf(InvalidRequestException.class);
    long capital = (long) c.capital;
    long diamonds = c.diamonds;
    ENGINE.mental.reportStage(c, 1, false, 0);
    assertThat(ENGINE.mental.bestStage(c)).as("못 깨면 그대로").isZero();
    assertThat(c.capital).isEqualTo(capital);

    ENGINE.mental.reportStage(c, 1, true, 2);
    assertThat(ENGINE.mental.bestStage(c)).isEqualTo(1);
    assertThat(c.capital).isEqualTo(capital + rule.capitalPerStage());
    // 별을 처음 얻을 때마다 다이아 (526번): 1개째 120, 2개째 120 (659번에 네 배로).
    assertThat(c.diamonds).isEqualTo(diamonds + 240);
    assertThat(c.lastStage.diamonds).isEqualTo(240);
    assertThat(c.lastStage.firstClear).isTrue();

    // 다시 깨면 늘어난 별만큼만, 자본은 없다
    ENGINE.mental.reportStage(c, 1, true, 3);
    assertThat(c.capital).isEqualTo(capital + rule.capitalPerStage());
    assertThat(c.lastStage.firstClear).isFalse();
    assertThat(c.lastStage.diamonds).as("3개째 별은 160").isEqualTo(160);
    assertThat(c.diamonds).as("별 셋이면 400: 뽑기 네 번").isEqualTo(diamonds + 400);
    assertThat(c.stageStars).containsExactly(3);
    ENGINE.mental.reportStage(c, 1, true, 1);
    assertThat(c.lastStage.diamonds).as("이미 얻은 별은 다시 깨도 주지 않는다").isZero();
    ENGINE.mental.reportStage(c, 1, true, 3);
    assertThat(c.lastStage.diamonds).isZero();
    assertThat(c.diamonds).isEqualTo(diamonds + 400);
    assertThat(c.stageStars).containsExactly(3);

    for (int stage = 2; stage < rule.perChapter(); stage++) {
      ENGINE.mental.reportStage(c, stage, true, 1);
    }
    ENGINE.mental.reportStage(c, rule.perChapter(), true, 1);
    assertThat(c.lastStage.diamonds).as("10의 배수 스테이지는 두 배: 별 하나 240").isEqualTo(240);
    ENGINE.mental.reportStage(c, rule.perChapter(), true, 3);
    assertThat(c.lastStage.diamonds).as("나머지 두 별 (120 + 160) × 2").isEqualTo(560);
    // 챕터 보스를 깨면 다음 챕터가 열린다 (407번): 2-1을 깰 수 있고, 그 다음 칸(2-3)은 아직이다.
    assertThat(ENGINE.mental.stagesView(c, "2026-11-15").last())
        .isEqualTo(rule.perChapter() * rule.chapters());
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
  void 전투_강화는_자본으로_끝없이_사고_값은_완만하게_오른다() {
    CompanyState c = company(5);
    CompanyProperties.Upgrades rule = PROPERTIES.mental().upgrades();
    assertThat(MentalEngine.UPGRADES)
        .as("고양이 속도 강화는 뺐고(394번) 체력(410번)을 넣었다. 치명타 피해는 없앴다(556번)")
        .containsExactly("damage", "fire", "hp", "buy");
    assertThat(rule.stepPercent())
        .as("공격력·연사·체력 모두 1% (653번, 648번에는 0.2%). 치명타 피해는 없앴다 (556번)")
        .containsEntry("damage", 1.0)
        .containsEntry("fire", 1.0)
        .containsEntry("hp", 1.0)
        .doesNotContainKey("buy")
        .doesNotContainKey("crit");
    assertThat(rule.buyStepShares())
        .as("매수벽 공격은 %가 아니라 한 단계에 4주 (579·590·594·632·648번)")
        .isEqualTo(4);
    assertThat(rule.maxPercent()).as("연사만 100%에서 멈춘다 (487번)").containsOnly(Map.entry("fire", 100));
    long before = (long) c.capital;
    assertThat(ENGINE.mental.buyUpgrade(c, "damage", 1)).isEqualTo(1);
    assertThat(c.capital).isEqualTo(before - rule.basePrice());
    // 단계마다 몇 %씩만 오른다: 두 배씩이면 끝없이 살 수 없다. 644번에 4%에서 8%로, 646번에 30%로 올렸다가 648번에 5%로 낮췄다: 100만 ×
    // 1.05.
    assertThat(ENGINE.mental.upgradePrice(0)).isEqualTo(rule.basePrice());
    assertThat(ENGINE.mental.upgradePrice(1)).isEqualTo(1_050_000L);
    assertThat(ENGINE.mental.upgradePrice(50))
        .as("50단계째 100만 × 1.05^50 ≈ 1,147만 (648번, 30%에는 4,979억)")
        .isBetween(1.1e7, 1.2e7);
    assertThat(ENGINE.mental.upgradePrice(100))
        .as("100단계째 100만 × 1.05^100 ≈ 1.3억 (648번, 30%에는 24.8경)")
        .isBetween(1.3e8, 1.33e8);
    assertThat(ENGINE.mental.upgradePrice(200))
        .as("200단계째 100만 × 1.05^200 ≈ 173억 (648번)")
        .isBetween(1.7e10, 1.76e10);
    assertThat(ENGINE.mental.upgradePrice(5_000))
        .as("long을 넘어도 값은 단계를 따라 계속 오른다")
        .isGreaterThan(1e90);
    CompanyView.BattleUpgrade damage = view(c, "damage");
    assertThat(damage.level()).isEqualTo(1);
    assertThat(damage.bonusPercent()).as("한 단계 1% (653번)").isEqualTo(1.0);
    assertThat(damage.nextBonusPercent()).isEqualTo(2.0);
    assertThat(damage.price().longValue()).isEqualTo((long) ENGINE.mental.upgradePrice(1));
    assertThat(damage.priceGrowthPercent()).isEqualTo(rule.priceGrowthPercent());

    // 꾹 눌러 모은 단계는 묶어 산다. 최대 단계는 없다. 자본은 실수라(505번) 정수 계산이 정확한 2^53 아래로 둔다.
    // 80단계 값의 합은 100만 × (1.05^80 − 1) ÷ 0.05 ≈ 9.7억이다 (648번, 5%. 646번 30%에는 4,349조).
    c.capital = 8_000_000_000_000_000L;
    double wallet = c.capital;
    long expected = 0;
    for (int level = 0; level < 80; level++) {
      expected += (long) ENGINE.mental.upgradePrice(level);
    }
    assertThat(ENGINE.mental.buyUpgrade(c, "hp", 50)).isEqualTo(50);
    assertThat(ENGINE.mental.buyUpgrade(c, "hp", 30)).isEqualTo(30);
    assertThat(c.battleLevels.get("hp")).isEqualTo(80);
    assertThat(wallet - c.capital).as("묶어 사도 한 단계씩 산 값의 합").isEqualTo(expected);
    assertThat(view(c, "hp").bonusPercent()).isEqualTo(80);
    assertThat(view(c, "hp").maxLevel()).as("0이면 끝없이 산다").isZero();
    assertThatThrownBy(() -> ENGINE.mental.buyUpgrade(c, "fire", 0))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> ENGINE.mental.buyUpgrade(c, "fire", rule.maxBatch() + 1))
        .isInstanceOf(InvalidRequestException.class);

    // 연사는 100%(1% × 100단계, 653번)에서 멈춘다 (487번): 넘치게 보내도 상한까지만 사고, 닿은 뒤에는 400.
    c.capital = 4_000_000_000L;
    assertThat(ENGINE.mental.buyUpgrade(c, "fire", 80)).isEqualTo(80);
    double atThirty = c.capital;
    assertThat(ENGINE.mental.buyUpgrade(c, "fire", 100)).as("남은 20단계만 산다").isEqualTo(20);
    double twenty = 0;
    for (int level = 80; level < 100; level++) {
      twenty += ENGINE.mental.upgradePrice(level);
    }
    assertThat(atThirty - c.capital).isCloseTo(twenty, withinPercentage(1e-6));
    assertThat(view(c, "fire").bonusPercent()).isEqualTo(100);
    assertThat(view(c, "fire").nextBonusPercent()).isEqualTo(100);
    assertThat(view(c, "fire").maxLevel()).isEqualTo(100);
    assertThatThrownBy(() -> ENGINE.mental.buyUpgrade(c, "fire", 1))
        .isInstanceOf(InvalidRequestException.class);
    // 상한이 생기기 전에 넘겨 산 단계는 상한으로 읽는다.
    c.battleLevels.put("fire", 250);
    assertThat(view(c, "fire").level()).isEqualTo(100);
    assertThat(view(c, "fire").bonusPercent()).isEqualTo(100);

    // 치명타 피해 강화는 없앴다 (556번): 살 수 없고, 저장에 남은 단계는 쓴 돈을 돌려주고 지운다.
    assertThatThrownBy(() -> ENGINE.mental.buyUpgrade(c, "crit", 1))
        .isInstanceOf(InvalidRequestException.class);
    assertThat(ENGINE.mental.hasRemovedUpgrades(c)).isFalse();
    assertThat(ENGINE.mental.refundRemovedUpgrades(c)).isFalse();
    c.battleLevels.put("crit", 2);
    double held = c.capital;
    assertThat(ENGINE.mental.hasRemovedUpgrades(c)).isTrue();
    assertThat(ENGINE.mental.refundRemovedUpgrades(c)).isTrue();
    assertThat(c.capital).isEqualTo(held + rule.basePrice() + 1_050_000L);
    assertThat(c.battleLevels).doesNotContainKey("crit");

    // 자본이 닿는 데까지만 산다. 한 단계도 못 사면 400.
    CompanyState poor = company(6);
    poor.capital = rule.basePrice() + 1_050_000L + 1_000L;
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
    assertThat(view(tough, "hp").bonusPercent()).isEqualTo(3.0);
    assertThat(view(tough, "hp").price().longValue())
        .isEqualTo((long) ENGINE.mental.upgradePrice(3));
  }
}
