package investorgame.raising.internal;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 측정: 한 회사의 일생(뽑기·합성·배치·이사·회의·결산)을 사장 셋으로 굴린다 (#344·#388·#389). */
class BalanceSimulationTest {

  static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  static final CompanyEngine ENGINE =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);
  static final List<String> LADDER =
      List.of("F", "E", "D", "C", "B", "A", "S", "SS", "SSS", "X", "XX", "XXX", "Z");
  static final List<String> TRADING =
      List.of("bio", "day", "semiconductor", "energy", "game", "food", "finance");

  enum Boss {
    GREEDY,
    READER,
    LAZY
  }

  static String majorityStance(CompanyState.Macro macro) {
    long up = macro.sentences.stream().filter(s -> s.sign.equals("UP")).count();
    long down = macro.sentences.stream().filter(s -> s.sign.equals("DOWN")).count();
    return up > down
        ? MacroEngine.AGGRESSIVE
        : down > up ? MacroEngine.DEFENSIVE : MacroEngine.NEUTRAL;
  }

  static String majorityChoice(CompanyState.Invest invest) {
    long up = invest.sentences.stream().filter(s -> s.sign.equals("UP")).count();
    long down = invest.sentences.stream().filter(s -> s.sign.equals("DOWN")).count();
    return up > down ? InvestEngine.BUY : down > up ? InvestEngine.SELL : InvestEngine.HOLD;
  }

  /** 연초: 채용권을 다 쓰고, 같은 등급 둘씩 합치고, 넘치면 내보내고, 높은 사람부터 앉히고, 이사할 수 있으면 한다. */
  static void yearStart(CompanyState c, HashSeededRandom random, Boss boss) {
    if (boss != Boss.LAZY) {
      while (ENGINE.canUpgrade(c)) {
        ENGINE.upgrade(c);
      }
    }
    while (c.tickets > 0) {
      int room = ENGINE.rosterMax(c) - c.employees.size();
      if (room <= 0) {
        if (!mergeOnce(c)) {
          CompanyState.Employee worst = c.employees.stream().min(byGrade()).orElseThrow();
          ENGINE.release(c, worst.id);
        }
        continue;
      }
      ENGINE.draw(c, Math.min(Math.min(c.tickets, room), PROPERTIES.gacha().maxDraws()), random);
    }
    while (c.employees.size() > ENGINE.seats(c) && mergeOnce(c)) {}
    List<CompanyState.Employee> best = new ArrayList<>(c.employees);
    best.sort(byGrade().reversed());
    int seats = ENGINE.seats(c);
    Map<Integer, String> placements = new HashMap<>();
    int t = 0;
    for (int i = 0; i < best.size(); i++) {
      String desk = null;
      if (i < seats) {
        desk = i == 2 ? "research" : TRADING.get(t++ % TRADING.size());
        if (t > TRADING.size()) {
          desk = null;
        }
      }
      placements.put(best.get(i).id, desk);
    }
    ENGINE.place(c, placements);
  }

  static Comparator<CompanyState.Employee> byGrade() {
    return Comparator.comparingInt(
        (CompanyState.Employee e) -> LADDER.indexOf(CompanyEngine.employeeGrade(e)) * 100 + e.rank);
  }

  static boolean mergeOnce(CompanyState c) {
    Map<String, List<CompanyState.Employee>> by = new HashMap<>();
    for (CompanyState.Employee e : c.employees) {
      if (CompanyEngine.employeeGrade(e).equals("GOD")) {
        continue;
      }
      by.computeIfAbsent(CompanyEngine.employeeGrade(e), k -> new ArrayList<>()).add(e);
    }
    for (List<CompanyState.Employee> same : by.values()) {
      if (same.size() >= PROPERTIES.gacha().mergeCount()) {
        try {
          ENGINE.merge(
              c,
              same.get(0).id,
              same.subList(1, PROPERTIES.gacha().mergeCount()).stream().map(e -> e.id).toList());
          return true;
        } catch (RuntimeException ignored) {
          // 이직 제안 등이 걸린 사람
        }
      }
    }
    return false;
  }

  static void quarter(CompanyState c, HashSeededRandom random, Boss boss) {
    if (ENGINE.macro.open(c)) {
      String stance =
          switch (boss) {
            case GREEDY -> MacroEngine.AGGRESSIVE;
            case READER -> majorityStance(c.macro);
            case LAZY -> MacroEngine.NEUTRAL;
          };
      ENGINE.macro.decide(c, stance, random);
    }
    if (ENGINE.invest.open(c)) {
      String choice =
          switch (boss) {
            case GREEDY -> InvestEngine.BUY;
            case READER -> majorityChoice(c.invest);
            case LAZY -> InvestEngine.HOLD;
          };
      ENGINE.invest.decide(c, choice, boss == Boss.GREEDY, random, false);
    }
    if (c.raise != null) {
      ENGINE.pay.answer(c, true, random);
    }
    if (c.resign != null) {
      ENGINE.pay.answerResign(c, true);
    }
    if (c.poach != null) {
      ENGINE.answerPoach(c, true);
    }
    ENGINE.settleQuarter(c, random);
  }

  /** 한 회사의 일생: 해마다 회사 등급(건물)의 첫 해를 적는다. 반환: [해 → 등급 단계], 마지막 자본. */
  record Life(int[] firstYearAt, long capital) {}

  static Life life(long seed, Boss boss, int years) {
    HashSeededRandom random = new HashSeededRandom(seed);
    CompanyState c = ENGINE.open(random, PROPERTIES.baseCapital());
    int[] first = new int[LADDER.size()];
    Arrays.fill(first, -1);
    first[0] = 0;
    for (int y = 1; y <= years && !c.finished; y++) {
      yearStart(c, random, boss);
      int at = LADDER.indexOf(ENGINE.grade(c));
      if (at >= 0 && first[at] < 0) {
        first[at] = y;
      }
      int year = c.year;
      while (c.year == year && !c.finished) {
        quarter(c, random, boss);
      }
    }
    return new Life(first, c.capital);
  }

  static long median(long[] xs) {
    long[] s = xs.clone();
    Arrays.sort(s);
    return s[s.length / 2];
  }

  record Summary(long capital, long[] firstYear) {}

  static Summary run(Boss boss, int trials, int years) {
    long[] capital = new long[trials];
    long[][] first = new long[LADDER.size()][trials];
    for (int seed = 0; seed < trials; seed++) {
      Life l = life(seed, boss, years);
      capital[seed] = l.capital();
      for (int k = 0; k < LADDER.size(); k++) {
        first[k][seed] = l.firstYearAt()[k] < 0 ? 999 : l.firstYearAt()[k];
      }
    }
    long[] medians = new long[LADDER.size()];
    for (int k = 0; k < LADDER.size(); k++) {
      medians[k] = median(first[k]);
    }
    return new Summary(median(capital), medians);
  }

  /**
   * 25년 일생 120판 (#344·#388·#389). 기사를 다수결로 읽는 사장이 늘 공격·크게 하는 사장보다, 그 사장이 이사 안 하고 중립·보류만 하는 사장보다 낫다.
   * 기사 읽는 사장은 첫 이사(E)를 3년 안에 하고, 등급 하나에 5년 넘게 걸리지 않는다. 맞춘 때(2026-11-07, 200판): 기사 1조 1,940억 · 공격
   * 1,913억 · 이사 안 함 194억, 기사 사장의 등급 첫 해 E 2 · D 6 · C 10 · B 14 · A 18 · S 21 · SS 24.
   */
  @Test
  void 기사를_읽는_사장이_이기고_등급이_고르게_오른다() {
    int trials = 120;
    int years = 25;
    Summary reader = run(Boss.READER, trials, years);
    Summary greedy = run(Boss.GREEDY, trials, years);
    Summary lazy = run(Boss.LAZY, trials, years);
    org.assertj.core.api.Assertions.assertThat(reader.capital())
        .as("기사 읽는 사장이 늘 공격·크게 하는 사장의 세 배 넘게 번다")
        .isGreaterThan(greedy.capital() * 3);
    org.assertj.core.api.Assertions.assertThat(greedy.capital())
        .as("이사 안 하고 버티는 쪽이 가장 못하다 (규모의 벽은 자본을 본다)")
        .isGreaterThan(lazy.capital());
    org.assertj.core.api.Assertions.assertThat(reader.firstYear()[1])
        .as("첫 이사")
        .isLessThanOrEqualTo(3);
    for (int k = 2; k <= LADDER.indexOf("S"); k++) {
      org.assertj.core.api.Assertions.assertThat(reader.firstYear()[k] - reader.firstYear()[k - 1])
          .as(LADDER.get(k - 1) + " → " + LADDER.get(k))
          .isBetween(2L, 5L);
    }
  }
}
