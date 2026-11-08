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
    LAZY,
    /** 기사 읽는 사장이 분기마다 멘탈 스테이지를 하나씩 깬다 (369번): 스테이지 보상 자본과 분기 강화율이 붙는다. */
    STAGES
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
        desk =
            i == 2 && ENGINE.deskOpen(c, "research")
                ? "research"
                : TRADING.get(t++ % TRADING.size());
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
            case READER, STAGES -> majorityStance(c.macro);
            case LAZY -> MacroEngine.NEUTRAL;
          };
      ENGINE.macro.decide(c, stance, random);
    }
    if (ENGINE.invest.open(c)) {
      String choice =
          switch (boss) {
            case GREEDY -> InvestEngine.BUY;
            case READER, STAGES -> majorityChoice(c.invest);
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
    if (boss == Boss.STAGES) {
      int next = ENGINE.mental.bestStage(c) + 1;
      if (next <= PROPERTIES.mental().stages().perChapter()) {
        ENGINE.mental.reportStage(c, next, true, 2);
      }
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
      // 한 해에 여러 단계를 지나면(공사가 끝난 다음 해 바로 책상을 늘리면) 지난 단계도 그해로 친다.
      int at = LADDER.indexOf(ENGINE.grade(c));
      for (int k = 0; k <= at; k++) {
        if (first[k] < 0) {
          first[k] = y;
        }
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
   * 25년 일생 120판 (#344·#388·#389·#468). 성장의 주된 길은 기사를 읽고 멘탈 스테이지를 깨는 사장이다(decisions.md 371번): 깬 최고
   * 스테이지만큼 붙는 분기 강화율(369번)이 쌓여 등급이 3~5년에 하나씩 오르고 25년 안에 SS에 닿는다. 스테이지를 안 하는 기사 사장은 그보다 훨씬 느리지만(의도)
   * 늘 공격·크게 하는 사장보다 낫고, 그 사장이 이사 안 하는 사장보다 낫다. 2026-11-08 120판: 스테이지 1조 2,071억 · 등급 첫 해 E 2 · D 6 ·
   * C 8 · B 14 · A 17 · S 22 · SS 23 / 기사 806억(E 3 · D 8 · C 13 · B 18 · A 23, S 없음) · 공격 39억 · 이사
   * 안 함 13억. 처음 깸 자본을 빼면 스테이지 8,911억이라 차이의 대부분은 분기 강화율이다.
   */
  @Test
  void 스테이지를_깨며_기사를_읽는_사장이_가장_빨리_크고_등급이_고르게_오른다() {
    int trials = 120;
    int years = 25;
    Summary stages = run(Boss.STAGES, trials, years);
    Summary reader = run(Boss.READER, trials, years);
    Summary greedy = run(Boss.GREEDY, trials, years);
    Summary lazy = run(Boss.LAZY, trials, years);
    System.out.println(
        "BALANCE 스테이지 "
            + stages.capital() / 100_000_000
            + "억 "
            + Arrays.toString(stages.firstYear())
            + " | 기사 "
            + reader.capital() / 100_000_000
            + "억 "
            + Arrays.toString(reader.firstYear())
            + " | 공격 "
            + greedy.capital() / 100_000_000
            + "억 | 이사 안 함 "
            + lazy.capital() / 100_000_000
            + "억");
    org.assertj.core.api.Assertions.assertThat(stages.capital())
        .as("스테이지를 깨는 사장이 안 깨는 사장보다 크게 번다")
        .isGreaterThan(reader.capital() * 3);
    org.assertj.core.api.Assertions.assertThat(reader.capital())
        .as("기사 읽는 사장이 늘 공격·크게 하는 사장의 세 배 넘게 번다")
        .isGreaterThan(greedy.capital() * 3);
    org.assertj.core.api.Assertions.assertThat(greedy.capital())
        .as("이사 안 하고 버티는 쪽이 가장 못하다 (규모의 벽은 자본을 본다)")
        .isGreaterThan(lazy.capital());
    org.assertj.core.api.Assertions.assertThat(stages.firstYear()[1])
        .as("첫 이사")
        .isLessThanOrEqualTo(3);
    for (int k = 2; k <= LADDER.indexOf("SS"); k++) {
      org.assertj.core.api.Assertions.assertThat(stages.firstYear()[k] - stages.firstYear()[k - 1])
          .as(LADDER.get(k - 1) + " → " + LADDER.get(k))
          .isBetween(1L, 6L);
    }
  }
}
