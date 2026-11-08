package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 턴 하나가 한 분기다 (decisions.md 268번, #330). 실제 콘텐츠와 application.yml 수치로 돌린다. */
class QuarterTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final CompanyEngine ENGINE =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);

  private static Map<String, Integer> stats(int value) {
    return Map.of(
        "insight", value, "patience", value, "courage", value, "conviction", value, "luck", value);
  }

  private static CompanyState company(long seed, long capital) {
    CompanyState company = new CompanyState();
    company.number = 2;
    company.capital = capital;
    company.era = "plain";
    ENGINE.startYear(company, new HashSeededRandom(seed));
    ENGINE.hire(company, stats(50));
    ENGINE.hire(company, stats(50));
    ENGINE.place(company, Map.of(1, "bio", 2, "day"));
    return company;
  }

  @Test
  void 분기마다_판단_하나와_수수료_4분의_1이_들어오고_네_분기를_넘기면_연말_결산이다() {
    for (int seed = 0; seed < 30; seed++) {
      CompanyState c = company(seed, 150_000_000L);
      for (int quarter = 1; quarter <= 4; quarter++) {
        assertThat(c.year).isEqualTo(1);
        assertThat(c.quarter).isEqualTo(quarter);
        long before = c.capital;
        long base = ENGINE.stakeBase(c);
        CompanyState.Quarter q = ENGINE.settleQuarter(c, new HashSeededRandom(seed));
        assertThat(q.quarter).isEqualTo(quarter);
        assertThat(q.capitalBefore).isEqualTo(before);
        assertThat(q.results).hasSize(2);
        if (q.capitalAfter > 0) {
          assertThat(q.capitalBefore + q.staff + q.fee - q.hiring).isEqualTo(q.capitalAfter);
        }
        for (CompanyState.Result r : q.results) {
          int flips = r.flips.values().stream().mapToInt(Integer::intValue).sum();
          assertThat(flips).as("분기마다 판단 하나").isLessThanOrEqualTo(1);
        }
        assertThat(q.fee).isEqualTo((long) (base * PROPERTIES.feeBp() / 10_000.0 / 4));
        if (quarter < 4) {
          // 자본은 분기마다 바뀌어도 등급·자리 수는 연말에만 바뀐다.
          assertThat(ENGINE.seats(c)).isEqualTo(ENGINE.seats(150_000_000L));
          assertThat(c.settlements).isEmpty();
        }
      }
      assertThat(c.year).isEqualTo(2);
      assertThat(c.quarter).isEqualTo(1);
      CompanyState.Settlement s = c.settlements.getLast();
      assertThat(s.quarters).hasSize(4);
      long staff = s.quarters.stream().mapToLong(q -> q.staff).sum();
      assertThat(s.results.stream().mapToLong(r -> r.pnl).sum()).isEqualTo(staff);
      assertThat(s.fee).isEqualTo(s.quarters.stream().mapToLong(q -> q.fee).sum());
      assertThat(s.capitalAfter).isEqualTo(s.quarters.getLast().capitalAfter);
      // 건물은 저절로 오르지 않고(296번), 지은 건물은 자본이 줄어도 그대로다(#347).
      assertThat(s.gradeAfter).isEqualTo(s.gradeBefore);
      assertThat(c.quarters).as("해가 바뀌면 비운다").isEmpty();
    }
  }

  @Test
  void 폭락은_한_분기에_터진다() {
    int crashes = 0;
    for (int seed = 0; seed < 400; seed++) {
      CompanyState c = company(seed, 150_000_000L);
      if (!CompanyEngine.CRASH.equals(c.phase)) {
        continue;
      }
      crashes++;
      int burst = c.crashQuarter;
      assertThat(burst).isBetween(2, 4);
      for (int quarter = 1; quarter <= 4; quarter++) {
        CompanyState.Quarter q = ENGINE.settleQuarter(c, new HashSeededRandom(seed));
        assertThat(q.crash).isEqualTo(quarter == burst);
      }
      assertThat(c.settlements.getLast().lines).anyMatch(l -> l.contains(burst + "분기"));
    }
    assertThat(crashes).isPositive();
  }

  @Test
  void 넘긴_분기가_한_해_합계에_모인다_같은_시드면_같다() {
    CompanyState a = company(7, 300_000_000L);
    CompanyState b = company(7, 300_000_000L);
    CompanyState.Settlement sa = ENGINE.settle(a, new HashSeededRandom(7));
    CompanyState.Settlement sb = ENGINE.settle(b, new HashSeededRandom(7));
    assertThat(sa.capitalAfter).isEqualTo(sb.capitalAfter);
    assertThat(sa.quarters).hasSize(4);
  }
}
