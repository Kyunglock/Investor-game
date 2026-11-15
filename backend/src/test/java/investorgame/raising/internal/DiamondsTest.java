package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * 다이아 (decisions.md 526번): 직원·고양이·무기 뽑기에 쓰는 하나뿐인 뽑기 재화. 뽑기권을 대신한다. 실제 콘텐츠와 application.yml 수치로 돌린다.
 */
class DiamondsTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private final CompanyEngine engine =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);
  private final IdleEngine idle = new IdleEngine(new IdleEngineTest.MutableClock(), engine);
  private final HashSeededRandom random = new HashSeededRandom(3);

  @Test
  void 값은_한_번_100이고_10연차는_1000에_열한_개다() {
    CompanyProperties.Diamonds rule = PROPERTIES.diamonds();
    assertThat(rule.start()).isEqualTo(1000);
    assertThat(rule.cost(1)).isEqualTo(100);
    assertThat(rule.items(1)).isEqualTo(1);
    assertThat(rule.cost(3)).isEqualTo(300);
    assertThat(rule.items(3)).isEqualTo(3);
    assertThat(rule.cost(10)).isEqualTo(1000);
    assertThat(rule.items(10)).as("10연차는 하나 더").isEqualTo(11);
    assertThat(rule.hire()).isEqualTo(100);
    // 별: 1개째 30, 2개째 30, 3개째 40. 10의 배수 스테이지는 두 배.
    assertThat(rule.forStars(1, 0, 1)).isEqualTo(30);
    assertThat(rule.forStars(1, 0, 3)).isEqualTo(100);
    assertThat(rule.forStars(1, 2, 3)).isEqualTo(40);
    assertThat(rule.forStars(1, 3, 3)).isZero();
    assertThat(rule.forStars(10, 0, 3)).isEqualTo(200);
    assertThat(rule.forStars(20, 1, 2)).isEqualTo(60);
    assertThat(rule.ex()).isEqualTo(300);
  }

  @Test
  void 새_회사는_다이아_1000으로_시작하고_세_뽑기가_모두_다이아를_쓴다() {
    CompanyState c = engine.open(random, engine.openingCapital());
    assertThat(c.diamonds).isEqualTo(1000);
    assertThat(c.tickets).isZero();
    assertThat(c.weaponTickets).isZero();
    engine.draw(c, 2, random);
    assertThat(c.diamonds).as("직원 둘").isEqualTo(800);
    engine.mental.drawWeapon(c, random);
    assertThat(c.diamonds).as("무기 한 번").isEqualTo(700);
    idle.drawCat(c, random);
    assertThat(c.diamonds).as("고양이 한 번").isEqualTo(600);
    // 다이아가 모자라면 하나도 뽑지 않고 거절한다.
    assertThatThrownBy(() -> engine.mental.drawWeapons(c, random, 10))
        .isInstanceOf(InvalidRequestException.class)
        .hasMessageContaining("다이아");
    assertThatThrownBy(() -> idle.drawCats(c, random, 10))
        .isInstanceOf(InvalidRequestException.class)
        .hasMessageContaining("다이아");
    c.diamonds = 50;
    assertThatThrownBy(() -> engine.draw(c, 1, random))
        .isInstanceOf(InvalidRequestException.class)
        .hasMessageContaining("다이아");
    assertThatThrownBy(() -> engine.mental.drawWeapon(c, random))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> idle.drawCat(c, random)).isInstanceOf(InvalidRequestException.class);
    assertThat(c.diamonds).as("거절되면 쓰지 않는다").isEqualTo(50);
  }

  @Test
  void 고양이_10연차는_1000에_열한_마리다() {
    CompanyState c = engine.open(random, engine.openingCapital());
    idle.drawCats(c, random, 10);
    assertThat(c.diamonds).isZero();
    assertThat(idle.view(c).lastDraws()).hasSize(11);
  }

  @Test
  void 옛_저장의_뽑기권은_한_장에_다이아_100으로_한_번만_바꾼다() throws Exception {
    JsonMapper json = JsonMapper.builder().build();
    CompanyState old =
        json.readValue(
            "{\"capital\":1000,\"tickets\":3,\"weaponTickets\":7,\"gachaReady\":true}",
            CompanyState.class);
    assertThat(old.diamondsReady).isFalse();
    assertThat(engine.adoptDiamonds(old)).isTrue();
    assertThat(old.diamonds).as("채용권 3 + 무기·고양이 뽑기권 7 = 10장").isEqualTo(1000);
    assertThat(old.tickets).isZero();
    assertThat(old.weaponTickets).isZero();
    assertThat(engine.adoptDiamonds(old)).as("한 번만").isFalse();
    assertThat(old.diamonds).isEqualTo(1000);
    // 뽑기권이 없던 저장은 0에서 시작한다: 시작 다이아를 다시 주지 않는다.
    CompanyState empty = json.readValue("{\"capital\":1000}", CompanyState.class);
    engine.adoptDiamonds(empty);
    assertThat(empty.diamonds).isZero();
    // 저장하고 다시 읽어도 또 바꾸지 않는다.
    CompanyState saved = json.readValue(json.writeValueAsString(old), CompanyState.class);
    assertThat(engine.adoptDiamonds(saved)).isFalse();
    assertThat(saved.diamonds).isEqualTo(1000);
  }

  @Test
  void 벽을_깨거나_이사해도_뽑기_재화는_나오지_않는다() {
    CompanyState c = engine.open(random, engine.openingCapital());
    c.capital = 10_000_000_000L;
    long before = c.diamonds;
    engine.upgrade(c);
    assertThat(c.diamonds).as("이사 채용권은 없앴다").isEqualTo(before);
    assertThat(c.tickets).isZero();
  }
}
