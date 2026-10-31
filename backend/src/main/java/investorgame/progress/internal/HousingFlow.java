package investorgame.progress.internal;

import investorgame.asset.AccountView;
import investorgame.asset.AssetService;
import investorgame.asset.TradeResult;
import investorgame.common.GameProperties;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.event.ChoiceTicket;
import investorgame.event.Completion;
import investorgame.event.EventService;
import investorgame.event.HousingFacts;
import investorgame.household.HouseholdService;
import investorgame.household.HouseholdView;
import investorgame.housing.HomeSale;
import investorgame.housing.HousingService;
import investorgame.housing.HousingView;
import investorgame.housing.Lease;
import investorgame.housing.MonthlyHousingCost;
import investorgame.housing.Tenure;
import investorgame.market.HomeQuote;
import investorgame.market.MarketService;
import investorgame.progress.ChoiceOutcome;
import investorgame.progress.GameView;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * 진행이 주거를 조율하는 부분 (주거 설계). 시세·금리는 시장에서, 현금은 자산에서, 소득은 진행에서 받아 주거 선택을 감당할 수 있는지 따지고(계약금·LTV·DSR) 돈을
 * 정산한다. 달마다 주거비를 내고, 갭투자 세입자를 갱신하고, 매물이 팔리는지 굴린다.
 */
@Component
class HousingFlow {

  private static final long BP = 10_000;
  private static final long LOAN_UNIT = 1_000_000;

  /** 전세대출을 받을 때 현금으로 남겨 두는 생활비 달 수 (decisions.md 107번). */
  private static final int CUSHION_MONTHS = 3;

  private static final long PROBE = 100_000_000;
  private static final String SEOUL = "seoul";
  private static final String GYEONGGI = "gyeonggi";

  /** 세집의 크기(방 수, #117). 필요한 크기 = 1 + 결혼 1 + 집에 있는 아이(최대 2). 아파트 전세(84㎡)·자가는 늘 넉넉하다. */
  static final String[] ROOM_NAMES = {"원룸", "투룸", "쓰리룸", "포룸"};

  static final int MAX_ROOMS = ROOM_NAMES.length;
  private static final List<String> CHILD_NAMES = List.of("첫째", "둘째", "셋째", "넷째", "다섯째");

  private final HousingService housing;
  private final MarketService market;
  private final AssetService assets;
  private final HouseholdService household;
  private final Comforter comforter;
  private final EventService events;
  private final LogRepository logs;
  private final ContentCatalog content;
  private final GameProperties calendar;
  private final ProgressProperties.HousingRules rules;

  HousingFlow(
      HousingService housing,
      MarketService market,
      AssetService assets,
      HouseholdService household,
      EventService events,
      LogRepository logs,
      ContentCatalog content,
      Comforter comforter,
      GameProperties calendar,
      ProgressProperties properties) {
    this.housing = housing;
    this.market = market;
    this.assets = assets;
    this.household = household;
    this.comforter = comforter;
    this.events = events;
    this.logs = logs;
    this.content = content;
    this.calendar = calendar;
    this.rules = properties.housing();
  }

  /** 주거 이벤트를 정하는 사실. 청약은 영끌로 분양가를 치를 수 있을 때만 공고가 온다 (#26). */
  HousingFacts facts(
      UUID gameId, HouseholdView home, int luck, long monthlyIncome, int points, int day) {
    HousingView view = housing.get(gameId);
    List<Integer> births = home.childBirthDays();
    boolean affordable =
        plans(gameId, List.of(ChoiceTicket.Housing.APPLY), false, home, monthlyIncome, points, day)
                .getFirst()
                .blocked()
            == null;
    // 배우자의 월세 불만 (decisions.md 111번): 월세에 사는 기혼자만 따진다.
    boolean canLeaveMonthly = false;
    boolean cashForJeonse = false;
    if (view.tenure() == Tenure.MONTHLY && home.married()) {
      List<Plan> moves =
          plans(
              gameId,
              List.of(
                  ChoiceTicket.Housing.VILLA,
                  ChoiceTicket.Housing.VILLA_INSURED,
                  ChoiceTicket.Housing.APT_JEONSE,
                  ChoiceTicket.Housing.BUY_SEOUL,
                  ChoiceTicket.Housing.BUY_GYEONGGI),
              false,
              home,
              monthlyIncome,
              points,
              day);
      canLeaveMonthly = moves.stream().anyMatch(p -> p.blocked() == null);
      cashForJeonse =
          moves.stream()
              .anyMatch(
                  p ->
                      ChoiceTicket.Housing.APT_JEONSE.equals(p.code())
                          && p.blocked() == null
                          && p.jeonseLoan() == 0);
    }
    // "집 살까?"는 매수·갭투자 가운데 하나라도 감당될 때만 온다 (decisions.md 118번). 2채면 더 묻지 않으니 따지지 않는다.
    boolean buyAffordable = false;
    if (view.homes().size() < 2) {
      List<String> buys = new ArrayList<>();
      if (!view.ownsResidence()) {
        buys.add(ChoiceTicket.Housing.BUY_SEOUL);
        buys.add(ChoiceTicket.Housing.BUY_GYEONGGI);
      }
      buys.add(ChoiceTicket.Housing.GAP);
      buyAffordable =
          plans(gameId, buys, false, home, monthlyIncome, points, day).stream()
              .anyMatch(p -> p.blocked() == null);
    }
    return new HousingFacts(
        view.tenure().name(),
        view.leaseEndDay(),
        view.homes().size(),
        view.ownsResidence(),
        view.tenure() == Tenure.VILLA_JEONSE && !view.insured(),
        births.isEmpty() ? null : births.getLast(),
        seoulChange(gameId),
        luck,
        affordable,
        cramped(view, home, day),
        canLeaveMonthly,
        cashForJeonse,
        buyAffordable);
  }

  /**
   * 가족 점수가 이 아래면 가족이 남처럼 멀어진 것으로 본다. 이벤트 쪽 `event.life.cold-family-below`와 같은 값 (decisions.md
   * 111번).
   */
  static final int COLD_FAMILY_BELOW = 20;

  /** 식구 수에 맞는 집 크기(방 수): 혼자 원룸, 부부 투룸, 아이 하나 쓰리룸, 둘 이상 포룸. 독립한 아이는 세지 않는다 (#117). */
  static int neededRooms(HouseholdView home, int day) {
    long atHome = home.children().stream().filter(c -> !c.leftBy(day)).count();
    return Math.min(MAX_ROOMS, 1 + (home.married() ? 1 : 0) + (int) Math.min(2, atHome));
  }

