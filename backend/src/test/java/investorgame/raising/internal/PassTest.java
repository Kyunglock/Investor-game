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

/** 시즌패스 (decisions.md 529·571번). 실제 콘텐츠와 application.yml 수치로 돌린다. */
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
  void 시즌은_4주이고_30단계에_다이아_2900을_주며_돈은_없다() {
    CompanyProperties.Pass rule = PROPERTIES.pass();
    assertThat(rule.days()).isEqualTo(28);
    assertThat(rule.steps()).isEqualTo(30);
    assertThat(rule.pointsPerStep()).isEqualTo(300);
    long diamonds = 0;
    for (int step = 1; step <= 30; step++) {
      PassRules.Reward r = engine.pass.reward(step);
      diamonds += r.diamonds();
      assertThat(r.diamonds()).as("모든 단계가 다이아를 준다").isPositive();
      assertThat(r.weapon()).as("무기는 10·20단계").isEqualTo(step == 10 || step == 20);
      assertThat(r.cat()).as("고양이는 30단계").isEqualTo(step == 30);
    }
    assertThat(diamonds).isEqualTo(24 * 50 + 3 * 200 + 2 * 300 + 500);
    assertThat(engine.pass.reward(1).diamonds()).isEqualTo(50);
    assertThat(engine.pass.reward(2).diamonds()).as("돈 단계였던 자리도 다이아다").isEqualTo(50);
    assertThat(engine.pass.reward(5).diamonds()).isEqualTo(200);
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

  private CompanyView.PassMission mission(CompanyState c, String code) {
    return rewards.passView(c).missions().stream()
        .filter(m -> m.code().equals(code))
        .findFirst()
        .orElseThrow();
  }

  @Test
  void 미션을_깨면_포인트를_받을_수_있고_눌러야_들어온다() {
    CompanyState c = opened();
    assertThat(rewards.passView(c).missions())
        .extracting(m -> m.code())
        .containsExactly("wall", "boss", "upgrade", "draw", "merge", "attend");
    assertThat(mission(c, "wall").title()).isEqualTo("매도벽 최고 기록 50개 돌파");
    assertThat(mission(c, "wall").target()).isEqualTo(50);
    assertThat(mission(c, "wall").points()).isEqualTo(30);
    assertThatThrownBy(() -> rewards.claimPassMission(c, null))
        .as("받을 것이 없다")
        .isInstanceOf(InvalidRequestException.class);
    // 출석 하루에 100: 저절로 들어오지 않고 받을 수 있게 된다 (572번).
    rewards.attend(c);
    assertThat(c.passExp).isZero();
    assertThat(mission(c, "attend").count()).isEqualTo(1);
    // 받을 것이 있는 동안에는 닿은 문턱을 가리키고, 받으면 다음 문턱으로 넘어간다 (#912).
    assertThat(mission(c, "attend").title()).isEqualTo("출석 1일");
    assertThat(mission(c, "attend").target()).isEqualTo(1);
    assertThat(mission(c, "attend").ready()).isEqualTo(100);
    assertThat(mission(c, "attend").earned()).isZero();
    assertThat(rewards.passView(c).missionsReady()).isEqualTo(1);
    rewards.claimPassMission(c, "attend");
    assertThat(c.passExp).isEqualTo(100);
    assertThat(mission(c, "attend").ready()).isZero();
    assertThat(mission(c, "attend").earned()).isEqualTo(100);
    assertThat(rewards.passView(c).missionsReady()).isZero();
    assertThatThrownBy(() -> rewards.claimPassMission(c, "attend"))
        .as("두 번 받지 못한다")
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> rewards.claimPassMission(c, "nothing"))
        .as("없는 미션")
        .isInstanceOf(InvalidRequestException.class);
    // 강화는 50번마다 30: 49번까지는 없다.
    rewards.upgraded(c, 49);
    assertThat(mission(c, "upgrade").count()).isEqualTo(49);
    assertThat(mission(c, "upgrade").target()).isEqualTo(50);
    assertThat(mission(c, "upgrade").ready()).isZero();
    rewards.upgraded(c, 1);
    assertThat(mission(c, "upgrade").ready()).isEqualTo(30);
    assertThat(mission(c, "upgrade").title()).isEqualTo("강화 50번");
    // 받지 않고 여러 문턱을 넘으면 그만큼 쌓여 한 번에 받는다. 가리키는 것은 닿은 마지막 문턱이다.
    rewards.upgraded(c, 110);
    assertThat(mission(c, "upgrade").ready()).isEqualTo(90);
    assertThat(mission(c, "upgrade").count()).isEqualTo(160);
    assertThat(mission(c, "upgrade").target()).isEqualTo(150);
    assertThat(mission(c, "upgrade").title()).isEqualTo("강화 150번");
    assertThat(c.passExp).isEqualTo(100);
    rewards.claimPassMission(c, "upgrade");
    assertThat(c.passExp).isEqualTo(190);
    assertThat(mission(c, "upgrade").target()).isEqualTo(200);
    assertThat(mission(c, "upgrade").title()).isEqualTo("강화 200번");
    // 뽑기는 10번마다 30, 합성은 5번마다 30. 모두 받기는 받을 수 있는 미션을 다 받는다.
    rewards.drew(c, 11);
    for (int i = 0; i < 5; i++) {
      rewards.merged(c, 1);
    }
    assertThat(rewards.passView(c).missionsReady()).isEqualTo(2);
    rewards.claimPassMission(c, null);
    assertThat(c.passExp).isEqualTo(250);
    assertThat(rewards.passView(c).missionsReady()).isZero();
    // 매도벽: 통과한 벽을 센다.
    idle.beat(c, "one", 0, "start");
    c.idle.damage = IdleEngine.maxHp(1) - 1;
    clock.now += 1000;
    idle.beat(c, "one", 1, "tick", List.of(new IdleHit(1, "bullet", 1)));
    assertThat(c.idle.wall).isEqualTo(2);
    assertThat(mission(c, "wall").count()).isEqualTo(1);
    assertThat(mission(c, "wall").ready()).as("벽 하나로는 아직 없다").isZero();
    engine.pass.progress(c, "wall", 49, idle.todayDate());
    assertThat(mission(c, "wall").ready()).as("쉰 번째 벽").isEqualTo(30);
    assertThat(mission(c, "wall").title()).isEqualTo("매도벽 최고 기록 50개 돌파");
    // 보스는 한 번에 30.
    engine.pass.progress(c, "boss", 1, idle.todayDate());
    rewards.claimPassMission(c, null);
    assertThat(c.passExp).isEqualTo(310);
    assertThat(rewards.passView(c).points()).isEqualTo(310);
    assertThat(rewards.passView(c).step()).isEqualTo(1);
    // 없는 미션은 아무 일도 없다.
    engine.pass.progress(c, "nothing", 100, idle.todayDate());
    assertThat(rewards.passView(c).missionsReady()).isZero();
    // 마지막 단계를 채우면 더 쌓이지 않는다.
    rewards.addPassExp(c, 100_000);
    assertThat(c.passExp).isEqualTo(9000);
    assertThat(rewards.passView(c).step()).isEqualTo(30);
  }

  @Test
  void 벽_미션은_최고_기록을_넘긴_벽만_센다() {
    CompanyState c = opened();
    idle.beat(c, "one", 0, "start");
    c.idle.wall = 50;
    c.idle.damage = IdleEngine.maxHp(50) - 1;
    clock.now += 1000;
    idle.beat(c, "one", 1, "tick", List.of(new IdleHit(50, "bullet", 1)));
    assertThat(c.idle.wall).isEqualTo(51);
    assertThat(c.idle.best).isEqualTo(50);
    assertThat(mission(c, "wall").count()).isEqualTo(1);
    // 환생하면 첫 벽으로 돌아가지만 기록은 남는다 (596번): 전에 깬 벽을 다시 부수는 것은 세지 않는다.
    idle.rebirth(c);
    assertThat(c.idle.wall).isEqualTo(1);
    c.idle.damage = IdleEngine.maxHp(1) - 1;
    clock.now += 1000;
    idle.beat(c, "one", 2, "tick", List.of(new IdleHit(1, "bullet", 1)));
    assertThat(c.idle.wall).isEqualTo(2);
    assertThat(c.idle.best).isEqualTo(50);
    assertThat(mission(c, "wall").count()).as("다시 부순 벽은 세지 않는다").isEqualTo(1);
    // 기록을 넘기면 다시 센다.
    c.idle.wall = 51;
    c.idle.damage = IdleEngine.maxHp(51) - 1;
    clock.now += 1000;
    idle.beat(c, "one", 3, "tick", List.of(new IdleHit(51, "bullet", 1)));
    assertThat(c.idle.best).isEqualTo(51);
    assertThat(mission(c, "wall").count()).isEqualTo(2);
  }

  @Test
  void 보스를_처음_깨면_보스_미션이_오른다() {
    CompanyState c = opened();
    idle.beat(c, "one", 0, "start");
    c.idle.wall = 50;
    c.idle.damage = IdleEngine.maxHp(50) - 1;
    clock.now += 1000;
    idle.beat(c, "one", 1, "tick", List.of(new IdleHit(50, "bullet", 1)));
    assertThat(c.idle.wall).isEqualTo(51);
    assertThat(mission(c, "boss").count()).isEqualTo(1);
    assertThat(mission(c, "wall").count()).isEqualTo(1);
    assertThat(mission(c, "boss").ready()).isEqualTo(30);
    assertThat(c.passExp).as("눌러서 받기 전에는 들어오지 않는다").isZero();
  }

  @Test
  void 포인트가_저절로_들어오던_때의_저장은_닿은_문턱을_두_번_주지_않는다() throws Exception {
    opened();
    JsonMapper json = JsonMapper.builder().build();
    // 572번 전: 벽 120개로 60, 출석 하루로 100이 이미 들어와 있다.
    CompanyState old =
        json.readValue(
            "{\"capital\":1000,\"passSeason\":1,\"passExp\":160,\"passRules\":2,"
                + "\"passMissions\":{\"wall\":120,\"attend\":1}}",
            CompanyState.class);
    CompanyView.Pass pass = rewards.passView(old);
    assertThat(pass.points()).isEqualTo(160);
    assertThat(pass.missionsReady()).isZero();
    assertThat(mission(old, "wall").earned()).isEqualTo(60);
    assertThatThrownBy(() -> rewards.claimPassMission(old, null))
        .isInstanceOf(InvalidRequestException.class);
    // 그 뒤에 닿은 문턱부터 눌러서 받는다.
    engine.pass.progress(old, "wall", 30, idle.todayDate());
    assertThat(mission(old, "wall").ready()).isEqualTo(30);
    rewards.claimPassMission(old, "wall");
    assertThat(rewards.passView(old).points()).isEqualTo(190);
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
    rewards.addPassExp(c, 1350);
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
    // 돈은 주지 않는다 (570번): 2단계도 다이아다.
    double before = c.capital;
    rewards.claimPass(c, 2, random);
    assertThat(c.capital).isEqualTo(before);
    assertThat(c.diamonds).isEqualTo(100);
    // 모두 받기: 남은 3·4단계.
    rewards.claimPass(c, null, random);
    assertThat(c.diamonds).isEqualTo(200);
    assertThat(rewards.passView(c).claimable()).isZero();
    assertThat(rewards.passView(c).lastRewards()).extracting(r -> r.step()).containsExactly(3, 4);
    assertThat(rewards.passView(c).steps().get(3).claimed()).isTrue();
    assertThat(rewards.passView(c).steps().get(4).reached()).isFalse();
  }

  @Test
  void 열_단계는_무기를_마지막_단계는_고양이를_더_준다() {
    CompanyState c = opened();
    c.diamonds = 0;
    rewards.addPassExp(c, 9000);
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
    // 한 시즌을 다 받으면 다이아 2,900.
    rewards.claimPass(c, null, random);
    assertThat(c.diamonds).isEqualTo(2900);
    assertThat(c.passClaimed).hasSize(30);
  }

  @Test
  void 시즌이_바뀌면_진행도가_비고_받지_않은_보상은_사라진다() throws Exception {
    CompanyState c = opened();
    c.diamonds = 0;
    rewards.addPassExp(c, 1500);
    rewards.upgraded(c, 20);
    rewards.drew(c, 10);
    assertThat(rewards.passView(c).missionsReady()).isEqualTo(1);
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
    assertThat(next.points()).isZero();
    assertThat(next.missions()).as("미션도 처음부터 센다").allMatch(m -> m.count() == 0);
    assertThat(next.missionsReady()).as("받지 않은 미션 포인트도 사라졌다").isZero();
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
    assertThat(rewards.passView(c).points()).isZero();
    // 시즌 칸이 없던 옛 저장은 지금 시즌의 0에서 시작한다.
    CompanyState old = json.readValue("{\"capital\":1000}", CompanyState.class);
    assertThat(rewards.passView(old).season()).isEqualTo(2);
    assertThat(rewards.passView(old).points()).isZero();
  }

  @Test
  void 단계에_100이_들던_때의_저장은_닿은_단계를_지킨다() throws Exception {
    opened();
    JsonMapper json = JsonMapper.builder().build();
    // 570번 전: 450으로 4단계에 닿아 1·2단계를 받았다. 스테이지 경험치를 세던 칸도 남아 있다.
    CompanyState old =
        json.readValue(
            "{\"capital\":1000,\"passSeason\":1,\"passExp\":450,\"passClaimed\":[1,2],"
                + "\"passStageDay\":\"2026-11-14\",\"passStageExp\":40}",
            CompanyState.class);
    CompanyView.Pass pass = rewards.passView(old);
    assertThat(pass.points()).isEqualTo(1350);
    assertThat(pass.step()).isEqualTo(4);
    assertThat(pass.claimable()).isEqualTo(2);
    assertThat(pass.steps().get(1).claimed()).isTrue();
    // 한 번만 옮긴다.
    assertThat(rewards.passView(old).points()).isEqualTo(1350);
    rewards.attend(old);
    rewards.claimPassMission(old, "attend");
    assertThat(rewards.passView(old).points()).isEqualTo(1450);
  }
}
