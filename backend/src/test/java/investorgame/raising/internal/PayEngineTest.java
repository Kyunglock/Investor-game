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
        ENGINE.pay.answer(c, true, new HashSeededRandom(seed));
        assertThat(ENGINE.pay.salary(c, e)).isGreaterThan(before);
        assertThat(e.morale).isEqualTo(Math.min(2, morale + 1));
      } else {
        ENGINE.pay.answer(c, false, new HashSeededRandom(seed));
        assertThat(ENGINE.pay.salary(c, e)).isEqualTo(before);
        assertThat(e.morale).isEqualTo(Math.max(-2, morale - 2));
      }
      assertThat(c.raise).isNull();
      assertThatThrownBy(() -> ENGINE.pay.answer(c, true, new HashSeededRandom(1)))
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

  /** 연봉이 없는 작은 회사(상가 아래)에서는 올려 달라고 하지 않는다 (#337: "0만 원 → 0만 원"). */
  @Test
  void 연봉이_없는_작은_회사에서는_협상이_오지_않는다() {
    for (int seed = 0; seed < 40; seed++) {
      CompanyState c = company(seed, 100_000_000L, 1);
      ENGINE.hire(c, stats(60));
      ENGINE.hire(c, stats(40));
      ENGINE.settle(c, new HashSeededRandom(seed));
      assertThat(c.raise).isNull();
    }
  }

  /** 올려 주면 raise-grow-percent(40%)로 능력치 하나가 한 띠 오른다 (decisions.md 280번). */
  @Test
  void 연봉을_올려_주면_확률로_능력치가_한_띠_오른다() {
    int grew = 0;
    int trials = 1000;
    for (int seed = 0; seed < trials; seed++) {
      CompanyState c = company(seed, 3_000_000_000L, 2);
      CompanyState.Employee e = ENGINE.hire(c, stats(40));
      ENGINE.place(c, Map.of(e.id, "bio"));
      c.raise = new CompanyState.Raise();
      c.raise.employeeId = e.id;
      int before = e.stats.get("patience");
      ENGINE.pay.answer(c, true, new HashSeededRandom(seed));
      int after = e.stats.get("patience");
      if (after > before) {
        grew++;
        assertThat(after).as("바이오 데스크는 인내심이 오른다").isEqualTo(before + 10);
        assertThat(c.yearLines).anyMatch(l -> l.contains("힘을 냈다") && l.contains("인내심"));
      }
    }
    assertThat(grew).isBetween(trials * 34 / 100, trials * 46 / 100);
  }

  /** 동결하면 다음 분기를 넘길 때 freeze-leave-percent(25%)로 떠난다 (280번). */
  @Test
  void 연봉을_동결하면_다음_분기에_확률로_떠난다() {
    int left = 0;
    int trials = 1000;
    for (int seed = 0; seed < trials; seed++) {
      CompanyState c = company(seed, 3_000_000_000L, 2);
      CompanyState.Employee e = ENGINE.hire(c, stats(40));
      ENGINE.place(c, Map.of(e.id, "bio"));
      c.raise = new CompanyState.Raise();
      c.raise.employeeId = e.id;
      ENGINE.pay.answer(c, false, new HashSeededRandom(seed));
      assertThat(e.frozenPending).isTrue();
      CompanyState.Quarter q = ENGINE.settleQuarter(c, new HashSeededRandom(seed));
      assertThat(e.frozenPending).as("한 번만 굴린다").isFalse();
      if (c.employees.isEmpty()) {
        left++;
        assertThat(q.lines).anyMatch(l -> l.contains("연봉 동결에 실망해 회사를 떠났다"));
        assertThat(c.timeline).anyMatch(x -> "left".equals(x.kind));
      }
    }
    assertThat(left).isBetween(trials * 20 / 100, trials * 30 / 100);
  }

  /** 답하지 않으면 ignore-quarters(2) 분기부터 분기마다 ignore-leave-percent(30%)로 떠난다 (280번). */
  @Test
  void 연봉_협상에_답하지_않고_버티면_두_분기째부터_떠날_수_있다() {
    int left = 0;
    int trials = 1000;
    for (int seed = 0; seed < trials; seed++) {
      CompanyState c = company(seed, 3_000_000_000L, 2);
      CompanyState.Employee e = ENGINE.hire(c, stats(40));
      ENGINE.place(c, Map.of(e.id, "bio"));
      c.raise = new CompanyState.Raise();
      c.raise.employeeId = e.id;
      ENGINE.settleQuarter(c, new HashSeededRandom(seed));
      assertThat(c.employees).as("첫 분기에는 떠나지 않는다").hasSize(1);
      assertThat(c.raise.quarters).isEqualTo(1);
      CompanyState.Quarter q = ENGINE.settleQuarter(c, new HashSeededRandom(seed));
      if (c.employees.isEmpty()) {
        left++;
        assertThat(c.raise).isNull();
        assertThat(q.lines).anyMatch(l -> l.contains("기다리다 지쳐 회사를 떠났다"));
      }
    }
    assertThat(left).isBetween(trials * 25 / 100, trials * 36 / 100);
    assertThat(ENGINE.pay.raiseOdds())
        .contains("40%")
        .contains("25%")
        .contains("2분기")
        .contains("30%");
  }
}