  static String roomName(int rooms) {
    return ROOM_NAMES[Math.clamp(rooms - 1, 0, MAX_ROOMS - 1)];
  }

  /** 월세·빌라 전세가 식구 수에 비해 좁은가. 크기를 모르는 옛 판·자가·아파트 전세(84㎡)는 좁지 않다. */
  static boolean cramped(HousingView view, HouseholdView home, int day) {
    return (view.tenure() == Tenure.MONTHLY || view.tenure() == Tenure.VILLA_JEONSE)
        && view.rooms() != null
        && view.rooms() < neededRooms(home, day);
  }

  static String childName(int seq) {
    return seq >= 1 && seq <= CHILD_NAMES.size() ? CHILD_NAMES.get(seq - 1) : seq + "번째";
  }

  /** 집 시세 + 내 보증금 − 주담대 − 전세대출 − 세입자 보증금. 총자산에 더한다. */
  long equity(UUID gameId) {
    HousingView view = housing.get(gameId);
    Map<String, Long> prices = market.homePrices(gameId);
    long equity = view.deposit() - view.jeonseLoan();
    for (HousingView.Home home : view.homes()) {
      equity += prices.get(home.region()) - home.mortgage() - home.tenantDeposit();
    }
    return equity;
  }

  /** 한 달: 주거비를 내고, 만기가 된 갭투자 세입자를 지금 전세가로 다시 받고(역전세면 차액을 내준다), 매물마다 매수자가 나왔는지 굴린다. */
  void month(UUID gameId, int month, int day, SeededRandom random) {
    MonthlyHousingCost cost = housing.settleMonth(gameId, market.mortgageRateBp(gameId), day);
    if (cost.total() > 0) {
      assets.spend(gameId, "HOUSING", cost.total(), day, null);
    }
    // 식구 수에 비해 좁은 집에 그대로 살면 달마다 조금씩 지치고, 석 달마다 가족 점수가 1점 깎인다 (#117, decisions.md 105번).
    if (cramped(housing.get(gameId), household.get(gameId), day)) {
      household.cheer(gameId, -1);
      if (month % 3 == 0) {
        household.bond(gameId, -1);
      }
    }
    // 가족 점수가 바닥이면(남처럼 멀어진 집) 달마다 조금씩 지친다. 여행·나들이 제안도 끊긴다 (decisions.md 111번).
    if (household.familyScore(gameId) < COLD_FAMILY_BELOW) {
      household.cheer(gameId, -1);
    }
    Map<String, Long> prices = market.homePrices(gameId);
    for (HousingView.Home home : housing.get(gameId).homes()) {
      if (!home.residence()
          && home.tenantLeaseEndDay() != null
          && home.tenantLeaseEndDay() <= day) {
        long next = prices.get(home.region()) * rules.jeonseRatioBp() / BP;
        long diff = next - home.tenantDeposit();
        if (diff > 0) {
          assets.credit(gameId, "TENANT_DEPOSIT", diff, day);
        } else if (diff < 0) {
          assets.spend(gameId, "TENANT_DEPOSIT", -diff, day, null);
        }
        housing.releaseTenant(gameId, home.seq(), next, day);
        logs.append(
            gameId,
            day,
            "TENANT",
            Map.of(
                "regionName", regionName(home.region()),
                "before", home.tenantDeposit(),
                "after", next));
      }
    }
    int change = seoulChange(gameId);
    int chance =
        change <= rules.fallingBp()
            ? rules.saleChanceFallingBp()
            : change >= rules.hotBp() ? rules.saleChanceHotBp() : rules.saleChanceBp();
    for (HousingView.Home home : housing.get(gameId).homes()) {
      if (home.listedDay() == null || home.listedDay() >= day) {
        continue;
      }
      if (random.forKey("progress", "home-sale", home.seq(), month).nextInt((int) BP) < chance) {
        sell(gameId, home, prices.get(home.region()), day);
      }
    }
  }

  /** 주담대 일시 상환: 현금으로 원금을 갚는다. 남은 기간의 원리금균등 월 상환액은 다음 달부터 줄어든다 (decisions.md 58번). */
  void repay(UUID gameId, int seq, long amount, int day) {
    HousingView.Home home =
        housing.get(gameId).homes().stream()
            .filter(h -> h.seq() == seq)
            .findFirst()
            .orElseThrow(() -> new NotFoundException("그런 집이 없다"));
    if (amount <= 0 || amount > home.mortgage()) {
      throw new InvalidRequestException("갚을 금액은 남은 주담대 이하여야 한다");
    }
    long cash = assets.get(gameId).cash();
    if (amount > cash) {
      throw new InvalidRequestException("현금이 %s 모자란다".formatted(money(amount - cash)));
    }
    housing.repayMortgage(gameId, seq, amount);
    assets.spend(gameId, "MORTGAGE_REPAY", amount, day, null);
    logs.append(
        gameId,
        day,
        "MORTGAGE_REPAY",
        Map.of(
            "regionName",
            regionName(home.region()),
            "amount",
            amount,
            "remaining",
            home.mortgage() - amount));
  }

  private void sell(UUID gameId, HousingView.Home home, long price, int day) {
    HomeSale sale = housing.sell(gameId, home.seq(), price, day);
    assets.credit(gameId, "HOME_SALE", price, day);
    if (sale.mortgage() > 0) {
      assets.spend(gameId, "MORTGAGE_REPAY", sale.mortgage(), day, null);
    }
    if (sale.tenantDeposit() > 0) {
      assets.spend(gameId, "TENANT_DEPOSIT", sale.tenantDeposit(), day, null);
    }
    logs.append(
        gameId,
        day,
        "HOME_SOLD",
        Map.of(
            "regionName", regionName(home.region()),
            "price", price,
            "purchasePrice", home.purchasePrice(),
            "residence", sale.residence()));
  }

  /** 매물로 내놓거나 거둔다. 내놓아도 바로 팔리지 않는다: 다음 달부터 매수자가 나와야 팔린다. */
  void setListed(UUID gameId, int seq, boolean listed, int day) {
    housing.setListed(gameId, seq, listed ? day : null);
  }

  // ---- 선택 ----

