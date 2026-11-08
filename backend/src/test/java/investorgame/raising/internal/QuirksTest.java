package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** 직원 버릇 (decisions.md 349번, #395). 실제 콘텐츠로 돌린다. */
class QuirksTest {

  private static final CompanyEngine ENGINE =
      new CompanyEngine(
          TestContent.load(),
          TestBehavior.create(),
          TestBehavior.bind("raising.company", CompanyProperties.class));

  private static Map<String, Integer> stats(int value) {
    return Map.of(
        "insight", value, "patience", value, "courage", value, "conviction", value, "luck", value);
  }

  @Test
  void 버릇은_번호로_정해져_바뀌지_않고_다섯이_고루_나온다() {
    CompanyState c = ENGINE.open(new HashSeededRandom(1), 150_000_000L);
    Set<String> seen = new HashSet<>();
    for (int i = 0; i < 10; i++) {
      CompanyState.Employee e = ENGINE.hire(c, stats(50));
      String code = ENGINE.quirks.code(e);
      assertThat(ENGINE.quirks.code(e)).isEqualTo(code);
      assertThat(ENGINE.quirks.name(e)).isNotBlank();
      seen.add(code);
    }
    assertThat(seen).containsExactlyInAnyOrder("gut", "chat", "chart", "news", "coffee");
    // 이웃한 번호는 버릇이 다르다.
    assertThat(ENGINE.quirks.code(c.employees.get(0)))
        .isNotEqualTo(ENGINE.quirks.code(c.employees.get(1)));
  }

  @Test
  void 뽑히면_버릇대로_첫인사를_하고_자리표시가_남지_않는다() {
    CompanyState c = ENGINE.open(new HashSeededRandom(2), 150_000_000L);
    c.tickets = 5;
    ENGINE.draw(c, 5, new HashSeededRandom(2));
    assertThat(c.lastDraw).hasSize(5);
    for (CompanyState.Drawn d : c.lastDraw) {
      assertThat(d.hello).isNotBlank().doesNotContain("{").contains(d.name);
    }
  }
}
