package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/** 아주 작은 회사의 규칙 (증권사 육성 설계 4·6절). 실제 콘텐츠와 application.yml 수치로 돌린다. */
class CompanyEngineTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final CompanyEngine ENGINE =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);

  private static Map<String, Integer> stats(
      int insight, int patience, int courage, int conviction) {
    return Map.of(
        "insight",
        insight,
        "patience",
        patience,
        "courage",
        courage,
        "conviction",
        conviction,
        "luck",
        50);
  }

  /** 회사를 차리고 그 직원을 바로 들인다. 지원자는 그대로 둔다. */
  private static CompanyState open(long seed, Map<String, Integer> stats, long capital) {
    CompanyState company = ENGINE.open(new HashSeededRandom(seed), capital);
    ENGINE.hire(company, stats);
    return company;
  }

  /** 투자 회의는 지켜본다로 넘기고 한 해를 결산한다. 결산 규칙만 볼 때 쓴다. */
  private static CompanyState.Settlement settleYear(CompanyState company, HashSeededRandom random) {
    if (ENGINE.invest.open(company)) {
      ENGINE.invest.decide(company, InvestEngine.HOLD, random);
    }
    return ENGINE.settle(company, random);
  }

  @Test
  void 사장의_사재로_직원_없이_F등급_자리_네_개로_열리고_채용권을_받는다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(1), ENGINE.openingCapital());
    assertThat(company.capital).isEqualTo(100_000_000);
    assertThat(company.employees).isEmpty();
    assertThat(company.opening).contains("100b로");
    assertThat(company.tickets).isEqualTo(PROPERTIES.gacha().startTickets());
    assertThat(ENGINE.draw(company, 1, new HashSeededRandom(1)).getFirst().name).isEqualTo("박한결");
    assertThat(ENGINE.grade(company.capital)).isEqualTo("F");
    assertThat(ENGINE.seats(company.capital)).isEqualTo(4);
    assertThat(ENGINE.grade(120_000_000)).as("E는 1.2억부터 (#344)").isEqualTo("E");
    assertThat(ENGINE.grade(119_999_999)).isEqualTo("F");
    assertThat(ENGINE.grade(300_000_000)).isEqualTo("D");
    assertThat(ENGINE.grade(200_000_000)).isEqualTo("E");
    assertThat(ENGINE.seats(200_000_000)).isEqualTo(6);
    assertThat(company.wantedDesk).isNotNull();
  }

  @Test
  void 자리_수를_넘게_앉힐_수_없다() {
    // F 회사는 자리 넷 (287번): 다섯을 앉히면 400, 넷이면 다섯째는 쉰다.
    CompanyState company = open(1, stats(50, 50, 50, 50), 100_000_000);
    for (int i = 0; i < 4; i++) {
      ENGINE.hire(company, stats(50, 50, 50, 50));
    }
    assertThatThrownBy(
            () ->
                ENGINE.place(company, Map.of(1, "bio", 2, "day", 3, "risk", 4, "game", 5, "food")))
        .isInstanceOf(InvalidRequestException.class);
    ENGINE.place(company, Map.of(1, "bio", 2, "day", 3, "risk", 4, "game"));
    assertThat(company.employees.get(4).desk).as("빠진 직원은 쉰다").isNull();
  }

  @Test
  /** 매각을 뺐다(236번): 세 해가 지나도 회사는 끝나지 않고 다음 해 연초 회의가 온다. */
  void 세_해를_넘겨도_회사가_이어지고_같은_시드면_같은_결과다() {
    long[] capitals = new long[2];
    for (int k = 0; k < 2; k++) {
      CompanyState company = open(9, stats(50, 50, 50, 50), 100_000_000);
      ENGINE.place(company, Map.of(1, "bio"));
      for (int year = 1; year <= PROPERTIES.turns() + 2; year++) {
        CompanyState.Settlement s = settleYear(company, new HashSeededRandom(9));
        assertThat(s.year).isEqualTo(year);
        assertThat(s.fee).as("수수료는 시장과 상관없이 들어온다").isPositive();
        assertThat(s.lines).isNotEmpty();
      }
      assertThat(company.year).isEqualTo(PROPERTIES.turns() + 3);
      assertThat(company.invest).as("다음 해 투자 회의가 온다").isNotNull();
      assertThat(company.tickets)
          .as("분기·연말마다 채용권을 받는다")
          .isGreaterThan(PROPERTIES.gacha().startTickets());
      capitals[k] = company.capital;
    }
    assertThat(capitals[0]).isEqualTo(capitals[1]);
  }

  /** 자리에 맞는 사람을 앉히고, 리서치 팀이 형광펜을 빌려주고, 리스크 관리 팀이 꼬드김을 막으면 결과가 좋아진다 (4.2절). */
  @Test
  void 배치가_결과를_바꾼다() {
    Map<String, Integer> patient = stats(20, 90, 20, 20);
    Map<String, Integer> analyst = stats(95, 20, 20, 20);
    Map<String, Integer> steady = stats(20, 20, 20, 95);
    double fit = average(patient, "bio", null, null);
    double misfit = average(patient, "day", null, null);
    double withResearch = average(patient, "bio", analyst, "research");
    double withRisk = average(patient, "bio", steady, "risk");
    assertThat(fit).as("인내심 좋은 사람은 바이오 데스크").isGreaterThan(misfit);
    assertThat(withResearch).as("리서치 팀이 형광펜을 빌려준다").isGreaterThan(fit);
    assertThat(withRisk).as("리스크 관리 팀이 꼬드김을 막는다").isGreaterThan(fit);
  }

  /** 1년 결산의 평균 수익(판돈 대비). */
  private static double average(
      Map<String, Integer> trader, String desk, Map<String, Integer> helper, String helperDesk) {
    long sum = 0;
    int trials = 3000;
    for (int seed = 0; seed < trials; seed++) {
      CompanyState company = open(seed, trader, 1_000_000_000L);
      Map<Integer, String> placements = new HashMap<>(Map.of(1, desk));
      if (helper != null) {
        ENGINE.hire(company, helper);
        placements.put(2, helperDesk);
      }
      ENGINE.place(company, placements);
      CompanyState.Settlement s = settleYear(company, new HashSeededRandom(seed));
      sum += s.results.getFirst().pnl * 10_000 / s.results.getFirst().stake;
    }
    return sum / (double) trials;
  }

  /** 매각과 재창업 (9절): 시대가 끝나기 전에는 SSS 이상이어야 팔 수 있고, 팔면 명성이 오르고 공동창업자와 다른 시대의 새 회사를 F에서 차린다. */
  @Test
  void 회사를_팔면_공동창업자와_새_시대의_F_회사를_차린다() {
    CompanyState company = open(4, stats(80, 80, 80, 80), 100_000_000);
    ENGINE.hire(company, stats(30, 30, 30, 30));
    assertThat(company.era).isEqualTo("plain");
    assertThat(ENGINE.canSell(company)).as("F는 시대가 끝나기 전에 못 판다").isFalse();
    company.capital = 1_000_000_000_000L;
    assertThat(ENGINE.grade(company.capital)).isEqualTo("SSS");
    assertThat(ENGINE.canSell(company)).as("SSS면 스스로 판다").isTrue();
    assertThat(ENGINE.fameFor(company)).as("SSS 9점 + 스스로 판 보너스").isEqualTo(10);

    int fame = ENGINE.fameFor(company);
    assertThat(ENGINE.fameGrade(fame)).as("10점 ÷ 2 = 5단계").isEqualTo("A");
    int slots = ENGINE.cofounderSlots(fame);
    assertThat(slots).isEqualTo(2);
    assertThatThrownBy(
            () -> ENGINE.refound(company, List.of(1, 2, 3), fame, new HashSeededRandom(4)))
        .isInstanceOf(InvalidRequestException.class);

    CompanyState next = ENGINE.refound(company, List.of(1), fame, new HashSeededRandom(4));
    assertThat(next.number).isEqualTo(2);
    assertThat(next.era).isNotEqualTo("plain");
    assertThat(next.capital).as("명성 A(5단계)면 시작 자본 +50%").isEqualTo(150_000_000L);
    assertThat(next.employees)
        .singleElement()
        .satisfies(e -> assertThat(e.stats.get("insight")).as("등급 그대로").isEqualTo(80));
    String cofounder = next.employees.getFirst().name;
    assertThat(next.opening).contains(cofounder);
    assertThat(next.met).as("만난 사람 수(이름)를 이어 센다").isEqualTo(company.met);
  }

  /** 큰 손실을 낸 직원은 원인이 된 능력치가 한 띠 내려가고, 폭락장을 버티면 되찾는다. SSS는 버틸 때마다 실전 경험이 쌓여 X·XX로 오른다 (6.4·2.3절). */
  @Test
  void 큰_손실은_등급을_내리고_위기를_버티면_오른다() {
    CompanyState.Employee weak = new CompanyState.Employee();
    weak.name = "김대리";
    weak.desk = "bio";
    weak.stats.putAll(stats(50, 50, 50, 50));
    CompanyState.Settlement settlement = new CompanyState.Settlement();
    CompanyState.Result result = new CompanyState.Result();
    result.stake = 100;
    result.pnl = -40;
    result.flips.put("patience", 3);
    result.flips.put("conviction", 1);
    ENGINE.drop(weak, result, settlement);
    assertThat(weak.stats.get("patience")).as("가장 많이 뒤집은 인내심이 한 띠").isEqualTo(40);
    assertThat(settlement.lines.getLast()).contains("김대리의 인내심이 한 띠 내려갔다 (B → C)");

    ENGINE.survive(weak, settlement);
    assertThat(weak.stats.get("patience")).as("폭락장을 버티면 되찾는다").isEqualTo(50);
    assertThat(weak.dropped).isEmpty();

    CompanyState.Employee ace = new CompanyState.Employee();
    ace.name = "박주임";
    ace.stats.putAll(stats(95, 95, 95, 95));
    ace.stats.put("luck", 95);
    assertThat(CompanyEngine.employeeGrade(ace)).isEqualTo("SSS");
    ENGINE.survive(ace, settlement);
    assertThat(CompanyEngine.employeeGrade(ace)).as("X까지 경험 1").isEqualTo("X");
    ENGINE.survive(ace, settlement);
    assertThat(CompanyEngine.employeeGrade(ace)).as("XX까지 경험 2").isEqualTo("X");
    ENGINE.survive(ace, settlement);
    assertThat(CompanyEngine.employeeGrade(ace)).isEqualTo("XX");
    assertThat(settlement.lines.getLast()).contains("박주임이 폭락장을 버텨 등급이 올랐다 (X → XX)");

    result.flips.clear();
    ENGINE.drop(ace, result, settlement);
    assertThat(CompanyEngine.employeeGrade(ace)).as("X 이상은 종합 등급이 내려간다").isEqualTo("X");
    assertThat(ace.stats.get("insight")).isEqualTo(95);
  }

  /** 결산에서 판돈의 30% 이상을 잃은 직원만 등급이 내려간다. */
  @Test
  void 결산에서_크게_잃은_직원의_등급이_내려간다() {
    int dropped = 0;
    for (int seed = 0; seed < 300; seed++) {
      // F 띠(0~19)는 더 내려갈 등급이 없으니(252번) D 띠로 본다.
      CompanyState company = open(seed, stats(30, 30, 30, 30), 1_000_000_000L);
      ENGINE.place(company, Map.of(1, "bio"));
      CompanyState.Settlement s = settleYear(company, new HashSeededRandom(seed));
      CompanyState.Result r = s.results.getFirst();
      boolean big = r.pnl * 100 <= -r.stake * PROPERTIES.experience().dropLossPercent();
      assertThat(!company.employees.getFirst().dropped.isEmpty()).isEqualTo(big);
      if (big) {
        dropped++;
      }
    }
    assertThat(dropped).as("능력치가 낮으면 크게 잃는 해가 있다").isPositive();
  }

  /** X 이상 효과 (2.4절): 확신·역발상·리더는 결산에서, 경보·선견은 연초 회의에서, 사수는 공채 시장에서 보인다. */
  @Test
  void X_이상_효과() {
    Map<String, Integer> ace = stats(92, 92, 92, 92);
    assertThat(averageWithRank(ace, 1, null))
        .as("X 확신은 더 번다")
        .isGreaterThan(averageWithRank(ace, 0, null));
    assertThat(averageWithRank(ace, 3, "crash"))
        .as("XXX 역발상은 폭락장에 번다")
        .isGreaterThan(averageWithRank(ace, 2, "crash") + 500);
    assertThat(teammateFlips(4)).as("Z 리더의 팀원은 덜 뒤집힌다").isLessThan(teammateFlips(3));

    CompanyState company = open(2, ace, 100_000_000);
    CompanyState.Employee first = company.employees.getFirst();
    company.nextOmen = "다음 해 조짐";
    company.nextPhase = "crash";
    assertThat(ENGINE.earlyOmen(company)).isNull();
    assertThat(ENGINE.forecast(company)).isNull();
    first.rank = 2;
    assertThat(ENGINE.earlyOmen(company)).contains("경보").contains("다음 해 조짐");
    assertThat(ENGINE.forecast(company)).as("선견은 ZZZ부터").isNull();
    first.rank = 6;
    assertThat(ENGINE.forecast(company)).contains("선견").contains("폭락장");
    assertThat(ENGINE.effectsOf(first)).containsExactly("확신", "경보", "역발상", "리더", "사수", "선견");

    // ZZ 사수: 뽑은 사람에게 사수의 가장 높은 능력치가 한 띠 더 붙는다. 같은 시드로 사수 없이 뽑은 사람과 견준다.
    first.stats.put("courage", 99);
    CompanyState plain = open(2, ace, 100_000_000);
    plain.employees.getFirst().stats.put("courage", 99);
    plain.employees.getFirst().rank = 4;
    first.rank = 5;
    int without = drawOne(plain).stats.get("courage");
    int with = drawOne(company).stats.get("courage");
    assertThat(with)
        .as("사수가 붙으면 용기가 한 띠 높다")
        .isEqualTo(Math.min(100, without + PROPERTIES.experience().band()));
  }

  /** XS 큰손·XSS 철벽·GOD 신의 손 (decisions.md 289번): ZZZ 위 직원 등급. 회사 등급은 ZZZ까지다. */
  @Test
  void XS_XSS_GOD_효과() {
    Map<String, Integer> ace = stats(95, 95, 95, 95);
    assertThat(averageWithRank(ace, 7, null))
        .as("XS 큰손은 더 번다")
        .isGreaterThan(averageWithRank(ace, 6, null));
    assertThat(averageWithRank(ace, 8, null))
        .as("XSS 철벽은 틀려도 덜 잃는다")
        .isGreaterThan(averageWithRank(ace, 7, null));
    assertThat(teammateFlips(9)).as("GOD 신의 손이면 모두 덜 흔들린다").isLessThan(teammateFlips(8));

    Map<String, Integer> top = new HashMap<>(ace);
    top.put("luck", 95);
    assertThat(CompanyEngine.gradeOf(top, 7)).isEqualTo("XS");
    assertThat(CompanyEngine.gradeOf(top, 8)).isEqualTo("XSS");
    assertThat(CompanyEngine.gradeOf(top, 9)).isEqualTo("GOD");
    CompanyState company = open(1, top, 100_000_000);
    CompanyState.Employee god = company.employees.getFirst();
    god.rank = 9;
    assertThat(ENGINE.topRank(god)).as("GOD가 맨 위").isTrue();
    assertThat(ENGINE.effectsOf(god)).endsWith("큰손", "철벽", "신의 손");
    god.rank = 6;
    assertThat(ENGINE.topRank(god)).as("ZZZ 위로 더 오를 수 있다").isFalse();
    assertThat(ENGINE.grade(Long.MAX_VALUE)).as("회사 등급은 ZZZ까지").isEqualTo("ZZZ");
  }

  /**
   * 등급 효과 (decisions.md 289번): 종합 등급이 높을수록 맞혔을 때 더 벌고, 낮을수록 잘 자란다. F 직원은 몇 해 일해야 E가 된다: 등급이 바로 높아지지
   * 않는다.
   */
  @Test
  void 등급마다_더_버는_몫과_자라는_빠르기가_다르다() {
    Map<String, Integer> rookie =
        new HashMap<>(
            Map.of("insight", 10, "patience", 10, "courage", 10, "conviction", 10, "luck", 10));
    CompanyState probe = open(1, rookie, 100_000_000);
    CompanyState.Employee f = probe.employees.getFirst();
    assertThat(ENGINE.perkGainPercent(f)).isZero();
    assertThat(ENGINE.perkGrowthPercent(f)).isEqualTo(60);
    assertThat(ENGINE.perkLine(f.stats, 0)).startsWith("새내기 · 맞히면 0% 더 번다").contains("60% 확률로 자란다");
    Map<String, Integer> legend = stats(95, 95, 95, 95);
    legend = new HashMap<>(legend);
    legend.put("luck", 95);
    assertThat(ENGINE.perkLine(legend, 0)).startsWith("레전드 · 맞히면 16% 더 번다").contains("실전 경험");
    assertThat(averageWithRank(stats(55, 55, 55, 55), 0, null))
        .as("같은 능력치라도 등급이 같으니 같다: 효과는 등급을 따라간다")
        .isEqualTo(averageWithRank(stats(55, 55, 55, 55), 0, null));

    int trials = 200;
    int[] years = new int[trials];
    int grownLines = 0;
    for (int seed = 0; seed < trials; seed++) {
      CompanyState company = open(seed, rookie, 100_000_000L);
      CompanyState.Employee e = company.employees.getFirst();
      ENGINE.place(company, Map.of(e.id, "day"));
      int year = 0;
      while (year < 40 && CompanyEngine.overallGrade(e.stats).equals("F")) {
        CompanyState.Settlement s = settleYear(company, new HashSeededRandom(seed));
        grownLines += s.lines.stream().anyMatch(l -> l.contains("자랐다")) ? 1 : 0;
        year++;
      }
      years[seed] = year;
    }
    java.util.Arrays.sort(years);
    assertThat(years[trials / 2]).as("F 직원이 E가 되기까지 해 수의 중앙값").isBetween(6, 12);
    assertThat(grownLines).as("자란 해는 소식 줄에 남는다").isPositive();
  }

  private static double averageWithRank(Map<String, Integer> stats, int rank, String phase) {
    long sum = 0;
    int trials = 2000;
    for (int seed = 0; seed < trials; seed++) {
      CompanyState company = open(seed, stats, 1_000_000_000L);
      company.employees.getFirst().rank = rank;
      if (phase != null) {
        company.phase = phase;
      }
      ENGINE.place(company, Map.of(1, "bio"));
      CompanyState.Result r = settleYear(company, new HashSeededRandom(seed)).results.getFirst();
      sum += r.pnl * 10_000 / r.stake;
    }
    return sum / (double) trials;
  }

  /** 같은 바이오 데스크에 앉은 팀원(능력치 낮음)이 한 해에 뒤집힌 횟수의 합. 옆자리의 단계만 바꾼다. */
  private static int teammateFlips(int neighborRank) {
    int flips = 0;
    for (int seed = 0; seed < 1000; seed++) {
      CompanyState company = open(seed, stats(95, 95, 95, 95), 1_000_000_000L);
      company.employees.getFirst().rank = neighborRank;
      ENGINE.hire(company, stats(10, 10, 10, 10));
      ENGINE.place(company, Map.of(1, "bio", 2, "bio"));
      CompanyState.Result teammate = settleYear(company, new HashSeededRandom(seed)).results.get(1);
      flips += teammate.flips.values().stream().mapToInt(Integer::intValue).sum();
    }
    return flips;
  }

  /**
   * 채용 뽑기 (decisions.md 312번): 채용권 한 장에 한 명이 쉬는 채로 온다. 돈은 들지 않는다. 데리고 있을 수 있는 사람은 100명이고, 넘으면 내보내야
   * 더 뽑는다.
   */
  @Test
  void 채용권으로_뽑고_데리고_있을_자리가_모자라면_내보낸다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(5), ENGINE.openingCapital());
    long capital = company.capital;
    List<CompanyState.Drawn> drawn = ENGINE.draw(company, 2, new HashSeededRandom(5));
    assertThat(drawn).hasSize(2);
    assertThat(company.employees).hasSize(2).allSatisfy(e -> assertThat(e.desk).isNull());
    assertThat(drawn)
        .extracting(d -> d.name)
        .containsExactlyElementsOf(company.employees.stream().map(e -> e.name).toList());
    assertThat(company.tickets).isEqualTo(PROPERTIES.gacha().startTickets() - 2);
    assertThat(company.capital).as("뽑기는 돈이 들지 않는다").isEqualTo(capital);
    assertThat(company.draws).isEqualTo(2);
    assertThat(company.collection.values().stream().mapToInt(Integer::intValue).sum()).isEqualTo(2);
    assertThatThrownBy(
            () ->
                ENGINE.draw(
                    company, PROPERTIES.gacha().startTickets() - 1, new HashSeededRandom(5)))
        .as("채용권이 모자란다")
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(
            () -> ENGINE.draw(company, PROPERTIES.gacha().maxDraws() + 1, new HashSeededRandom(5)))
        .isInstanceOf(InvalidRequestException.class);

    // 데리고 있는 인원에 상한이 없다 (354번): 백 명을 넘겨도 더 뽑는다.
    assertThat(ENGINE.rosterMax(company)).isGreaterThan(100_000);
    company.tickets = 200;
    while (company.employees.size() < 100) {
      int room = 100 - company.employees.size();
      ENGINE.draw(company, Math.min(PROPERTIES.gacha().maxDraws(), room), new HashSeededRandom(5));
    }
    assertThat(company.employees).hasSize(100);
    ENGINE.draw(company, 1, new HashSeededRandom(5));
    assertThat(company.employees).hasSize(101);
    CompanyState.Employee gone = company.employees.getFirst();
    ENGINE.release(company, gone.id);
    assertThat(company.employees).hasSize(100).doesNotContain(gone);
    assertThat(company.alumni).extracting(a -> a.name).containsExactly(gone.name);
    ENGINE.draw(company, 1, new HashSeededRandom(5));
  }

  /** 뽑기 하나. 채용권이 없으면 한 장 쥐여 준다. */
  private static CompanyState.Employee drawOne(CompanyState company) {
    company.tickets = Math.max(company.tickets, 1);
    int id = ENGINE.draw(company, 1, new HashSeededRandom(77)).getFirst().employeeId;
    return company.employees.stream().filter(e -> e.id == id).findFirst().orElseThrow();
  }

  /**
   * 확률표 (decisions.md 312번): 회사 등급을 중심으로 한 단계 아래 30% · 같은 등급 44% · 위 18% · 두 단계 위 6% · 특급(네 단계 위)
   * 2%.
   */
  @Test
  void 뽑기는_회사_등급을_중심으로_확률표대로_나온다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(1), ENGINE.openingCapital());
    assertThat(ENGINE.rates())
        .extracting(CompanyProperties.Rate::percent)
        .containsExactly(30, 44, 18, 6, 2);
    assertThat(ENGINE.rates().stream().map(r -> ENGINE.rateGrade(company, r)).toList())
        .as("F 회사: 바닥은 F")
        .containsExactly("F", "F", "E", "D", "B");
    int[] counts = new int[CompanyEngine.LADDER.size()];
    int stars = 0;
    int total = 0;
    for (int round = 0; round < 300; round++) {
      company.employees.clear();
      company.tickets = 8;
      for (CompanyState.Drawn d : ENGINE.draw(company, 8, new HashSeededRandom(round))) {
        counts[CompanyEngine.LADDER.indexOf(d.grade)]++;
        stars += d.star ? 1 : 0;
        total++;
      }
    }
    assertThat(stars / (double) total).as("특급은 2% 언저리").isBetween(0.008, 0.035);
    assertThat(counts[CompanyEngine.LADDER.indexOf("A")]).as("F 회사에 A 이상은 특급(B)뿐").isZero();
    assertThat((counts[0] + counts[1]) / (double) total).as("F·E가 대부분").isGreaterThan(0.7);

    CompanyState big = ENGINE.open(new HashSeededRandom(1), 10_000_000_000L);
    assertThat(ENGINE.rateGrade(big, ENGINE.rates().get(1))).as("B 회사의 중심은 B").isEqualTo("B");
  }

  /** 특급 (decisions.md 290·312번): 확률표의 맨 끝 칸. F 회사에 네 단계 위 B가 오고, 능력치가 모두 그 띠 안이며, 연표에 남는다. */
  @Test
  void 특급은_드물게_네_단계_위에서_오고_연표에_남는다() {
    CompanyState found = null;
    CompanyState.Drawn star = null;
    for (int round = 0; round < 400 && star == null; round++) {
      CompanyState company = ENGINE.open(new HashSeededRandom(round), ENGINE.openingCapital());
      for (CompanyState.Drawn d : ENGINE.draw(company, 5, new HashSeededRandom(round))) {
        if (d.star) {
          star = d;
          found = company;
        }
      }
    }
    assertThat(star).as("특급이 나오는 회사가 있다").isNotNull();
    assertThat(star.grade).isEqualTo("B");
    int id = star.employeeId;
    CompanyState.Employee e =
        found.employees.stream().filter(x -> x.id == id).findFirst().orElseThrow();
    assertThat(e.stats.values()).as("능력치가 모두 B 띠").allSatisfy(v -> assertThat(v).isBetween(50, 59));
    assertThat(found.timeline)
        .anyMatch(t -> t.text != null && t.text.contains("특급 인재") && t.text.contains(e.name));
  }

  /** 인사 직원 (6.3절, decisions.md 312번): 뽑기의 중심이 인사 직원보다 두 단계 아래까지 오르고, 연말에 채용권을 한 장 더 받는다. */
  @Test
  void 인사팀이_뽑기를_돕는다() {
    Map<String, Integer> sharp = stats(92, 92, 92, 92);
    CompanyState company = open(3, sharp, 100_000_000);
    ENGINE.place(company, Map.of(1, "hr"));
    assertThat(ENGINE.hrCap(company.employees.getFirst())).as("평균 84(SS)의 두 단계 아래").isEqualTo("A");
    assertThat(ENGINE.rateGrade(company, ENGINE.rates().get(1))).as("중심이 A로 오른다").isEqualTo("A");
    int sum = 0;
    int count = 0;
    for (int round = 0; round < 60; round++) {
      company.tickets = 5;
      for (CompanyState.Drawn d : ENGINE.draw(company, 5, new HashSeededRandom(round))) {
        sum += CompanyEngine.LADDER.indexOf(d.grade);
        count++;
      }
      company.employees.removeIf(e -> e.id != 1);
    }
    assertThat(sum / (double) count).as("중심이 A 언저리로 오른다").isGreaterThan(4.3);

    company.invest = null;
    company.tickets = 0;
    CompanyState.Settlement s = ENGINE.settle(company, new HashSeededRandom(3));
    assertThat(s.lines).anyMatch(l -> l.contains("인사팀이 좋은 사람을"));
    assertThat(company.tickets)
        .as("분기 넷 + 연말 + 인사팀")
        .isGreaterThanOrEqualTo(
            4 * PROPERTIES.gacha().quarterTickets()
                + PROPERTIES.gacha().yearTickets()
                + PROPERTIES.hr().extraTickets());
  }

  /** 채용권은 분기를 넘길 때마다, 연말에 더, 업적과 이사로 받는다. 받은 까닭이 분기 실적·결산 소식에 남는다 (decisions.md 312번). */
  @Test
  void 채용권은_연말과_이사로_받는다() {
    // 채용권은 연말에 한 장 (357번): 분기를 넘겨도 받지 않고 소식도 없다.
    CompanyState company = ENGINE.open(new HashSeededRandom(4), ENGINE.openingCapital());
    int start = company.tickets;
    CompanyState.Quarter q = ENGINE.settleQuarter(company, new HashSeededRandom(4));
    assertThat(PROPERTIES.gacha().quarterTickets()).isZero();
    assertThat(company.tickets).isEqualTo(start);
    assertThat(q.lines).noneMatch(l -> l.contains("채용권"));
    for (int i = 0; i < 3; i++) {
      ENGINE.settleQuarter(company, new HashSeededRandom(4));
    }
    assertThat(company.year).isEqualTo(2);
    // 연말에 한 장(+ 그해 연 업적이 있으면 한 장 더).
    assertThat(PROPERTIES.gacha().yearTickets()).isEqualTo(1);
    assertThat(company.tickets)
        .as("연말에 한 장")
        .isBetween(start + 1, start + 1 + company.settlements.getLast().achieved.size());
    assertThat(company.settlements.getLast().lines)
        .anyMatch(l -> l.contains("채용권") && l.contains("1장"));
    company.capital = 1_000_000_000L;
    int before = company.tickets;
    ENGINE.upgrade(company);
    assertThat(company.tickets).isEqualTo(before + PROPERTIES.gacha().moveTickets());
  }

  /** 섹터 데스크 (4.2·9.4절): 그 시대에 뜨는 섹터 데스크에 그 자리가 원하는 능력치가 좋은 사람을 앉히면 결과가 좋아진다. */
  @Test
  void 시대에_뜨는_섹터_데스크에_맞는_사람을_앉히면_결과가_좋아진다() {
    Map<String, Integer> brave = stats(50, 30, 85, 30);
    double chipInBoom = yearly(brave, "semiconductor", "chip-boom", null);
    assertThat(chipInBoom)
        .as("반도체 붐 시대엔 반도체 데스크가 뜬다")
        .isGreaterThan(yearly(brave, "semiconductor", "plain", null))
        .isGreaterThan(yearly(brave, "day", "chip-boom", null));
    assertThat(chipInBoom)
        .as("용기가 원하는 자리에 인내심 낮은 사람이 맞다")
        .isGreaterThan(yearly(brave, "energy", "chip-boom", null));

    Map<String, Integer> steady = stats(50, 30, 30, 85);
    assertThat(yearly(steady, "food", "long-winter", null))
        .as("긴 겨울엔 덜 빠지는 식품 데스크에 줏대 있는 사람")
        .isGreaterThan(yearly(steady, "semiconductor", "long-winter", null))
        .isGreaterThan(yearly(steady, "food", "plain", null));

    assertThat(yearly(brave, "game", "plain", "game"))
        .as("관심 섹터가 같은 데스크면 조금 더 번다")
        .isGreaterThan(yearly(brave, "game", "plain", null));
  }

  /** 시대와 관심 섹터를 정해 한 해 결산한 평균 수익(판돈 대비, 만분율). 투자 회의는 지켜본다. */
  private static double yearly(
      Map<String, Integer> trader, String desk, String era, String interest) {
    long sum = 0;
    int trials = 3000;
    for (int seed = 0; seed < trials; seed++) {
      CompanyState company = open(seed, trader, 1_000_000_000L);
      company.era = era;
      ENGINE.startYear(company, new HashSeededRandom(seed));
      company.employees.getFirst().sector = interest;
      ENGINE.place(company, Map.of(company.employees.getFirst().id, desk));
      CompanyState.Settlement s = settleYear(company, new HashSeededRandom(seed));
      sum += s.results.getFirst().pnl * 10_000 / s.results.getFirst().stake;
    }
    return sum / (double) trials;
  }

  @Test
  void 연초_회의에_이번_시대에_뜨는_섹터가_보이고_뽑은_사람은_관심_섹터를_안고_온다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(1), ENGINE.openingCapital());
    assertThat(ENGINE.hotLine(company)).as("평범한 시대엔 뜨는 섹터가 없다").isNull();
    company.era = "long-winter";
    assertThat(ENGINE.hotDesks(company)).containsExactly("food", "finance");
    assertThat(ENGINE.hotLine(company)).isEqualTo("이번 시대에 뜨는 섹터: 식품 데스크·금융 데스크.");

    CompanyState.Employee hired = drawOne(company);
    assertThat(hired.sector).as("뽑은 사람은 관심 섹터를 안고 온다").isNotNull();

    hired.desk = "day";
    assertThat(ENGINE.interested(hired)).as("단타 데스크는 섹터를 가리지 않는다").isFalse();
    hired.desk = hired.sector; // 섹터 데스크의 코드는 섹터 코드와 같다
    assertThat(ENGINE.interested(hired)).isTrue();
  }

  /** 망한 회사 (decisions.md 247·312번): 자본이 0이면 닫고 사재로 다음 회사를 차린다. 채용권·도감은 따라온다. */
  @Test
  void 자본이_바닥나면_망한_회사가_되고_사재로_다음_회사를_차린다() {
    CompanyState fresh = ENGINE.open(new HashSeededRandom(1), ENGINE.openingCapital());
    assertThat(ENGINE.broke(fresh)).isFalse();
    assertThat(ENGINE.brokeNotice(fresh)).isNull();
    assertThatThrownBy(() -> ENGINE.restart(fresh, new HashSeededRandom(2), 100_000_000))
        .isInstanceOf(InvalidRequestException.class);

    CompanyState poor = ENGINE.open(new HashSeededRandom(1), 1);
    assertThat(ENGINE.broke(poor)).as("사람은 채용권으로 뽑으니 돈이 적어도 망하지 않는다").isFalse();
    ENGINE.hire(poor, stats(50, 50, 50, 50));
    poor.capital = 0;
    assertThat(ENGINE.broke(poor)).as("자본 0은 수수료도 판돈도 0이다").isTrue();
    assertThat(ENGINE.brokeNotice(poor)).isNotBlank();

    poor.met = 7;
    poor.tickets = 2;
    poor.collection.put("C", 3);
    CompanyState next = ENGINE.restart(poor, new HashSeededRandom(2), ENGINE.openingCapital());
    assertThat(next.tickets)
        .as("채용권은 이어지고 처음 몫을 더 받는다")
        .isEqualTo(2 + PROPERTIES.gacha().startTickets());
    assertThat(next.collection).as("도감은 사장의 것").containsEntry("C", 3);
    assertThat(poor.closed).isTrue();
    assertThat(next.number).isEqualTo(2);
    assertThat(next.year).isEqualTo(1);
    assertThat(next.capital).isEqualTo(100_000_000);
    // 직원은 잃지 않는다 (265번): 쉬는 채로 모두 따라온다.
    assertThat(next.employees).as("직원은 모두 따라온다").hasSize(1);
    assertThat(next.employees.getFirst().desk).as("쉬는 채로").isNull();
    assertThat(poor.employees).isEmpty();
    assertThat(next.opening).contains("직원들은 모두 따라왔다");
    assertThat(drawOne(next).name).as("이름은 이어 센다").isNotEqualTo("박한결");
    assertThat(next.opening).contains("1호 회사는 문을 닫았다").contains("2호 회사");
  }

  @Test
  void 큰_회사가_폭락장에_판돈을_넘게_잃으면_자본이_0이_되고_소식_줄에_남는다() {
    String emptied = TestContent.load().raising().company().bankrupt().emptied();
    int emptiedYears = 0;
    for (long seed = 1; seed <= 30; seed++) {
      // XX 회사(10조)의 게임 데스크: 폭락장 손익과 잃는 몫이 등급 배율로 커져 한 해에 판돈을 넘게 잃을 수 있다 (244번).
      CompanyState company = open(seed, stats(1, 1, 1, 1), 10_000_000_000_000L);
      company.employees.getFirst().desk = "game";
      company.phase = CompanyEngine.CRASH;
      // 폭락은 한 분기에 한 해 몫이 한꺼번에 터진다 (268번).
      company.crashQuarter = 2;
      company.invest = null;
      CompanyState.Settlement settlement = ENGINE.settle(company, new HashSeededRandom(seed));
      if (company.capital == 0) {
        emptiedYears++;
        assertThat(settlement.lines).contains(emptied);
        assertThat(ENGINE.broke(company)).isTrue();
      } else {
        assertThat(settlement.lines).doesNotContain(emptied);
      }
    }
    assertThat(emptiedYears).as("자본이 바닥나는 해가 있다").isPositive();
  }

  /**
   * 자리가 줄면 넘친 사람이 쉰다 (#311, decisions.md 248번): 돕는 자리부터, 그다음 나중에 들어온 사람부터. 자리 수는 연말에만 바뀐다 (268번): 해
   * 가운데 자본이 띠 아래로 내려가도 그해에는 그대로다.
   */
  @Test
  void 자본이_줄어_자리가_줄면_돕는_자리부터_일어나_쉰다() {
    // E 회사(자리 6)에 여섯을 앉힌다. 해 가운데 자본이 1.2억 아래로 떨어져도 그해에는 자리 여섯 그대로다.
    CompanyState company = open(5, stats(50, 50, 50, 50), 120_000_000 + 1_000_000);
    for (int i = 0; i < 5; i++) {
      ENGINE.hire(company, stats(50, 50, 50, 50));
    }
    List<CompanyState.Employee> staff = company.employees;
    List<String> traders = List.of("bio", "day", "game", "food", "finance");
    Map<Integer, String> seats = new HashMap<>();
    seats.put(staff.get(0).id, "research");
    for (int i = 1; i < 6; i++) {
      seats.put(staff.get(i).id, traders.get(i - 1));
    }
    ENGINE.place(company, seats);
    assertThat(ENGINE.seats(company)).isEqualTo(6);

    company.capital -= 2_000_000;
    assertThat(company.capital).isLessThan(120_000_000);
    assertThat(ENGINE.seats(company)).as("자리 수는 연말에만 바뀐다").isEqualTo(6);
    assertThat(staff.get(0).desk).isEqualTo("research");

    // 연말에 건물이 줄어들면(F, 자리 4, 296번) 넘친 둘이 일어난다: 돕는 자리가 먼저, 그다음 나중에 들어온 사람.
    company.gradedCapital = company.capital;
    company.building = ENGINE.grade(company.capital);
    ENGINE.fitSeats(company);
    assertThat(ENGINE.seats(company)).isEqualTo(4);
    assertThat(staff.get(0).desk).as("돕는 자리가 먼저 일어난다").isNull();
    assertThat(staff.get(5).desk).isNull();
    for (int i = 1; i < 5; i++) {
      assertThat(staff.get(i).desk).isEqualTo(traders.get(i - 1));
    }

    // 돕는 자리가 없으면 나중에 들어온 사람부터 일어난다.
    company.capital = 1_000_000;
    company.gradedCapital = company.capital;
    staff.get(0).desk = "bio";
    List<CompanyState.Employee> stood = ENGINE.fitSeats(company);
    assertThat(stood).extracting(e -> e.id).containsExactly(staff.get(4).id);
    assertThat(staff.get(0).desk).isEqualTo("bio");
    assertThat(staff.get(1).desk).isEqualTo("bio");
  }

  /** 지은 건물은 폭락장에 자본이 띠 아래로 떨어져도 줄지 않는다 (#347): 전에는 연말에 저절로 줄어 앉아 있던 사람이 휴게실로 밀려났다. */
  @Test
  void 지은_건물은_폭락장에도_줄지_않는다() {
    for (long seed = 1; seed <= 40; seed++) {
      CompanyState company = open(seed, stats(1, 1, 1, 1), 130_000_000);
      company.building = "E";
      for (int i = 0; i < 5; i++) {
        ENGINE.hire(company, stats(1, 1, 1, 1));
      }
      Map<Integer, String> seats = new HashMap<>();
      for (CompanyState.Employee e : company.employees) {
        seats.put(e.id, "game");
      }
      ENGINE.place(company, seats);
      company.phase = CompanyEngine.CRASH;
      company.invest = null;
      ENGINE.settle(company, new HashSeededRandom(seed));
      assertThat(ENGINE.grade(company)).isEqualTo("E");
      assertThat(ENGINE.seats(company)).isEqualTo(6);
      assertThat(company.employees.stream().filter(e -> e.desk != null).count()).isEqualTo(6);
    }
  }

  /**
   * 시대가 바뀐다 (#313, decisions.md 250번): 첫 회사는 평범한 시대로 열고, 세 해마다 다른 시대가 온다. 마지막 해에는 연초 회의가 알려 주고, 바뀐
   * 해의 결산 소식에 남는다. 다음 해 시장을 미리 정해 둔 것(경보·선견)이 그해가 와도 같다.
   */
  @Test
  void 세_해마다_다른_시대가_오고_마지막_해에는_연초_회의가_알려_준다() {
    int years = PROPERTIES.turns();
    java.util.Set<String> seen = new java.util.HashSet<>();
    for (long seed = 1; seed <= 10; seed++) {
      CompanyState company = ENGINE.open(new HashSeededRandom(seed), ENGINE.openingCapital());
      HashSeededRandom random = new HashSeededRandom(seed);
      assertThat(company.era).isEqualTo("plain");
      String era = company.era;
      for (int year = 1; year <= years * 3; year++) {
        assertThat(ENGINE.eraEndingLine(company) != null)
            .as("%d년 차가 시대의 마지막 해인가", year)
            .isEqualTo(year % years == 0);
        String nextPhase = company.nextPhase;
        CompanyState.Settlement settlement = settleYear(company, random);
        assertThat(company.phase).as("미리 본 내년 시장이 그해가 와도 같다").isEqualTo(nextPhase);
        if (year % years == 0) {
          assertThat(company.era).as("%d년 차가 끝나면 시대가 바뀐다", year).isNotEqualTo(era);
          assertThat(settlement.lines)
              .anyMatch(
                  line -> line.contains("끝나고") && line.endsWith(ENGINE.era(company).description()));
          era = company.era;
        } else {
          assertThat(company.era).isEqualTo(era);
        }
        seen.add(company.era);
      }
    }
    assertThat(seen.size()).as("여러 시대가 나온다").isGreaterThan(3);
  }

  @Test
  void 망해서_다시_차린_회사는_지난_회사와_다른_시대로_연다() {
    CompanyState broke = ENGINE.open(new HashSeededRandom(1), 0);
    CompanyState next = ENGINE.restart(broke, new HashSeededRandom(2), ENGINE.openingCapital());
    assertThat(next.era).isNotEqualTo(broke.era);
  }

  /**
   * 연말 결산서의 장부가 맞는다 (#314, decisions.md 251번): 연초 자본은 연초 회의 때의 자본이다. 채용 뽑기는 돈이 들지 않아(312번) 인사 비용이
   * 없다. 연초 자본 + 회의 + 직원들 + 수수료 − 인사 비용 = 연말 자본.
   */
  @Test
  void 연말_결산서의_연초_자본은_연초_회의_때의_자본이고_장부가_맞는다() {
    for (long seed = 1; seed <= 20; seed++) {
      CompanyState company = ENGINE.open(new HashSeededRandom(seed), ENGINE.openingCapital());
      HashSeededRandom random = new HashSeededRandom(seed);
      for (int year = 1; year <= 4; year++) {
        long start = company.capital;
        if (company.tickets > 0 && company.employees.size() < ENGINE.seats(company)) {
          CompanyState.Employee hired = drawOne(company);
          Map<Integer, String> seats = new HashMap<>();
          company.employees.forEach(e -> seats.put(e.id, e.desk));
          seats.put(hired.id, "day");
          if (seats.values().stream().filter(d -> d != null).count() <= ENGINE.seats(company)) {
            ENGINE.place(company, seats);
          }
        }
        CompanyState.Settlement s = settleYear(company, random);
        assertThat(s.capitalBefore).isEqualTo(start);
        assertThat(s.hiring).as("뽑기는 돈이 들지 않는다").isZero();
        long staff = s.results.stream().mapToLong(r -> r.pnl).sum();
        long invest = s.investTotal == null ? 0 : s.investTotal;
        if (s.capitalAfter > 0) {
          assertThat(s.capitalBefore + invest + staff + s.fee - s.hiring - s.moving)
              .as("%d번 시드 %d년 차 장부", seed, year)
              .isEqualTo(s.capitalAfter);
        }
      }
    }
  }

  /**
   * 하락은 글자가 바뀐다 (#315, decisions.md 252번): SSS 100이 90이 되어 "SSS → SSS"가 뜨던 것을 띠 경계 아래까지 내린다. 되찾을 때는
   * 내린 만큼만 돌려주고, 바닥 띠(F)에서는 더 내리지 않는다. 같은 횟수면 줏대 → 인내심 → 용기 순으로 탓한다.
   */
  @Test
  void 하락은_한_등급_아래로_내리고_되찾을_때는_내린_만큼만_돌려준다() {
    CompanyState.Employee e = new CompanyState.Employee();
    e.name = "최사원";
    e.desk = "day";
    e.stats.putAll(stats(50, 50, 100, 50));
    CompanyState.Settlement settlement = new CompanyState.Settlement();
    CompanyState.Result result = new CompanyState.Result();
    result.flips.put("courage", 2);
    ENGINE.drop(e, result, settlement);
    assertThat(e.stats.get("courage")).as("SSS 100 → SS 띠").isEqualTo(89);
    assertThat(settlement.lines.getLast()).contains("(SSS → SS)");
    ENGINE.survive(e, settlement);
    assertThat(e.stats.get("courage")).as("내린 만큼(11점)만 되찾는다").isEqualTo(100);

    e.stats.put("patience", 25);
    result.flips.clear();
    result.flips.put("patience", 1);
    ENGINE.drop(e, result, settlement);
    assertThat(e.stats.get("patience")).as("E 25 → F 15").isEqualTo(15);
    ENGINE.survive(e, settlement);
    assertThat(e.stats.get("patience")).as("되찾아도 원래 점수를 넘지 않는다").isEqualTo(25);

    e.stats.put("patience", 5);
    int lines = settlement.lines.size();
    ENGINE.drop(e, result, settlement);
    assertThat(e.stats.get("patience")).as("F 띠에서는 더 내리지 않는다").isEqualTo(5);
    assertThat(e.dropped).isEmpty();
    assertThat(settlement.lines).hasSize(lines);

    // 같은 횟수면 말풍선과 같은 순서: 줏대가 먼저다.
    e.stats.putAll(stats(50, 50, 50, 50));
    result.flips.clear();
    result.flips.put("patience", 2);
    result.flips.put("courage", 2);
    result.flips.put("conviction", 2);
    ENGINE.drop(e, result, settlement);
    assertThat(e.stats.get("conviction")).isEqualTo(40);
    result.flips.remove("conviction");
    ENGINE.drop(e, result, settlement);
    assertThat(e.stats.get("patience")).as("그다음 인내심").isEqualTo(40);
  }

  @Test
  void 판돈이_없던_직원은_폭락장을_버틴_것으로_치지_않는다() {
    CompanyState company = open(1, stats(95, 95, 95, 95), 0);
    company.employees.getFirst().stats.put("luck", 95);
    company.employees.getFirst().desk = "day";
    company.phase = CompanyEngine.CRASH;
    company.invest = null;
    ENGINE.settle(company, new HashSeededRandom(1));
    assertThat(company.employees.getFirst().experience).isZero();
    assertThat(company.employees.getFirst().rank).isZero();
  }

  @Test
  /** 게임 금액 (decisions.md 313번): 1,000마다 a·b·c·d로 올라가고 앞자리는 세 자리까지. 화면의 money()와 같다. */
  void 돈은_게임_금액_단위로_쓴다() {
    assertThat(CompanyEngine.money(950)).isEqualTo("950");
    assertThat(CompanyEngine.money(3_500)).isEqualTo("3.5a");
    assertThat(CompanyEngine.money(100_000_000)).isEqualTo("100b");
    assertThat(CompanyEngine.money(248_580_000)).isEqualTo("249b");
    assertThat(CompanyEngine.money(41_250_000)).isEqualTo("41.3b");
    assertThat(CompanyEngine.money(56_361_512_345_678L)).isEqualTo("56.4d");
    assertThat(CompanyEngine.money(1_000_000_000_000_000L)).isEqualTo("1e");
    assertThat(CompanyEngine.money(999_960_000)).isEqualTo("1c");
    assertThat(CompanyEngine.money(-5_200_000)).isEqualTo("−5.2b");
  }

  /** 폭락장에 아무도 바닥에서 던지지 않았으면 머리줄이 "못 참고 판 사람이 가장 크게 잃었다"가 아니다 (#318, decisions.md 255번). */
  @Test
  void 폭락장에_아무도_못_참지_않았으면_머리줄이_다르다() {
    Map<String, String> phases = TestContent.load().raising().company().phases();
    CompanyState calm = open(1, stats(50, 100, 50, 100), 100_000_000);
    calm.employees.getFirst().desk = "day";
    calm.phase = CompanyEngine.CRASH;
    calm.invest = null;
    CompanyState.Settlement held = ENGINE.settle(calm, new HashSeededRandom(1));
    assertThat(held.results.getFirst().flips).doesNotContainKey("patience");
    assertThat(held.lines.getFirst()).isEqualTo(phases.get("crashHeld"));

    for (long seed = 1; seed <= 30; seed++) {
      CompanyState panicky = open(seed, stats(50, 1, 50, 100), 100_000_000);
      panicky.employees.getFirst().desk = "day";
      panicky.phase = CompanyEngine.CRASH;
      panicky.invest = null;
      CompanyState.Settlement s = ENGINE.settle(panicky, new HashSeededRandom(seed));
      if (s.results.getFirst().flips.containsKey("patience")) {
        assertThat(s.lines.getFirst()).isEqualTo(phases.get("crash"));
        return;
      }
    }
    throw new AssertionError("인내심 1인데 한 번도 못 참지 않았다");
  }

  /** 뽑은 사람 이름은 성 × 이름 조합을 겹치지 않게 돌리고 직함을 붙이지 않는다 (#319, decisions.md 256번). */
  @Test
  void 뽑은_사람_이름은_겹치지_않고_직함이_없다() {
    var texts = TestContent.load().raising().company();
    int total = texts.surnames().size() * texts.names().size();
    CompanyState company = ENGINE.open(new HashSeededRandom(1), ENGINE.openingCapital());
    java.util.Set<String> names = new java.util.HashSet<>();
    String previous = null;
    while (names.size() < total) {
      company.tickets = PROPERTIES.gacha().maxDraws();
      company.employees.clear();
      for (CompanyState.Drawn d :
          ENGINE.draw(
              company,
              Math.min(PROPERTIES.gacha().maxDraws(), ENGINE.rosterMax(company)),
              new HashSeededRandom(1))) {
        assertThat(names.add(d.name)).as("겹친 이름: %s", d.name).isTrue();
        assertThat(d.name).doesNotContain("대리").doesNotContain("수습").doesNotContain("주임");
        if (previous != null) {
          assertThat(d.name.charAt(0)).as("이웃한 사람의 성이 다르다").isNotEqualTo(previous.charAt(0));
        }
        previous = d.name;
        if (names.size() == total) {
          break;
        }
      }
    }
    assertThat(names).hasSize(total);
  }

  /** SSS 회사의 뽑기는 위 칸에서 X 이상 경력직이 나온다(312번). 계약금(258번)은 연봉·이적료와 함께 뺐다(383·385번). */
  @Test
  void SSS_회사의_뽑기에는_경력직이_나온다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(3), 1_200_000_000_000L);
    assertThat(ENGINE.grade(company)).isEqualTo("SSS");
    assertThat(ENGINE.rateGrade(company, ENGINE.rates().get(2))).isEqualTo("X");
    company.tickets = 60;
    List<CompanyState.Drawn> drawn = new java.util.ArrayList<>();
    for (int i = 0; i < 6; i++) {
      drawn.addAll(ENGINE.draw(company, 10, new HashSeededRandom(3)));
    }
    CompanyState.Drawn veteran =
        drawn.stream().filter(d -> d.grade.equals("X")).findFirst().orElseThrow();
    CompanyState.Employee e =
        company.employees.stream()
            .filter(x -> x.id == veteran.employeeId)
            .findFirst()
            .orElseThrow();
    assertThat(e.rank).isEqualTo(1);
    assertThat(e.stats.values())
        .as("능력치가 모두 SSS 띠")
        .allSatisfy(v -> assertThat(v).isGreaterThanOrEqualTo(90));
  }

  /**
   * 자리가 둘뿐인 해의 폭락 조짐은 리스크 관리 팀 대신 폭락장에 덜 빠지는 자리를 권한다 (#322, decisions.md 259번). 287번부터 가장 작은 회사도
   * 자리가 넷이라 늘 리스크 관리 팀을 권한다.
   */
  @Test
  void 자리가_넉넉하면_폭락_조짐에_리스크_관리_팀을_권한다() {
    var wanted = TestContent.load().raising().company().wanted();
    CompanyState small = ENGINE.open(new HashSeededRandom(1), 100_000_000);
    small.wantedDesk = "risk";
    assertThat(ENGINE.seats(small)).isGreaterThan(CompanyEngine.FEW_SEATS);
    assertThat(ENGINE.wantedLine(small)).as("F 회사도 자리가 넷").isEqualTo(wanted.get("risk"));
    assertThat(ENGINE.deskGainBp(small, "food")).isEqualTo(PROPERTIES.desks().get("food").gainBp());
  }

  /** 근속 (#325, decisions.md 262번): 같은 자리 세 해째부터 손에 익는다. 이직 제안은 385번에서 뺐다. */
  @Test
  void 같은_자리_세_해째부터_손에_익는다() {
    var rules = PROPERTIES.people();
    // 같은 자리 세 해째부터 손에 익는다.
    CompanyState tenure = open(4, stats(50, 50, 50, 50), 100_000_000);
    CompanyState.Employee e = tenure.employees.getFirst();
    e.desk = "day";
    for (int year = 1; year <= rules.settleYears(); year++) {
      assertThat(ENGINE.settled(e)).as("%d년째", year).isEqualTo(year >= rules.settleYears());
      tenure.invest = null;
      CompanyState.Settlement st = ENGINE.settle(tenure, new HashSeededRandom(4));
      if (year == rules.settleYears()) {
        assertThat(st.lines).anyMatch(line -> line.contains("손에 익었다"));
      }
    }
    e.desk = "bio";
    assertThat(ENGINE.settled(e)).as("자리를 바꾸면 다시 센다").isFalse();
  }

  /**
   * 회사 연표·업적·명예의 전당 (#326, decisions.md 263번): 차린 해와 등급이 바뀐 해가 연표에 남고, 한 해에 자본이 두 배면 업적이 열리며, 내보낸
   * 직원은 떠난 사람으로 남는다.
   */
  /**
   * 건물 이사 (decisions.md 296번): 등급은 저절로 오르지 않는다. 자본이 다음 띠 + 이사 비용(다음 띠의 25%) 이상이면 비용을 내고 올라가고, 자리 수가
   * 바로 바뀐다. 자본이 띠 아래로 떨어지면 연말에 저절로 줄어든다. 랜드마크 타워(Z)에 올라도 엔딩 없이 이어진다(374번).
   */
  @Test
  void 건물은_이사_비용을_내야_올라가고_자본이_띠_아래로_떨어지면_연말에_줄어든다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(1), ENGINE.openingCapital());
    assertThat(company.building).isEqualTo("F");
    assertThat(ENGINE.nextGrade(company)).isEqualTo("E");
    assertThat(ENGINE.upgradeCost(company)).as("E 1.2억의 15% (#344)").isEqualTo(18_000_000L);
    assertThat(ENGINE.upgradeNeeded(company)).isEqualTo(138_000_000L);
    assertThat(ENGINE.canUpgrade(company)).isFalse();
    assertThatThrownBy(() -> ENGINE.upgrade(company)).isInstanceOf(InvalidRequestException.class);

    // 자본이 넉넉해도 결산으로는 안 오른다.
    company.capital = 900_000_000L;
    company.invest = null;
    ENGINE.settle(company, new HashSeededRandom(1));
    assertThat(ENGINE.grade(company)).isEqualTo("F");
    assertThat(ENGINE.seats(company)).isEqualTo(4);

    // 이사: 비용이 빠지고 자리가 늘고 연표에 남는다. 그해 이사 비용은 결산에 따로 적힌다.
    long before = company.capital;
    ENGINE.upgrade(company);
    assertThat(ENGINE.grade(company)).isEqualTo("E");
    assertThat(company.capital).isEqualTo(before - 18_000_000L);
    assertThat(company.yearMoving).isEqualTo(18_000_000L);
    assertThat(ENGINE.seats(company)).isEqualTo(6);
    assertThat(company.timeline).extracting(e -> e.kind).contains("grow");
    // 한 번에 한 단계씩: D(3억)는 새 건물(상가)이라 한 해 동안 짓는다 (#347). 비용은 지금 다 내고, 연말 결산에서 옮긴다.
    ENGINE.upgrade(company);
    assertThat(ENGINE.grade(company)).as("공사 중에는 지금 건물 그대로").isEqualTo("E");
    assertThat(company.buildingTo).isEqualTo("D");
    assertThat(company.buildLeft).isEqualTo(1);
    assertThat(company.capital).isEqualTo(before - 63_000_000L);
    assertThat(ENGINE.canUpgrade(company)).as("공사 중에는 다음 건물을 못 짓는다").isFalse();
    company.invest = null;
    CompanyState.Settlement s = ENGINE.settle(company, new HashSeededRandom(2));
    assertThat(ENGINE.grade(company)).as("한 해 지어 옮겼다").isEqualTo("D");
    assertThat(company.buildingTo).isNull();
    assertThat(s.gradeAfter).isEqualTo("D");
    assertThat(s.lines).anyMatch(line -> line.contains("다 지어졌다"));
    assertThat(s.moving).isEqualTo(63_000_000L);
    assertThat(ENGINE.canUpgrade(company)).as("C 10억은 아직").isFalse();

    // 지은 건물은 자본이 띠 아래로 떨어져도 그대로다 (#347).
    company.capital = 100_000_000L;
    company.invest = null;
    CompanyState.Settlement fell = ENGINE.settle(company, new HashSeededRandom(3));
    assertThat(fell.gradeBefore).isEqualTo("D");
    assertThat(fell.gradeAfter).isEqualTo("D");
    assertThat(ENGINE.grade(company)).isEqualTo("D");

    // 랜드마크 타워(Z)에 올라도 엔딩 없이 이어진다 (374번).
    company.capital = 200_000_000_000_000L;
    for (int seed = 10; !"Z".equals(ENGINE.grade(company)) && seed < 60; seed++) {
      if (ENGINE.canUpgrade(company)) {
        ENGINE.upgrade(company);
      } else {
        // 공사 중이면 한 해 짓는다.
        company.invest = null;
        ENGINE.settle(company, new HashSeededRandom(seed));
        company.capital = Math.max(company.capital, 200_000_000_000_000L);
      }
    }
    assertThat(ENGINE.grade(company)).isEqualTo("Z");
    assertThat(company.finished).isFalse();
    assertThat(company.timeline).extracting(e -> e.kind).contains("ending");
    assertThat(ENGINE.nextGrade(company)).as("Z 다음 건물").isEqualTo("ZZ");
  }

  @Test
  void 연표와_업적과_떠난_직원이_남는다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(1), ENGINE.openingCapital());
    assertThat(company.timeline).extracting(e -> e.kind).containsExactly("open");

    // 자본이 두 배가 되는 해를 만든다: 결산 직전 자본을 띠 바로 위로 올려 등급도 바뀌게.
    CompanyState.Employee a = ENGINE.hire(company, stats(60, 60, 60, 60));
    a.desk = "day";
    company.invest = null;
    company.capital = 450_000_000L;
    company.yearStartCapital = 100_000_000L;
    // 건물은 저절로 오르지 않는다(296번): 이사 비용을 내고 올라가야 연표에 남는다.
    ENGINE.upgrade(company);
    CompanyState.Settlement s = ENGINE.settle(company, new HashSeededRandom(1));
    assertThat(s.achieved).contains("곱빼기");
    assertThat(company.achievements).containsKey("doubled");
    assertThat(company.timeline).extracting(e -> e.kind).contains("grow", "best");
    assertThat(a.totalPnl).isEqualTo(s.results.getFirst().pnl);

    assertThat(s.lines).as("업적을 열면 채용권").anyMatch(l -> l.contains("업적을 열었다"));

    // 내보낸 사람이 떠난 직원으로 남는다.
    ENGINE.release(company, a.id);
    assertThat(company.alumni).extracting(x -> x.name).containsExactly(a.name);
    assertThat(company.timeline).extracting(e -> e.kind).contains("left");
  }

  /** 인사 비용만으로는 "가장 아팠던 해"가 아니다: 연표와 업적은 인사 비용을 빼기 전의 운용 결과로 본다 (263번). */
  @Test
  void 인사_비용만으로는_가장_아팠던_해가_아니다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(2), ENGINE.openingCapital());
    drawOne(company);
    company.capital = 100_000_000L - 25_000_000L;
    company.yearHiring += 25_000_000L;
    company.invest = null;
    ENGINE.settle(company, new HashSeededRandom(2));
    assertThat(company.timeline).extracting(e -> e.kind).doesNotContain("worst");
  }

  /** 채용 뽑기 전에 차린 회사 (decisions.md 312번): 처음 불러올 때 채용권을 받고 지금 직원이 도감에 오른다. 한 번만. */
  @Test
  void 뽑기_전에_차린_회사는_채용권을_받고_직원이_도감에_오른다() {
    CompanyState old = open(1, stats(50, 50, 50, 50), 100_000_000);
    old.gachaReady = false;
    old.tickets = 0;
    old.collection.clear();
    assertThat(ENGINE.adoptGacha(old)).isTrue();
    assertThat(old.tickets).isEqualTo(PROPERTIES.gacha().startTickets());
    assertThat(old.collection).containsEntry("B", 1);
    assertThat(ENGINE.adoptGacha(old)).as("한 번만").isFalse();
    assertThat(old.tickets).isEqualTo(PROPERTIES.gacha().startTickets());
    assertThat(ENGINE.open(new HashSeededRandom(1), 100_000_000).gachaReady).isTrue();
  }

  /** #343·#391: 자리가 원하는 능력치가 먼저 자라고, 등급 글자가 바뀔 때만 소식이 남고, 종합 등급이 오르면 올라섰다는 소식이 남는다. */
  @Test
  void 자리에서_자라고_등급이_바뀔_때만_소식이_남는다() {
    Map<String, Integer> rookie =
        new HashMap<>(
            Map.of("insight", 10, "patience", 10, "courage", 10, "conviction", 10, "luck", 10));
    int promoted = 0;
    for (int seed = 0; seed < 60; seed++) {
      CompanyState company = open(seed, rookie, 100_000_000L);
      CompanyState.Employee e = company.employees.getFirst();
      ENGINE.place(company, Map.of(e.id, "day"));
      for (int year = 0; year < 12; year++) {
        CompanyState.Settlement s = settleYear(company, new HashSeededRandom(seed));
        for (String line : s.lines) {
          if (line.contains("자랐다")) {
            java.util.regex.Matcher m =
                java.util.regex.Pattern.compile("(\\S+) → (\\S+)\\.$").matcher(line);
            assertThat(m.find()).as(line).isTrue();
            assertThat(m.group(1)).as("등급이 그대로면 소식이 없다: " + line).isNotEqualTo(m.group(2));
          }
          promoted += line.contains("올라섰다") ? 1 : 0;
        }
      }
      // 단타 데스크는 용기를 원한다: 용기가 가장 먼저 자란다
      assertThat(e.stats.get("courage")).isGreaterThanOrEqualTo(e.stats.get("insight"));
    }
    assertThat(promoted).as("종합 등급이 오르면 올라섰다는 소식").isPositive();
  }

  /** #392: 최근에 쓴 문구와 이번에 이미 쓴 문구는 건너뛰고, 다 썼으면 굴린 것을 쓴다. 기억은 60개까지. */
  @Test
  void 같은_문구는_이어_나오지_않게_고른다() {
    CompanyState c = new CompanyState();
    List<String> lines = List.of("가", "나", "다");
    java.util.Set<String> now = new java.util.HashSet<>();
    ENGINE.remember(c, List.of("가"));
    assertThat(ENGINE.fresh(c, lines, 0, now)).as("최근에 쓴 가는 건너뛴다").isEqualTo("나");
    assertThat(ENGINE.fresh(c, lines, 0, now)).as("이번에 쓴 나도 건너뛴다").isEqualTo("다");
    assertThat(ENGINE.fresh(c, lines, 0, now)).as("다 썼으면 굴린 것").isEqualTo("가");
    for (int i = 0; i < 100; i++) {
      ENGINE.remember(c, List.of("x" + i));
    }
    assertThat(c.recentLines).hasSize(CompanyEngine.RECENT_LINES).doesNotContain("가");
  }

  /** 한 해를 넘긴다: 분기마다 직원이 종목을 물어 왔으면 지켜본다. */
  private static CompanyState.Settlement year(CompanyState c, long seed) {
    HashSeededRandom random = new HashSeededRandom(seed);
    int year = c.year;
    while (c.year == year) {
      ENGINE.scout.discover(c, random);
      if (ENGINE.invest.open(c)) {
        ENGINE.invest.decide(c, InvestEngine.HOLD, random);
      }
      ENGINE.settleQuarter(c, random);
    }
    return c.settlements.getLast();
  }

  /** #394: 연말에 조짐이 맞았나 헛소문이었나를 밝힌다. 방어로 돌릴 태도가 없어(382번) 늘 버틴 셈이다. */
  @Test
  void 연말에_조짐이_맞았는지_밝힌다() {
    // 헛조짐: 보통 해인데 조짐이 떴다. 버텼다.
    CompanyState calm = open(3, stats(60, 60, 60, 60), 100_000_000);
    ENGINE.place(calm, Map.of(calm.employees.getFirst().id, "day"));
    calm.phase = "normal";
    calm.omen = "경제 유튜브 채널마다 '곧 폭락이 온다'는 영상이 올라온다.";
    CompanyState.Settlement kept = year(calm, 3);
    assertThat(kept.omenCall).isEqualTo("falseKept");
    assertThat(kept.lines).anyMatch(line -> line.startsWith("헛소문이었다"));
    assertThat(kept.achieved).contains("헛소문 감별사");

    // 진짜 조짐: 폭락장이다.
    CompanyState storm = open(4, stats(60, 60, 60, 60), 100_000_000);
    ENGINE.place(storm, Map.of(storm.employees.getFirst().id, "day"));
    storm.phase = CompanyEngine.CRASH;
    storm.crashQuarter = 3;
    storm.omen = "신용 대출이 늘었다.";
    CompanyState.Settlement saw = year(storm, 4);
    assertThat(saw.omenCall).isEqualTo("trueIgnored");
    assertThat(saw.lines).anyMatch(line -> line.startsWith("조짐이 맞았다"));
  }

  /** 옛 저장 상태에 직원 합성 기록(합성 횟수·방금 한 합성·합성으로 처음 만든 등급)이 남아 있어도 읽힌다 (384번). */
  @Test
  void 옛_저장_상태의_합성_기록은_무시하고_읽는다() {
    String old =
        """
        {"year": 2, "capital": 5000000000, "merges": 3,
         "lastMerge": {"baseId": 1, "name": "김촉", "before": "C", "after": "A", "jackpot": true,
                       "farewells": ["잘 부탁해요"], "firstOfGrade": true, "inheritedQuirk": "촉파"},
         "mergedFirst": ["A"],
         "collection": {"C": 2, "A": 1},
         "employees": [{"id": 1, "name": "김촉", "quirk": "gut"}]}
        """;
    CompanyState c = JsonMapper.builder().build().readValue(old, CompanyState.class);
    assertThat(c.year).isEqualTo(2);
    assertThat(c.collection).containsEntry("A", 1);
    assertThat(c.employees).singleElement().satisfies(e -> assertThat(e.quirk).isEqualTo("gut"));
  }

  /**
   * 옛 저장 상태에 이직 제안(걸린 제안·증권사마다 손을 뻗은 횟수·떠난 사람의 데려간 증권사와 소식)이 남아 있어도 읽히고, 연표에 남은 옛 이직 줄은 그대로다
   * (385번). 그 해를 결산해도 아무도 떠나지 않고 이직 소식 줄도 없다.
   */
  @Test
  void 옛_저장_상태의_이직_제안은_무시하고_읽는다() {
    CompanyState c = ENGINE.open(new HashSeededRandom(6), ENGINE.openingCapital());
    ENGINE.hire(c, stats(60, 60, 60, 60));
    ENGINE.hire(c, stats(70, 70, 70, 70));
    JsonMapper json = JsonMapper.builder().build();
    ObjectNode node = json.valueToTree(c);
    int target = c.employees.getLast().id;
    node.set(
        "poach",
        json.readTree(
            "{\"employeeId\": "
                + target
                + ", \"transferFee\": 1350000000, \"rival\": \"존버캐피탈\", \"count\": 2}"));
    node.set("poachCounts", json.readTree("{\"존버캐피탈\": 2}"));
    node.set(
        "alumni",
        json.readTree(
            "[{\"name\": \"류소울\", \"from\": 1, \"to\": 2, \"grade\": \"S\","
                + " \"rival\": \"존버캐피탈\", \"reported\": false}]"));
    node.set(
        "timeline",
        json.readTree("[{\"year\": 2, \"kind\": \"left\", \"text\": \"류소울이(가) 존버캐피탈(으)로 떠났다.\"}]"));
    CompanyState old = json.treeToValue(node, CompanyState.class);
    assertThat(old.employees).hasSize(2);
    assertThat(old.alumni).singleElement().satisfies(a -> assertThat(a.name).isEqualTo("류소울"));
    assertThat(old.timeline).anyMatch(e -> e.text.contains("존버캐피탈"));
    old.invest = null;
    CompanyState.Settlement s = ENGINE.settle(old, new HashSeededRandom(6));
    assertThat(old.employees).as("아무도 떠나지 않는다").hasSize(2);
    assertThat(s.lines).noneMatch(line -> line.contains("존버캐피탈"));
  }

  /** 실패·재미 업적 (decisions.md 351번): 망한 판도 즐겁게. 연말 결산이 읽는다. */
  @Test
  void 실패_업적은_연말에_열리고_위로_보상은_한_장이다() {
    CompanyState c = ENGINE.open(new HashSeededRandom(11), ENGINE.openingCapital());
    for (int i = 0; i < 10; i++) {
      ENGINE.hire(c, stats(3, 3, 3, 3));
    }
    assertThat(c.employees).allMatch(e -> "F".equals(CompanyEngine.employeeGrade(e)));
    c.employees.get(1).name = c.employees.get(0).name;
    for (int q = 0; q < 4; q++) {
      ENGINE.settleQuarter(c, new HashSeededRandom(11));
    }
    CompanyState.Settlement s = c.settlements.getLast();
    assertThat(c.achievements).containsKeys("f-ten", "same-name");
    // 실패 업적(F의 전당)은 한 장, 재미 업적(동명이인)은 보통대로.
    int fails = 0;
    int normals = 0;
    for (String name : s.achieved) {
      if (ENGINE.history.all().stream().anyMatch(a -> a.name().equals(name) && a.isFail())) {
        fails++;
      } else {
        normals++;
      }
    }
    assertThat(fails).isGreaterThanOrEqualTo(1);
    assertThat(normals).isGreaterThanOrEqualTo(1);
    assertThat(ENGINE.history.achievementTickets(s, 3)).isEqualTo(fails + normals * 3);
  }
}