  /** 한 선택지에 드는 돈과 고를 수 없는 이유. rooms는 세집의 크기(방 수, #117), 세가 아니면 0. */
  record Plan(
      String code,
      String region,
      long price,
      long mortgage,
      long deposit,
      long jeonseLoan,
      long monthlyRent,
      long tenantDeposit,
      long cashNeeded,
      long monthlyBurden,
      String detail,
      String blocked,
      int rooms) {}

  /** 주거 선택지마다 드는 돈. 화면에 보여 주고, 고를 때 다시 계산해 막는다. */
  List<Plan> plans(
      UUID gameId,
      List<String> codes,
      boolean fraud,
      HouseholdView home,
      long monthlyIncome,
      int points,
      int day) {
    HousingView view = housing.get(gameId);
    Map<String, Long> prices = market.homePrices(gameId);
    int rate = market.mortgageRateBp(gameId);
    long cash = assets.get(gameId).cash();
    // 집을 살 때 현금이 모자라면 들고 있는 주식을 팔아 보탠다 (decisions.md 100번).
    long stocks = sellable(gameId);
    int rooms = neededRooms(home, day);
    // 전세대출은 내 돈으로 모자란 만큼만 받는다. 생활비 석 달분은 현금으로 남긴다 (decisions.md 107번).
    long cushion = CUSHION_MONTHS * household.monthlyExpense(gameId, day);
    // 이사하면 지금 보증금을 돌려받고 전세대출을 갚는다. 전세사기면 보증금은 돌아오지 않는다.
    long returning = returning(view, fraud);
    long existingBurden =
        view.homes().stream().mapToLong(h -> housing.monthlyPayment(h.mortgage(), rate)).sum();
    List<Plan> plans = new ArrayList<>();
    for (String code : codes) {
      plans.add(
          plan(
              code,
              view,
              prices,
              rate,
              cash,
              stocks,
              returning,
              rooms,
              cushion,
              monthlyIncome,
              existingBurden,
              points,
              day));
    }
    return plans;
  }

  private Plan plan(
      String code,
      HousingView view,
      Map<String, Long> prices,
      int rate,
      long cash,
      long stocks,
      long returning,
      int rooms,
      long cushion,
      long income,
      long existingBurden,
      int points,
      int day) {
    return switch (code) {
      case ChoiceTicket.Housing.PASS,
          ChoiceTicket.Housing.NEVER,
          ChoiceTicket.Housing.WAIT,
          ChoiceTicket.Housing.STAY,
          ChoiceTicket.Housing.ENDURE ->
          new Plan(code, null, 0, 0, 0, 0, 0, 0, 0, 0, null, null, 0);
      case ChoiceTicket.Housing.KEEP -> {
        if (view.tenure() == Tenure.MONTHLY && view.deposit() == 0) {
          // 살던 집을 판 뒤의 임시 월세는 연장할 것이 없다: 새로 월세를 든다.
          yield rental(
              ChoiceTicket.Housing.KEEP,
              Tenure.MONTHLY,
              view,
              prices,
              rate,
              cash,
              0,
              rooms,
              cushion,
              income,
              day);
        }
        // 같은 집이니 크기도 그대로. 식구가 늘어 좁아졌으면 그렇다고 적는다 (#117).
        int keepRooms = view.rooms() == null ? rooms : view.rooms();
        long deposit = view.deposit() * (BP + rules.renewRaiseBp()) / BP;
        long rent = view.monthlyRent() * (BP + rules.renewRaiseBp()) / BP;
        // 오른 보증금은 내 돈으로 먼저 내고 모자란 만큼만 전세대출을 늘린다. 여유가 있으면 그만큼 갚는다 (decisions.md 107번).
        boolean jeonse = view.tenure() == Tenure.VILLA_JEONSE || view.tenure() == Tenure.APT_JEONSE;
        long cap = jeonse && income > 0 ? round(deposit * rules.jeonseLoanBp() / BP) : 0;
        long spare = Math.max(0, cash - cushion);
        long loan =
            jeonse
                ? Math.clamp(
                    roundUp(view.jeonseLoan() + (deposit - view.deposit()) - spare),
                    income > 0 ? 0 : Math.min(view.jeonseLoan(), cap),
                    Math.max(cap, income > 0 ? 0 : view.jeonseLoan()))
                : 0;
        long need = Math.max(0, (deposit - view.deposit()) - (loan - view.jeonseLoan()));
        long burden = housing.leaseMonthlyCost(rent, loan, deposit, view.insured(), rate);
        yield new Plan(
            code,
            view.region(),
            0,
            0,
            deposit,
            loan,
            rent,
            0,
            need,
            burden,
            "%s보증금 %s → %s%s · 더 낼 현금 %s · 월 %s%s"
                .formatted(
                    view.rooms() == null || view.tenure() == Tenure.APT_JEONSE
                        ? ""
                        : roomName(keepRooms) + " · ",
                    money(view.deposit()),
                    money(deposit),
                    loan > 0 ? " (전세대출 %s)".formatted(money(loan)) : "",
                    money(need),
                    money(burden),
                    view.rooms() != null && view.tenure() != Tenure.APT_JEONSE && keepRooms < rooms
                        ? " · 식구에 비해 좁다"
                        : ""),
            need > cash ? short_(need - cash) : null,
            keepRooms);
      }
      case ChoiceTicket.Housing.MONTHLY ->
          rental(
              code,
              Tenure.MONTHLY,
              view,
              prices,
              rate,
              cash,
              returning,
              rooms,
              cushion,
              income,
              day);
      case ChoiceTicket.Housing.VILLA, ChoiceTicket.Housing.VILLA_INSURED ->
          rental(
              code,
              Tenure.VILLA_JEONSE,
              view,
              prices,
              rate,
              cash,
              returning,
              rooms,
              cushion,
              income,
              day);
      case ChoiceTicket.Housing.APT_JEONSE ->
          rental(
              code,
              Tenure.APT_JEONSE,
              view,
              prices,
              rate,
              cash,
              returning,
              rooms,
              cushion,
              income,
              day);
      case ChoiceTicket.Housing.BUY_SEOUL, ChoiceTicket.Housing.BUY_GYEONGGI -> {
        String region = ChoiceTicket.Housing.BUY_SEOUL.equals(code) ? SEOUL : GYEONGGI;
        yield buyPlan(
            code,
            region,
            prices.get(region),
            rate,
            cash,
            stocks,
            returning,
            income,
            existingBurden,
            "시세");
      }
      case ChoiceTicket.Housing.APPLY -> {
        long price = prices.get(SEOUL) * rules.cheongyakPriceBp() / BP;
        Plan won =
            cheongyakPlan(code, price, rate, cash, stocks, returning, income, existingBurden);
        int chance = cheongyakChanceBp(points);
        yield new Plan(
            code,
            SEOUL,
            price,
            won.mortgage(),
            0,
            0,
            0,
            0,
            won.cashNeeded(),
            won.monthlyBurden(),
            "내 가점 %d점 · 당첨 가능성 약 %d%% · %s".formatted(points, chance / 100, won.detail()),
            won.blocked() == null ? null : "청약을 넣을 수 없다. " + won.blocked(),
            0);
      }
      case ChoiceTicket.Housing.GAP -> {
        long price = prices.get(SEOUL);
        long tenant = price * rules.jeonseRatioBp() / BP;
        long need = price - tenant;
        String blocked =
            view.homes().size() >= 2
                ? "아파트는 2채까지다"
                : need > cash + stocks ? short_(need - cash - stocks) : null;
        yield new Plan(
            code,
            SEOUL,
            price,
            0,
            0,
            0,
            0,
            tenant,
            need,
            0,
            "시세 %s · 세입자 보증금 %s · 필요 현금 %s%s · 2년마다 전세가가 내리면 차액을 돌려준다"
                .formatted(
                    money(price), money(tenant), money(need), stockNote(need, cash, cash + stocks)),
            blocked,
            0);
      }
      default -> throw new IllegalArgumentException("알 수 없는 주거 선택지: " + code);
    };
  }

