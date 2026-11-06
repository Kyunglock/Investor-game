package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 연봉과 사기 (decisions.md 270번, #325). */
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

  @Test
  void 작은_회사는_연봉이_없고_상가부터_분기마다_연봉이_나간다() {
    CompanyState small = company(1, 100_000_000L, 1);
    ENGINE.place(small, Map.of(ENGINE.hire(small, stats(50)).id, "bio"));
    assertThat(ENGINE.pay.salary(small, small.employees.getFirst())).isZero();

    CompanyState big = company(1, 3_000_000_000L, 1);
    CompanyState.Employee e = ENGINE.hire(big, stats(50));
    ENGINE.place(big, Map.of(e.id, "bio"));
    long salary = ENGINE.pay.salary(big, e);
    assertThat(salary).isPositive();
    long before = big.capital;
    CompanyState.Quarter q = ENGINE.settleQuarter(big, new HashSeededRandom(1));
    assertThat(q.salary).isEqualTo(salary / 4);
    assertThat(q.capitalBefore + q.staff + q.fee - q.salary - q.hiring).isEqualTo(q.capitalAfter);
    assertThat(before).isEqualTo(q.capitalBefore);
  }

  @Test
  void 연봉_협상에서_올려_주면_사기가_오르고_동결하면_꺾인다() {
    int asked = 0;
    for (int seed = 0; seed < 40; seed++) {
      CompanyState c = company(seed, 3_000_000_000L, 1);
      ENGINE.hire(c, stats(60));
      ENGINE.hire(c, stats(40));
      // 둘째 해부터 온다.
      assertThat(c.raise).isNull();
      ENGINE.settle(c, new HashSeededRandom(seed));
      if (c.raise == null) {
        continue;
      }
      asked++;
      CompanyState.Employee e =
          c.employees.stream().filter(x -> x.id == c.raise.employeeId).findFirst().orElseThrow();
      assertThat(c.raise.after).isGreaterThan(c.raise.before);
      assertThat(ENGINE.pay.raiseLine(c)).contains(e.name).doesNotContain("{");
      long before = ENGINE.pay.salary(c, e);
      int morale = e.morale;
      if (seed % 2 == 0) {
        ENGINE.pay.answer(c, true);
        assertThat(ENGINE.pay.salary(c, e)).isGreaterThan(before);
        assertThat(e.morale).isEqualTo(Math.min(2, morale + 1));
      } else {
        ENGINE.pay.answer(c, false);
        assertThat(ENGINE.pay.salary(c, e)).isEqualTo(before);
        assertThat(e.morale).isEqualTo(Math.max(-2, morale - 2));
      }
      assertThat(c.raise).isNull();
      assertThatThrownBy(() -> ENGINE.pay.answer(c, true))
          .isInstanceOf(InvalidRequestException.class);
    }
    assertThat(asked).isPositive();
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
    c.raise = null;
    CompanyState.Settlement s = ENGINE.settle(c, new HashSeededRandom(4));
    assertThat(worker.morale).isLessThanOrEqualTo(1);
    assertThat(rester.morale).as("−1 → 0으로 돌아오고 쉬어서 +1").isEqualTo(1);
    assertThat(s.lines).anyMatch(l -> l.contains(rester.name) && l.contains("기운"));
  }
}
