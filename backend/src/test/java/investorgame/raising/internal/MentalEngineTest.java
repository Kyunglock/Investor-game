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

  /** 매도벽 돌파 스테이지 (#698): 멘탈 스테이지와 따로 차례로 열리고, 보상 규칙은 같으며, 분기 강화율에는 들어가지 않는다. */
  @Test
  void 매도벽_돌파_스테이지는_멘탈_스테이지와_따로_차례로_열린다() {
    CompanyState c = company(9);
    CompanyProperties.Stages rule = PROPERTIES.mental().stages();
    assertThatThrownBy(() -> ENGINE.mental.reportAssault(c, 2, true, 3))
        .as("아직 안 열린 스테이지")
        .isInstanceOf(InvalidRequestException.class);
    long capital = (long) c.capital;
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
  void 무기_10연속_뽑기는_열_장을_쓰고_나온_차례대로_남기며_모자라면_하나도_뽑지_않는다() {
    CompanyState c = company(5);
    c.weaponTickets = 9;
    assertThatThrownBy(() -> ENGINE.mental.drawWeapons(c, new HashSeededRandom(5), 10))
        .isInstanceOf(InvalidRequestException.class);
    assertThat(c.weaponTickets).isEqualTo(9);
    assertThat(c.lastWeaponDraws).isEmpty();

    c.weaponTickets = 10;
    int before = c.weapons.stream().mapToInt(w -> w.count).sum();
    ENGINE.mental.drawWeapons(c, new HashSeededRandom(5), 10);
    assertThat(c.weaponTickets).isZero();
    assertThat(c.lastWeaponDraws).hasSize(10);
    assertThat(c.weapons.stream().mapToInt(w -> w.count).sum()).isEqualTo(before + 10);
    var last = c.lastWeaponDraws.getLast();
    assertThat(c.lastWeaponDraw.same(last.kind, last.grade)).isTrue();
    var view = ENGINE.mental.armoryView(c);
    assertThat(view.lastDraws()).hasSize(10);
    // 같은 무기가 두 번 나오면 두 번째는 새것이 아니다.
    java.util.Set<String> seen = new java.util.HashSet<>();
    for (var d : view.lastDraws()) {
      assertThat(d.isNew())
          .isEqualTo(
              seen.add(d.kind() + d.grade())
                  && !(d.kind().equals(MentalEngine.PISTOL) && d.grade().equals("F")));
    }

    c.weaponTickets = 1;
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
        .containsExactly(0, 0, 0, 0, 0);
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
