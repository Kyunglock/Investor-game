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

  /** 운까지 다섯 능력치가 모두 value. */
  private static Map<String, Integer> all(int value) {
    return Map.of(
        "insight", value, "patience", value, "courage", value, "conviction", value, "luck", value);
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
      ENGINE.invest.decide(company, InvestEngine.BUY, random);
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
  void 한_자리에는_여덟_명까지_앉힐_수_있다() {
    // 440번: 자리 수가 넉넉해도 한 데스크에는 DESK_CAP(8)명까지.
    CompanyState company = open(1, stats(50, 50, 50, 50), 1_000_000_000_000L);
    assertThat(ENGINE.seats(company)).isGreaterThan(CompanyEngine.DESK_CAP);
    Map<Integer, String> nine = new HashMap<>();
    for (int i = 0; i < CompanyEngine.DESK_CAP; i++) {
      ENGINE.hire(company, stats(50, 50, 50, 50));
    }
    for (CompanyState.Employee e : company.employees) {
      nine.put(e.id, "day");
    }
    assertThat(nine).hasSize(CompanyEngine.DESK_CAP + 1);
    assertThatThrownBy(() -> ENGINE.place(company, nine))
        .isInstanceOf(InvalidRequestException.class)
        .hasMessageContaining("8명까지");
    nine.put(company.employees.getLast().id, "bio");
    ENGINE.place(company, nine);
    assertThat(company.employees.stream().filter(e -> "day".equals(e.desk)).count())
        .isEqualTo(CompanyEngine.DESK_CAP);
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
      capitals[k] = (long) company.capital;
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

  /**
   * 직원 등급은 뽑은 그대로 간다 (decisions.md 421번, #582): 폭락장을 버티거나 한 해 일해도 오르지 않는다. 능력치·SSS 위 단계 모두 그대로고 등급이
   * 바뀌었다는 소식 줄도 없다.
   */
  @Test
  void 직원_등급은_결산으로_오르지도_떨어지지도_않는다() {
    List<Map<String, Integer>> kinds =
        List.of(stats(10, 10, 10, 10), stats(30, 30, 30, 30), stats(55, 55, 55, 55), all(95));
    for (int seed = 0; seed < 40; seed++) {
      Map<String, Integer> start = new HashMap<>(kinds.get(seed % kinds.size()));
      CompanyState company = open(seed, start, 1_000_000_000L);
      CompanyState.Employee e = company.employees.getFirst();
      e.rank = seed % 3 == 0 && CompanyEngine.overallGrade(e.stats).equals("SSS") ? 2 : 0;
      int rank = e.rank;
      Map<String, Integer> before = new HashMap<>(e.stats);
      ENGINE.place(company, Map.of(e.id, "bio"));
      for (int year = 0; year < 8; year++) {
        CompanyState.Settlement s = settleYear(company, new HashSeededRandom(seed * 31L + year));
        assertThat(s.lines)
            .as("등급이 바뀌었다는 소식이 없다")
            .noneMatch(
                line ->
                    line.contains("일하며 자랐다")
                        || line.contains("올라섰다! 종합")
                        || line.contains("등급이 내려갔다")
                        || line.contains("한 띠 내려갔다")
                        || line.contains("되찾았다 (")
                        || line.contains("실전 경험"));
      }
      assertThat(e.stats).as("능력치 그대로").isEqualTo(before);
      assertThat(e.rank).as("SSS 위 단계 그대로").isEqualTo(rank);
    }
  }

  /** XS 큰손·XSS 철벽·GOD 신의 손 (decisions.md 289번): ZZZ 위 직원 등급. 회사 등급은 ZZZ까지다. */
  @Test
  void XS_XSS_GOD_효과() {
    Map<String, Integer> ace = stats(95, 95, 95, 95);
    assertThat(averageWithRank(ace, 7, null))
        .as("XS 큰손은 더 번다")
        .isGreaterThan(averageWithRank(ace, 6, null));
    // 456번: 운용에 손실이 없어 틀려도 덜 잃는 XSS 철벽은 더 줄일 손실이 없다.
    assertThat(averageWithRank(ace, 8, null))
        .as("XSS 철벽은 잃을 것이 없어 큰손과 같다")
        .isEqualTo(averageWithRank(ace, 7, null));
    assertThat(teammateFlips(9)).as("GOD 신의 손이면 모두 덜 흔들린다").isLessThan(teammateFlips(8));

    Map<String, Integer> top = new HashMap<>(ace);
    top.put("luck", 95);
    assertThat(CompanyEngine.gradeOf(top, 7)).isEqualTo("XS");
    assertThat(CompanyEngine.gradeOf(top, 8)).isEqualTo("XSS");
    assertThat(CompanyEngine.gradeOf(top, 9)).isEqualTo("GOD");
    CompanyState company = open(1, top, 100_000_000);
    CompanyState.Employee god = company.employees.getFirst();
    god.rank = 9;
    assertThat(ENGINE.effectsOf(god)).endsWith("큰손", "철벽", "신의 손");
    assertThat(ENGINE.grade(Long.MAX_VALUE)).as("회사 등급은 ZZZ까지").isEqualTo("ZZZ");
  }

  /** 등급 효과 (decisions.md 289·387번): 종합 등급이 높을수록 맞혔을 때 더 번다. 등급은 뽑은 그대로라(421번) 자라는 확률은 효과 줄에 없다. */
  @Test
  void 등급마다_더_버는_몫이_다르다() {
    Map<String, Integer> rookie =
        new HashMap<>(
            Map.of("insight", 10, "patience", 10, "courage", 10, "conviction", 10, "luck", 10));
    CompanyState probe = open(1, rookie, 100_000_000);
    CompanyState.Employee f = probe.employees.getFirst();
    assertThat(ENGINE.perkGainPercent(f)).isEqualTo(10);
    assertThat(ENGINE.perkLine(f.stats, 0))
        .as("F는 손 뒤집힘 보정도 이름 붙은 효과도 없다")
        .isEqualTo("새내기 · 맞히면 1.1배 번다(+10%)");
    assertThat(ENGINE.perkLine(all(85), 0))
        .isEqualTo("스타 · 맞히면 13.8배 번다(+1,280%) · 손 뒤집힘 −50% · 방패: 한 분기에 잃으면 손실의 3할을 막는다");
    Map<String, Integer> legend = stats(95, 95, 95, 95);
    legend = new HashMap<>(legend);
    legend.put("luck", 95);
    assertThat(ENGINE.perkLine(legend, 0))
        .startsWith("레전드 · 맞히면 26.6배 번다(+2,560%) · 손 뒤집힘 −60% · 전설의 촉")
        .doesNotContain("실전 경험")
        .doesNotContain("자란다");
    assertThat(ENGINE.perkLine(legend, 9)).startsWith("GOD · 맞히면 13,108.2배 번다(+1,310,720%)");
    assertThat(ENGINE.drawnPerk("D")).isEqualTo("맞히면 1.4배");
    assertThat(ENGINE.drawnPerk("SS")).isEqualTo("맞히면 13.8배 · 방패");
    assertThat(ENGINE.drawnPerk("X")).isEqualTo("맞히면 52.2배 · 확신");
    assertThat(averageWithRank(stats(55, 55, 55, 55), 0, null))
        .as("같은 능력치라도 등급이 같으니 같다: 효과는 등급을 따라간다")
        .isEqualTo(averageWithRank(stats(55, 55, 55, 55), 0, null));
  }

  /**
   * 더 버는 몫은 등급마다 두 배다 (decisions.md 387번, 사용자 결정): F 10% · E 20% · D 40% · C 80% · B 160% · A 320%
   * · S 640% · SS 1,280% · SSS 2,560%, 그 위(X~GOD)도 단계마다 두 배. 같은 회사·같은 자리에서 한 등급 높은 직원이 한 해에 훨씬 더
   * 번다.
   */
  @Test
  void 더_버는_몫이_등급마다_두_배다() {
    List<String> ladder = CompanyEngine.LADDER;
    assertThat(ENGINE.gainPercentOf("F")).isEqualTo(10);
    for (int i = 1; i < ladder.size(); i++) {
      assertThat(ENGINE.gainPercentOf(ladder.get(i)))
          .as(ladder.get(i))
          .isEqualTo(ENGINE.gainPercentOf(ladder.get(i - 1)) * 2);
    }
    assertThat(ENGINE.gainPercentOf("SS")).isEqualTo(1280);
    assertThat(ENGINE.gainPercentOf("SSS")).isEqualTo(2560);
    double b = averageWithRank(stats(55, 55, 55, 55), 0, null);
    double a = averageWithRank(stats(65, 65, 65, 65), 0, null);
    double ss = averageWithRank(all(85), 0, null);
    assertThat(a).as("A는 B보다 한 해에 훨씬 더 번다").isGreaterThan(b * 1.5);
    assertThat(ss).as("SS는 B의 세 배 넘게 번다").isGreaterThan(b * 3);
  }

  /** 높은 등급일수록 판단이 흔들리지 않는다 (decisions.md 387번): 같은 시드로 손 뒤집힘 보정을 끈 엔진과 견준다. */
  @Test
  void 높은_등급일수록_손이_덜_뒤집힌다() {
    CompanyEngine plain =
        withPerks(
            p ->
                new CompanyProperties.Perks(
                    p.gainPercent(),
                    Map.of(),
                    p.readBonus(),
                    p.stopLossPercent(),
                    p.pullGainPercent(),
                    p.shieldPercent()));
    // 인내심(바이오 데스크가 원하는 능력치)이 낮은 SS 직원: 자주 뒤집힐 사람이 반만 뒤집힌다.
    Map<String, Integer> shaky =
        Map.of("insight", 100, "patience", 30, "courage", 100, "conviction", 100, "luck", 100);
    assertThat(CompanyEngine.overallGrade(shaky)).isEqualTo("SS");
    assertThat(flips(ENGINE, shaky)).isLessThan(flips(plain, shaky) * 7 / 10);
  }

  /**
   * 이름 붙은 등급 효과 (decisions.md 387번): A 손절은 손이 뒤집혀도 덜 잃고, S 끌어주기는 같은 데스크 동료가 더 벌고, SS 방패는 잃은 분기의 손실을
   * 줄인다. 같은 시드로 그 효과만 끈 엔진과 견준다.
   */
  @Test
  void A_손절_S_끌어주기_SS_방패() {
    CompanyEngine noStopLoss =
        withPerks(
            p ->
                new CompanyProperties.Perks(
                    p.gainPercent(),
                    p.flipPercent(),
                    p.readBonus(),
                    100,
                    p.pullGainPercent(),
                    p.shieldPercent()));
    Map<String, Integer> veteran =
        Map.of("insight", 80, "patience", 20, "courage", 80, "conviction", 80, "luck", 50);
    assertThat(CompanyEngine.overallGrade(veteran)).isEqualTo("A");
    assertThat(yearPnl(ENGINE, veteran, null, false))
        .as("A 손절: 운용에 손실이 없어(456번) 줄일 것이 없다")
        .isEqualTo(yearPnl(noStopLoss, veteran, null, false));

    CompanyEngine noPull =
        withPerks(
            p ->
                new CompanyProperties.Perks(
                    p.gainPercent(),
                    p.flipPercent(),
                    p.readBonus(),
                    p.stopLossPercent(),
                    0,
                    p.shieldPercent()));
    Map<String, Integer> rookie = stats(30, 30, 30, 30);
    Map<String, Integer> ace = stats(75, 75, 75, 75);
    assertThat(yearPnl(ENGINE, rookie, ace, true))
        .as("S 끌어주기: 같은 데스크 동료가 더 번다")
        .isGreaterThan(yearPnl(noPull, rookie, ace, true));
    assertThat(yearPnl(ENGINE, rookie, ace, false))
        .as("다른 데스크면 붙지 않는다")
        .isEqualTo(yearPnl(noPull, rookie, ace, false));

    CompanyEngine noShield =
        withPerks(
            p ->
                new CompanyProperties.Perks(
                    p.gainPercent(),
                    p.flipPercent(),
                    p.readBonus(),
                    p.stopLossPercent(),
                    p.pullGainPercent(),
                    0));
    Map<String, Integer> star = all(85);
    assertThat(yearPnl(ENGINE, star, null, false))
        .as("SS 방패: 운용에 손실이 없어(456번) 막을 것이 없다")
        .isEqualTo(yearPnl(noShield, star, null, false));
  }

  /** 첫 직원(바이오 데스크)이 한 해 번 돈의 합, 300판. mate는 같은 데스크(sameDesk) 또는 단타 데스크에 앉는 동료다. */
  private static long yearPnl(
      CompanyEngine engine,
      Map<String, Integer> first,
      Map<String, Integer> mate,
      boolean sameDesk) {
    long sum = 0;
    for (int seed = 0; seed < 300; seed++) {
      CompanyState company = engine.open(new HashSeededRandom(seed), 1_000_000_000L);
      engine.hire(company, first);
      if (mate != null) {
        engine.hire(company, mate);
        engine.place(company, Map.of(1, "bio", 2, sameDesk ? "bio" : "day"));
      } else {
        engine.place(company, Map.of(1, "bio"));
      }
      if (engine.invest.open(company)) {
        engine.invest.decide(company, InvestEngine.BUY, new HashSeededRandom(seed));
      }
      sum += engine.settle(company, new HashSeededRandom(seed)).results.getFirst().pnl;
    }
    return sum;
  }

  /** 바이오 데스크에 혼자 앉은 직원이 한 해에 뒤집힌 횟수의 합, 1,000판. */
  private static int flips(CompanyEngine engine, Map<String, Integer> stats) {
    int flips = 0;
    for (int seed = 0; seed < 1000; seed++) {
      CompanyState company = engine.open(new HashSeededRandom(seed), 1_000_000_000L);
      engine.hire(company, stats);
      engine.place(company, Map.of(1, "bio"));
      company.phase = "normal";
      if (engine.invest.open(company)) {
        engine.invest.decide(company, InvestEngine.BUY, new HashSeededRandom(seed));
      }
      CompanyState.Result r = engine.settle(company, new HashSeededRandom(seed)).results.getFirst();
      flips += r.flips.values().stream().mapToInt(Integer::intValue).sum();
    }
    return flips;
  }

  /** 등급 효과 수치만 바꾼 엔진 (387번). 같은 시드로 효과를 켜고 끈 결과를 견준다. */
  static CompanyEngine withPerks(java.util.function.UnaryOperator<CompanyProperties.Perks> change) {
    try {
      var components = CompanyProperties.class.getRecordComponents();
      Object[] values = new Object[components.length];
      Class<?>[] types = new Class<?>[components.length];
      for (int i = 0; i < components.length; i++) {
        types[i] = components[i].getType();
        Object value = components[i].getAccessor().invoke(PROPERTIES);
        values[i] = value instanceof CompanyProperties.Perks perks ? change.apply(perks) : value;
      }
      CompanyProperties changed =
          CompanyProperties.class.getDeclaredConstructor(types).newInstance(values);
      return new CompanyEngine(TestContent.load(), TestBehavior.create(), changed);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException(e);
    }
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
    long capital = (long) company.capital;
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
        .as("긴 겨울엔 식품 데스크가 뜬다")
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
    company.gradedCapital = (long) company.capital;
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
    company.gradedCapital = (long) company.capital;
    staff.get(0).desk = "bio";
    List<CompanyState.Employee> stood = ENGINE.fitSeats(company);
    assertThat(stood).extracting(e -> e.id).containsExactly(staff.get(4).id);
    assertThat(staff.get(0).desk).isEqualTo("bio");
    assertThat(staff.get(1).desk).isEqualTo("bio");
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
        long start = (long) company.capital;
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

  /** 판돈은 자본이 아니라 건물의 값이다 (411번): 자본을 전투 강화·이사에 다 써도 버는 양이 그대로다. */
  @Test
  void 판돈과_수수료는_자본이_아니라_건물의_값에서_나온다() {
    CompanyState rich = open(1, stats(50, 50, 50, 50), 100_000_000);
    CompanyState spent = open(1, stats(50, 50, 50, 50), 1_000);
    assertThat(ENGINE.grade(rich)).isEqualTo("F");
    assertThat(ENGINE.buildingValue(spent)).as("반지하는 사장의 사재").isEqualTo(ENGINE.openingCapital());
    assertThat(ENGINE.stakeOf(spent, 2)).isEqualTo(ENGINE.stakeOf(rich, 2)).isPositive();
    spent.building = "C";
    assertThat(ENGINE.buildingValue(spent)).as("C 건물은 그 띠의 값").isEqualTo(1_000_000_000L);
    assertThat(ENGINE.stakeOf(spent, 1))
        .isEqualTo(1_000_000_000L * PROPERTIES.stakePercent() / 100);
  }

  /** 잃을 자본이 모자라면 잃은 몫들을 같은 비율로 줄여 장부가 맞는다 (411번). */
  @Test
  void 잃을_자본이_모자라면_손실을_가진_만큼으로_줄인다() {
    assertThat(CompanyEngine.capLosses(1_000, new long[] {300, -200})).containsExactly(300, -200);
    assertThat(CompanyEngine.capLosses(100, new long[] {50, -400, -200}))
        .as("합이 −100이 되게 손실만 깎는다")
        .containsExactly(50, -100, -50);
    assertThat(CompanyEngine.capLosses(0, new long[] {-7, -3})).containsExactly(0, 0);
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
        ENGINE.invest.decide(c, InvestEngine.BUY, random);
      }
      ENGINE.settleQuarter(c, random);
    }
    return c.settlements.getLast();
  }

  /** 386번: 돈을 굴린 사람이 모두 폭락장 손익 절반 이하인 자리에 앉은 분기만 방어로 친다. 아무도 안 굴렸으면 방어가 아니다. */
  @Test
  void 모두_식품_금융에_앉은_분기만_방어다() {
    CompanyState.Quarter q = new CompanyState.Quarter();
    assertThat(ENGINE.braced(q)).as("돈 굴린 사람이 없다").isFalse();
    CompanyState.Result food = new CompanyState.Result();
    food.desk = "food";
    CompanyState.Result finance = new CompanyState.Result();
    finance.desk = "finance";
    q.results.addAll(List.of(food, finance));
    assertThat(ENGINE.braced(q)).isTrue();
    CompanyState.Result chip = new CompanyState.Result();
    chip.desk = "semiconductor";
    q.results.add(chip);
    assertThat(ENGINE.braced(q)).as("한 사람이라도 폭락에 크게 빠지는 자리면 방어가 아니다").isFalse();
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

}
