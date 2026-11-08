package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * 회사 경제의 맞춤 (증권사 육성 설계 5절 1번, decisions.md 226·229·389번). 첫 회사(1억 원, F)에 같은 능력치의 직원 둘을 맞는
 * 자리(바이오·단타)에 앉히고 분기마다 직원이 종목을 물어 왔으면 종목 회의(기사 다수결), 결산을 하며 한 시대(세 해)를 2,000번 돌려, 능력치에 따라 회사가 자라는
 * 폭이 목표 안에 드는지 본다(거시경제 회의는 382번에서 빠졌다). 수치를 바꾸면 이 목표부터 다시 맞춘다.
 */
class EconomySimulationTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final CompanyEngine ENGINE =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);
  private static final long START = 100_000_000L;
  private static final long GRADE_E = PROPERTIES.gradeCapital().get(1);
  private static final int TRIALS = 2000;

  private static Map<String, Integer> stats(int value) {
    return Map.of(
        "insight", value, "patience", value, "courage", value, "conviction", value, "luck", value);
  }

  private static String majority(CompanyState.Invest invest) {
    long up = invest.sentences.stream().filter(s -> s.sign.equals("UP")).count();
    long down = invest.sentences.stream().filter(s -> s.sign.equals("DOWN")).count();
    return up > down ? InvestEngine.BUY : down > up ? InvestEngine.SELL : InvestEngine.HOLD;
  }

  /**
   * 한 해를 사람처럼 돈다: 분기마다 분기 넘기기를 누르면 직원이 종목을 물어 오고, 물어 왔으면 종목 회의(기사 다수결) → 분기 결산, 네 분기를 넘기면 연말 결산
   * (decisions.md 267·268·382번).
   */
  private static void year(CompanyState company, long seed) {
    HashSeededRandom random = new HashSeededRandom(seed);
    int year = company.year;
    while (company.year == year) {
      ENGINE.scout.discover(company, random);
      if (ENGINE.invest.open(company)) {
        ENGINE.invest.decide(company, majority(company.invest), random);
      }
      ENGINE.settleQuarter(company, random);
    }
  }

  /** 한 시대 뒤 자본 배수의 중앙값과 E(2억, 257번) 이상에 닿은 몫. */
  private static double[] era(int level) {
    double[] ratio = new double[TRIALS];
    int reachedE = 0;
    for (int seed = 0; seed < TRIALS; seed++) {
      CompanyState company = ENGINE.open(new HashSeededRandom(seed), START);
      ENGINE.hire(company, stats(level));
      ENGINE.hire(company, stats(level));
      ENGINE.place(company, Map.of(1, "bio", 2, "day"));
      for (int y = 0; y < PROPERTIES.turns(); y++) {
        // 사장은 기사 문장의 다수결로 고른다(형광펜 없이 약 64% 맞는다).
        year(company, seed);
      }
      ratio[seed] = company.capital / (double) START;
      if (company.capital >= GRADE_E) {
        reachedE++;
      }
    }
    Arrays.sort(ratio);
    return new double[] {ratio[TRIALS / 2], reachedE / (double) TRIALS};
  }

  @Test
  void 능력치가_좋을수록_한_시대에_회사가_크게_자란다() {
    double[] weak = era(30);
    double[] average = era(45);
    double[] good = era(60);
    double[] great = era(75);
    System.out.printf(
        "ECONOMY 세 해 D %.2f(%.0f%%) · C %.2f(%.0f%%) · A %.2f(%.0f%%) · S %.2f(%.0f%%)%n",
        weak[0],
        weak[1] * 100,
        average[0],
        average[1] * 100,
        good[0],
        good[1] * 100,
        great[0],
        great[1] * 100);
    // 투자 회의가 한 해에 판단 하나만큼 더해 226번 목표(E 1.14배·C 1.71배·A 34%·S 77%)보다 3할쯤 커졌다 (229번).
    // E 띠를 2억으로 낮추고 첫 회사의 첫해에 폭락장을 뺐다(257번): 첫 시대에 E(첫 책상 추가)에 닿는 몫이 커졌다.
    // 종목 회의가 물어 올 때만 열리고(267번) 해마다 거시경제 회의를 연다(266번): 조금 줄었다.
    // 턴이 분기가 되어(268번) 분기마다 판단 하나·수수료 4분의 1, 판돈은 1분기 자본으로 한 해 내내 같다.
    // 2,000판: E 직원 21% · C 직원 54% · A 직원 84% · S 직원 98%, 세 해 자본 중앙값 1.41 · 2.07 · 2.98 · 4.39배.
    // #344: E 띠를 1.2억으로 낮춰 첫 이사가 빨라졌다. 2,000판: E 직원 75% · C 92% · A 99%, 세 해 자본 중앙값 1.72 · 2.44 ·
    // 3.67 · 5.34배.
    // 387번: 맞히면 더 버는 몫이 등급마다 두 배(D 1.4배 · C 1.8배 · A 4.2배 · S 7.4배)라 반지하 회사에서는 높은 직원일수록 훨씬 크게
    // 자란다(벽은
    // 회사가 커져야 높아진다). 2,000판(능력치 30·45·60·75 = 종합 D·C·A·S): E에 닿는 몫 83% · 99% · 100% · 100%, 세 해 자본
    // 중앙값
    // 1.92 · 3.79 · 20.6 · 95.3배. 반지하에서 뽑히는 사람은 대개 F·E라 A·S 둘로 차리는 일은 없다.
    // 388번: 종목 회의 수익률을 데스크 몫과 떼어 −50% ~ +300%로(판돈은 분기 몫의 260% × 등급마다 0.77). 2,000판: E에 닿는 몫 82% ·
    // 98% ·
    // 100% · 100%, 세 해 자본 중앙값 2.03 · 4.01 · 21.3 · 93.8배. 389번(#546)에서 다시 재도 같아 그대로 둔다.
    assertThat(weak[0]).as("D 직원: 두 배 가까이 자란다").isBetween(1.6, 2.3);
    assertThat(weak[1]).as("D 직원도 절반 넘게 첫 이사를 할 수 있다").isBetween(0.6, 0.9);
    assertThat(average[0]).as("C 직원: 세 해에 서너 배").isBetween(3.0, 4.6);
    assertThat(average[1]).as("C 직원: 거의 다 E에 닿는다").isGreaterThan(0.95);
    assertThat(good[0]).as("A 직원은 C 직원보다 훨씬 크게 자란다(등급마다 두 배)").isGreaterThan(average[0] * 3);
    assertThat(good[1]).as("A 직원: 거의 다 E에 닿는다").isGreaterThan(0.95);
    assertThat(great[1]).as("S 직원: 거의 다 E에 닿는다").isGreaterThan(0.9);
  }

  /**
   * 첫 회사의 회의 판돈 (decisions.md 389번, 제안). 반지하(F)의 종목 회의는 판돈이 분기 몫의 260%라 자본의 약 60%를 걸고, 회의 수익률은 −50%
   * ~ +300%(388번, 사용자 결정)다. 크게 걸어 회의 한 번이 짜릿하되 한 번에 무너지지는 않는지 본다. 첫 회사에 D 직원
   * 둘(EconomySimulationTest의 가장 약한 시대)로 첫 해를 2,000번 돌린다. 2026-11-09: 회의 판돈 평균 자본의 61% · 회의 한 번에 25%
   * 넘게 잃는 일 6.9% · 가장 크게 잃은 회의 −32% · 한 해 중앙값 1.46배(하위 10% 0.86배, 상위 10% 2.55배) · 잃는 해 18% · 반토막
   * 0.5%.
   */
  @Test
  void 첫_회사의_첫_해는_회의_한_번에_무너지지_않는다() {
    int trials = TRIALS;
    double[] ratio = new double[trials];
    int losses = 0;
    int halved = 0;
    int meetings = 0;
    int deep = 0;
    double stakeShare = 0;
    double worst = 0;
    for (int seed = 0; seed < trials; seed++) {
      CompanyState company = ENGINE.open(new HashSeededRandom(seed), START);
      ENGINE.hire(company, stats(30));
      ENGINE.hire(company, stats(30));
      ENGINE.place(company, Map.of(1, "bio", 2, "day"));
      HashSeededRandom random = new HashSeededRandom(seed);
      while (company.year == 1) {
        ENGINE.scout.discover(company, random);
        if (ENGINE.invest.open(company)) {
          long before = company.capital;
          ENGINE.invest.decide(company, majority(company.invest), random);
          double change = (company.capital - before) / (double) before;
          meetings++;
          stakeShare += company.invest.stake / (double) before;
          deep += change < -0.25 ? 1 : 0;
          worst = Math.min(worst, change);
        }
        ENGINE.settleQuarter(company, random);
      }
      ratio[seed] = company.capital / (double) START;
      losses += company.capital < START ? 1 : 0;
      halved += company.capital < START / 2 ? 1 : 0;
    }
    Arrays.sort(ratio);
    System.out.printf(
        "ECONOMY 첫 회사 첫 해: 회의 판돈 평균 %.0f%% · 25%% 넘게 잃는 회의 %.1f%% · 가장 크게 잃은 회의 %.0f%% · 중앙값 %.2f(하위 10%% %.2f · 상위 10%% %.2f)"
            + " · 잃는 해 %.0f%% · 반토막 %.1f%%%n",
        stakeShare * 100 / meetings,
        deep * 100.0 / meetings,
        worst * 100,
        ratio[trials / 2],
        ratio[trials / 10],
        ratio[trials * 9 / 10],
        losses * 100.0 / trials,
        halved * 100.0 / trials);
    assertThat(worst).as("회의 한 번에 자본의 3분의 1 넘게 잃지 않는다(−50% × 판돈)").isGreaterThan(-0.34);
    assertThat(deep / (double) meetings).as("회의 한 번에 4분의 1 넘게 잃는 일은 드물다").isLessThan(0.1);
    assertThat(losses / (double) trials).as("첫 해에 잃는 회사는 열에 둘쯤").isBetween(0.1, 0.3);
    assertThat(halved / (double) trials).as("첫 해에 반토막 나는 회사는 거의 없다").isLessThan(0.02);
  }

  /** 첫 회사에 C 직원 둘을 그 자리에 앉히고 반지하를 떠나 상가(D)에 닿는 해의 중앙값. */
  private static int firstMove(Map<Integer, String> placements) {
    int trials = 600;
    int[] years = new int[trials];
    for (int seed = 0; seed < trials; seed++) {
      CompanyState company = ENGINE.open(new HashSeededRandom(seed), START);
      ENGINE.hire(company, stats(45));
      ENGINE.hire(company, stats(45));
      ENGINE.place(company, placements);
      int year = 1;
      while (year <= 30 && LADDER.indexOf(ENGINE.grade(company.capital)) < 2) {
        year(company, seed);
        year++;
      }
      years[seed] = year - 1;
    }
    Arrays.sort(years);
    System.out.println("ECONOMY 첫 이사 " + placements + " " + years[trials / 2] + "년");
    return years[trials / 2];
  }

  /**
   * 첫 이사까지 몇 해 (#320, decisions.md 257번). 전에는 API로 굴려 보면 반지하에서 10년, 상가까지 16년쯤 걸렸다. 종목 회의가 물어 올 때만
   * 열리면서 (267번) 한 사람을 종목 발굴팀에 앉혀 해마다 종목 회의를 여는 쪽이 빠르고(중앙값 7년), 둘 다 돈을 굴리면 회의가 드물어 한 해쯤 늦다(9년). 배치에서
   * 고민이 생긴다.
   */
  @Test
  void C_직원_둘이면_다섯_해_안에_첫_이사를_한다() {
    assertThat(firstMove(Map.of(1, "bio", 2, "scout")))
        .as("한 사람은 바이오, 한 사람은 종목 발굴팀 (#344: 중앙값 3년, 387·388번: 2년)")
        .isBetween(2, 4);
    assertThat(firstMove(Map.of(1, "bio", 2, "day")))
        .as("둘 다 돈을 굴리면 종목 회의가 드물다 (중앙값 4년)")
        .isBetween(3, 5);
  }

  /** 돈을 굴리는 자리 일곱(섹터 데스크 여섯과 단타). 규모의 벽 측정은 자리 수만큼 직원을 고르게 앉힌다. */
  private static final List<String> TRADING =
      List.of("bio", "day", "semiconductor", "energy", "game", "food", "finance");

  private static final List<String> LADDER =
      List.of("F", "E", "D", "C", "B", "A", "S", "SS", "SSS", "X", "XX", "XXX");

  /**
   * 규모의 벽 (decisions.md 244번). 회사 등급마다(자본 = 그 등급 띠 바닥의 1.7배) 그 등급의 공채에서 뽑을 만한 직원(능력치 = 회사 등급 띠의
   * 가운데, 289번: 전에는 두 단계 위)을 자리 수만큼 앉히고 한 해를 돌린다. 전에는 B부터 잃는 해가 없고 SSS면 한 해에 자본이 세 배였다. 이제 어느 등급에서도
   * 잃는 해가 있고, 꼭대기에서는 폭락장 한 번에 등급이 떨어질 수 있다.
   */
  @Test
  void 어느_등급에서도_잃는_해가_있고_한_해에_치솟지_않는다() {
    int trials = 800;
    for (int k = 2; k <= 10; k++) {
      long capital = (long) (PROPERTIES.gradeCapital().get(k) * 1.7);
      int stat = Math.min(100, k * 10 + 5);
      double[] ratio = new double[trials];
      int losses = 0;
      int dropped = 0;
      for (int seed = 0; seed < trials; seed++) {
        // 아무 해나 대표하도록 2호 회사로 연다: 첫 회사의 첫해는 폭락장이 아니다(257번).
        CompanyState company = new CompanyState();
        company.number = 2;
        company.capital = capital;
        company.era = "plain";
        ENGINE.startYear(company, new HashSeededRandom(seed));
        Map<Integer, String> placements = new HashMap<>();
        for (int i = 0; i < ENGINE.seats(capital); i++) {
          ENGINE.hire(company, stats(stat));
          placements.put(i + 1, TRADING.get(i % TRADING.size()));
        }
        ENGINE.place(company, placements);
        year(company, seed);
        ratio[seed] = company.capital / (double) capital;
        losses += company.capital < capital ? 1 : 0;
        dropped += LADDER.indexOf(ENGINE.grade(company.capital)) < k ? 1 : 0;
      }
      Arrays.sort(ratio);
      String grade = LADDER.get(k);
      System.out.printf(
          "ECONOMY %s 한 해 중앙값 %.2f · 상위 10%% %.2f · 잃는 해 %.0f%% · 떨어짐 %.0f%%%n",
          grade,
          ratio[trials / 2],
          ratio[trials * 9 / 10],
          losses * 100.0 / trials,
          dropped * 100.0 / trials);
      assertThat(losses / (double) trials).as(grade + " 회사도 잃는 해가 있다").isBetween(0.12, 0.4);
      // 지원자가 회사 등급을 따라 오면서(289번) 한 해 중앙값이 1.12(D)~1.30(X)배로 낮아졌다: 등급이 바로 높아지지 않는다.
      // 387번: 더 버는 몫이 등급마다 두 배라 데스크 몫의 벽도 등급마다 거의 절반씩 높였다. 800판: D 1.09 · B 1.11 · S 1.13 · SSS
      // 1.27 ·
      // X 1.25 · XX 1.07배, 잃는 해 24~39%, XX는 폭락장에 17% 떨어진다.
      // 388번: 회의 수익률이 −50% ~ +300%로 넓어지고 규모의 벽이 수익률 대신 회의 판돈에 붙어(전에는 큰 회사일수록 회의에서 덜 벌고 더 잃었다) 높은
      // 등급이
      // 조금 더 자란다. 800판: D 1.09 · B 1.12 · S 1.18 · SSS 1.37 · X 1.39 · XX 1.26배, 잃는 해 22~39%, XX는
      // 폭락장에 18%
      // 떨어진다. 389번(#546)에서 다시 재도 같다: D의 잃는 해 39%가 상한(40%)에 가장 가깝지만 첫 회사의 판돈은 줄이지 않는다
      // (아래 첫_회사의_첫_해는_회의_한_번에_무너지지_않는다).
      assertThat(ratio[trials / 2]).as(grade + " 회사의 한 해 중앙값").isBetween(1.05, 1.45);
      // 꼭대기(X)도 상위 10%가 한 해 두 배 아래다(SS~X 1.57~1.59배).
      assertThat(ratio[trials * 9 / 10]).as(grade + " 회사가 한 해에 등급 띠(3배)를 넘지 않는다").isLessThan(2.0);
      if (k >= 10) {
        assertThat(dropped / (double) trials).as(grade + " 꼭대기는 폭락장에 떨어질 수 있다").isGreaterThan(0.1);
      }
    }
  }
}