  /** 아파트를 산다: 대출은 LTV와 DSR 중 작은 쪽, 나머지는 현금(이사하면 돌려받는 보증금 포함, 모자라면 주식을 판다). */
  private Plan buyPlan(
      String code,
      String region,
      long price,
      int rate,
      long cash,
      long stocks,
      long returning,
      long income,
      long existingBurden,
      String priceLabel) {
    long ltv = price * rules.ltvBp() / BP;
    long room = income * rules.dsrBp() / BP - existingBurden;
    long perProbe = housing.monthlyPayment(PROBE, rate);
    long dsr = room <= 0 || perProbe <= 0 ? 0 : room * PROBE / perProbe;
    long mortgage = round(Math.min(ltv, dsr));
    long need = price - mortgage;
    long available = cash + returning + stocks;
    long burden = housing.monthlyPayment(mortgage, rate);
    String blocked =
        need > available
            ? (income <= 0
                ? "소득이 없어 주담대가 안 된다. 현금 %s이 모자란다".formatted(money(need - available))
                : mortgage < ltv
                    ? "DSR 40%%에 걸려 대출이 %s뿐이다. 현금 %s이 모자란다"
                        .formatted(money(mortgage), money(need - available))
                    : short_(need - available))
            : null;
    return new Plan(
        code,
        region,
        price,
        mortgage,
        0,
        0,
        0,
        0,
        need,
        burden,
        "%s %s · 주담대 %s (연 %s) · 필요 현금 %s%s · 월 원리금 %s"
            .formatted(
                priceLabel,
                money(price),
                money(mortgage),
                rate(rate),
                money(need),
                stockNote(need, cash + returning, available),
                money(burden)),
        blocked,
        0);
  }

  /**
   * 청약 (decisions.md 48번): 계약금(분양가의 cheongyak-down-bp)은 현금(+돌려받을 보증금, 모자라면 주식을 판 돈)으로 내야 하고, 나머지는
   * 분양 대출로 — LTV는 따지지 않고 DSR 안에서만. DSR이 모자라면 그만큼 현금을 더 내야 한다. 둘 중 하나라도 안 되면 막힌다(그러면 공고 자체가 오지 않는다).
   */
  private Plan cheongyakPlan(
      String code,
      long price,
      int rate,
      long cash,
      long stocks,
      long returning,
      long income,
      long existingBurden) {
    long down = price * rules.cheongyakDownBp() / BP;
    long available = cash + returning + stocks;
    long room = income * rules.dsrBp() / BP - existingBurden;
    long perProbe = housing.monthlyPayment(PROBE, rate);
    long dsr = room <= 0 || perProbe <= 0 ? 0 : room * PROBE / perProbe;
    long mortgage = round(Math.min(price - down, dsr));
    long need = price - mortgage;
    long burden = housing.monthlyPayment(mortgage, rate);
    String blocked =
        available < down
            ? "계약금 %s(분양가의 %d%%)이 모자란다"
                .formatted(money(down - available), rules.cheongyakDownBp() / 100)
            : need > available
                ? (income <= 0
                    ? "소득이 없어 분양 대출이 안 된다. 현금 %s이 모자란다".formatted(money(need - available))
                    : "DSR %d%%에 걸려 대출이 %s뿐이다. 현금 %s이 모자란다"
                        .formatted(rules.dsrBp() / 100, money(mortgage), money(need - available)))
                : null;
    return new Plan(
        code,
        SEOUL,
        price,
        mortgage,
        0,
        0,
        0,
        0,
        need,
        burden,
        "분양가 %s · 계약금 %s · 분양 대출 %s (연 %s) · 필요 현금 %s%s · 월 원리금 %s"
            .formatted(
                money(price),
                money(down),
                money(mortgage),
                rate(rate),
                money(need),
                stockNote(need, cash + returning, available),
                money(burden)),
        blocked,
        0);
  }

