package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 출석 보상 (decisions.md 528번). 실제 콘텐츠와 application.yml 수치로 돌린다. */
class RewardsEngineTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final long DAY = 86_400_000L;

  private final CompanyEngine engine =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);
  private final IdleEngineTest.MutableClock clock = new IdleEngineTest.MutableClock();
  private final IdleEngine idle = new IdleEngine(clock, engine);
  private final RewardsEngine rewards = new RewardsEngine(idle, engine);

  private CompanyState opened() {
    // 2026-11-15 12:00 (한국 시간).
    clock.now = Instant.parse("2026-11-15T03:00:00Z").toEpochMilli();
    CompanyState c = engine.open(new HashSeededRandom(4), engine.openingCapital());
    c.capital = 0;
    c.diamonds = 0;
    return c;
  }

  @Test
  void 출석판은_7일이고_한_주기에_다이아_750이며_돈은_없다() {
    List<CompanyProperties.AttendanceDay> days = PROPERTIES.attendance().days();
    assertThat(days).hasSize(7);
    assertThat(days.stream().mapToLong(CompanyProperties.AttendanceDay::diamonds).toArray())
        .containsExactly(50, 50, 100, 50, 100, 100, 300);
    assertThat(days.stream().mapToLong(CompanyProperties.AttendanceDay::diamonds).sum())
        .isEqualTo(750);
    // 돈 칸은 뺐다 (564번).
    assertThat(days).allMatch(day -> day.incomeMinutes() == 0);
  }

  @Test
  void 하루에_한_번만_받고_한국_시간_자정에_다시_열린다() {
    CompanyState c = opened();
    assertThat(rewards.view(c).claimable()).as("옛 저장과 새 회사는 1일 차부터").isTrue();
    assertThat(rewards.view(c).today()).isEqualTo(1);
    rewards.attend(c);
    assertThat(c.diamonds).isEqualTo(50);
    assertThat(rewards.view(c).claimable()).isFalse();
    assertThat(rewards.view(c).today()).as("오늘 받은 칸").isEqualTo(1);
    assertThat(rewards.view(c).lastReward().diamonds()).isEqualTo(50);
    assertThatThrownBy(() -> rewards.attend(c))
        .as("같은 날 두 번")
        .isInstanceOf(InvalidRequestException.class);
    assertThat(c.diamonds).isEqualTo(50);
    // 한국 시간 23:59에는 아직 같은 날이다.
    clock.now = Instant.parse("2026-11-15T14:59:00Z").toEpochMilli();
    assertThat(rewards.view(c).claimable()).isFalse();
    // 2분 뒤는 한국 시간으로 다음 날 00:01이다.
    clock.now += 2 * 60_000L;
    assertThat(idle.today()).isEqualTo("2026-11-16");
    assertThat(rewards.view(c).claimable()).isTrue();
    assertThat(rewards.view(c).today()).isEqualTo(2);
  }

  @Test
  void 출석_보상은_돈을_주지_않는다() {
    CompanyState c = opened();
    engine.hire(
        c,
        java.util.Map.of(
            "insight", 50, "patience", 50, "courage", 50, "conviction", 50, "luck", 50));
    assertThat(rewards.view(c).board()).allMatch(day -> day.money() == null);
    double before = c.capital;
    for (int day = 0; day < 7; day++) {
      rewards.attend(c);
      assertThat(rewards.view(c).lastReward().money().doubleValue()).isZero();
      clock.now += DAY;
    }
    assertThat(c.capital).isEqualTo(before);
  }

  @Test
  void 빠진_날이_있어도_이어서_가고_7일_차_다음은_다시_1일_차다() {
    CompanyState c = opened();
    long[] expected = {50, 50, 100, 50, 100, 100, 300};
    for (int day = 0; day < 7; day++) {
      assertThat(rewards.view(c).today()).isEqualTo(day + 1);
      long before = c.diamonds;
      rewards.attend(c);
      assertThat(c.diamonds - before).as("%d일 차", day + 1).isEqualTo(expected[day]);
      var board = rewards.view(c).board();
      for (int i = 0; i < 7; i++) {
        assertThat(board.get(i).claimed()).as("받은 날 %d의 칸 %d", day + 1, i + 1).isEqualTo(i <= day);
      }
      // 사흘을 빠져도 처음으로 돌아가지 않는다.
      clock.now += (day == 2 ? 4 : 1) * DAY;
    }
    assertThat(c.diamonds).as("한 주기").isEqualTo(750);
    // 다음 날은 새 주기의 1일 차다: 받은 칸이 없다.
    assertThat(rewards.view(c).claimable()).isTrue();
    assertThat(rewards.view(c).today()).isEqualTo(1);
    assertThat(rewards.view(c).board()).noneMatch(d -> d.claimed());
    rewards.attend(c);
    assertThat(c.diamonds).isEqualTo(800);
  }

  @Test
  void 출석은_저장에_남고_테스트판은_날짜를_넘길_수_있다() throws Exception {
    CompanyState c = opened();
    rewards.attend(c);
    JsonMapper json = JsonMapper.builder().build();
    CompanyState saved = json.readValue(json.writeValueAsString(c), CompanyState.class);
    assertThat(rewards.view(saved)).isEqualTo(rewards.view(c));
    assertThat(rewards.view(saved).claimable()).isFalse();
    rewards.nextDay(saved);
    assertThat(rewards.view(saved).claimable()).isTrue();
    assertThat(rewards.view(saved).today()).isEqualTo(2);
    // 출석 칸이 없던 저장은 1일 차부터다.
    CompanyState old = json.readValue("{\"capital\":1000}", CompanyState.class);
    assertThat(rewards.view(old).today()).isEqualTo(1);
    assertThat(rewards.view(old).claimable()).isTrue();
    assertThat(rewards.view(old).lastReward()).isNull();
  }

  @Test
  void 상점은_게임_재화로_사고_하루_횟수가_한국_시간_자정에_다시_찬다() {
    // 상점 (decisions.md 541번): 무료 다이아 20(하루 1번), 돈으로 다이아 20(초당 수입 20분어치, 5번),
    // 다이아 60으로 수입 30분어치(3번), 다이아 200으로 수입 2시간어치(1번).
    CompanyState c = opened();
    assertThat(rewards.shopView(c).items())
        .extracting(i -> i.code())
        .containsExactly("free", "diamonds", "money-small", "money-large");
    rewards.buy(c, "free");
    assertThat(c.diamonds).isEqualTo(20);
    assertThat(rewards.shopView(c).lastReceipt().diamonds()).isEqualTo(20);
    assertThatThrownBy(() -> rewards.buy(c, "free"))
        .as("하루 한 번")
        .isInstanceOf(InvalidRequestException.class);
    // 돈으로 다이아: 값은 지금 초당 수입의 20분어치다.
    double perSecond = idle.perSecond(c);
    double price = Math.floor(20 * 60 * perSecond);
    assertThat(rewards.shopView(c).items().get(1).priceMoney().doubleValue()).isEqualTo(price);
    assertThatThrownBy(() -> rewards.buy(c, "diamonds"))
        .as("돈이 모자라다")
        .isInstanceOf(InvalidRequestException.class);
    c.capital = price * 5 + 7;
    for (int i = 0; i < 5; i++) rewards.buy(c, "diamonds");
    assertThat(c.capital).isEqualTo(7);
    assertThat(c.diamonds).isEqualTo(120);
    assertThat(rewards.shopView(c).items().get(1).left()).isZero();
    assertThatThrownBy(() -> rewards.buy(c, "diamonds"))
        .isInstanceOf(InvalidRequestException.class);
    // 다이아로 돈: 60개에 수입 30분어치.
    rewards.buy(c, "money-small");
    assertThat(c.diamonds).isEqualTo(60);
    assertThat(c.capital).isEqualTo(7 + Math.floor(30 * 60 * perSecond));
    assertThat(rewards.shopView(c).items().get(2).left()).isEqualTo(2);
    assertThatThrownBy(() -> rewards.buy(c, "money-large"))
        .as("다이아가 모자라다")
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> rewards.buy(c, "nothing")).isInstanceOf(InvalidRequestException.class);
    // 다음 날(한국 시간)에는 횟수가 다시 찬다.
    clock.now += DAY;
    assertThat(rewards.shopView(c).items()).allMatch(i -> i.left() == i.dailyLimit());
    rewards.buy(c, "free");
    assertThat(c.diamonds).isEqualTo(80);
    // 저장을 거쳐도 그날 산 횟수가 남는다.
    CompanyState again =
        JsonMapper.builder()
            .build()
            .readValue(JsonMapper.builder().build().writeValueAsString(c), CompanyState.class);
    assertThat(rewards.shopView(again).items().get(0).left()).isZero();
  }
}
