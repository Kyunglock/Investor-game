package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.HashMap;
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

  @Test
  void 첫_사람이_1호_직원이_되며_F등급_자리_두_개로_열린다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(1), stats(50, 50, 50, 50), 120_000_000);
    assertThat(company.capital).isEqualTo(120_000_000);
    assertThat(company.employees)
        .singleElement()
        .satisfies(e -> assertThat(e.name).isEqualTo("김대리"));
    assertThat(ENGINE.grade(company.capital)).isEqualTo("F");
    assertThat(ENGINE.seats(company.capital)).isEqualTo(2);
    assertThat(ENGINE.grade(300_000_000)).isEqualTo("E");
    assertThat(ENGINE.seats(300_000_000)).isEqualTo(3);
    assertThat(company.wantedDesk).isNotNull();
  }

  @Test
  void 자리_수를_넘게_앉힐_수_없다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(1), stats(50, 50, 50, 50), 100_000_000);
    ENGINE.hire(company, stats(50, 50, 50, 50));
    ENGINE.hire(company, stats(50, 50, 50, 50));
    assertThatThrownBy(() -> ENGINE.place(company, Map.of(1, "bio", 2, "day", 3, "risk")))
        .isInstanceOf(InvalidRequestException.class);
    ENGINE.place(company, Map.of(1, "bio", 2, "day"));
    assertThat(company.employees.get(2).desk).as("빠진 직원은 쉰다").isNull();
  }

  @Test
  void 세_해를_결산하면_회사가_끝나고_같은_시드면_같은_결과다() {
    long[] capitals = new long[2];
    for (int k = 0; k < 2; k++) {
      CompanyState company =
          ENGINE.open(new HashSeededRandom(9), stats(50, 50, 50, 50), 100_000_000);
      ENGINE.place(company, Map.of(1, "bio"));
      for (int year = 1; year <= PROPERTIES.turns(); year++) {
        CompanyState.Settlement s = ENGINE.settle(company, new HashSeededRandom(9));
        assertThat(s.year).isEqualTo(year);
        assertThat(s.fee).as("수수료는 시장과 상관없이 들어온다").isPositive();
        assertThat(s.lines).isNotEmpty();
      }
      assertThat(company.year).isEqualTo(PROPERTIES.turns() + 1);
      assertThatThrownBy(() -> ENGINE.settle(company, new HashSeededRandom(9)))
          .isInstanceOf(InvalidRequestException.class);
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
      CompanyState company = ENGINE.open(new HashSeededRandom(seed), trader, 1_000_000_000L);
      Map<Integer, String> placements = new HashMap<>(Map.of(1, desk));
      if (helper != null) {
        ENGINE.hire(company, helper);
        placements.put(2, helperDesk);
      }
      ENGINE.place(company, placements);
      CompanyState.Settlement s = ENGINE.settle(company, new HashSeededRandom(seed));
      sum += s.results.getFirst().pnl * 10_000 / s.results.getFirst().stake;
    }
    return sum / (double) trials;
  }
}