  private Plan rental(
      String code,
      Tenure tenure,
      HousingView view,
      Map<String, Long> prices,
      int rate,
      long cash,
      long returning,
      int rooms,
      long cushion,
      long income,
      int day) {
    long available = cash + returning;
    // 월세·빌라 전세는 식구 수에 맞는 크기(방 수)로 구한다. 아이가 늘수록 보증금·월세가 계단처럼 오른다 (#117).
    int tier = Math.clamp(rooms - 1, 0, MAX_ROOMS - 1);
    if (tenure == Tenure.MONTHLY) {
      ProgressProperties.Rent base =
          rules.monthly().get(Math.min(tier, rules.monthly().size() - 1));
      long standard = household.inflated(base.deposit(), day);
      // 보증금이 모자라면 덜 내고 월세를 더 낸다(전월세 전환). 월세는 언제나 구할 수 있다.
      long deposit = Math.min(standard, round(available));
      long rent =
          household.inflated(base.rent(), day)
              + (standard - deposit) * rules.conversionBpPerMonth() / BP;
      return new Plan(
          code,
          null,
          0,
          0,
          deposit,
          0,
          rent,
          0,
          deposit,
          rent,
          "%s · 보증금 %s · 월세 %s".formatted(roomName(rooms), money(deposit), money(rent)),
          null,
          rooms);
    }
    long gyeonggi = prices.get(GYEONGGI);
    long deposit =
        tenure == Tenure.APT_JEONSE
            ? gyeonggi * rules.jeonseRatioBp() / BP
            : gyeonggi * rules.villaBp().get(Math.min(tier, rules.villaBp().size() - 1)) / BP;
    // 전세대출은 내 돈(현금 + 돌려받을 보증금 − 생활비 석 달분)으로 모자란 만큼만, 보증금의 80%까지. 소득이 없으면 안 나온다 (decisions.md 107번).
    long cap = income > 0 ? round(deposit * rules.jeonseLoanBp() / BP) : 0;
    long loan = Math.clamp(roundUp(deposit - Math.max(0, available - cushion)), 0, cap);
    long need = deposit - loan;
    boolean insured = ChoiceTicket.Housing.VILLA_INSURED.equals(code);
    long burden = housing.leaseMonthlyCost(0, loan, deposit, insured, rate);
    return new Plan(
        code,
        tenure == Tenure.APT_JEONSE ? GYEONGGI : null,
        0,
        0,
        deposit,
        loan,
        0,
        0,
        need,
        burden,
        "%s보증금 %s%s · 필요 현금 %s · 월 %s%s"
            .formatted(
                tenure == Tenure.APT_JEONSE ? "" : roomName(rooms) + " · ",
                money(deposit),
                loan > 0 ? " (전세대출 %s)".formatted(money(loan)) : "",
                money(need),
                money(burden),
                insured ? " (보증료 포함)" : ""),
        need > available ? short_(need - available) : null,
        // 84㎡ 아파트는 식구가 늘어도 넉넉하다.
        tenure == Tenure.APT_JEONSE ? MAX_ROOMS : rooms);
  }

