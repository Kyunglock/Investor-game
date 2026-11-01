package investorgame.progress.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.TestcontainersConfiguration;
import investorgame.asset.AssetService;
import investorgame.common.Hint;
import investorgame.common.Phase;
import investorgame.common.Sex;
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
import investorgame.household.Spouse;
import investorgame.housing.HousingService;
import investorgame.housing.Tenure;
import investorgame.market.MarketService;
import investorgame.progress.ChoiceOutcome;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
      (truth, seq) -> new Hint(Hint.HintDirection.NEUTRAL, Hint.HintStrength.MILD, Hint.Detail.LOW);

  @Autowired HousingFlow flow;
  @Autowired HousingService housing;
  @Autowired AssetService assets;
  @Autowired MarketService market;
  @Autowired HouseholdService household;
  @Autowired EventService events;
  @Autowired LogRepository logs;

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
    housing.rent(
        gameId, Tenure.VILLA_JEONSE, null, 150_000_000, 0, 120_000_000, false, null, JOB_DAY);
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
  void 주담대를_현금으로_일시_상환하면_원금이_줄고_현금을_넘기면_막힌다() {
    housing.buyResidence(gameId, "seoul", 1_000_000_000, 500_000_000, JOB_DAY);
    long cash = assets.get(gameId).cash();
    assets.credit(gameId, "WINDFALL", 200_000_000 - cash, JOB_DAY);
    int seq = housing.get(gameId).homes().getFirst().seq();

    flow.repay(gameId, seq, 150_000_000, JOB_DAY + 30);

    assertThat(housing.get(gameId).homes().getFirst().mortgage()).isEqualTo(350_000_000);
    assertThat(assets.get(gameId).cash()).isEqualTo(50_000_000);
    assertThatThrownBy(() -> flow.repay(gameId, seq, 60_000_000, JOB_DAY + 30))
        .isInstanceOf(InvalidRequestException.class)
        .hasMessageContaining("현금");
    assertThatThrownBy(() -> flow.repay(gameId, seq, 400_000_000, JOB_DAY + 30))
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 막힌_선택은_고를_수_없다() {
    housing.rent(gameId, Tenure.MONTHLY, null, 10_000_000, 600_000, 0, false, null, JOB_DAY);
    EventView leaseEnd =
        leaseEndOf(
            new HousingFacts(
                "MONTHLY",
                JOB_DAY + YEAR,
                0,
                false,
                false,
                null,
                0,
                50,
                true,
                false,
                false,
                false,
                true,
                null),
            1L);
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

  /** 집을 살 때 현금이 모자라면 들고 있는 주식을 팔아 보탠다 (decisions.md 100번). 모자란 만큼만, 큰 종목부터. */
  @Test
  void 현금이_모자라면_주식을_팔아_집을_산다() {
    housing.rent(gameId, Tenure.MONTHLY, null, 10_000_000, 600_000, 0, false, null, JOB_DAY);
    long seoul = market.homePrices(gameId).get("seoul");
    String code = market.prices(gameId).keySet().stream().sorted().findFirst().orElseThrow();
    long price = market.prices(gameId).get(code);
    long quantity = seoul / price + 1;
    long cash = assets.get(gameId).cash();
    assets.credit(gameId, "WINDFALL", quantity * price + 1_000_000 - cash, JOB_DAY);
    assets.buy(gameId, code, quantity, price, JOB_DAY, null);
    assertThat(assets.get(gameId).cash()).isEqualTo(1_000_000);

    HousingFlow.Plan plan =
        flow.plans(gameId, List.of("BUY_SEOUL"), false, single, 0, 0, JOB_DAY).getFirst();
    assertThat(plan.blocked()).as("주식을 팔면 치를 수 있다").isNull();
    assertThat(plan.detail()).contains("주식").contains("매도");

    EventView leaseEnd =
        leaseEndOf(
            new HousingFacts(
                "MONTHLY",
                JOB_DAY + YEAR,
                0,
                false,
                false,
                null,
                0,
                50,
                true,
                false,
                false,
                false,
                true,
                null),
            1L);
    ChoiceTicket ticket = events.prepareChoice(gameId, leaseEnd.eventId(), "BUY_SEOUL");
    var outcome =
        flow.resolve(
            gameId,
            ticket,
            (ChoiceTicket.Housing) ticket.effect(),
            single,
            0,
            0,
            new HashSeededRandom(1L));

    assertThat(outcome.message()).contains("주식").contains("팔아");
    assertThat(housing.get(gameId).ownsResidence()).isTrue();
    var account = assets.get(gameId);
    assertThat(account.debt()).as("빚 없이 치렀다").isZero();
    assertThat(account.cash()).as("한 주 단위라 조금 남을 뿐이다").isBetween(0L, price);
    assertThat(account.holdings().get(code).quantity()).as("모자란 만큼만 팔았다").isPositive();
    assertThat(logs.findAll(gameId))
        .anyMatch(e -> e.kind().equals("TRADE") && "HOUSING".equals(e.payload().get("reason")));
  }

  /** 청약 가점 (decisions.md 42번): 무주택 기간·부양가족·통장 기간. 가점이 높을수록 당첨이 쉽다. */
  @Test
  void 청약_가점은_무주택_기간과_부양가족과_통장_기간으로_매긴다() {
    HouseholdView young = new HouseholdView(false, null, List.of(), null, null);
    assertThat(HousingFlow.cheongyakPoints(15, JOB_DAY, young, JOB_DAY, YEAR))
        .as("25세 혼자: 무주택 0 + 부양 5 + 통장 2")
        .isEqualTo(7);
    HouseholdView family =
        new HouseholdView(
            true,
            12 * YEAR,
            List.of(
                new HouseholdView.Child(1, 14 * YEAR, 41 * YEAR, Sex.M),
                new HouseholdView.Child(2, 16 * YEAR, 43 * YEAR, Sex.F)),
            null,
            null);
    int at40 = 25 * YEAR;
    assertThat(HousingFlow.cheongyakPoints(15, JOB_DAY, family, at40, YEAR))
        .as("40세 부부+자녀 둘: 무주택(27세 결혼부터 13년) 28 + 부양 20 + 통장 17")
        .isEqualTo(28 + 20 + 17);
    assertThat(HousingFlow.cheongyakChanceBp(70)).isGreaterThan(HousingFlow.cheongyakChanceBp(60));
    assertThat(HousingFlow.cheongyakChanceBp(20)).isPositive();
  }

  @Test
  void 계약금과_분양_대출이_안_되면_청약을_넣을_수_없다() {
    HousingFlow.Plan broke =
        flow.plans(gameId, List.of("APPLY"), false, single, 3_000_000, 45, JOB_DAY).getFirst();
    assertThat(broke.blocked()).startsWith("청약을 넣을 수 없다.").contains("계약금");

    long cash = assets.get(gameId).cash();
    assets.credit(gameId, "WINDFALL", broke.cashNeeded() - cash, JOB_DAY);
    HousingFlow.Plan apply =
        flow.plans(gameId, List.of("APPLY"), false, single, 3_000_000, 45, JOB_DAY).getFirst();
    assertThat(apply.blocked()).isNull();
    assertThat(apply.price()).isEqualTo(market.homePrices(gameId).get("seoul") * 70 / 100);
    assertThat(apply.detail()).contains("가점 45점").contains("분양가");
  }

  /** 전세대출은 내 돈으로 모자란 만큼만 (decisions.md 107번). 현금이 넉넉하면 대출 없이 보증금을 다 내고, 없으면 80%까지 빌린다. */
  @Test
  void 전세대출은_내_돈으로_모자란_만큼만_받는다() {
    long gyeonggi = market.homePrices(gameId).get("gyeonggi");
    long deposit = gyeonggi * 30 / 100;
    long cash = assets.get(gameId).cash();
    assets.credit(gameId, "WINDFALL", deposit * 2 - cash, JOB_DAY);

    HousingFlow.Plan rich =
        flow.plans(gameId, List.of("VILLA"), false, single, 3_000_000, 0, JOB_DAY).getFirst();
    assertThat(rich.jeonseLoan()).as("현금이 넉넉하면 빌리지 않는다").isZero();
    assertThat(rich.cashNeeded()).isEqualTo(deposit);

    assets.spend(gameId, "LIFE_COST", assets.get(gameId).cash() - deposit / 2, JOB_DAY, null);
    HousingFlow.Plan half =
        flow.plans(gameId, List.of("VILLA"), false, single, 3_000_000, 0, JOB_DAY).getFirst();
    long cushion = 3 * household.monthlyExpense(gameId, JOB_DAY);
    assertThat(half.jeonseLoan())
        .as("모자란 만큼(+생활비 석 달분)만, 100만 원 단위로 올림")
        .isBetween(deposit / 2 + cushion, deposit / 2 + cushion + 1_000_000);
    assertThat(half.cashNeeded()).isLessThanOrEqualTo(deposit / 2 - cushion + 1_000_000);
    assertThat(half.blocked()).isNull();

    assets.spend(gameId, "LIFE_COST", assets.get(gameId).cash() - 1_000_000, JOB_DAY, null);
    HousingFlow.Plan poor =
        flow.plans(gameId, List.of("VILLA"), false, single, 3_000_000, 0, JOB_DAY).getFirst();
    assertThat(poor.jeonseLoan())
        .as("많아도 보증금의 80%")
        .isEqualTo(deposit * 80 / 100 / 1_000_000 * 1_000_000);
    assertThat(poor.blocked()).contains("모자란다");
    HousingFlow.Plan noIncome =
        flow.plans(gameId, List.of("VILLA"), false, single, 0, 0, JOB_DAY).getFirst();
    assertThat(noIncome.jeonseLoan()).as("소득이 없으면 안 나온다").isZero();
  }

  /**
   * 집 크기 (#117, decisions.md 105번): 혼자 원룸, 부부 투룸, 아이 하나 쓰리룸, 둘 이상 포룸. 월세·빌라 전세가 계단처럼 오르고 아파트 전세는
   * 그대로다.
   */
  @Test
  void 식구가_늘면_더_넓은_집이_필요하고_월세와_빌라_전세가_오른다() {
    assets.credit(gameId, "WINDFALL", 1_000_000_000, JOB_DAY);
    HouseholdView couple = new HouseholdView(true, JOB_DAY, List.of(), null, null);
    HouseholdView one =
        new HouseholdView(
            true,
            JOB_DAY,
            List.of(new HouseholdView.Child(1, JOB_DAY, 40 * YEAR, Sex.F)),
            null,
            null);
    HouseholdView three =
        new HouseholdView(
            true,
            JOB_DAY,
            List.of(
                new HouseholdView.Child(1, JOB_DAY, 40 * YEAR, Sex.F),
                new HouseholdView.Child(2, JOB_DAY, 41 * YEAR, Sex.M),
                new HouseholdView.Child(3, JOB_DAY, 42 * YEAR, Sex.M)),
            null,
            null);
    assertThat(HousingFlow.neededRooms(single, JOB_DAY)).isEqualTo(1);
    assertThat(HousingFlow.neededRooms(couple, JOB_DAY)).isEqualTo(2);
    assertThat(HousingFlow.neededRooms(one, JOB_DAY)).isEqualTo(3);
    assertThat(HousingFlow.neededRooms(three, JOB_DAY)).as("셋이어도 포룸까지").isEqualTo(4);
    assertThat(HousingFlow.neededRooms(one, 41 * YEAR)).as("독립한 아이는 세지 않는다").isEqualTo(2);

    List<String> codes = List.of("MONTHLY", "VILLA", "APT_JEONSE");
    List<HousingFlow.Plan> alone = flow.plans(gameId, codes, false, single, 3_000_000, 0, JOB_DAY);
    List<HousingFlow.Plan> withOne = flow.plans(gameId, codes, false, one, 3_000_000, 0, JOB_DAY);
    List<HousingFlow.Plan> big = flow.plans(gameId, codes, false, three, 3_000_000, 0, JOB_DAY);
    assertThat(alone.get(0).deposit()).isEqualTo(10_000_000);
    assertThat(alone.get(0).monthlyRent()).isEqualTo(600_000);
    assertThat(alone.get(0).detail()).startsWith("원룸 · ");
    assertThat(withOne.get(0).deposit()).isEqualTo(30_000_000);
    assertThat(withOne.get(0).monthlyRent()).isEqualTo(1_200_000);
    assertThat(withOne.get(0).detail()).startsWith("쓰리룸 · ");
    assertThat(withOne.get(0).rooms()).isEqualTo(3);
    assertThat(big.get(0).deposit()).isEqualTo(40_000_000);
    assertThat(big.get(0).monthlyRent()).isEqualTo(1_500_000);
    long gyeonggi = market.homePrices(gameId).get("gyeonggi");
    assertThat(alone.get(1).deposit()).isEqualTo(gyeonggi * 30 / 100);
    assertThat(withOne.get(1).deposit()).isEqualTo(gyeonggi * 48 / 100);
    assertThat(big.get(1).deposit()).isEqualTo(gyeonggi * 55 / 100);
    assertThat(withOne.get(2).deposit()).as("84㎡ 아파트 전세는 식구와 무관").isEqualTo(alone.get(2).deposit());
    assertThat(withOne.get(2).rooms()).isEqualTo(HousingFlow.MAX_ROOMS);
  }

  /** 좁은 집 (#117): 아이가 태어나 좁아지면 "집이 좁다"가 와서 넓은 집으로 옮기고, 그냥 살면 달마다 조금씩 지친다. */
  @Test
  void 아이가_태어나_집이_좁아지면_넓은_집으로_옮기거나_좁은_채_지친다() {
    housing.rent(gameId, Tenure.MONTHLY, null, 20_000_000, 900_000, 0, false, 2, JOB_DAY);
    household.marry(gameId, JOB_DAY, null);
    household.addChild(gameId, JOB_DAY, 27, Sex.M);
    HouseholdView family = household.get(gameId);
    assertThat(HousingFlow.cramped(housing.get(gameId), family, JOB_DAY)).isTrue();
    assertThat(flow.view(gameId, 15, JOB_DAY).cramped()).isTrue();
    assertThat(flow.view(gameId, 15, JOB_DAY).roomsName()).isEqualTo("투룸");

    int happiness = household.happiness(gameId);
    flow.month(gameId, 3, JOB_DAY + 30, new HashSeededRandom(1L));
    assertThat(household.happiness(gameId)).as("좁은 집에서는 달마다 −1").isEqualTo(happiness - 1);
    assertThat(household.familyScore(gameId)).as("석 달마다 가족 −1").isEqualTo(49);

    HousingFacts cramped =
        new HousingFacts(
            "MONTHLY",
            JOB_DAY + 30 * YEAR,
            0,
            false,
            false,
            JOB_DAY,
            0,
            50,
            false,
            true,
            false,
            false,
            true,
            null);
    EventView ask = housingOf(cramped, JOB_DAY, JOB_DAY);
    assertThat(ask.title()).isEqualTo("집이 좁다");
    assertThat(ask.occursDay()).isEqualTo(JOB_DAY + 60);
    assertThat(ask.options())
        .extracting(EventView.Option::code)
        .containsExactly(
            "MONTHLY",
            "VILLA",
            "VILLA_INSURED",
            "APT_JEONSE",
            "BUY_SEOUL",
            "BUY_GYEONGGI",
            "ENDURE");
    ChoiceTicket ticket = events.prepareChoice(gameId, ask.eventId(), "MONTHLY");
    assets.credit(gameId, "WINDFALL", 100_000_000, ask.occursDay());
    var moved =
        flow.resolve(
            gameId,
            ticket,
            (ChoiceTicket.Housing) ticket.effect(),
            family,
            3_000_000,
            0,
            new HashSeededRandom(1L));
    assertThat(moved.message()).startsWith("첫째가 태어나 더 넓은 집으로 옮겼다.").contains("쓰리룸");
    assertThat(housing.get(gameId).rooms()).isEqualTo(3);
    assertThat(housing.get(gameId).monthlyRent()).isEqualTo(1_200_000);
    assertThat(HousingFlow.cramped(housing.get(gameId), family, ask.occursDay())).isFalse();
  }

  /** 결혼한 세입자에게 오는 첫 주거 이벤트. marriedDay·facts로 "집이 좁다" 같은 장면을 띄운다. */
  private EventView housingOf(HousingFacts facts, int marriedDay, int fromDay) {
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
            null,
            true,
            marriedDay,
            null,
            1,
            List.of(),
            List.of(),
            List.of(),
            false,
            Map.of(),
            Map.of(),
            facts,
            0L,
            50,
            Set.of());
    HashSeededRandom random = new HashSeededRandom(1L);
    int from = fromDay;
    for (int i = 0; i < 50; i++) {
      int next = events.peekNextEventDay(gameId, context, from, random).orElseThrow();
      ScheduleResult result = events.schedule(gameId, context, from, next, random, HINTS);
      if (result.pending().isPresent() && result.pending().get().kind() == EventKind.HOUSING) {
        return result.pending().get();
      }
      result
          .pending()
          .ifPresent(
              v ->
                  events.complete(
                      gameId, v.eventId(), new investorgame.event.Completion("x", "x", List.of())));
      from = next;
    }
    throw new AssertionError("주거 이벤트가 오지 않았다");
  }

  /**
   * 배우자의 월세 불만 (#116, decisions.md 104번): 미루면 조금, 거스르면 많이 행복도·가족 점수가 깎이고 단계가 오르면 더. 들어주면 월세를 벗어나며
   * 가까워진다.
   */
  @Test
  void 배우자의_월세_불만을_미루거나_거스르면_멀어지고_들어주면_가까워진다() {
    housing.rent(gameId, Tenure.MONTHLY, null, 10_000_000, 600_000, 0, false, null, JOB_DAY);
    household.marry(gameId, JOB_DAY, new Spouse("은행원", 3_800_000, "성격은 다정하다."));
    HouseholdView family = household.get(gameId);
    assertThat(household.familyScore(gameId)).isEqualTo(50);

    EventView first = spouseRentOf(JOB_DAY);
    assertThat(first.title()).isEqualTo("언제까지 월세 살 거야?");
    var waited = resolveSpouseRent(first, "WAIT", family);
    assertThat(waited.message()).contains("조금만 더 모으자고 설득했다");
    assertThat(household.familyScore(gameId)).as("미루면 −3").isEqualTo(47);
    assertThat(housing.get(gameId).tenure()).isEqualTo(Tenure.MONTHLY);

    EventView second = spouseRentOf(first.occursDay());
    assertThat(second.title()).isEqualTo("배우자가 다시 집 이야기를 꺼냈다");
    var stayed = resolveSpouseRent(second, "STAY", family);
    assertThat(stayed.message()).contains("월세에 남기로 했다");
    assertThat(household.familyScore(gameId)).as("2단계에서 거스르면 −12").isEqualTo(35);

    EventView third = spouseRentOf(second.occursDay());
    assertThat(third.title()).isEqualTo("집 때문에 부부 싸움이 났다");
    assets.credit(gameId, "WINDFALL", 500_000_000, third.occursDay());
    var moved = resolveSpouseRent(third, "VILLA_INSURED", family);
    assertThat(moved.message()).startsWith("배우자의 말에 월세를 벗어났다.").contains("보증보험");
    assertThat(household.familyScore(gameId)).as("들어주면 +8").isEqualTo(43);
    assertThat(housing.get(gameId).tenure()).isEqualTo(Tenure.VILLA_JEONSE);
    assertThat(housing.get(gameId).insured()).isTrue();
  }

  private ChoiceOutcome.Outcome resolveSpouseRent(
      EventView view, String option, HouseholdView family) {
    ChoiceTicket ticket = events.prepareChoice(gameId, view.eventId(), option);
    assertThat(
            ChoiceTicket.Housing.isSpouseRent(
                ((ChoiceTicket.Housing) ticket.effect()).definition()))
        .isTrue();
    return flow.resolve(
        gameId,
        ticket,
        (ChoiceTicket.Housing) ticket.effect(),
        family,
        3_000_000,
        0,
        new HashSeededRandom(1L));
  }

  /** 결혼한 월세 세입자에게 오는 다음 배우자 월세 불만 장면. 그 전의 다른 주거 이벤트("집 살까?")는 넘긴다. */
  private EventView spouseRentOf(int fromDay) {
    HousingFacts monthly =
        new HousingFacts(
            "MONTHLY",
            JOB_DAY + 30 * YEAR,
            0,
            false,
            false,
            null,
            0,
            50,
            false,
            false,
            false,
            false,
            true,
            null);
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
            null,
            true,
            JOB_DAY,
            "은행원",
            0,
            List.of(),
            List.of(),
            List.of(),
            false,
            Map.of(),
            Map.of(),
            monthly,
            0L,
            50,
            Set.of());
    HashSeededRandom random = new HashSeededRandom(1L);
    int from = fromDay;
    for (int i = 0; i < 50; i++) {
      int next = events.peekNextEventDay(gameId, context, from, random).orElseThrow();
      ScheduleResult result = events.schedule(gameId, context, from, next, random, HINTS);
      if (result.pending().isPresent()) {
        EventView view = result.pending().get();
        if (view.kind() == EventKind.HOUSING
            && view.options().stream().anyMatch(o -> o.code().equals("WAIT"))) {
          return view;
        }
        events.complete(
            gameId, view.eventId(), new investorgame.event.Completion("PASS", "PASS", List.of()));
      }
      from = next;
    }
    throw new AssertionError("배우자의 월세 불만 장면이 오지 않았다");
  }

  /** 보증보험 없는 빌라 만기 중 전세사기가 숨은 판을 찾는다(7%라 시드를 돌린다). */
  private EventView fraudulentLeaseEnd() {
    HousingFacts villa =
        new HousingFacts(
            "VILLA_JEONSE",
            JOB_DAY + YEAR,
            0,
            false,
            true,
            null,
            0,
            50,
            true,
            false,
            false,
            false,
            true,
            null);
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
            null,
            false,
            null,
            null,
            0,
            List.of(),
            List.of(),
            List.of(),
            false,
            Map.of(),
            Map.of(),
            facts,
            0L,
            50,
            Set.of());
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
