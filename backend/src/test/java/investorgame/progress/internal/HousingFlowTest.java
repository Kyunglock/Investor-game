package investorgame.progress.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.TestcontainersConfiguration;
import investorgame.asset.AssetService;
import investorgame.common.Hint;
import investorgame.common.Phase;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.event.ChoiceTicket;
import investorgame.event.EventKind;
import investorgame.event.EventService;
import investorgame.event.EventView;
import investorgame.event.HintProvider;
import investorgame.event.HousingFacts;
import investorgame.event.ScheduleResult;
import investorgame.event.SchedulingContext;
import investorgame.household.HouseholdService;
import investorgame.household.HouseholdView;
import investorgame.housing.HousingService;
import investorgame.housing.Tenure;
import investorgame.market.MarketService;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** 주거 설계 3절의 돈 계산: 계약금·LTV·DSR로 막고, 전세사기면 보증금을 잃고, 집은 총자산에 들어간다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class HousingFlowTest {

  private static final int YEAR = 360;
  private static final int JOB_DAY = 10 * YEAR;
  private static final HintProvider HINTS =
      (truth, seq) -> new Hint(Hint.HintDirection.NEUTRAL, Hint.HintStrength.MILD);

  @Autowired HousingFlow flow;
  @Autowired HousingService housing;
  @Autowired AssetService assets;
  @Autowired MarketService market;
  @Autowired HouseholdService household;
  @Autowired EventService events;

  UUID gameId;
  HouseholdView single;

  @BeforeEach
  void setUp() {
    gameId = UUID.randomUUID();
    assets.create(gameId, new SplittableRandom(1));
    market.create(gameId);
    household.create(gameId);
    housing.create(gameId);
    single = household.get(gameId);
  }

  @Test
  void 집은_계약금이_있고_소득이_DSR을_넘어야_살_수_있다() {
    long cash = assets.get(gameId).cash();
    long seoul = market.homePrices(gameId).get("seoul");
    assets.credit(gameId, "WINDFALL", seoul - cash, JOB_DAY);

    HousingFlow.Plan noIncome =
        flow.plans(gameId, List.of("BUY_SEOUL"), false, single, 0, 0, JOB_DAY).getFirst();
    assertThat(noIncome.mortgage()).as("소득이 없으면 주담대가 안 된다").isZero();
    assertThat(noIncome.cashNeeded()).isEqualTo(seoul);
    assertThat(noIncome.blocked()).isNull();

    HousingFlow.Plan rich =
        flow.plans(gameId, List.of("BUY_SEOUL"), false, single, 20_000_000, 0, JOB_DAY).getFirst();
    assertThat(rich.mortgage()).as("LTV 50%").isEqualTo(seoul / 2 / 1_000_000 * 1_000_000);

    HousingFlow.Plan modest =
        flow.plans(gameId, List.of("BUY_SEOUL"), false, single, 3_000_000, 0, JOB_DAY).getFirst();
    assertThat(modest.mortgage()).as("월 300만 소득이면 DSR 40%에 걸린다").isLessThan(rich.mortgage());
    assertThat(modest.monthlyBurden()).isLessThanOrEqualTo(3_000_000 * 40 / 100);

    assets.spend(gameId, "LIFE_COST", assets.get(gameId).cash() - 10_000_000, JOB_DAY, null);
    HousingFlow.Plan poor =
        flow.plans(gameId, List.of("BUY_SEOUL", "MONTHLY"), false, single, 3_000_000, 0, JOB_DAY)
            .getFirst();
    assertThat(poor.blocked()).contains("모자란다");
    HousingFlow.Plan rent =
        flow.plans(gameId, List.of("MONTHLY"), false, single, 0, 0, JOB_DAY).getFirst();
    assertThat(rent.blocked()).as("월세는 보증금을 덜 내고 월세를 더 내서라도 구한다").isNull();
  }

  @Test
  void 전세사기를_당하면_보증금을_잃고_전세대출은_그대로_갚는다() {
    housing.rent(gameId, Tenure.VILLA_JEONSE, null, 150_000_000, 0, 120_000_000, false, JOB_DAY);
    long before = assets.totalAsset(gameId, market.prices(gameId)) + flow.equity(gameId);
    EventView leaseEnd = fraudulentLeaseEnd();
    ChoiceTicket ticket = events.prepareChoice(gameId, leaseEnd.eventId(), "MONTHLY");
    ChoiceTicket.Housing effect = (ChoiceTicket.Housing) ticket.effect();
    assertThat(effect.fraud()).isTrue();

    var outcome =
        flow.resolve(gameId, ticket, effect, single, 3_000_000, 0, new HashSeededRandom(1L));

    assertThat(outcome.message()).contains("보증금").contains("돌려받지 못했다");
    long after = assets.totalAsset(gameId, market.prices(gameId)) + flow.equity(gameId);
    assertThat(before - after).as("보증금 1.5억을 잃는다").isGreaterThanOrEqualTo(150_000_000);
    assertThat(housing.get(gameId).tenure()).isEqualTo(Tenure.MONTHLY);
  }

  @Test
  void 막힌_선택은_고를_수_없다() {
    housing.rent(gameId, Tenure.MONTHLY, null, 10_000_000, 600_000, 0, false, JOB_DAY);
    EventView leaseEnd =
        leaseEndOf(new HousingFacts("MONTHLY", JOB_DAY + YEAR, 0, false, false, null, 0, 50), 1L);
    ChoiceTicket ticket = events.prepareChoice(gameId, leaseEnd.eventId(), "BUY_SEOUL");
    assertThatThrownBy(
            () ->
                flow.resolve(
                    gameId,
                    ticket,
                    (ChoiceTicket.Housing) ticket.effect(),
                    single,
                    3_000_000,
                    0,
                    new HashSeededRandom(1L)))
        .isInstanceOf(InvalidRequestException.class);
  }

  /** 청약 가점 (decisions.md 42번): 무주택 기간·부양가족·통장 기간. 가점이 높을수록 당첨이 쉽다. */
  @Test
  void 청약_가점은_무주택_기간과_부양가족과_통장_기간으로_매긴다() {
    HouseholdView young = new HouseholdView(false, null, List.of(), null);
    assertThat(HousingFlow.cheongyakPoints(15, JOB_DAY, young, JOB_DAY, YEAR))
        .as("25세 혼자: 무주택 0 + 부양 5 + 통장 2")
        .isEqualTo(7);
    HouseholdView family = new HouseholdView(true, 12 * YEAR, List.of(14 * YEAR, 16 * YEAR), null);
    int at40 = 25 * YEAR;
    assertThat(HousingFlow.cheongyakPoints(15, JOB_DAY, family, at40, YEAR))
        .as("40세 부부+자녀 둘: 무주택(27세 결혼부터 13년) 28 + 부양 20 + 통장 17")
        .isEqualTo(28 + 20 + 17);
    assertThat(HousingFlow.cheongyakChanceBp(70)).isGreaterThan(HousingFlow.cheongyakChanceBp(60));
    assertThat(HousingFlow.cheongyakChanceBp(20)).isPositive();
  }

  @Test
  void 영끌로도_분양가를_못_치르면_청약을_넣을_수_없다() {
    HousingFlow.Plan broke =
        flow.plans(gameId, List.of("APPLY"), false, single, 3_000_000, 45, JOB_DAY).getFirst();
    assertThat(broke.blocked()).startsWith("영끌해도 청약을 넣을 수 없다.").contains("모자란다");

    long cash = assets.get(gameId).cash();
    assets.credit(gameId, "WINDFALL", broke.cashNeeded() - cash, JOB_DAY);
    HousingFlow.Plan apply =
        flow.plans(gameId, List.of("APPLY"), false, single, 3_000_000, 45, JOB_DAY).getFirst();
    assertThat(apply.blocked()).isNull();
    assertThat(apply.price()).isEqualTo(market.homePrices(gameId).get("seoul") * 70 / 100);
    assertThat(apply.detail()).contains("가점 45점").contains("분양가");
  }

  /** 보증보험 없는 빌라 만기 중 전세사기가 숨은 판을 찾는다(7%라 시드를 돌린다). */
  private EventView fraudulentLeaseEnd() {
    HousingFacts villa =
        new HousingFacts("VILLA_JEONSE", JOB_DAY + YEAR, 0, false, true, null, 0, 50);
    for (long seed = 1; seed <= 300; seed++) {
      UUID probe = UUID.randomUUID();
      EventView view = leaseEndOf(probe, villa, seed);
      if (((ChoiceTicket.Housing) events.prepareChoice(probe, view.eventId(), "MONTHLY").effect())
          .fraud()) {
        return leaseEndOf(gameId, villa, seed);
      }
    }
    throw new AssertionError("전세사기 시드를 찾지 못했다");
  }

  private EventView leaseEndOf(HousingFacts facts, long seed) {
    return leaseEndOf(gameId, facts, seed);
  }

  private EventView leaseEndOf(UUID id, HousingFacts facts, long seed) {
    SchedulingContext context =
        new SchedulingContext(
            Phase.SAVING,
            15,
            "long",
            "food",
            JOB_DAY + 30,
            true,
            null,
            55 * YEAR,
            JOB_DAY,
            "office",
            JOB_DAY,
            true,
            false,
            null,
            0,
            List.of(),
            false,
            Map.of(),
            facts);
    HashSeededRandom random = new HashSeededRandom(seed);
    int from = JOB_DAY;
    for (int i = 0; i < 50; i++) {
      int next = events.peekNextEventDay(id, context, from, random).orElseThrow();
      ScheduleResult result = events.schedule(id, context, from, next, random, HINTS);
      if (result.pending().isPresent() && result.pending().get().kind() == EventKind.HOUSING) {
        return result.pending().get();
      }
      result
          .pending()
          .ifPresent(
              v ->
                  events.complete(
                      id, v.eventId(), new investorgame.event.Completion("x", "x", List.of())));
      from = next;
    }
    throw new AssertionError("주거 이벤트가 오지 않았다");
  }
}
