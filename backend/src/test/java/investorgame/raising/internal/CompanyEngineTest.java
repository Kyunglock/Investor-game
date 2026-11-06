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
  void 사장의_사재로_직원_없이_F등급_자리_두_개로_열리고_지원자가_온다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(1), ENGINE.openingCapital());
    assertThat(company.capital).isEqualTo(100_000_000);
    assertThat(company.employees).isEmpty();
    assertThat(company.opening).contains("1억 원");
    assertThat(company.applicants).hasSize(PROPERTIES.market().applicants());
    assertThat(company.applicants.getFirst().name).isEqualTo("박한결");
    assertThat(company.applicants.getFirst().line)
        .as("첫 지원자는 올해 필요한 인재")
        .contains(
            TestContent.load().raising().company().desks().stream()
                .filter(d -> d.code().equals(company.wantedDesk))
                .findFirst()
                .orElseThrow()
                .name());
    assertThat(ENGINE.grade(company.capital)).isEqualTo("F");
    assertThat(ENGINE.seats(company.capital)).isEqualTo(2);
    assertThat(ENGINE.grade(200_000_000)).as("E는 2억부터 (256번)").isEqualTo("E");
    assertThat(ENGINE.grade(199_999_999)).isEqualTo("F");
    assertThat(ENGINE.grade(600_000_000)).isEqualTo("D");
    assertThat(ENGINE.grade(300_000_000)).isEqualTo("E");
    assertThat(ENGINE.seats(300_000_000)).isEqualTo(3);
    assertThat(company.wantedDesk).isNotNull();
  }

  @Test
  void 자리_수를_넘게_앉힐_수_없다() {
    CompanyState company = open(1, stats(50, 50, 50, 50), 100_000_000);
    ENGINE.hire(company, stats(50, 50, 50, 50));
    ENGINE.hire(company, stats(50, 50, 50, 50));
    assertThatThrownBy(() -> ENGINE.place(company, Map.of(1, "bio", 2, "day", 3, "risk")))
        .isInstanceOf(InvalidRequestException.class);
    ENGINE.place(company, Map.of(1, "bio", 2, "day"));
    assertThat(company.employees.get(2).desk).as("빠진 직원은 쉰다").isNull();
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
      assertThat(company.applicants).as("다음 해 공채").isNotEmpty();
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
    assertThat(ENGINE.grade(next.capital)).isEqualTo("F");
    assertThat(next.capital).as("명성 A(5단계)면 시작 자본 +50%").isEqualTo(150_000_000L);
    assertThat(next.employees)
        .singleElement()
        .satisfies(e -> assertThat(e.stats.get("insight")).as("등급 그대로").isEqualTo(80));
    String cofounder = next.employees.getFirst().name;
    assertThat(next.opening).contains(cofounder);
    // 새 지원자는 지난 회사에서 만난 사람의 이름을 이어 쓴다.
    assertThat(next.applicants).extracting(a -> a.name).doesNotContain(cofounder);
    assertThat(next.met).isGreaterThan(company.met);
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
      // F 띠(0~19)는 더 내려갈 등급이 없으니(251번) D 띠로 본다.
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

    first.rank = 4;
    ENGINE.deal(company, new HashSeededRandom(2));
    assertThat(company.applicants)
        .extracting(a -> a.line)
        .noneMatch(l -> l != null && l.contains("사수"));
    first.rank = 5;
    first.stats.put("courage", 99);
    ENGINE.deal(company, new HashSeededRandom(2));
    assertThat(company.applicants.get(1).line)
        .as("둘째 지원자에게 사수가 붙어 사수의 가장 높은 능력치가 한 띠 높다")
        .contains(first.name)
        .contains("용기");
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

  /** 공채 시장 (decisions.md 228번): 계약금을 내고 뽑고, 자리가 꽉 차면 내보낼 사람을 고르고, 값을 내고 새로 받는다. */
  @Test
  void 공채_시장에서_계약금을_내고_뽑는다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(5), ENGINE.openingCapital());
    CompanyState.Applicant first = company.applicants.getFirst();
    assertThat(first.fee).isEqualTo(ENGINE.fee(company.capital, first.stats, 0));
    long before = company.capital;
    CompanyState.Employee hired = ENGINE.hireApplicant(company, first.id, null);
    assertThat(hired.name).isEqualTo(first.name);
    assertThat(hired.stats).isEqualTo(first.stats);
    assertThat(hired.desk).as("뽑으면 쉬는 채로 들어온다").isNull();
    assertThat(company.capital).isEqualTo(before - first.fee);
    assertThat(company.applicants).doesNotContain(first);
    assertThatThrownBy(() -> ENGINE.hireApplicant(company, first.id, null))
        .as("뽑힌 지원자는 없다")
        .isInstanceOf(InvalidRequestException.class);

    CompanyState.Applicant second = company.applicants.getFirst();
    ENGINE.hireApplicant(company, second.id, null);
    CompanyState.Applicant third = company.applicants.getFirst();
    assertThatThrownBy(() -> ENGINE.hireApplicant(company, third.id, null))
        .as("자리 두 개가 꽉 찼다")
        .isInstanceOf(InvalidRequestException.class);
    ENGINE.hireApplicant(company, third.id, hired.id);
    assertThat(company.employees).extracting(e -> e.name).doesNotContain(hired.name);

    long cash = company.capital;
    ENGINE.refresh(company, new HashSeededRandom(5));
    assertThat(company.capital)
        .as("1억 회사는 정해진 값")
        .isEqualTo(cash - PROPERTIES.market().refreshCost());
    assertThat(company.applicants).hasSize(PROPERTIES.market().applicants());
    company.capital = 0;
    assertThatThrownBy(() -> ENGINE.refresh(company, new HashSeededRandom(5)))
        .isInstanceOf(InvalidRequestException.class);
    CompanyState.Applicant pricey = company.applicants.getFirst();
    assertThatThrownBy(() -> ENGINE.hireApplicant(company, pricey.id, null))
        .as("계약금이 모자란다")
        .isInstanceOf(InvalidRequestException.class);
  }

  /** 지원자 등급의 중심은 회사 등급보다 두 단계 위(F 회사면 D)이고, 등급이 높을수록 계약금이 비싸다. 해가 바뀌면 새 지원자가 온다. */
  @Test
  void 지원자는_회사_등급을_따라_오고_해마다_바뀐다() {
    int sum = 0;
    int count = 0;
    for (int seed = 0; seed < 300; seed++) {
      CompanyState company = ENGINE.open(new HashSeededRandom(seed), ENGINE.openingCapital());
      for (CompanyState.Applicant a : company.applicants) {
        int at = CompanyEngine.LADDER.indexOf(CompanyEngine.overallGrade(a.stats));
        assertThat(at).as("F 회사에는 F~B가 온다").isBetween(0, 4);
        sum += at;
        count++;
      }
    }
    assertThat(sum / (double) count).as("중심은 D 언저리").isBetween(1.6, 2.6);
    assertThat(ENGINE.fee(100_000_000, stats(90, 90, 90, 90), 0))
        .isGreaterThan(ENGINE.fee(100_000_000, stats(30, 30, 30, 30), 0));

    CompanyState company = ENGINE.open(new HashSeededRandom(8), ENGINE.openingCapital());
    List<String> first = company.applicants.stream().map(a -> a.name).toList();
    settleYear(company, new HashSeededRandom(8));
    assertThat(company.applicants).extracting(a -> a.name).doesNotContainAnyElementsOf(first);
  }

  /** 인사 직원 (6.3절): 인사팀에 사람이 있으면 지원자가 한 명 더 오고, 지원자 등급의 중심이 인사 직원보다 두 단계 아래까지 오른다. */
  @Test
  void 인사팀이_공채를_돕는다() {
    Map<String, Integer> sharp = stats(92, 92, 92, 92);
    CompanyState company = open(3, sharp, 100_000_000);
    ENGINE.place(company, Map.of(1, "hr"));
    assertThat(ENGINE.hrCap(company.employees.getFirst())).as("평균 84(SS)의 두 단계 아래").isEqualTo("A");
    int sum = 0;
    for (int seed = 0; seed < 100; seed++) {
      ENGINE.deal(company, new HashSeededRandom(seed));
      assertThat(company.applicants).hasSize(PROPERTIES.market().applicants() + 1);
      assertThat(company.applicants.getLast().line).contains("인사팀");
      sum +=
          company.applicants.stream()
              .mapToInt(a -> CompanyEngine.LADDER.indexOf(CompanyEngine.overallGrade(a.stats)))
              .sum();
    }
    assertThat(sum / (100.0 * 4)).as("중심이 A 언저리로 오른다").isGreaterThan(4.3);
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
  void 연초_회의에_이번_시대에_뜨는_섹터가_보이고_지원자는_관심_섹터를_안고_온다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(1), ENGINE.openingCapital());
    assertThat(ENGINE.hotLine(company)).as("평범한 시대엔 뜨는 섹터가 없다").isNull();
    company.era = "long-winter";
    assertThat(ENGINE.hotDesks(company)).containsExactly("food", "finance");
    assertThat(ENGINE.hotLine(company)).isEqualTo("이번 시대에 뜨는 섹터: 식품 데스크·금융 데스크.");

    assertThat(company.applicants).allSatisfy(a -> assertThat(a.sector).isNotNull());
    CompanyState.Applicant first = company.applicants.getFirst();
    CompanyState.Employee hired = ENGINE.hireApplicant(company, first.id, null);
    assertThat(hired.sector).as("뽑으면 관심 섹터를 안고 들어온다").isEqualTo(first.sector);

    hired.desk = "day";
    assertThat(ENGINE.interested(hired)).as("단타 데스크는 섹터를 가리지 않는다").isFalse();
    hired.desk = hired.sector; // 섹터 데스크의 코드는 섹터 코드와 같다
    assertThat(ENGINE.interested(hired)).isTrue();
  }

  /** 올해 필요한 자리가 섹터 데스크면 첫 지원자는 그 섹터에 관심이 있다. */
  @Test
  void 필요한_인재가_섹터_데스크면_첫_지원자의_관심_섹터도_같다() {
    int seen = 0;
    for (int seed = 0; seed < 200; seed++) {
      CompanyState company = ENGINE.open(new HashSeededRandom(seed), ENGINE.openingCapital());
      String sector =
          ENGINE.desks().stream()
              .filter(d -> d.code().equals(company.wantedDesk))
              .findFirst()
              .orElseThrow()
              .sector();
      if (sector != null) {
        seen++;
        assertThat(company.applicants.getFirst().sector).isEqualTo(sector);
      }
    }
    assertThat(seen).as("필요한 인재가 섹터 데스크인 해가 있다").isPositive();
  }

  /** 망한 회사 (decisions.md 246번): 자본이 0이거나 직원 없이 가장 싼 계약금도 못 내면 닫고 사재로 다음 회사를 차린다. */
  @Test
  void 자본이_바닥나면_망한_회사가_되고_사재로_다음_회사를_차린다() {
    CompanyState fresh = ENGINE.open(new HashSeededRandom(1), ENGINE.openingCapital());
    assertThat(ENGINE.broke(fresh)).isFalse();
    assertThat(ENGINE.brokeNotice(fresh)).isNull();
    assertThatThrownBy(() -> ENGINE.restart(fresh, new HashSeededRandom(2), 100_000_000))
        .isInstanceOf(InvalidRequestException.class);

    long cheapest = PROPERTIES.market().fees().getFirst();
    CompanyState poor = ENGINE.open(new HashSeededRandom(1), cheapest - 1);
    assertThat(ENGINE.broke(poor)).as("직원 없이 가장 싼 계약금도 못 낸다").isTrue();
    ENGINE.hire(poor, stats(50, 50, 50, 50));
    assertThat(ENGINE.broke(poor)).as("직원이 있으면 적은 돈으로도 굴려 다시 일어설 수 있다").isFalse();
    poor.capital = 0;
    assertThat(ENGINE.broke(poor)).as("자본 0은 수수료도 판돈도 0이다").isTrue();
    assertThat(ENGINE.brokeNotice(poor)).isNotBlank();

    poor.met = 7;
    CompanyState next = ENGINE.restart(poor, new HashSeededRandom(2), ENGINE.openingCapital());
    assertThat(poor.closed).isTrue();
    assertThat(next.number).isEqualTo(2);
    assertThat(next.year).isEqualTo(1);
    assertThat(next.capital).isEqualTo(100_000_000);
    assertThat(next.employees).as("직원은 따라오지 않는다").isEmpty();
    assertThat(next.applicants).isNotEmpty();
    assertThat(next.applicants.getFirst().name).as("이름은 이어 센다").isNotEqualTo("박한결");
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

  /** 자리가 줄면 넘친 사람이 쉰다 (#311, decisions.md 247번): 돕는 자리부터, 그다음 나중에 들어온 사람부터. */
  @Test
  void 자본이_줄어_자리가_줄면_돕는_자리부터_일어나_쉰다() {
    // E 회사(자리 3)에 셋을 앉힌다. 새로 받기 값을 내면 2억 아래로 떨어져 F(자리 2)가 된다.
    CompanyState company = open(5, stats(50, 50, 50, 50), 200_000_000 + 1_000_000);
    ENGINE.hire(company, stats(50, 50, 50, 50));
    ENGINE.hire(company, stats(50, 50, 50, 50));
    List<CompanyState.Employee> staff = company.employees;
    ENGINE.place(
        company,
        Map.of(staff.get(0).id, "research", staff.get(1).id, "bio", staff.get(2).id, "day"));
    assertThat(ENGINE.seats(company.capital)).isEqualTo(3);

    ENGINE.refresh(company, new HashSeededRandom(5));
    assertThat(ENGINE.seats(company.capital)).isEqualTo(2);
    assertThat(staff.get(0).desk).as("돕는 자리가 먼저 일어난다").isNull();
    assertThat(staff.get(1).desk).isEqualTo("bio");
    assertThat(staff.get(2).desk).isEqualTo("day");

    // 돕는 자리가 없으면 나중에 들어온 사람부터 일어난다.
    ENGINE.place(company, Map.of(staff.get(1).id, "bio", staff.get(2).id, "day"));
    company.capital = 1_000_000;
    staff.get(0).desk = "bio";
    List<CompanyState.Employee> stood = ENGINE.fitSeats(company);
    assertThat(stood).extracting(e -> e.id).containsExactly(staff.get(2).id);
    assertThat(staff.get(0).desk).isEqualTo("bio");
    assertThat(staff.get(1).desk).isEqualTo("bio");
  }

  @Test
  void 결산으로_자리가_줄면_넘친_사람이_쉬고_소식_줄에_남는다() {
    for (long seed = 1; seed <= 40; seed++) {
      CompanyState company = open(seed, stats(1, 1, 1, 1), 200_000_000);
      ENGINE.hire(company, stats(1, 1, 1, 1));
      ENGINE.hire(company, stats(90, 90, 90, 90));
      List<CompanyState.Employee> staff = company.employees;
      ENGINE.place(
          company,
          Map.of(staff.get(0).id, "game", staff.get(1).id, "game", staff.get(2).id, "research"));
      company.phase = CompanyEngine.CRASH;
      company.invest = null;
      CompanyState.Settlement settlement = ENGINE.settle(company, new HashSeededRandom(seed));
      long seated = company.employees.stream().filter(e -> e.desk != null).count();
      assertThat(seated).isLessThanOrEqualTo(ENGINE.seats(company.capital));
      if (ENGINE.seats(company.capital) < 3) {
        assertThat(staff.get(2).desk).as("리서치 팀이 먼저 일어난다").isNull();
        assertThat(settlement.lines).anyMatch(line -> line.contains("자리에서 일어나 쉰다"));
        return;
      }
    }
    throw new AssertionError("폭락장에 자리가 줄어드는 해가 없었다");
  }

  /**
   * 시대가 바뀐다 (#313, decisions.md 249번): 첫 회사는 평범한 시대로 열고, 세 해마다 다른 시대가 온다. 마지막 해에는 연초 회의가 알려 주고, 바뀐
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
   * 연말 결산서의 장부가 맞는다 (#314, decisions.md 250번): 연초 자본은 연초 회의 때의 자본이고, 그해 계약금·새로 받기 값은 채용비 줄로 나온다. 연초
   * 자본 + 회의 + 직원들 + 수수료 − 채용비 = 연말 자본.
   */
  @Test
  void 연말_결산서의_연초_자본은_연초_회의_때의_자본이고_채용비가_따로_나온다() {
    for (long seed = 1; seed <= 20; seed++) {
      CompanyState company = ENGINE.open(new HashSeededRandom(seed), ENGINE.openingCapital());
      HashSeededRandom random = new HashSeededRandom(seed);
      for (int year = 1; year <= 4; year++) {
        long start = company.capital;
        long spent = 0;
        long refreshCost = ENGINE.refreshCost(company);
        if (company.employees.size() < ENGINE.seats(company.capital - refreshCost)) {
          ENGINE.refresh(company, random);
          spent += refreshCost;
          CompanyState.Applicant cheapest =
              company.applicants.stream()
                  .min(java.util.Comparator.comparingLong(a -> a.fee))
                  .orElseThrow();
          if (company.capital >= cheapest.fee
              && company.employees.size() < ENGINE.seats(company.capital - cheapest.fee)) {
            CompanyState.Employee hired = ENGINE.hireApplicant(company, cheapest.id, null);
            spent += cheapest.fee;
            Map<Integer, String> seats = new HashMap<>();
            company.employees.forEach(e -> seats.put(e.id, e.desk));
            seats.put(hired.id, "day");
            if (seats.values().stream().filter(d -> d != null).count()
                <= ENGINE.seats(company.capital)) {
              ENGINE.place(company, seats);
            }
          }
        }
        CompanyState.Settlement s = settleYear(company, random);
        assertThat(s.capitalBefore).isEqualTo(start);
        assertThat(s.hiring).isEqualTo(spent);
        long staff = s.results.stream().mapToLong(r -> r.pnl).sum();
        long invest = s.investTotal == null ? 0 : s.investTotal;
        if (s.capitalAfter > 0) {
          assertThat(s.capitalBefore + invest + staff + s.fee - s.hiring)
              .as("%d번 시드 %d년 차 장부", seed, year)
              .isEqualTo(s.capitalAfter);
        }
      }
    }
  }

  /**
   * 하락은 글자가 바뀐다 (#315, decisions.md 251번): SSS 100이 90이 되어 "SSS → SSS"가 뜨던 것을 띠 경계 아래까지 내린다. 되찾을 때는
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
  void 큰돈은_조와_억으로_쓴다() {
    assertThat(CompanyEngine.won(100_000_000)).isEqualTo("1억 원");
    assertThat(CompanyEngine.won(248_580_000)).isEqualTo("2억 4,858만 원");
    assertThat(CompanyEngine.won(56_361_512_345_678L)).isEqualTo("56조 3,615억 원");
    assertThat(CompanyEngine.won(1_000_000_000_000_000L)).isEqualTo("1,000조 원");
  }

  /** 폭락장에 아무도 바닥에서 던지지 않았으면 머리줄이 "못 참고 판 사람이 가장 크게 잃었다"가 아니다 (#318, decisions.md 254번). */
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

  /** 지원자 이름은 성 × 이름 조합을 겹치지 않게 돌리고 직함을 붙이지 않는다 (#319, decisions.md 255번). */
  @Test
  void 지원자_이름은_겹치지_않고_직함이_없다() {
    var texts = TestContent.load().raising().company();
    int total = texts.surnames().size() * texts.names().size();
    CompanyState company = ENGINE.open(new HashSeededRandom(1), 100_000_000_000L);
    java.util.Set<String> names = new java.util.HashSet<>();
    String previous = null;
    while (names.size() < total) {
      for (CompanyState.Applicant a : company.applicants) {
        assertThat(names.add(a.name)).as("겹친 이름: %s", a.name).isTrue();
        assertThat(a.name).doesNotContain("대리").doesNotContain("수습").doesNotContain("주임");
        if (previous != null) {
          assertThat(a.name.charAt(0)).as("이웃한 지원자의 성이 다르다").isNotEqualTo(previous.charAt(0));
        }
        previous = a.name;
        if (names.size() == total) {
          break;
        }
      }
      // 새로 받을수록 비싸지므로(257번) 횟수를 되돌린다. 이름은 만난 수로 붙으니 그래도 이어진다.
      company.refreshes = 0;
      ENGINE.refresh(company, new HashSeededRandom(1));
    }
    assertThat(names).hasSize(total);
  }

  /**
   * 큰 회사에도 공채가 무겁다 (#321, decisions.md 257번): 계약금은 정해진 값과 자본 비율 가운데 큰 쪽, 새로 받기 값은 자본에 비례하고 한 해에
   * 받을수록 비싸지며, SSS 회사부터 경력직(X 이상)이 온다.
   */
  @Test
  void 큰_회사의_계약금과_새로_받기_값은_자본에_비례하고_경력직이_온다() {
    Map<String, Integer> sss = new HashMap<>(stats(95, 95, 95, 95));
    sss.put("luck", 95);
    long small = ENGINE.fee(100_000_000, sss, 0);
    assertThat(small).as("1억 회사의 SSS 계약금은 정해진 값").isEqualTo(120_000_000);
    long big = ENGINE.fee(1_000_000_000_000L, sss, 0);
    assertThat(big).as("1조 회사의 SSS 계약금은 자본의 8%").isEqualTo(80_000_000_000L);
    assertThat(ENGINE.fee(1_000_000_000_000L, sss, 1)).as("경력직은 더 비싸다").isGreaterThan(big);

    // 새로 받기 값을 내고도 SSS(1조 이상)에 머물게 넉넉히 연다.
    CompanyState company = ENGINE.open(new HashSeededRandom(3), 1_200_000_000_000L);
    long first = ENGINE.refreshCost(company);
    assertThat(first).as("1.2조 회사의 새로 받기는 자본의 0.5%").isEqualTo(6_000_000_000L);
    ENGINE.refresh(company, new HashSeededRandom(3));
    assertThat(ENGINE.refreshCost(company)).as("두 번째는 두 배쯤").isGreaterThan(first * 19 / 10);

    CompanyState.Applicant veteran = company.applicants.get(2);
    assertThat(veteran.rank).as("SSS 회사에는 X 경력직이 온다").isEqualTo(1);
    assertThat(CompanyEngine.gradeOf(veteran.stats, veteran.rank)).isEqualTo("X");
    assertThat(veteran.line).contains("경력직");
    CompanyState.Employee hired = ENGINE.hireApplicant(company, veteran.id, null);
    assertThat(CompanyEngine.employeeGrade(hired)).isEqualTo("X");

    CompanyState small2 = ENGINE.open(new HashSeededRandom(3), 100_000_000);
    assertThat(small2.applicants).allMatch(a -> a.rank == 0);
  }
}
