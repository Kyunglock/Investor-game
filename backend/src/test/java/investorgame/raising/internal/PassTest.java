package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import investorgame.raising.CompanyService.IdleHit;
import investorgame.raising.CompanyView;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 시즌패스 (decisions.md 529번). 실제 콘텐츠와 application.yml 수치로 돌린다. */
class PassTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final long DAY = 86_400_000L;

  private final CompanyEngine engine =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);
  private final IdleEngineTest.MutableClock clock = new IdleEngineTest.MutableClock();
  private final IdleEngine idle = new IdleEngine(clock, engine);
  private final RewardsEngine rewards = new RewardsEngine(idle, engine);
  private final HashSeededRandom random = new HashSeededRandom(9);

  private CompanyState opened() {
    // 2026-11-15 12:00 (한국 시간): 첫 시즌(11월 2일 ~ 29일)의 14일째.
    clock.now = Instant.parse("2026-11-15T03:00:00Z").toEpochMilli();
    CompanyState c = engine.open(random, engine.openingCapital());
    c.capital = 0;
    c.diamonds = 0;
    return c;
  }

  @Test
  void 시즌은_4주이고_30단계에_다이아_2300을_준다() {
    CompanyProperties.Pass rule = PROPERTIES.pass();
    assertThat(rule.days()).isEqualTo(28);
    assertThat(rule.steps()).isEqualTo(30);
    assertThat(rule.expPerStep()).isEqualTo(100);
    long diamonds = 0;
    int money = 0;
    for (int step = 1; step <= 30; step++) {
      PassRules.Reward r = engine.pass.reward(step);
      diamonds += r.diamonds();
      money += r.money() ? 1 : 0;
      assertThat(r.weapon()).as("무기는 10·20단계").isEqualTo(step == 10 || step == 20);
      assertThat(r.cat()).as("고양이는 30단계").isEqualTo(step == 30);
    }
    assertThat(diamonds).isEqualTo(12 * 50 + 3 * 200 + 2 * 300 + 500);
    assertThat(money).as("보통 단계 스물넷 가운데 절반은 돈").isEqualTo(12);
    // 보통 단계는 다이아와 돈이 번갈아 나온다.
    assertThat(engine.pass.reward(1).diamonds()).isEqualTo(50);
    assertThat(engine.pass.reward(2).money()).isTrue();
    assertThat(engine.pass.reward(3).diamonds()).isEqualTo(50);
    assertThat(engine.pass.reward(4).money()).isTrue();
    assertThat(engine.pass.reward(5).diamonds()).isEqualTo(200);
    assertThat(engine.pass.reward(6).diamonds()).as("5단계 다음도 차례를 잇는다").isEqualTo(50);
    assertThat(engine.pass.reward(10).diamonds()).isEqualTo(300);
    assertThat(engine.pass.reward(15).diamonds()).isEqualTo(200);
    assertThat(engine.pass.reward(30).diamonds()).isEqualTo(500);
  }

  @Test
  void 시즌은_한국_시간으로_4주마다_바뀌고_남은_시간이_보인다() {
    CompanyState c = opened();
    CompanyView.Pass pass = rewards.passView(c);
    assertThat(pass.season()).isEqualTo(1);
    assertThat(pass.name()).isEqualTo("시즌 1");
    // 11월 30일 00:00 (한국 시간)에 끝난다.
    assertThat(pass.endsAt()).isEqualTo(Instant.parse("2026-11-29T15:00:00Z").toEpochMilli());
    assertThat(pass.secondsLeft()).isEqualTo(14 * 86_400 + 12 * 3600);
    assertThat(pass.endingSoon()).isFalse();
    assertThat(pass.steps()).hasSize(30);
    assertThat(engine.pass.season(c, LocalDate.parse("2026-11-29"))).isEqualTo(1);
    assertThat(engine.pass.season(c, LocalDate.parse("2026-11-30"))).isEqualTo(2);
    assertThat(engine.pass.season(c, LocalDate.parse("2026-10-01"))).as("첫 시즌 전이면 1").isEqualTo(1);
    // 끝나기 하루 전부터 알려 준다.
    clock.now = Instant.parse("2026-11-29T03:00:00Z").toEpochMilli();
    assertThat(rewards.passView(c).endingSoon()).isTrue();
  }

  @Test
  void 경험치는_벽과_스테이지와_EX와_출석으로_얻고_스테이지는_하루_100까지다() {
    CompanyState c = opened();
    CompanyProperties.PassExp exp = PROPERTIES.pass().exp();
    // 출석 100.
    rewards.attend(c);
    assertThat(c.passExp).isEqualTo(100);
    // EX 디펜스 50.
    rewards.exDone(c);
    assertThat(c.passExp).isEqualTo(150);
    // 멘탈 보호 스테이지: 깰 때마다 20, 하루 100까지.
    for (int i = 0; i < 8; i++) {
      rewards.stageCleared(c);
    }
    assertThat(exp.stage()).isEqualTo(20);
    assertThat(c.passExp).as("여덟 번 깨도 100").isEqualTo(250);
    clock.now += DAY;
    rewards.stageCleared(c);
    assertThat(c.passExp).as("다음 날은 다시 얻는다").isEqualTo(270);
    // 매도벽 하나에 2.
    idle.beat(c, "one", 0, "start");
    c.idle.damage = IdleEngine.maxHp(1) - 1;
    clock.now += 1000;
    idle.beat(c, "one", 1, "tick", List.of(new IdleHit(1, "bullet", 1)));
    assertThat(c.idle.wall).isEqualTo(2);
    assertThat(c.passExp).isEqualTo(272);
    assertThat(rewards.passView(c).step()).isEqualTo(2);
    // 마지막 단계를 채우면 더 쌓이지 않는다.
    rewards.addPassExp(c, 100_000);
    assertThat(c.passExp).isEqualTo(3000);
    assertThat(rewards.passView(c).step()).isEqualTo(30);
  }

  @Test
  void 도달한_단계만_한_번_받고_모두_받기도_된다() {
    CompanyState c = opened();
    engine.hire(
        c,
        java.util.Map.of(
            "insight", 50, "patience", 50, "courage", 50, "conviction", 50, "luck", 50));
    c.diamonds = 0;
    assertThatThrownBy(() -> rewards.claimPass(c, 1, random))
        .as("아직 도달하지 않았다")
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> rewards.claimPass(c, null, random))
        .as("받을 것이 없다")
        .isInstanceOf(InvalidRequestException.class);
    rewards.addPassExp(c, 450);
    assertThat(rewards.passView(c).step()).isEqualTo(4);
    assertThat(rewards.passView(c).claimable()).isEqualTo(4);
    rewards.claimPass(c, 1, random);
    assertThat(c.diamonds).isEqualTo(50);
    assertThat(rewards.passView(c).lastRewards()).hasSize(1);
    assertThatThrownBy(() -> rewards.claimPass(c, 1, random))
        .as("이미 받았다")
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> rewards.claimPass(c, 5, random))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> rewards.claimPass(c, 31, random))
        .isInstanceOf(InvalidRequestException.class);
    // 돈 단계는 그때 회사의 초당 수입 30분어치다.
    double before = c.capital;
    rewards.claimPass(c, 2, random);
    assertThat(c.capital - before).isEqualTo(Math.floor(30 * 60 * idle.perSecond(c)));
    assertThat(c.diamonds).isEqualTo(50);
    // 모두 받기: 남은 3·4단계.
    rewards.claimPass(c, null, random);
    assertThat(c.diamonds).as("3단계 50, 4단계는 돈").isEqualTo(100);
    assertThat(rewards.passView(c).claimable()).isZero();
    assertThat(rewards.passView(c).lastRewards()).extracting(r -> r.step()).containsExactly(3, 4);
    assertThat(rewards.passView(c).steps().get(3).claimed()).isTrue();
    assertThat(rewards.passView(c).steps().get(4).reached()).isFalse();
  }

  @Test
  void 열_단계는_무기를_마지막_단계는_고양이를_더_준다() {
    CompanyState c = opened();
    c.diamonds = 0;
    rewards.addPassExp(c, 3000);
    int weapons = c.weapons.stream().mapToInt(w -> w.count).sum();
    rewards.claimPass(c, 10, random);
    assertThat(c.diamonds).isEqualTo(300);
    assertThat(c.weapons.stream().mapToInt(w -> w.count).sum()).isEqualTo(weapons + 1);
    CompanyView.PassReward ten = rewards.passView(c).lastRewards().getFirst();
    assertThat(ten.weaponKind()).isNotNull();
    assertThat(ten.weaponGrade()).isIn(MentalEngine.DRAW_GRADES);
    assertThat(ten.cat()).isNull();
    rewards.claimPass(c, 30, random);
    assertThat(c.diamonds).isEqualTo(800);
    CompanyView.PassReward last = rewards.passView(c).lastRewards().getFirst();
    assertThat(last.cat()).isNotNull();
    assertThat(last.catName()).isNotBlank();
    assertThat(idle.view(c).cats().stream().mapToInt(cat -> cat.level()).sum()).isEqualTo(1);
    // 한 시즌을 다 받으면 다이아 2,300.
    rewards.claimPass(c, null, random);
    assertThat(c.diamonds).isEqualTo(2300);
    assertThat(c.passClaimed).hasSize(30);
  }

  @Test
  void 시즌이_바뀌면_진행도가_비고_받지_않은_보상은_사라진다() throws Exception {
    CompanyState c = opened();
    c.diamonds = 0;
    rewards.addPassExp(c, 500);
    rewards.claimPass(c, 1, random);
    assertThat(c.diamonds).isEqualTo(50);
    // 저장하고 다시 읽어도 그대로다.
    JsonMapper json = JsonMapper.builder().build();
    CompanyState saved = json.readValue(json.writeValueAsString(c), CompanyState.class);
    assertThat(rewards.passView(saved)).isEqualTo(rewards.passView(c));
    // 11월 30일: 다음 시즌.
    clock.now = Instant.parse("2026-11-30T03:00:00Z").toEpochMilli();
    CompanyView.Pass next = rewards.passView(c);
    assertThat(next.season()).isEqualTo(2);
    assertThat(next.exp()).isZero();
    assertThat(next.step()).isZero();
    assertThat(next.claimable()).as("받지 않은 2~5단계는 사라졌다").isZero();
    assertThat(next.steps()).noneMatch(s -> s.claimed());
    assertThatThrownBy(() -> rewards.claimPass(c, 2, random))
        .isInstanceOf(InvalidRequestException.class);
    assertThat(c.diamonds).as("받은 것은 그대로다").isEqualTo(50);
    // 테스트판은 시즌을 넘길 수 있다.
    rewards.addPassExp(c, 200);
    rewards.nextSeason(c);
    assertThat(rewards.passView(c).season()).isEqualTo(3);
    assertThat(rewards.passView(c).exp()).isZero();
    // 시즌 칸이 없던 옛 저장은 지금 시즌의 0에서 시작한다.
    CompanyState old = json.readValue("{\"capital\":1000}", CompanyState.class);
    assertThat(rewards.passView(old).season()).isEqualTo(2);
    assertThat(rewards.passView(old).exp()).isZero();
  }
}
