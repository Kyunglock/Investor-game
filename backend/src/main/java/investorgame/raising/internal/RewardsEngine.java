package investorgame.raising.internal;

import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.SeededRandom;
import investorgame.raising.CompanyView;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * 날마다·시즌마다 받는 보상: 출석(decisions.md 528번)과 시즌패스(529번). 하루의 경계는 한국 시간 자정이고 서버 시각으로 판정한다(화면의 시계는 믿지
 * 않는다).
 */
@Component
class RewardsEngine {
  private final IdleEngine idle;
  private final CompanyEngine engine;

  RewardsEngine(IdleEngine idle, CompanyEngine engine) {
    this.idle = idle;
    this.engine = engine;
  }

  private CompanyProperties.Attendance rule() {
    return engine.attendance();
  }

  /** 오늘 출석 보상을 아직 안 받았나. */
  boolean claimable(CompanyState c) {
    return !idle.today().equals(c.attendDay);
  }

  /** 돈 보상 한 칸의 크기: 지금 회사의 초당 수입 × minutes분. */
  private double money(CompanyState c, int minutes) {
    return Math.floor(minutes * 60.0 * idle.perSecond(c));
  }

  /**
   * 출석 보상을 받는다 (528번): 하루에 한 번. 출석판의 다음 칸을 받고 한 칸 나아간다. 누적 출석이라 하루 빠져도 처음으로 돌아가지 않고, 마지막 칸 다음은 다시 첫
   * 칸이다. 오늘 이미 받았으면 400.
   */
  void attend(CompanyState c) {
    if (!claimable(c)) {
      throw new InvalidRequestException("오늘 출석 보상은 이미 받았어요");
    }
    List<CompanyProperties.AttendanceDay> days = rule().days();
    int at = Math.floorMod(c.attendCount, days.size());
    CompanyProperties.AttendanceDay day = days.get(at);
    CompanyState.AttendReward reward = new CompanyState.AttendReward();
    reward.day = at + 1;
    reward.diamonds = day.diamonds();
    reward.money = day.incomeMinutes() > 0 ? money(c, day.incomeMinutes()) : 0;
    c.diamonds += reward.diamonds;
    c.capital += reward.money;
    c.attendCount++;
    c.attendDay = idle.today();
    c.lastAttend = reward;
    // 출석은 시즌패스 미션이다 (569번).
    engine.pass.progress(c, "attend", 1, idle.todayDate());
  }

  /** 테스트판: 하루가 지난 셈 친다. 오늘 받은 출석을 다시 받고 상점의 산 횟수가 지워진다. */
  void nextDay(CompanyState c) {
    c.attendDay = null;
    c.shopDay = null;
    c.shopBought.clear();
  }

  /** 상점의 산 횟수는 한국 시간 자정에 지워진다 (541번). */
  private void rollShop(CompanyState c) {
    if (c.shopBought == null) c.shopBought = new java.util.HashMap<>();
    if (!idle.today().equals(c.shopDay)) {
      c.shopDay = idle.today();
      c.shopBought.clear();
    }
  }

  /** 상점에서 상품 하나를 산다 (541번). 값은 다이아나 돈(지금 초당 수입 × 분)이고, 하루 횟수를 다 썼거나 재화가 모자라거나 없는 상품이면 400. */
  void buy(CompanyState c, String code) {
    rollShop(c);
    CompanyProperties.ShopItem item =
        engine.shop().items().stream()
            .filter(i -> i.code().equals(code))
            .findFirst()
            .orElseThrow(() -> new InvalidRequestException("없는 상품이에요: " + code));
    int bought = c.shopBought.getOrDefault(code, 0);
    if (bought >= item.dailyLimit()) {
      throw new InvalidRequestException("오늘은 다 샀어요. 내일 다시 열려요");
    }
    double price = money(c, item.priceIncomeMinutes());
    if (c.capital < price) {
      throw new InvalidRequestException("돈이 모자라요");
    }
    CompanyEngine.spend(c, item.priceDiamonds());
    c.capital -= price;
    CompanyState.ShopReceipt receipt = new CompanyState.ShopReceipt();
    receipt.code = code;
    receipt.diamonds = item.giveDiamonds();
    receipt.money = money(c, item.giveIncomeMinutes());
    c.diamonds += receipt.diamonds;
    c.capital += receipt.money;
    c.shopBought.put(code, bought + 1);
    c.lastShop = receipt;
  }

