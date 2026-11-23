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

/** 시즌패스 (decisions.md 529·571·643번). 실제 콘텐츠와 application.yml 수치로 돌린다. */
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
  void 시즌은_4주이고_30단계에_다이아_4240을_주며_돈은_없다() {
    CompanyProperties.Pass rule = PROPERTIES.pass();
    assertThat(rule.days()).isEqualTo(28);
    assertThat(rule.steps()).isEqualTo(30);
    assertThat(rule.pointsPerStep()).isEqualTo(300);
    long diamonds = 0;
    for (int step = 1; step <= 30; step++) {
      PassRules.Reward r = engine.pass.reward(step);
      diamonds += r.diamonds();
      assertThat(r.diamonds()).as("모든 단계가 다이아를 준다").isPositive();
      assertThat(r.weapon()).as("무기는 10·20단계").isEqualTo(step % 10 == 0 && step < 30);
      assertThat(r.cat()).as("고양이는 30단계").isEqualTo(step == 30);
    }
    // 659번: 보통 80 · 5의 배수 240 · 10·20단계 400 · 30단계 800 (644번에는 20 · 60 · 100 · 200으로 1,060).
    assertThat(diamonds).isEqualTo(24 * 80 + 3 * 240 + 2 * 400 + 800).isEqualTo(4_240);
    assertThat(engine.pass.reward(1).diamonds()).isEqualTo(80);
    assertThat(engine.pass.reward(2).diamonds()).as("돈 단계였던 자리도 다이아다").isEqualTo(80);
    assertThat(engine.pass.reward(5).diamonds()).isEqualTo(240);
    assertThat(engine.pass.reward(10).diamonds()).isEqualTo(400);
    assertThat(engine.pass.reward(15).diamonds()).isEqualTo(240);
    assertThat(engine.pass.reward(20).diamonds()).isEqualTo(400);
    assertThat(engine.pass.reward(30).diamonds()).isEqualTo(800);
  }

  @Test
  void 퀘스트를_모두_하면_25일째쯤_마지막_단계에_닿는다() {
    // 643번: 하루 200 × 28일 + 한 주 1,000 × 4주 = 9,600. 30단계는 9,000이라 600(사흘)의 여유가 있다.
    CompanyProperties.Pass rule = PROPERTIES.pass();
    long daily = rule.missions().stream().filter(m -> !m.weekly()).mapToLong(m -> m.points()).sum();
    long weekly = rule.missions().stream().filter(m -> m.weekly()).mapToLong(m -> m.points()).sum();
    assertThat(daily).isEqualTo(200);
    assertThat(weekly).isEqualTo(1000);
    long cap = (long) rule.steps() * rule.pointsPerStep();
    assertThat(daily * rule.days() + weekly * (rule.days() / 7))
        .isEqualTo(9_600)
        .isGreaterThan(cap);
    // 날마다 모두 하고 주간은 그 주 첫날에 끝낸다고 해도 24일째까지는 닿지 못한다.
    assertThat(daily * 24 + weekly * 4).isLessThan(cap);
    assertThat(daily * 25 + weekly * 4).isEqualTo(cap);
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
  void 퀘스트를_깨면_포인트를_받을_수_있고_눌러야_들어온다() {
    CompanyState c = opened();
    assertThat(rewards.passView(c).missions())
        .extracting(m -> m.code())
        .containsExactly(
            "attend", "upgrade", "skill", "wall", "boss", "draw", "merge", "fish", "forever");
    assertThat(rewards.passView(c).missions())
        .extracting(m -> m.period())
        .containsExactly("day", "day", "day", "week", "week", "week", "week", "week", "week");
    assertThat(mission(c, "wall").title()).isEqualTo("매도벽 최고 기록 30개 돌파");
    assertThat(mission(c, "wall").target()).isEqualTo(30);
    assertThat(mission(c, "wall").points()).isEqualTo(250);
    assertThat(mission(c, "attend").title()).isEqualTo("출석하기");
    // 일일은 다음 날 자정, 주간은 시즌 첫날부터 7일씩: 11월 15일 정오면 둘 다 16일 0시에 바뀐다.
    assertThat(mission(c, "attend").resetsIn()).isEqualTo(12 * 3600);
    assertThat(mission(c, "wall").resetsIn()).isEqualTo(12 * 3600);
    assertThatThrownBy(() -> rewards.claimPassMission(c, null))
        .as("받을 것이 없다")
        .isInstanceOf(InvalidRequestException.class);
    // 출석 하루에 50: 저절로 들어오지 않고 받을 수 있게 된다 (572번).
    rewards.attend(c);
    assertThat(c.passExp).isZero();
    assertThat(mission(c, "attend").count()).isEqualTo(1);
    assertThat(mission(c, "attend").ready()).isEqualTo(50);
    assertThat(mission(c, "attend").done()).isFalse();
    assertThat(rewards.passView(c).missionsReady()).isEqualTo(1);
    rewards.claimPassMission(c, "attend");
    assertThat(c.passExp).isEqualTo(50);
    assertThat(mission(c, "attend").ready()).isZero();
    assertThat(mission(c, "attend").done()).isTrue();
    assertThat(rewards.passView(c).missionsReady()).isZero();
    assertThatThrownBy(() -> rewards.claimPassMission(c, "attend"))
        .as("한 주기에 한 번")
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> rewards.claimPassMission(c, "nothing"))
        .as("없는 미션")
        .isInstanceOf(InvalidRequestException.class);
    // 강화는 하루 20번에 50: 19번까지는 없고, 넘겨 센 수는 목표에서 멈추며 더 주지 않는다.
    rewards.upgraded(c, 19);
    assertThat(mission(c, "upgrade").count()).isEqualTo(19);
    assertThat(mission(c, "upgrade").ready()).isZero();
    rewards.upgraded(c, 100);
    assertThat(mission(c, "upgrade").count()).isEqualTo(20);
    assertThat(mission(c, "upgrade").ready()).isEqualTo(50);
    // 주간: 뽑기 20번, 합성 5번에 150씩. 모두 받기는 받을 수 있는 퀘스트를 다 받는다.
    rewards.drew(c, 20);
    for (int i = 0; i < 5; i++) {
      rewards.merged(c, 1);
    }
    assertThat(rewards.passView(c).missionsReady()).isEqualTo(3);
    rewards.claimPassMission(c, null);
    assertThat(c.passExp).isEqualTo(50 + 50 + 150 + 150);
    assertThat(rewards.passView(c).missionsReady()).isZero();
    rewards.drew(c, 40);
    assertThat(mission(c, "draw").ready()).as("주간도 한 주에 한 번").isZero();
    // 매도벽: 최고 기록을 넘긴 벽을 센다.
    idle.beat(c, "one", 0, "start");
    c.idle.damage = IdleEngine.maxHp(1) - 1;
    clock.now += 1000;
    idle.beat(c, "one", 1, "tick", List.of(new IdleHit(1, "bullet", 1)));
    assertThat(c.idle.wall).isEqualTo(2);
    assertThat(mission(c, "wall").count()).isEqualTo(1);
    assertThat(mission(c, "wall").ready()).isZero();
    engine.pass.progress(c, "wall", 29, idle.todayDate());
    assertThat(mission(c, "wall").ready()).isEqualTo(250);
    // 없는 미션은 아무 일도 없다.
    engine.pass.progress(c, "nothing", 100, idle.todayDate());
    assertThat(rewards.passView(c).missionsReady()).isEqualTo(1);
    // 마지막 단계를 채우면 더 쌓이지 않는다.
    rewards.addPassExp(c, 100_000);
    assertThat(c.passExp).isEqualTo(9_000);
    assertThat(rewards.passView(c).step()).isEqualTo(30);
  }

  @Test
  void 일일_퀘스트는_자정에_주간_퀘스트는_7일마다_처음부터_센다() {
    CompanyState c = opened();
    rewards.attend(c);
    rewards.claimPassMission(c, "attend");
    rewards.upgraded(c, 20);
    rewards.drew(c, 12);
    assertThat(mission(c, "upgrade").ready()).isEqualTo(50);
    // 다음 날(11월 16일 월요일): 일일은 비고, 받지 않은 강화 포인트도 사라진다. 주간도 새 주(16~22일)라 비운다.
    clock.now = Instant.parse("2026-11-16T03:00:00Z").toEpochMilli();
    assertThat(mission(c, "attend").done()).isFalse();
    assertThat(mission(c, "attend").count()).isZero();
    assertThat(mission(c, "upgrade").ready()).isZero();
    assertThat(mission(c, "upgrade").count()).isZero();
    assertThat(mission(c, "draw").count()).isZero();
    assertThat(mission(c, "attend").resetsIn()).isEqualTo(12 * 3600);
    assertThat(mission(c, "draw").resetsIn()).isEqualTo(6 * 86_400 + 12 * 3600);
    assertThat(c.passExp).as("받은 포인트는 남는다").isEqualTo(50);
    // 같은 주의 다음 날에는 주간이 이어진다.
    rewards.drew(c, 15);
    rewards.attend(c);
    rewards.claimPassMission(c, "attend");
    clock.now = Instant.parse("2026-11-17T03:00:00Z").toEpochMilli();
    assertThat(mission(c, "draw").count()).isEqualTo(15);
    assertThat(mission(c, "attend").done()).isFalse();
    rewards.drew(c, 5);
    assertThat(mission(c, "draw").ready()).isEqualTo(150);
    // 저장하고 다시 읽어도 그대로다.
    JsonMapper json = JsonMapper.builder().build();
    CompanyState saved = json.readValue(json.writeValueAsString(c), CompanyState.class);
    assertThat(rewards.passView(saved)).isEqualTo(rewards.passView(c));
  }

  @Test
  void 환생_영구_강화_스킬도_미션이다() {
    CompanyState c = opened();
    idle.beat(c, "one", 0, "start");
    assertThat(mission(c, "fish").title()).isEqualTo("환생으로 생선 100마리 얻기");
    assertThat(mission(c, "forever").title()).isEqualTo("영구 강화 5번");
    assertThat(mission(c, "skill").title()).isEqualTo("스킬 20번 사용");
    // 환생으로 얻은 생선: 광고 3배를 뺀 바탕 수로 센다. 501번째 벽은 100 × 120% = 120마리 (644번; 전에는 301번째 벽이 123마리).
    c.idle.wall = 501;
    idle.rebirth(c, true);
    assertThat(c.fish).isEqualTo(360);
    assertThat(mission(c, "fish").count()).as("목표에서 멈춘다").isEqualTo(100);
    assertThat(mission(c, "fish").ready()).isEqualTo(150);
    // 영구 강화는 한 주에 다섯 번이면 150.
    for (int i = 0; i < 5; i++) {
      idle.buyFishUpgrade(c, "damage");
    }
    assertThat(mission(c, "forever").count()).isEqualTo(5);
    assertThat(mission(c, "forever").ready()).isEqualTo(150);
    // 스킬은 쓴 횟수.
    c.idle.wall = 101;
    c.idle.best = 100;
    c.idle.bossCleared = 100;
    idle.useActive(c, "barrage");
    assertThat(mission(c, "skill").count()).isEqualTo(1);
    rewards.claimPassMission(c, null);
    assertThat(c.passExp).isEqualTo(150 + 150);
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
    assertThat(mission(c, "boss").ready()).isEqualTo(150);
    assertThat(c.passExp).as("눌러서 받기 전에는 들어오지 않는다").isZero();
  }

  @Test
  void 미션이_시즌_내내_되풀이되던_때의_저장은_포인트를_지키고_퀘스트를_0부터_센다() throws Exception {
    opened();
    JsonMapper json = JsonMapper.builder().build();
    // 643번 전: 벽 120개, 출석 하루를 셌고 포인트 160이 들어와 있다.
    CompanyState old =
        json.readValue(
            "{\"capital\":1000,\"passSeason\":1,\"passExp\":160,\"passRules\":3,"
                + "\"passMissions\":{\"wall\":120,\"attend\":1},"
                + "\"passMissionTaken\":{\"wall\":2,\"attend\":1}}",
            CompanyState.class);
    CompanyView.Pass pass = rewards.passView(old);
    assertThat(pass.points()).isEqualTo(160);
    assertThat(pass.missionsReady()).isZero();
    assertThat(pass.missions()).allMatch(m -> m.count() == 0 && !m.done());
    engine.pass.progress(old, "wall", 30, idle.todayDate());
    rewards.claimPassMission(old, "wall");
    assertThat(rewards.passView(old).points()).isEqualTo(410);
  }

  @Test
  void 단계가_50이던_때_넘친_포인트는_30단계에서_멈추고_받은_단계는_남는다() throws Exception {
    opened();
    JsonMapper json = JsonMapper.builder().build();
    CompanyState old =
        json.readValue(
            "{\"capital\":1000,\"passSeason\":1,\"passExp\":12000,\"passRules\":3,"
                + "\"passClaimed\":[1,2,3,35]}",
            CompanyState.class);
    CompanyView.Pass pass = rewards.passView(old);
    assertThat(pass.points()).isEqualTo(9_000);
    assertThat(pass.step()).isEqualTo(30);
    assertThat(pass.steps()).hasSize(30);
    assertThat(pass.claimable()).isEqualTo(27);
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
    assertThat(c.diamonds).isEqualTo(80);
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
    assertThat(c.diamonds).isEqualTo(160);
    // 모두 받기: 남은 3·4단계.
    rewards.claimPass(c, null, random);
    // 1~4단계 모두 80씩 (659번, 644번에는 20씩).
    assertThat(c.diamonds).isEqualTo(4 * 80);
    assertThat(rewards.passView(c).claimable()).isZero();
    assertThat(rewards.passView(c).lastRewards()).extracting(r -> r.step()).containsExactly(3, 4);
    assertThat(rewards.passView(c).steps().get(3).claimed()).isTrue();
    assertThat(rewards.passView(c).steps().get(4).reached()).isFalse();
  }

  @Test
  void 열_단계는_무기를_마지막_단계는_고양이를_더_준다() {
    CompanyState c = opened();
    c.diamonds = 0;
    rewards.addPassExp(c, 9_000);
    int weapons = c.weapons.stream().mapToInt(w -> w.count).sum();
    rewards.claimPass(c, 10, random);
    assertThat(c.diamonds).isEqualTo(400);
    assertThat(c.weapons.stream().mapToInt(w -> w.count).sum()).isEqualTo(weapons + 1);
    CompanyView.PassReward ten = rewards.passView(c).lastRewards().getFirst();
    assertThat(ten.weaponKind()).isNotNull();
    assertThat(ten.weaponGrade()).isIn(MentalEngine.DRAW_GRADES);
    assertThat(ten.cat()).isNull();
    rewards.claimPass(c, 30, random);
    assertThat(c.diamonds).isEqualTo(400 + 800);
    CompanyView.PassReward last = rewards.passView(c).lastRewards().getFirst();
    assertThat(last.cat()).isNotNull();
    assertThat(last.catName()).isNotBlank();
    assertThat(idle.view(c).cats().stream().mapToInt(cat -> cat.level()).sum()).isEqualTo(1);
    // 한 시즌을 다 받으면 다이아 4,240 (659번, 644번에는 1,060).
    rewards.claimPass(c, null, random);
    assertThat(c.diamonds).isEqualTo(4_240);
    assertThat(c.passClaimed).hasSize(30);
  }

  @Test
  void 시즌이_바뀌면_진행도가_비고_받지_않은_보상은_사라진다() throws Exception {
    CompanyState c = opened();
    c.diamonds = 0;
    rewards.addPassExp(c, 1500);
    rewards.upgraded(c, 20);
    rewards.drew(c, 20);
    assertThat(rewards.passView(c).missionsReady()).isEqualTo(2);
    rewards.claimPass(c, 1, random);
    assertThat(c.diamonds).isEqualTo(80);
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
    assertThat(c.diamonds).as("받은 것은 그대로다").isEqualTo(80);
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
    assertThat(rewards.passView(old).points()).isEqualTo(1400);
  }
}
