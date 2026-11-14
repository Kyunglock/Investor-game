package investorgame.raising.internal;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import investorgame.raising.CompanyView;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 측정: 한 회사의 일생(뽑기·배치·이사·회의·결산)을 사장 다섯 유형으로 굴린다 (#344·#388·#389·#546). */
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
    STAGES,
    /** 스테이지 사장이 연초마다 자본의 BUYER_PERCENT%까지 전투 강화(394번)를 산다: 공격력·연사 가운데 싼 쪽부터. */
    BUYER
  }

  /** 전투 강화를 사는 사장(BUYER)이 연초마다 강화에 쓰는 자본 비율(%). */
  static final int BUYER_PERCENT = 2;

  static String majorityChoice(CompanyState.Invest invest) {
    long up = invest.sentences.stream().filter(s -> s.sign.equals("UP")).count();
    long down = invest.sentences.stream().filter(s -> s.sign.equals("DOWN")).count();
    return down > up ? InvestEngine.SELL : InvestEngine.BUY;
  }

  /** 연초: 채용권을 다 쓰고, 넘치면 내보내고, 높은 사람부터 앉히고, 이사할 수 있으면 한다. */
  static void yearStart(CompanyState c, HashSeededRandom random, Boss boss) {
    if (boss != Boss.LAZY) {
      while (ENGINE.canUpgrade(c)) {
        ENGINE.upgrade(c);
      }
    }
    if (boss == Boss.BUYER) {
      long budget = (long) c.capital * BUYER_PERCENT / 100;
      while (true) {
        String kind =
            ENGINE.mental.upgradeViews(c).stream()
                .filter(u -> u.maxLevel() == 0 || u.level() < u.maxLevel())
                .min(Comparator.comparingInt(CompanyView.BattleUpgrade::level))
                .orElseThrow()
                .kind();
        long price = (long) ENGINE.mental.upgradePrice(c.battleLevels.getOrDefault(kind, 0));
        if (price > budget) {
          break;
        }
        budget -= price;
        ENGINE.mental.buyUpgrade(c, kind, 1);
      }
    }
    while (c.tickets > 0) {
      int room = ENGINE.rosterMax(c) - c.employees.size();
      if (room <= 0) {
        CompanyState.Employee worst = c.employees.stream().min(byGrade()).orElseThrow();
        ENGINE.release(c, worst.id);
        continue;
      }
      ENGINE.draw(c, Math.min(Math.min(c.tickets, room), PROPERTIES.gacha().maxDraws()), random);
    }
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

  static void quarter(CompanyState c, HashSeededRandom random, Boss boss) {
    // 분기 넘기기를 누르면 직원이 종목을 물어 온다 (267·382번).
    ENGINE.scout.discover(c, random);
    if (ENGINE.invest.open(c)) {
      String choice =
          switch (boss) {
            case GREEDY -> InvestEngine.BUY;
            case READER, STAGES, BUYER -> majorityChoice(c.invest);
            case LAZY -> majorityChoice(c.invest); // 지켜본다는 없다(423번): 자동 진행처럼 다수결
          };
      ENGINE.invest.decide(c, choice, boss == Boss.GREEDY, random);
      // 회의 뒤 전투는 없다(474번): battleMode가 null이라 건너뛴다.
      String battle = InvestEngine.battleMode(c.invest);
      if (battle != null && (boss == Boss.STAGES || boss == Boss.BUYER)) {
        ENGINE.invest.battle(c, battle, 3);
      }
    }
    if (boss == Boss.STAGES || boss == Boss.BUYER) {
      int next = ENGINE.mental.bestStage(c) + 1;
      if (next <= PROPERTIES.mental().stages().perChapter()) {
        ENGINE.mental.reportStage(c, next, true, 2);
      }
    }
    ENGINE.settleQuarter(c, random);
  }

  /**
   * 한 회사의 일생: 해마다 회사 등급(건물)의 첫 해를 적는다. 반환: [해 → 등급 단계], 마지막 자본, 해마다 연말의 전투 강화 단계(공격력 + 연사), 분기
   * 실적·결산서의 전투 강화 비용 줄을 모두 더한 값, 산 강화 단계들의 값을 모두 더한 값.
   */
  record Life(
      int[] firstYearAt, long capital, int[] battleLevels, long bookedUpgrades, long boughtValue) {}

  static Life life(long seed, Boss boss, int years) {
    HashSeededRandom random = new HashSeededRandom(seed);
    CompanyState c = ENGINE.open(random, PROPERTIES.baseCapital());
    int[] first = new int[LADDER.size()];
    Arrays.fill(first, -1);
    first[0] = 0;
    int[] levels = new int[years + 1];
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
      levels[y] = c.battleLevels.values().stream().mapToInt(Integer::intValue).sum();
    }
    long booked = c.settlements.stream().mapToLong(s -> s.upgrades).sum() + c.yearUpgrades;
    long bought = 0;
    for (int level : c.battleLevels.values()) {
      for (int i = 0; i < level; i++) {
        bought += (long) ENGINE.mental.upgradePrice(i);
      }
    }
    return new Life(first, (long) c.capital, levels, booked, bought);
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
   * 25년 일생 120판 (#344·#388·#389·#468·#546). 성장의 주된 길은 기사를 읽고 멘탈 스테이지를 깨는 사장이다(decisions.md 371번): 깬
   * 최고 스테이지만큼 붙는 분기 강화율(369번)이 쌓여 등급이 3~6년에 하나씩 오른다. 스테이지를 안 하는 기사 사장은 그보다 훨씬 느리지만(의도) 늘 공격·크게 하는
   * 사장보다 낫고, 그 사장이 이사 안 하는 사장보다 낫다. 전투 강화를 사는 스테이지 사장(394번)은 강화에 쓴 만큼 자본이 덜 크지만 등급은 스테이지 사장과 거의 같이
   * 오른다.
   *
   * <p>지금(2026-11-09, 389번): 스테이지 1조 3,146억 · 등급 첫 해 E 2 · D 6 · C 8 · B 13 · A 16 · S 21 · SS 23 /
   * 강화 사는 스테이지 7,931억 · E 2 · D 6 · C 9 · B 13 · A 16 · S 22 · SS 24 / 기사 1,589억 · E 3 · D 8 · C 12
   * · B 17 · A 22 / 공격 330억 · E 3 · D 12 · C 15 · B 21 / 이사 안 함 17억(반지하 그대로).
   *
   * <p>지나온 길(371·382~388번): 거시경제 회의가 있을 때 스테이지 1조 2,071억(SS 23년) · 기사 806억 · 공격 39억 · 이사 안 함
   * 13억이었다. 거시경제 회의·인건비·직원 합성·이직 제안을 걷어 내며(382~385번) 경제 수치를 그대로 둬 스테이지 사장이 2,596억(A 20년, S 없음) · 기사
   * 98억 · 공격 34억 · 이사 안 함 6억까지 줄었다. 맞히면 더 버는 몫을 등급마다 두 배로 하고(387번) 종목 회의 수익률을 −50% ~ +300%로
   * 넓혀(388번) 다시 #518 전 수준이 되었고, 389번(#546)에서 이 속도를 그대로 두기로 했다. 그동안 두 배 반으로 낮췄던 기사 사장과 공격 사장의 차이도
   * 371번의 세 배로 되돌렸다.
   */
  @Test
  void 스테이지를_깨며_기사를_읽는_사장이_가장_빨리_크고_등급이_고르게_오른다() {
    int trials = 120;
    int years = 25;
    Summary stages = run(Boss.STAGES, trials, years);
    Summary buyer = run(Boss.BUYER, trials, years);
    Summary reader = run(Boss.READER, trials, years);
    Summary greedy = run(Boss.GREEDY, trials, years);
    Summary lazy = run(Boss.LAZY, trials, years);
    System.out.println(
        "BALANCE 스테이지 "
            + stages.capital() / 100_000_000
            + "억 "
            + Arrays.toString(stages.firstYear())
            + " | 강화 사는 스테이지 "
            + buyer.capital() / 100_000_000
            + "억 "
            + Arrays.toString(buyer.firstYear())
            + " | 기사 "
            + reader.capital() / 100_000_000
            + "억 "
            + Arrays.toString(reader.firstYear())
            + " | 공격 "
            + greedy.capital() / 100_000_000
            + "억 "
            + Arrays.toString(greedy.firstYear())
            + " | 이사 안 함 "
            + lazy.capital() / 100_000_000
            + "억 "
            + Arrays.toString(lazy.firstYear()));
    org.assertj.core.api.Assertions.assertThat(stages.capital())
        .as("스테이지를 깨는 사장이 안 깨는 사장보다 크게 번다")
        .isGreaterThan(reader.capital() * 3);
    org.assertj.core.api.Assertions.assertThat(buyer.capital())
        // 회의 뒤 매도벽 돌파 보너스가 없어져(474번) 차가 조금 줄었다: 세 배 → 두 배 반.
        .as("전투 강화를 사도 스테이지가 성장의 주된 길이다 (394번)")
        .isGreaterThan(reader.capital() * 5 / 2);
    // 틀려도 회의에서 잃지 않으므로(#697) 늘 크게 하는 사장이 기사 읽는 사장보다 더 벌 수 있다. 기사를 읽으면 이사 안 하는 사장보다는 낫다.
    org.assertj.core.api.Assertions.assertThat(reader.capital())
        .as("기사 읽는 사장이 이사 안 하고 버티는 사장보다 번다")
        .isGreaterThan(lazy.capital());
    org.assertj.core.api.Assertions.assertThat(greedy.capital())
        .as("이사 안 하고 버티는 쪽이 가장 못하다 (규모의 벽은 자본을 본다)")
        .isGreaterThan(lazy.capital());
    org.assertj.core.api.Assertions.assertThat(stages.firstYear()[1])
        .as("첫 이사")
        .isLessThanOrEqualTo(3);
    org.assertj.core.api.Assertions.assertThat(stages.capital())
        .as("25년에 #518 전 수준(1조 원대)을 크게 넘지 않는다 (389번)")
        .isLessThan(3_000_000_000_000L);
    // 회의 방어 삭제 후 25년 120판 중앙값: 스테이지 3,542억/S 23년, 강화 사는 쪽 2,476억/S 24년.
    // 손실 회복 보너스 없이 SS는 25년 안에 닿지 않는다. 경제는 바꾸지 않고 S까지 성장 간격을 검증한다.
    org.assertj.core.api.Assertions.assertThat(stages.firstYear()[LADDER.indexOf("S")])
        .as("방어 보너스 없이도 25년 안에 S에 도달한다")
        .isLessThanOrEqualTo(years);
    for (int k = 2; k <= LADDER.indexOf("S"); k++) {
      org.assertj.core.api.Assertions.assertThat(stages.firstYear()[k] - stages.firstYear()[k - 1])
          .as(LADDER.get(k - 1) + " → " + LADDER.get(k))
          .isBetween(1L, 6L);
    }
    int s = LADDER.indexOf("S");
    org.assertj.core.api.Assertions.assertThat(buyer.firstYear()[s] - stages.firstYear()[s])
        .as("전투 강화를 사는 사장도 S에 두 해 넘게 늦지 않는다 (389번)")
        .isBetween(0L, 2L);
  }

  /**
   * 전투 강화는 끝없이 산다 (394번): 스테이지 사장이 연초마다 자본의 2%까지 공격력·연사를 사면, 자본이 커지는 만큼 단계가 계속 오른다. 값이 단계마다 4%씩 오르니
   * 자본이 열 배 크면 약 59단계를 더 산다. 쓴 돈은 분기 실적·결산서의 전투 강화 비용 줄에 빠짐없이 적힌다. 강화는 멘탈 전투를 쉽게 할 뿐 경제로는 스테이지 열 개를
   * 깨는 데까지만 돌아오고(시뮬레이션은 강화 없이도 분기마다 하나씩 깬다고 친다), 강화에 쓴 돈은 그대로 빠진다: 해마다 2%면 25년에 약 0.98^25 ≈ 0.6배.
   * 2026-11-09 40판(25년, 389번): 강화 사는 사장 7,109억(안 사면 1조 1,035억) · 공격력+연사 단계 5년 19 · 10년 59 · 15년 144
   * · 20년 258 · 25년 338(하나에 약 169단계, +169%). 5%씩 쓰면 25년 366단계지만 자본이 4,925억으로 줄어 2%로 잰다.
   */
  @Test
  void 전투_강화를_사는_스테이지_사장은_자본이_커지는_만큼_단계가_끝없이_오른다() {
    int trials = 40;
    int years = 25;
    long[] capital = new long[trials];
    long[][] levels = new long[years + 1][trials];
    for (int seed = 0; seed < trials; seed++) {
      Life l = life(seed, Boss.BUYER, years);
      capital[seed] = l.capital();
      for (int y = 1; y <= years; y++) {
        levels[y][seed] = l.battleLevels()[y];
      }
      org.assertj.core.api.Assertions.assertThat(l.bookedUpgrades())
          .as("분기 실적·결산서의 전투 강화 비용 줄 = 강화에 쓴 돈")
          .isEqualTo(l.boughtValue());
    }
    long[] median = new long[years + 1];
    for (int y = 1; y <= years; y++) {
      median[y] = median(levels[y]);
    }
    Summary stages = run(Boss.STAGES, trials, years);
    System.out.println(
        "BATTLE-UPGRADES 강화 사는 스테이지 사장 "
            + median(capital) / 100_000_000
            + "억 (안 사면 "
            + stages.capital() / 100_000_000
            + "억) · 공격력+연사 단계 5년 "
            + median[5]
            + " · 10년 "
            + median[10]
            + " · 15년 "
            + median[15]
            + " · 20년 "
            + median[20]
            + " · 25년 "
            + median[25]);
    for (int y = 5; y + 5 <= years; y += 5) {
      org.assertj.core.api.Assertions.assertThat(median[y + 5])
          .as(y + "년 → " + (y + 5) + "년에도 단계가 오른다")
          .isGreaterThan(median[y]);
    }
    org.assertj.core.api.Assertions.assertThat(median[years])
        .as("25년이면 공격력·연사 합쳐 200단계 넘게(하나에 +100% 넘게)")
        .isGreaterThan(200);
    org.assertj.core.api.Assertions.assertThat(median(capital))
        .as("강화에 자본의 2%씩 써도 성장의 큰 줄기는 그대로다")
        .isGreaterThan(stages.capital() * 3 / 5);
  }
}