  /** 상점의 화면 값 (541번): 상품마다 지금의 값과 주는 것, 오늘 남은 횟수. */
  CompanyView.Shop shopView(CompanyState c) {
    rollShop(c);
    List<CompanyView.ShopItem> items =
        engine.shop().items().stream()
            .map(
                i ->
                    new CompanyView.ShopItem(
                        i.code(),
                        i.name(),
                        i.priceDiamonds(),
                        i.priceIncomeMinutes() > 0
                            ? CompanyView.money(money(c, i.priceIncomeMinutes()))
                            : null,
                        i.giveDiamonds(),
                        i.giveIncomeMinutes(),
                        i.giveIncomeMinutes() > 0
                            ? CompanyView.money(money(c, i.giveIncomeMinutes()))
                            : null,
                        i.dailyLimit(),
                        Math.max(0, i.dailyLimit() - c.shopBought.getOrDefault(i.code(), 0))))
            .toList();
    CompanyState.ShopReceipt r = c.lastShop;
    return new CompanyView.Shop(
        items,
        r == null
            ? null
            : new CompanyView.ShopReceipt(r.code, r.diamonds, CompanyView.money(r.money)));
  }

  /**
   * 출석판의 화면 값. 오늘 받을 칸(이미 받았으면 오늘 받은 칸)이 today이고, 이번 주기에서 그 앞까지가 받은 칸이다. 마지막 칸을 받은 날에는 모든 칸이 받은 채로
   * 보이고 다음 날 새 주기가 시작된다.
   */
  CompanyView.Attendance view(CompanyState c) {
    List<CompanyProperties.AttendanceDay> days = rule().days();
    boolean claimable = claimable(c);
    int next = Math.floorMod(c.attendCount, days.size());
    boolean finished = !claimable && c.attendCount > 0 && next == 0;
    int stamped = finished ? days.size() : next;
    int today = claimable ? next + 1 : stamped;
    List<CompanyView.AttendanceDay> board = new ArrayList<>();
    for (int i = 0; i < days.size(); i++) {
      CompanyProperties.AttendanceDay d = days.get(i);
      board.add(
          new CompanyView.AttendanceDay(
              i + 1,
              d.diamonds(),
              d.incomeMinutes(),
              d.incomeMinutes() > 0 ? CompanyView.money(money(c, d.incomeMinutes())) : null,
              i < stamped));
    }
    CompanyState.AttendReward r = c.lastAttend;
    return new CompanyView.Attendance(
        today,
        claimable,
        board,
        r == null
            ? null
            : new CompanyView.AttendanceReward(r.day, r.diamonds, CompanyView.money(r.money)));
  }

  /** 강화를 levels번 했다: 시즌패스 미션 (569번). */
  void upgraded(CompanyState c, int levels) {
    engine.pass.progress(c, "upgrade", levels, idle.todayDate());
  }

  /** 고양이나 무기를 count번 뽑았다: 시즌패스 미션 (569번). */
  void drew(CompanyState c, int count) {
    engine.pass.progress(c, "draw", count, idle.todayDate());
  }

  /** 무기를 한 번 합쳤다: 시즌패스 미션 (569번). */
  void merged(CompanyState c) {
    engine.pass.progress(c, "merge", 1, idle.todayDate());
  }

