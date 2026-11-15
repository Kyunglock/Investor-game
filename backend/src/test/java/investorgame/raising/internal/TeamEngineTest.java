package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.content.internal.TestContent;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 팀장과 팀장 보고 (decisions.md 269번). */
class TeamEngineTest {

  private static final CompanyEngine ENGINE =
      new CompanyEngine(
          TestContent.load(),
          TestBehavior.create(),
          TestBehavior.bind("raising.company", CompanyProperties.class));

  private static Map<String, Integer> stats(int value) {
    return Map.of(
        "insight", value, "patience", value, "courage", value, "conviction", value, "luck", value);
  }

  /** 반도체 데스크에 둘(약한 1번, 강한 2번), 리서치 팀에 하나. */
  private static CompanyState company(long seed) {
    CompanyState c = new CompanyState();
    c.number = 2;
    c.capital = 600_000_000L;
    c.era = "plain";
    ENGINE.begin(c);
    ENGINE.hire(c, stats(30));
    ENGINE.hire(c, stats(70));
    ENGINE.hire(c, stats(50));
    ENGINE.place(c, Map.of(1, "semiconductor", 2, "semiconductor", 3, "research"));
    return c;
  }

  @Test
  void 자리마다_종합_등급이_가장_높은_사람이_팀장이고_사장이_바꿀_수_있다() {
    CompanyState c = company(1);
    assertThat(ENGINE.teams.leaderOf(c, "semiconductor")).get().extracting(e -> e.id).isEqualTo(2);
    assertThat(ENGINE.teams.leaderOf(c, "research")).get().extracting(e -> e.id).isEqualTo(3);
    assertThat(ENGINE.teams.leaderOf(c, "bio")).isEmpty();

    ENGINE.teams.appoint(c, "semiconductor", 1);
    assertThat(ENGINE.teams.leaderOf(c, "semiconductor")).get().extracting(e -> e.id).isEqualTo(1);
    assertThatThrownBy(() -> ENGINE.teams.appoint(c, "semiconductor", 3))
        .as("그 자리에 앉은 사람만")
        .isInstanceOf(InvalidRequestException.class);

    // 정한 팀장이 자리를 떠나면 지정이 풀리고, 돌아와도 다시 정하기 전에는 팀장이 아니다.
    ENGINE.place(c, Map.of(1, "bio", 2, "semiconductor", 3, "research"));
    ENGINE.place(c, Map.of(1, "semiconductor", 2, "semiconductor", 3, "research"));
    assertThat(ENGINE.teams.leaderOf(c, "semiconductor")).get().extracting(e -> e.id).isEqualTo(2);
  }
}