  /**
   * 주거 선택을 반영한다. 막힌 선택이면 오류. 끝난 세를 정산하고(전세사기면 보증금을 잃는다), 새 세·집값을 낸다.
   *
   * @return 결과 문구
   */
  ChoiceOutcome.Outcome resolve(
      UUID gameId,
      ChoiceTicket ticket,
      ChoiceTicket.Housing effect,
      HouseholdView home,
      long monthlyIncome,
      int points,
      SeededRandom random) {
    String code = ticket.optionCode();
    Plan plan =
        plans(
                gameId,
                List.of(code),
                effect.fraud(),
                home,
                monthlyIncome,
                points,
                ticket.occursDay())
            .getFirst();
    if (plan.blocked() != null && effect.fraud()) {
      // 고를 때는 몰랐던 전세사기로 돈이 모자라졌다. 가장 싼 월세로 밀려난다(보증금이 모자라면 마이너스 통장).
      code = ChoiceTicket.Housing.MONTHLY;
      plan =
          plans(gameId, List.of(code), true, home, monthlyIncome, points, ticket.occursDay())
              .getFirst();
    } else if (plan.blocked() != null) {
      throw new InvalidRequestException(plan.blocked());
    }
    events.complete(gameId, ticket.eventId(), new Completion(ticket.optionCode(), code, List.of()));
    int day = ticket.occursDay();
    HousingView before = housing.get(gameId);
    StringBuilder message = new StringBuilder();
    if (ChoiceTicket.Housing.LEASE_REFUSED.equals(effect.definition())) {
      message.append("집주인이 재계약을 거절해 집을 옮겼다. ");
    }
    Map<String, Object> payloadExtra = new LinkedHashMap<>();
    long lost = 0;
    long sold = 0;
    // 배우자의 월세 불만 (#116): 단계와 아이 수에 따라 거스른 대가와 들어준 보람이 다르다.
    boolean spouseRent = ChoiceTicket.Housing.isSpouseRent(effect.definition());
    int level = spouseRent ? ChoiceTicket.Housing.spouseRentLevel(effect.definition()) : 0;
    int children = spouseRent ? ChoiceTicket.Housing.spouseRentChildren(effect.definition()) : 0;
    if (spouseRent) {
      payloadExtra.put("level", level);
      payloadExtra.put("children", children);
      if (!ChoiceTicket.Housing.WAIT.equals(code) && !ChoiceTicket.Housing.STAY.equals(code)) {
        boolean buying =
            ChoiceTicket.Housing.BUY_SEOUL.equals(code)
                || ChoiceTicket.Housing.BUY_GYEONGGI.equals(code);
        message
            .append(
                buying
                    ? content.spouseRentText().boughtText()
                    : content.spouseRentText().movedText())
            .append(' ');
      }
    }
    // 집이 좁다 (#117): 옮기면 누가 태어나(결혼해) 옮겼는지 앞머리에 쓴다.
    boolean cramped = ChoiceTicket.Housing.isCramped(effect.definition());
    Integer crampedChild = cramped ? ChoiceTicket.Housing.crampedChild(effect.definition()) : null;
    if (cramped) {
      payloadExtra.put("childSeq", crampedChild);
      if (!ChoiceTicket.Housing.ENDURE.equals(code)) {
        message
            .append(
                crampedChild == null
                    ? "결혼하고 더 넓은 집으로 옮겼다."
                    : "%s가 태어나 더 넓은 집으로 옮겼다.".formatted(childName(crampedChild)))
            .append(' ');
      }
    }
    if (effect.fraud()) {
      lost = before.deposit();
      message.append(
          "집주인이 연락을 끊었다. 빌라는 경매로 넘어갔고 보증금 %s을 돌려받지 못했다. 전세대출 %s은 그대로 갚아야 한다. "
              .formatted(money(before.deposit()), money(before.jeonseLoan())));
    }
    switch (code) {
      case ChoiceTicket.Housing.PASS ->
          message.append(
              ChoiceTicket.Housing.isCheongyak(effect.definition())
                  ? "이번 분양은 넘겼다."
                  : "아직은 사지 않기로 했다.");
      case ChoiceTicket.Housing.NEVER -> message.append("청약은 더 보지 않기로 했다. 공고가 떠도 묻지 않는다.");
      case ChoiceTicket.Housing.WAIT -> message.append(content.spouseRentText().waitText(level));
      case ChoiceTicket.Housing.STAY -> message.append(content.spouseRentText().stayText(level));
      case ChoiceTicket.Housing.ENDURE ->
          message.append("좁아도 그냥 살기로 했다. 짐은 거실까지 나와 있고, 식구가 늘 때마다 더 좁아질 것이다.");
      case ChoiceTicket.Housing.APPLY -> {
        // 가점으로 당첨을 굴린다. 넣을 때 돈이 되는지 이미 따졌다(#26). 그래도 모자라면(전세사기 등) 포기한다 (decisions.md 42번).
        boolean won =
            random.forKey("progress", "cheongyak", ticket.seq()).nextInt((int) BP)
                < cheongyakChanceBp(points);
        if (!won) {
          message.append("가점 %d점으로는 떨어졌다. 경쟁률이 수백 대 일이었다.".formatted(points));
        } else if (plan.cashNeeded()
            > assets.get(gameId).cash() + returning(before, effect.fraud()) + sellable(gameId)) {
          message.append(
              "가점 %d점으로 당첨됐다! 그런데 계약금이 %s 모자랐다. 눈물을 머금고 포기했다."
                  .formatted(
                      points,
                      money(
                          plan.cashNeeded()
                              - assets.get(gameId).cash()
                              - returning(before, effect.fraud())
                              - sellable(gameId))));
        } else {
          Lease ended =
              housing.buyResidence(gameId, plan.region(), plan.price(), plan.mortgage(), day);
          settle(gameId, ended, effect.fraud(), day);
          sold = raise(gameId, plan.price() - plan.mortgage(), day);
          payIn(gameId, plan.price() - plan.mortgage(), day);
          message.append(
              "가점 %d점으로 당첨됐다! %s를 분양가 %s에 샀다(시세의 %d%%). 주담대 %s."
                  .formatted(
                      points,
                      regionName(plan.region()),
                      money(plan.price()),
                      rules.cheongyakPriceBp() / 100,
                      money(plan.mortgage())));
        }
        payloadExtra.put("won", won);
        payloadExtra.put("points", points);
        payloadExtra.put("bought", won && housing.get(gameId).ownsResidence());
      }
      case ChoiceTicket.Housing.KEEP -> {
        if (effect.fraud() || (before.tenure() == Tenure.MONTHLY && before.deposit() == 0)) {
          settle(gameId, rent(gameId, plan, Tenure.MONTHLY, day), effect.fraud(), day);
          payIn(gameId, plan.deposit() - plan.jeonseLoan(), day);
          message.append("월세 %s짜리 방을 구했다.".formatted(money(plan.monthlyRent())));
        } else {
          housing.renew(gameId, plan.deposit(), plan.monthlyRent(), plan.jeonseLoan(), day);
          payIn(gameId, plan.cashNeeded(), day);
          message.append("2년 더 살기로 했다. 보증금 %s.".formatted(money(plan.deposit())));
        }
      }
      case ChoiceTicket.Housing.MONTHLY,
          ChoiceTicket.Housing.VILLA,
          ChoiceTicket.Housing.VILLA_INSURED,
          ChoiceTicket.Housing.APT_JEONSE -> {
        Tenure tenure =
            switch (code) {
              case ChoiceTicket.Housing.MONTHLY -> Tenure.MONTHLY;
              case ChoiceTicket.Housing.APT_JEONSE -> Tenure.APT_JEONSE;
              default -> Tenure.VILLA_JEONSE;
            };
        settle(gameId, rent(gameId, plan, tenure, day), effect.fraud(), day);
        payIn(gameId, plan.deposit() - plan.jeonseLoan(), day);
        message.append(movedText(code, plan));
      }
      case ChoiceTicket.Housing.BUY_SEOUL, ChoiceTicket.Housing.BUY_GYEONGGI -> {
        Lease ended =
            housing.buyResidence(gameId, plan.region(), plan.price(), plan.mortgage(), day);
        settle(gameId, ended, effect.fraud(), day);
        sold = raise(gameId, plan.price() - plan.mortgage(), day);
        payIn(gameId, plan.price() - plan.mortgage(), day);
        message.append(
            "%s를 %s에 샀다. 주담대 %s, 월 원리금 약 %s. 금리는 경기 따라 바뀐다."
                .formatted(
                    regionName(plan.region()),
                    money(plan.price()),
                    money(plan.mortgage()),
                    money(plan.monthlyBurden())));
      }
      case ChoiceTicket.Housing.GAP -> {
        housing.buyGap(gameId, plan.region(), plan.price(), plan.tenantDeposit(), day);
        sold = raise(gameId, plan.price() - plan.tenantDeposit(), day);
        payIn(gameId, plan.price() - plan.tenantDeposit(), day);
        message.append(
            "세입자 보증금 %s을 끼고 %s를 %s에 샀다(갭투자)."
                .formatted(
                    money(plan.tenantDeposit()), regionName(plan.region()), money(plan.price())));
      }
      default -> throw new IllegalArgumentException("알 수 없는 주거 선택지: " + code);
    }
    if (sold > 0) {
      message.append(" 모자란 현금은 주식 %s어치를 팔아 마련했다.".formatted(money(sold)));
    }
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("definition", effect.definition());
    payload.put("option", code);
    payload.put("label", content.housingLabel(code));
    payload.put("price", plan.price());
    payload.put("mortgage", plan.mortgage());
    payload.put("deposit", plan.deposit());
    payload.put("jeonseLoan", plan.jeonseLoan());
    payload.put("monthlyRent", plan.monthlyRent());
    payload.put("regionName", plan.region() == null ? null : regionName(plan.region()));
    payload.put("fraud", effect.fraud());
    payload.put("lost", lost);
    payload.put("stockSold", sold);
    // 아파트 전세(84㎡)·자가는 방 수 표기를 쓰지 않는다 (decisions.md 120번).
    boolean aptJeonse =
        ChoiceTicket.Housing.APT_JEONSE.equals(code)
            || (ChoiceTicket.Housing.KEEP.equals(code) && before.tenure() == Tenure.APT_JEONSE);
    payload.put("roomsName", plan.rooms() > 0 && !aptJeonse ? roomName(plan.rooms()) : null);
    payload.putAll(payloadExtra);
    // 행복도 (decisions.md 82번): 전세사기는 크게 지치고, 내 집을 사면 기쁘고, 독립해 나가면 조금 기쁘다.
    if (effect.fraud()) {
      household.cheer(gameId, -15);
    } else if (Boolean.TRUE.equals(payloadExtra.get("bought"))
        || ChoiceTicket.Housing.BUY_SEOUL.equals(code)
        || ChoiceTicket.Housing.BUY_GYEONGGI.equals(code)
        || ChoiceTicket.Housing.GAP.equals(code)) {
      household.cheer(gameId, 10);
    } else if (ChoiceTicket.Housing.MOVE_OUT.equals(effect.definition())) {
      household.cheer(gameId, 3);
    }
    // 좁아도 그냥 산다 (#117): 조금 지치고 멀어진다. 그 뒤로도 달마다 조금씩 (month 참고).
    if (ChoiceTicket.Housing.ENDURE.equals(code)) {
      household.cheer(gameId, -2);
      household.bond(gameId, -2);
    }
    // 배우자의 월세 불만 (#116, decisions.md 104번): 미루면 조금, 거스르면 많이 지치고 멀어진다. 단계가 오를수록, 아이가 있으면 더. 들어주면
    // 가까워진다.
    if (spouseRent) {
      int step = Math.min(level, 3) - 1;
      int kids = children > 0 ? 1 : 0;
      if (ChoiceTicket.Housing.WAIT.equals(code)) {
        household.cheer(gameId, -(new int[] {2, 3, 5}[step] + kids));
        household.bond(gameId, -(new int[] {3, 5, 8}[step] + 2 * kids));
      } else if (ChoiceTicket.Housing.STAY.equals(code)) {
        household.cheer(gameId, -(new int[] {5, 7, 10}[step] + 2 * kids));
        household.bond(gameId, -(new int[] {8, 12, 15}[step] + 3 * kids));
      } else if (ChoiceTicket.Housing.BUY_SEOUL.equals(code)
          || ChoiceTicket.Housing.BUY_GYEONGGI.equals(code)) {
        household.bond(gameId, 10);
      } else {
        household.cheer(gameId, 5);
        household.bond(gameId, 8);
      }
    }
    // 전세사기 뒤에는 누군가의 위로가 붙는다 (decisions.md 85번). 나이는 모르므로 부모님은 빠진다.
    String comfort =
        effect.fraud()
            ? comforter
                .comfort(gameId, Comforter.FRAUD, day, null, random.forKey("comfort", ticket.seq()))
                .orElse(null)
            : null;
    if (comfort != null) {
      payload.put("comfort", comfort);
    }
    logs.append(gameId, day, "HOUSING", payload);
    return new ChoiceOutcome.Outcome(
        ticket.kind().name(),
        ticket.optionCode(),
        code,
        List.of(),
        null,
        null,
        List.of(),
        message.toString().trim(),
        null,
        comfort);
  }