  /**
   * 시즌패스의 단계 보상을 받는다 (529번). step이 null이면 받을 수 있는 것을 모두 받는다. 도달하지 않았거나 이미 받은 단계면 400. 모두 받기에 받을 것이
   * 없어도 400.
   */
  void claimPass(CompanyState c, Integer step, SeededRandom random) {
    engine.pass.roll(c, idle.todayDate());
    int reached = engine.pass.reached(c);
    List<Integer> steps = new ArrayList<>();
    if (step == null) {
      for (int i = 1; i <= reached; i++) {
        if (!c.passClaimed.contains(i)) steps.add(i);
      }
      if (steps.isEmpty()) {
        throw new InvalidRequestException("받을 수 있는 시즌패스 보상이 없어요");
      }
    } else {
      if (step < 1 || step > engine.pass.rule().steps()) {
        throw new InvalidRequestException("없는 단계예요: " + step);
      }
      if (step > reached) {
        throw new InvalidRequestException("아직 도달하지 않은 단계예요: " + step);
      }
      if (c.passClaimed.contains(step)) {
        throw new InvalidRequestException("이미 받은 단계예요: " + step);
      }
      steps.add(step);
    }
    List<CompanyState.PassReward> got = new ArrayList<>();
    for (int at : steps) {
      PassRules.Reward reward = engine.pass.reward(at);
      CompanyState.PassReward r = new CompanyState.PassReward();
      r.step = at;
      r.diamonds = reward.diamonds();
      c.diamonds += r.diamonds;
      if (reward.weapon()) {
        engine.mental.initWeapons(c);
        CompanyState.Pulled weapon = engine.mental.drawOne(c, random);
        r.weaponKind = weapon.kind;
        r.weaponGrade = weapon.grade;
      }
      if (reward.cat()) {
        r.cat = idle.grantCat(c, random).kind;
      }
      c.passClaimed.add(at);
      got.add(r);
    }
    c.lastPass = got;
  }

  /** 테스트판: 시즌패스 포인트를 더한다. */
  void addPassExp(CompanyState c, long exp) {
    engine.pass.gain(c, exp, idle.todayDate());
  }

  /** 테스트판: 다음 시즌으로 넘긴다. 진행도가 비고 받지 않은 보상은 사라진다. */
  void nextSeason(CompanyState c) {
    c.passSeasonOffset++;
    engine.pass.roll(c, idle.todayDate());
  }

  private static final long DAY_SECONDS = 86_400;

  /** 시즌패스의 화면 값 (529번). */
  CompanyView.Pass passView(CompanyState c) {
    java.time.LocalDate today = idle.todayDate();
    engine.pass.roll(c, today);
    CompanyProperties.Pass rule = engine.pass.rule();
    int reached = engine.pass.reached(c);
    long endsAt = IdleEngine.startOf(engine.pass.ends(c, today));
    long left = Math.max(0, (endsAt - idle.now() + 999) / 1000);
    List<CompanyView.PassStep> steps = new ArrayList<>();
    int claimable = 0;
    for (int at = 1; at <= rule.steps(); at++) {
      PassRules.Reward reward = engine.pass.reward(at);
      boolean claimed = c.passClaimed.contains(at);
      if (at <= reached && !claimed) claimable++;
      steps.add(
          new CompanyView.PassStep(
              at, reward.diamonds(), reward.weapon(), reward.cat(), at <= reached, claimed));
    }
    // 미션 (569번): 이번 시즌에 센 수와 다음에 닿을 수, 그때 받는 포인트.
    List<CompanyView.PassMission> missions =
        rule.missions().stream()
            .map(
                m -> {
                  long count = c.passMissions.getOrDefault(m.code(), 0L);
                  long target = (count / m.every() + 1) * m.every();
                  return new CompanyView.PassMission(
                      m.code(),
                      m.title().replace("{n}", String.format("%,d", target)),
                      count,
                      target,
                      m.every(),
                      m.points(),
                      count / m.every() * m.points());
                })
            .toList();
    List<CompanyView.PassReward> last =
        (c.lastPass == null ? List.<CompanyState.PassReward>of() : c.lastPass)
            .stream()
                .map(
                    r ->
                        new CompanyView.PassReward(
                            r.step,
                            r.diamonds,
                            r.weaponKind,
                            r.weaponGrade,
                            r.cat,
                            r.cat == null ? null : idle.catName(r.cat)))
                .toList();
    return new CompanyView.Pass(
        c.passSeason,
        "시즌 " + c.passSeason,
        endsAt,
        left,
        left <= DAY_SECONDS,
        c.passExp,
        rule.pointsPerStep(),
        reached,
        claimable,
        steps,
        missions,
        last);
  }
}
