package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 사기 (decisions.md 270번, #325). 연봉·연봉 협상·사표는 뺐다(383번). */
class PayEngineTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final CompanyEngine ENGINE =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);

  private static Map<String, Integer> stats(int value) {
    return Map.of(
        "insight", value, "patience", value, "courage", value, "conviction", value, "luck", value);
  }

  private static CompanyState company(long seed, long capital, int year) {
    CompanyState c = new CompanyState();
    c.number = 2;
    c.year = year;
    c.capital = capital;
    c.era = "plain";
    ENGINE.startYear(c, new HashSeededRandom(seed));
    return c;
  }

  /**
   * 인건비를 뺐다 (decisions.md 383번): 큰 회사도 분기마다 연봉이 나가지 않는다. 분기 실적은 시작 자본 + 직원들 + 수수료 − 인사 비용 = 끝 자본.
   */
  @Test
  void 큰_회사도_분기마다_연봉이_나가지_않는다() {
    CompanyState big = company(1, 3_000_000_000L, 1);
    CompanyState.Employee e = ENGINE.hire(big, stats(50));
    ENGINE.place(big, Map.of(e.id, "bio"));
    long before = big.capital;
    CompanyState.Quarter q = ENGINE.settleQuarter(big, new HashSeededRandom(1));
    assertThat(q.capitalBefore + q.staff + q.fee - q.hiring).isEqualTo(q.capitalAfter);
    assertThat(before).isEqualTo(q.capitalBefore);
  }

  /** 옛 저장 상태에 연봉 협상·사표·올려 준 횟수·인건비가 남아 있어도 읽힌다 (383번). */
  @Test
  void 옛_저장_상태의_연봉_협상과_사표는_무시하고_읽는다() {
    String old =
        """
        {"year": 3, "capital": 5000000000,
         "raise": {"employeeId": 1, "before": 100, "after": 110, "quarters": 1},
         "resign": {"employeeId": 1, "reason": "FROZEN", "year": 3, "quarter": 2},
         "employees": [{"id": 1, "name": "김촉", "raises": 2, "askedYear": 2,
                        "frozenPending": true, "morale": -1}],
         "quarters": [{"year": 3, "quarter": 1, "salary": 12345}],
         "settlements": [{"year": 2, "salary": 54321}]}
        """;
    CompanyState c = JsonMapper.builder().build().readValue(old, CompanyState.class);
    assertThat(c.year).isEqualTo(3);
    assertThat(c.employees).singleElement().satisfies(e -> assertThat(e.morale).isEqualTo(-1));
    assertThat(c.quarters).hasSize(1);
    assertThat(c.settlements).hasSize(1);
  }

  @Test
  void 사기가_낮으면_손이_더_뒤집히고_높으면_덜_뒤집힌다() {
    CompanyState c = company(3, 100_000_000L, 1);
    CompanyState.Employee e = ENGINE.hire(c, stats(40));
    ENGINE.place(c, Map.of(e.id, "bio"));
    int neutral = ENGINE.odds(c, e).flipBp();
    e.morale = -2;
    int low = ENGINE.odds(c, e).flipBp();
    e.morale = 2;
    int high = ENGINE.odds(c, e).flipBp();
    assertThat(low).isGreaterThan(neutral);
    assertThat(high).isLessThan(neutral);
  }

  @Test
  void 연말에_사기가_0_쪽으로_돌아오고_한_해_쉰_사람은_기운을_되찾는다() {
    CompanyState c = company(4, 100_000_000L, 1);
    CompanyState.Employee worker = ENGINE.hire(c, stats(50));
    CompanyState.Employee rester = ENGINE.hire(c, stats(50));
    worker.joinedYear = 0;
    rester.joinedYear = 0;
    ENGINE.place(c, Map.of(worker.id, "bio"));
    worker.morale = 2;
    rester.morale = -1;
    CompanyState.Settlement s = ENGINE.settle(c, new HashSeededRandom(4));
    assertThat(worker.morale).isLessThanOrEqualTo(1);
    assertThat(rester.morale).as("−1 → 0으로 돌아오고 쉬어서 +1").isEqualTo(1);
    assertThat(s.lines).anyMatch(l -> l.contains(rester.name) && l.contains("기운"));
  }

  private static int moraleAfter(String read, String choice, boolean up) {
    CompanyState c = company(1, 100_000_000L, 1);
    CompanyState.Employee e = ENGINE.hire(c, stats(50));
    int before = e.morale;
    CompanyState.Remark r = new CompanyState.Remark();
    r.employeeId = e.id;
    r.read = read;
    c.invest = new CompanyState.Invest();
    c.invest.remarks = List.of(r);
    c.invest.choice = choice;
    c.invest.up = up;
    ENGINE.pay.afterMeeting(c);
    return e.morale - before;
  }

  /** #338: 자기 말도 틀렸으면 서운하지 않다. 자기 말이 맞았는데 사장이 다르게 골랐을 때만 서운하다. */
  @Test
  void 자기_말이_맞았는데_안_들어_줬을_때만_서운하다() {
    // 사자고 했는데 사장은 지켜봤고, 내렸다: 둘 다 틀렸다
    assertThat(moraleAfter("UP", InvestEngine.HOLD, false)).isZero();
    // 사자고 했는데 사장은 지켜봤고, 올랐다: 직원 말이 맞았다
    assertThat(moraleAfter("UP", InvestEngine.HOLD, true)).isEqualTo(-1);
    // 사자고 했는데 사장은 팔았고, 내렸다: 사장이 맞았다
    assertThat(moraleAfter("UP", InvestEngine.SELL, false)).isZero();
    // 사자고 했고 사장도 샀고, 올랐다
    assertThat(moraleAfter("UP", InvestEngine.BUY, true)).isEqualTo(1);
  }

  @Test
  void 같은_소식은_한_줄로_묶고_횟수를_붙인다() {
    assertThat(CompanyEngine.grouped(List.of("가", "나", "가", "가"))).containsExactly("가 (3번)", "나");
  }
}