  /** 이사하면 돌려받는 돈: 보증금(전세사기면 0) − 전세대출. 세입자가 아니면 0. */
  private static long returning(HousingView view, boolean fraud) {
    boolean renting = view.tenure() != Tenure.PARENTS && view.tenure() != Tenure.OWN;
    return renting ? (fraud ? 0 : view.deposit()) - view.jeonseLoan() : 0;
  }

  /** 집값에 보탤 수 있는 주식: 평가액 − 빚. 팔면 빚부터 갚기 때문이다 (decisions.md 100번). */
  private long sellable(UUID gameId) {
    AccountView account = assets.get(gameId);
    return Math.max(0, assets.holdingsValue(gameId, market.prices(gameId)) - account.debt());
  }

  /** 현금(+돌려받을 보증금)으로 모자라 주식을 팔아야 하면 그 금액을 알린다. 주식을 다 팔아도 모자라면 막힌 이유가 대신 보인다. */
  private static String stockNote(long need, long cash, long available) {
    return need > cash && need <= available ? " (주식 %s 매도)".formatted(money(need - cash)) : "";
  }

  /**
   * 집값을 치르기 전에 현금이 amount에 모자라면 주식을 팔아 채운다 (decisions.md 100번). 평가액이 큰 종목부터 모자란 만큼만 판다(한 주 단위라 조금
   * 남을 수 있다). 판 것은 매매창 매도처럼 TRADE로 남긴다.
   *
   * @return 판 금액
   */
  private long raise(UUID gameId, long amount, int day) {
    Map<String, Long> prices = market.prices(gameId);
    List<Map.Entry<String, AccountView.Holding>> order =
        assets.get(gameId).holdings().entrySet().stream()
            .filter(e -> e.getValue().quantity() > 0 && prices.getOrDefault(e.getKey(), 0L) > 0)
            .sorted(
                Comparator.comparingLong(
                        (Map.Entry<String, AccountView.Holding> e) ->
                            -e.getValue().quantity() * prices.get(e.getKey()))
                    .thenComparing(Map.Entry::getKey))
            .toList();
    long raised = 0;
    for (Map.Entry<String, AccountView.Holding> entry : order) {
      AccountView account = assets.get(gameId);
      // 팔면 빚부터 갚으므로 빚만큼 더 팔아야 현금이 된다.
      long gap = amount - account.cash() + account.debt();
      if (gap <= 0) {
        break;
      }
      long price = prices.get(entry.getKey());
      long quantity = Math.min(entry.getValue().quantity(), (gap + price - 1) / price);
      TradeResult trade = assets.sell(gameId, entry.getKey(), quantity, price, day, null);
      if (trade.status() != TradeResult.Status.EXECUTED) {
        continue;
      }
      raised += trade.amount();
      Map<String, Object> payload = new HashMap<>();
      payload.put("stockCode", entry.getKey());
      payload.put("stockName", content.stock(entry.getKey()).name());
      payload.put("side", "SELL");
      payload.put("chosen", "SELL");
      payload.put("actual", "SELL");
      payload.put("deviations", List.of());
      payload.put("status", trade.status());
      payload.put("quantity", trade.quantity());
      payload.put("price", trade.price());
      payload.put("amount", trade.amount());
      payload.put("realizedPnl", trade.realizedPnl());
      payload.put("reason", "HOUSING");
      logs.append(gameId, day, "TRADE", payload);
    }
    return raised;
  }

