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
    assertThat(company.applicants.getFirst().name).isEqualTo("김대리");
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
      CompanyState company = open(seed, stats(10, 10, 10, 10), 1_000_000_000L);
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
    assertThat(first.fee).isEqualTo(ENGINE.fee(first.stats));
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
    assertThat(company.capital).isEqualTo(cash - PROPERTIES.market().refreshCost());
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
    assertThat(ENGINE.fee(stats(90, 90, 90, 90))).isGreaterThan(ENGINE.fee(stats(30, 30, 30, 30)));

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
}
