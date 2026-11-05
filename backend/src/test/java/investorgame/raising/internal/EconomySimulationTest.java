package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.Arrays;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * 회사 경제의 맞춤 (증권사 육성 설계 5절 1번, decisions.md 226번). 첫 회사(1억 원, F)에 같은 능력치의 직원 둘을 맞는 자리(바이오·단타)에 앉히고 한
 * 시대(세 해)를 2,000번 돌려, 능력치에 따라 회사가 자라는 폭이 목표 안에 드는지 본다. 수치를 바꾸면 이 목표부터 다시 맞춘다.
 */
class EconomySimulationTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final CompanyEngine ENGINE =
      new CompanyEngine(
          TestContent.load(),
          TestBehavior.create(),
          PROPERTIES,
          TestBehavior.bind("raising", RaisingProperties.class));
  private static final long START = 100_000_000L;
  private static final long GRADE_E = 300_000_000L;
  private static final int TRIALS = 2000;

  private static Map<String, Integer> stats(int value) {
    return Map.of(
        "insight", value, "patience", value, "courage", value, "conviction", value, "luck", value);
  }

  /** 한 시대 뒤 자본 배수의 중앙값과 E(3억) 이상에 닿은 몫. */
  private static double[] era(int level) {
    double[] ratio = new double[TRIALS];
    int reachedE = 0;
    for (int seed = 0; seed < TRIALS; seed++) {
      CompanyState company = ENGINE.open(new HashSeededRandom(seed), stats(level), START);
      ENGINE.hire(company, stats(level));
      ENGINE.place(company, Map.of(1, "bio", 2, "day"));
      for (int year = 0; year < PROPERTIES.turns(); year++) {
        ENGINE.settle(company, new HashSeededRandom(seed));
      }
      ratio[seed] = company.capital / (double) START;
      if (company.capital >= GRADE_E) {
        reachedE++;
      }
    }
    Arrays.sort(ratio);
    return new double[] {ratio[TRIALS / 2], reachedE / (double) TRIALS};
  }

  @Test
  void 능력치가_좋을수록_한_시대에_회사가_크게_자란다() {
    double[] weak = era(30);
    double[] average = era(45);
    double[] good = era(60);
    double[] great = era(75);
    assertThat(weak[0]).as("E 직원: 제자리 안팎").isBetween(0.8, 1.4);
    assertThat(weak[1]).as("E 직원은 거의 못 오른다").isLessThan(0.1);
    assertThat(average[0]).as("C 직원: 세 해에 1.5~2배").isBetween(1.4, 2.1);
    assertThat(good[1]).as("A 직원: 셋에 하나쯤 E에 닿는다").isBetween(0.2, 0.55);
    assertThat(great[1]).as("S 직원: 대부분 E에 닿는다").isGreaterThan(0.6);
  }
}