  /**
   * 청약 가점 (실제 84점 만점을 줄인 것). 무주택 기간(30세나 결혼 중 빠른 날부터, 1년마다 2점, 최대 32), 부양가족(본인 5 + 배우자·자녀 1명마다 5,
   * 최대 35), 청약통장(독립한 날 만들었다고 보고 1년마다 1점 + 2, 최대 17).
   */
  static int cheongyakPoints(
      int startAge, Integer careerStartDay, HouseholdView home, int day, int daysPerYear) {
    int age30 = (30 - startAge) * daysPerYear;
    int from = home.marriedDay() == null ? age30 : Math.min(age30, home.marriedDay());
    int noHome = day < from ? 0 : Math.min(32, 2 + 2 * ((day - from) / daysPerYear));
    int family = (home.married() ? 1 : 0) + home.childBirthDays().size();
    int dependents = Math.min(35, 5 + 5 * family);
    int account =
        careerStartDay == null
            ? 0
            : Math.min(17, 2 + Math.max(0, day - careerStartDay) / daysPerYear);
    return noHome + dependents + account;
  }

  /** 가점별 당첨 확률(만분율). 서울 인기 단지는 60점대도 쉽지 않다. */
  static int cheongyakChanceBp(int points) {
    if (points >= 70) {
      return 6000;
    }
    if (points >= 60) {
      return 2500;
    }
    if (points >= 50) {
      return 800;
    }
    if (points >= 40) {
      return 300;
    }
    return 100;
  }

  private Lease rent(UUID gameId, Plan plan, Tenure tenure, int day) {
    return housing.rent(
        gameId,
        tenure,
        plan.region(),
        plan.deposit(),
        plan.monthlyRent(),
        plan.jeonseLoan(),
        ChoiceTicket.Housing.VILLA_INSURED.equals(plan.code()),
        plan.rooms() > 0 ? plan.rooms() : null,
        day);
  }

  /** 끝난 세: 보증금을 돌려받고(전세사기면 못 받고) 전세대출을 갚는다. 모자라면 마이너스 통장이 된다. */
  private void settle(UUID gameId, Lease ended, boolean fraud, int day) {
    if (ended.tenure() == Tenure.PARENTS || ended.tenure() == Tenure.OWN) {
      return;
    }
    if (!fraud && ended.deposit() > 0) {
      assets.credit(gameId, "DEPOSIT_RETURN", ended.deposit(), day);
    }
    if (ended.jeonseLoan() > 0) {
      assets.spend(gameId, "JEONSE_LOAN_REPAY", ended.jeonseLoan(), day, null);
    }
  }

  private void payIn(UUID gameId, long amount, int day) {
    if (amount > 0) {
      assets.spend(gameId, "HOUSING_PAYMENT", amount, day, null);
    }
  }

  private String movedText(String code, Plan plan) {
    return switch (code) {
      case ChoiceTicket.Housing.MONTHLY ->
          "보증금 %s, 월세 %s짜리 %s을 구했다."
              .formatted(money(plan.deposit()), money(plan.monthlyRent()), roomName(plan.rooms()));
      case ChoiceTicket.Housing.APT_JEONSE ->
          "경기 아파트에 전세 %s으로 들어갔다.".formatted(money(plan.deposit()));
      case ChoiceTicket.Housing.VILLA_INSURED ->
          "빌라 %s에 전세 %s으로 들어갔다. 보증보험도 들었다."
              .formatted(roomName(plan.rooms()), money(plan.deposit()));
      default -> "빌라 %s에 전세 %s으로 들어갔다.".formatted(roomName(plan.rooms()), money(plan.deposit()));
    };
  }

  // ---- 화면 ----

  GameView.Housing view(UUID gameId, int startAge, int day) {
    HousingView view = housing.get(gameId);
    Map<String, Long> prices = market.homePrices(gameId);
    int rate = market.mortgageRateBp(gameId);
    List<GameView.Home> homes = new ArrayList<>();
    long burden =
        housing.leaseMonthlyCost(
            view.monthlyRent(), view.jeonseLoan(), view.deposit(), view.insured(), rate);
    for (HousingView.Home home : view.homes()) {
      long payment = housing.monthlyPayment(home.mortgage(), rate);
      burden += payment;
      homes.add(
          new GameView.Home(
              home.seq(),
              regionName(home.region()),
              prices.get(home.region()),
              home.purchasePrice(),
              home.mortgage(),
              payment,
              home.residence(),
              home.tenantDeposit(),
              home.listedDay() != null));
    }
    List<GameView.HomeQuote> quotes =
        market.homeQuotes(gameId).stream()
            .map(
                q ->
                    new GameView.HomeQuote(
                        q.region(), regionName(q.region()), q.price(), q.change12mBp(), q.last12()))
            .toList();
    return new GameView.Housing(
        view.tenure().name(),
        view.region() == null ? null : regionName(view.region()),
        view.deposit(),
        view.monthlyRent(),
        view.jeonseLoan(),
        view.insured(),
        view.leaseEndDay() == null ? null : startAge + view.leaseEndDay() / calendar.daysPerYear(),
        rate,
        burden,
        homes,
        quotes,
        view.rooms() == null || view.tenure() == Tenure.APT_JEONSE ? null : roomName(view.rooms()),
        cramped(view, household.get(gameId), day));
  }

  // ---- 도움 ----

  private int seoulChange(UUID gameId) {
    return market.homeQuotes(gameId).stream()
        .filter(q -> q.region().equals(SEOUL))
        .mapToInt(HomeQuote::change12mBp)
        .findFirst()
        .orElse(0);
  }

  private String regionName(String region) {
    return content.homeRegion(region).name();
  }

  private static long round(long amount) {
    return Math.max(0, amount / LOAN_UNIT * LOAN_UNIT);
  }

  /** 대출 단위로 올림. 모자란 만큼을 빌릴 때 쓴다. */
  private static long roundUp(long amount) {
    return amount <= 0 ? 0 : (amount + LOAN_UNIT - 1) / LOAN_UNIT * LOAN_UNIT;
  }

  private static String short_(long amount) {
    return "현금이 %s 모자란다".formatted(money(amount));
  }

  private static String rate(int bp) {
    return "%d.%02d%%".formatted(bp / 100, bp % 100);
  }

  /** 1억 2,300만 원처럼. 만 원 아래는 버린다. */
  static String money(long amount) {
    long abs = Math.abs(amount);
    String sign = amount < 0 ? "−" : "";
    long eok = abs / 100_000_000;
    long man = abs % 100_000_000 / 10_000;
    if (eok > 0 && man > 0) {
      return "%s%d억 %,d만 원".formatted(sign, eok, man);
    }
    if (eok > 0) {
      return "%s%d억 원".formatted(sign, eok);
    }
    if (man > 0) {
      return "%s%,d만 원".formatted(sign, man);
    }
    return "%s%,d원".formatted(sign, abs);
  }
}
