package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import investorgame.raising.CompanyView;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 금고 도전 (decisions.md 641번): 보스전 등급과 금괴, 주간 던전의 카드와 층, 금고 상점. */
class VaultEngineTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);

  private final CompanyEngine engine =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);
  private final IdleEngineTest.MutableClock clock = new IdleEngineTest.MutableClock();
  private final IdleEngine idle = new IdleEngine(clock, engine);
  private final VaultEngine vault = new VaultEngine(idle, engine);

  private CompanyState opened() {
    // 2026-11-18 수요일 12:00 (한국 시간).
    clock.now = Instant.parse("2026-11-18T03:00:00Z").toEpochMilli();
    CompanyState c = engine.open(new HashSeededRandom(4), engine.openingCapital());
    engine.mental.initWeapons(c);
    c.diamonds = 0;
    return c;
  }

  @Test
  void 한_주는_한국_시간_월요일_0시에_바뀐다() {
    long sunday = Instant.parse("2026-11-22T14:59:59Z").toEpochMilli();
    long monday = Instant.parse("2026-11-22T15:00:00Z").toEpochMilli();
    assertThat(VaultEngine.weekOf(monday)).isEqualTo(VaultEngine.weekOf(sunday) + 1);
    CompanyState c = opened();
    assertThat(vault.view(c).resetsAt()).isEqualTo(monday);
  }

  @Test
  void 등급의_문턱은_한_등급마다_1_5배이고_리그는_열_등급씩이다() {
    assertThat(VaultEngine.tier(0)).isZero();
    assertThat(VaultEngine.tier(9.9)).isZero();
    assertThat(VaultEngine.tier(10)).isEqualTo(1);
    assertThat(VaultEngine.tier(14.9)).isEqualTo(1);
    assertThat(VaultEngine.tier(15)).isEqualTo(2);
    for (int tier = 1; tier <= 80; tier++) {
      double score = VaultEngine.tierScore(tier);
      assertThat(VaultEngine.tier(score)).as("문턱 %d", tier).isEqualTo(tier);
      assertThat(VaultEngine.tier(score * 0.999)).as("문턱 %d 바로 아래", tier).isEqualTo(tier - 1);
    }
    assertThat(VaultEngine.tierName(1)).isEqualTo("브론즈 1");
    assertThat(VaultEngine.tierName(10)).isEqualTo("브론즈 10");
    assertThat(VaultEngine.tierName(11)).isEqualTo("실버 1");
    assertThat(VaultEngine.tierName(50)).isEqualTo("다이아 10");
    assertThat(VaultEngine.tierName(75)).isEqualTo("마스터 25");
  }

  @Test
  void 보스전은_새로_닿은_등급마다_금괴를_주고_같은_주에_다시_주지_않는다() {
    CompanyState c = opened();
    vault.reportBoss(c, 100);
    CompanyView.VaultBoss boss = vault.view(c).boss();
    assertThat(boss.tier()).isEqualTo(6);
    assertThat(boss.best()).isEqualTo(100);
    assertThat(boss.record()).isEqualTo(100);
    assertThat(boss.nextScore()).isEqualTo(VaultEngine.tierScore(7));
    assertThat(c.vault.gold).isEqualTo(6 * VaultEngine.TIER_GOLD);
    // 더 낮거나 같은 등급의 기록은 금괴가 없다.
    vault.reportBoss(c, 60);
    vault.reportBoss(c, 100);
    assertThat(c.vault.gold).isEqualTo(6 * VaultEngine.TIER_GOLD);
    assertThat(vault.view(c).boss().best()).isEqualTo(100);
    assertThatThrownBy(() -> vault.reportBoss(c, -1)).isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> vault.reportBoss(c, Double.NaN))
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 주가_바뀌면_등급을_다시_받고_금괴와_역대_기록은_남는다() {
    CompanyState c = opened();
    vault.reportBoss(c, 100);
    clock.now += VaultEngine.WEEK_MS;
    CompanyView.Vault view = vault.view(c);
    assertThat(view.boss().tier()).isZero();
    assertThat(view.boss().best()).isZero();
    assertThat(view.boss().record()).isEqualTo(100);
    assertThat(view.gold()).isEqualTo(6 * VaultEngine.TIER_GOLD);
    vault.reportBoss(c, 100);
    assertThat(c.vault.gold).isEqualTo(12 * VaultEngine.TIER_GOLD);
  }

  @Test
  void 피해량은_지금_팀이_낼_수_있는_상한까지만_받는다() {
    CompanyState c = opened();
    double cap = idle.fieldDps(c) * VaultEngine.BOSS_SECONDS * VaultEngine.SCORE_SLACK;
    assertThat(cap).isGreaterThan(0);
    vault.reportBoss(c, 1e30);
    assertThat(vault.view(c).boss().best()).isEqualTo(cap);
  }

  @Test
  void 저장한_파티로_싸운_보스전은_그_파티가_낼_수_있는_상한까지_받는다() {
    // 654번: 출전 칸과 따로 저장한 파티로 싸우면 상한을 그 파티로 잰다. 출전 칸은 바뀌지 않는다.
    CompanyState c = opened();
    double field = idle.fieldDps(c);
    List<String> fielded = List.copyOf(c.idle.fielded);
    c.idle.cats.put("sky", 10);
    c.idle.cats.put("mint", 10);
    // 없는 고양이·가지지 않은 고양이·겹친 고양이는 빼고 잰다.
    double party = idle.partyDps(c, List.of("sky", "mint", "sky", "nope", "lilac"));
    assertThat(party).isEqualTo(idle.partyDps(c, List.of("sky", "mint")));
    assertThat(party).isGreaterThan(field);
    assertThat(c.idle.fielded).isEqualTo(fielded);
    assertThat(idle.fieldDps(c)).isEqualTo(field);
    vault.reportBoss(c, 1e30, List.of("sky", "mint"));
    assertThat(vault.view(c).boss().best())
        .isEqualTo(party * VaultEngine.BOSS_SECONDS * VaultEngine.SCORE_SLACK);
  }

  @Test
  void 약점과_내성은_겹치지_않고_천적은_스킬_없는_고양이다() {
    for (long week = 2960; week < 3000; week++) {
      List<Integer> order = VaultEngine.skillOrder(week);
      assertThat(new HashSet<>(order)).hasSize(VaultEngine.WEAK_SKILLS * 2);
      List<String> rivals = VaultEngine.rivals(week);
      assertThat(new HashSet<>(rivals)).hasSize(VaultEngine.RIVAL_CATS);
      assertThat(rivals).allMatch(code -> List.of("C", "B").contains(IdleEngine.catGrade(code)));
    }
    assertThat(VaultEngine.skillOrder(2970)).isNotEqualTo(VaultEngine.skillOrder(2971));
    CompanyView.VaultBoss boss = vault.view(opened()).boss();
    assertThat(boss.weakSkills()).hasSize(4);
    assertThat(boss.resistSkills()).hasSize(4);
    assertThat(boss.weakSkills()).noneMatch(skill -> skill.name().contains("스킬"));
  }

  @Test
  void 던전은_카드를_고른_뒤에_차례대로_깨고_층마다_금괴를_준다() {
    CompanyState c = opened();
    CompanyView.VaultDungeon dungeon = vault.view(c).dungeon();
    assertThat(dungeon.cleared()).isZero();
    assertThat(dungeon.offers()).hasSize(VaultEngine.OFFERS);
    assertThat(vault.view(c).dungeon().offers()).as("다시 봐도 같은 석 장").isEqualTo(dungeon.offers());
    assertThatThrownBy(() -> vault.clearFloor(c, 1))
        .as("카드를 고르기 전")
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> vault.pickCard(c, "없는-카드"))
        .isInstanceOf(InvalidRequestException.class);
    String first = dungeon.offers().getFirst().code();
    vault.pickCard(c, first);
    assertThat(vault.view(c).dungeon().offers()).as("고른 뒤에는 비어 있다").isEmpty();
    assertThatThrownBy(() -> vault.pickCard(c, first)).isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> vault.clearFloor(c, 2))
        .as("층을 건너뛸 수 없다")
        .isInstanceOf(InvalidRequestException.class);
    vault.clearFloor(c, 1);
    assertThat(c.vault.gold).isEqualTo(30);
    assertThatThrownBy(() -> vault.clearFloor(c, 1)).isInstanceOf(InvalidRequestException.class);
    for (int floor = 2; floor <= VaultEngine.FLOORS; floor++) {
      List<CompanyView.VaultCard> offers = vault.view(c).dungeon().offers();
      assertThat(offers).hasSize(VaultEngine.OFFERS);
      assertThat(offers)
          .as("이미 고른 카드는 다시 나오지 않는다")
          .noneMatch(o -> c.vault.cards.contains(o.code()));
      vault.pickCard(c, offers.getFirst().code());
      vault.clearFloor(c, floor);
    }
    assertThat(c.vault.gold).isEqualTo(30 + 50 + 80);
    dungeon = vault.view(c).dungeon();
    assertThat(dungeon.cleared()).isEqualTo(3);
    assertThat(dungeon.cards()).hasSize(3);
    assertThat(dungeon.offers()).isEmpty();
    assertThatThrownBy(() -> vault.clearFloor(c, 4)).isInstanceOf(InvalidRequestException.class);
    // 다음 주에는 처음부터다.
    clock.now += VaultEngine.WEEK_MS;
    dungeon = vault.view(c).dungeon();
    assertThat(dungeon.cleared()).isZero();
    assertThat(dungeon.cards()).isEmpty();
    assertThat(dungeon.offers()).hasSize(VaultEngine.OFFERS);
  }

  @Test
  void 카드의_코드는_겹치지_않고_배율은_모두_양수다() {
    assertThat(VaultEngine.CARDS.stream().map(VaultEngine.Card::code).distinct())
        .hasSize(VaultEngine.CARDS.size());
    assertThat(VaultEngine.CARDS.size())
        .as("세 층에 석 장씩 내도 남는다")
        .isGreaterThanOrEqualTo(VaultEngine.OFFERS + VaultEngine.FLOORS - 1);
    for (VaultEngine.Card card : VaultEngine.CARDS) {
      assertThat(
              List.of(
                  card.damage(),
                  card.fire(),
                  card.skill(),
                  card.mental(),
                  card.enemyHp(),
                  card.enemySpeed(),
                  card.wallHp(),
                  card.bossHp()))
          .as(card.code())
          .allMatch(percent -> percent > 0)
          .anyMatch(percent -> percent != 100);
    }
  }

  @Test
  void 금고_상점은_금괴로_사고_주마다_횟수가_다시_찬다() {
    CompanyState c = opened();
    HashSeededRandom random = new HashSeededRandom(4);
    assertThatThrownBy(() -> vault.buy(c, "diamonds", random))
        .as("금괴가 없다")
        .isInstanceOf(InvalidRequestException.class);
    vault.view(c);
    c.vault.gold = 1_000;
    assertThatThrownBy(() -> vault.buy(c, "없는-상품", random))
        .isInstanceOf(InvalidRequestException.class);
    for (int i = 0; i < 5; i++) vault.buy(c, "diamonds", random);
    assertThat(c.diamonds).isEqualTo(5 * VaultEngine.SHOP_DIAMONDS);
    assertThat(c.vault.gold).isEqualTo(1_000 - 5 * 30);
    assertThatThrownBy(() -> vault.buy(c, "diamonds", random))
        .as("이번 주 횟수를 다 썼다")
        .isInstanceOf(InvalidRequestException.class);
    long fish = c.fish;
    vault.buy(c, "fish", random);
    assertThat(c.fish).isEqualTo(fish + VaultEngine.SHOP_FISH);
    int cats = idle.view(c).cats().stream().mapToInt(CompanyView.IdleCat::level).sum();
    vault.buy(c, "cat", random);
    assertThat(idle.view(c).cats().stream().mapToInt(CompanyView.IdleCat::level).sum())
        .isEqualTo(cats + 1);
    int weapons = c.weapons.stream().mapToInt(w -> w.count).sum();
    vault.buy(c, "weapon", random);
    assertThat(c.weapons.stream().mapToInt(w -> w.count).sum()).isEqualTo(weapons + 1);
    assertThat(vault.view(c).lastNote()).isNotBlank();
    CompanyView.VaultItem diamonds = vault.view(c).shop().getFirst();
    assertThat(diamonds.left()).isZero();
    clock.now += VaultEngine.WEEK_MS;
    assertThat(vault.view(c).shop().getFirst().left()).isEqualTo(5);
  }

  @Test
  void 금고_훈련은_주가_바뀌어도_남고_값이_오르며_피해량_상한도_는다() {
    CompanyState c = opened();
    HashSeededRandom random = new HashSeededRandom(4);
    vault.view(c);
    c.vault.gold = 100;
    vault.buy(c, VaultEngine.TRAINING, random);
    assertThat(c.vault.gold).isEqualTo(60);
    vault.buy(c, VaultEngine.TRAINING, random);
    assertThat(c.vault.gold).isZero();
    assertThatThrownBy(() -> vault.buy(c, VaultEngine.TRAINING, random))
        .isInstanceOf(InvalidRequestException.class);
    clock.now += VaultEngine.WEEK_MS;
    CompanyView.Vault view = vault.view(c);
    assertThat(view.trainingPercent()).isEqualTo(2 * VaultEngine.TRAINING_STEP_PERCENT);
    CompanyView.VaultItem training = view.shop().getLast();
    assertThat(training.code()).isEqualTo(VaultEngine.TRAINING);
    assertThat(training.level()).isEqualTo(2);
    assertThat(training.price()).isEqualTo(80);
    vault.reportBoss(c, 1e30);
    assertThat(vault.view(c).boss().best())
        .isEqualTo(
            idle.fieldDps(c) * VaultEngine.BOSS_SECONDS * VaultEngine.SCORE_SLACK * 1.06,
            org.assertj.core.api.Assertions.within(1e-6));
    c.vault.training = VaultEngine.TRAINING_MAX;
    c.vault.gold = 10_000;
    assertThatThrownBy(() -> vault.buy(c, VaultEngine.TRAINING, random))
        .as("끝까지 올렸다")
        .isInstanceOf(InvalidRequestException.class);
    assertThat(vault.view(c).shop().getLast().left()).isZero();
  }

  @Test
  void 저장했다_읽어도_금고_상태가_그대로다() throws Exception {
    CompanyState c = opened();
    vault.reportBoss(c, 100);
    vault.pickCard(c, vault.view(c).dungeon().offers().getFirst().code());
    tools.jackson.databind.json.JsonMapper mapper =
        tools.jackson.databind.json.JsonMapper.builder().build();
    CompanyState read = mapper.readValue(mapper.writeValueAsString(c), CompanyState.class);
    assertThat(vault.view(read)).isEqualTo(vault.view(c));
    // 금고가 생기기 전의 저장은 빈 금고로 읽힌다.
    read.vault = null;
    assertThat(vault.view(read).gold()).isZero();
  }
}
