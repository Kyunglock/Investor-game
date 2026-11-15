package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import investorgame.raising.internal.CompanyState.Employee;
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
    ENGINE.startYear(c, new HashSeededRandom(seed));
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

  /** 돈을 굴리는 팀의 보고 (291번): 손익 크기·폭락·태도로 고른 머리줄, 팀원 성적, 뒤집힘 횟수, 조언. */
  @Test
  void 돈을_굴리는_팀장은_크기와_폭락과_팀원과_뒤집힘_횟수까지_보고한다() {
    CompanyState c = company(1);
    Employee weak = c.employees.get(0);
    Employee head = c.employees.get(1);
    CompanyState.Result a = result(weak, 100_000_000L, -30_000_000L);
    a.flips.put("patience", 2);
    CompanyState.Result b = result(head, 100_000_000L, -10_000_000L);
    b.flips.put("courage", 1);
    CompanyState.Quarter crashed = new CompanyState.Quarter();
    crashed.crash = true;

    String text = trading(c, java.util.List.of(a, b), java.util.List.of(crashed), "올해");
    assertThat(text)
        .as("폭락장에서 잃은 머리줄")
        .containsAnyOf("폭락이 터져 올해 40b 잃었습니다.", "올해 폭락장에서 −40b입니다.")
        .as("가장 크게 잃은 팀원")
        .contains(weak.name + "은 30b 잃었습니다. 제가 옆에서 더 챙기겠습니다.")
        .as("뒤집힘 횟수")
        .contains(weak.name + "이 못 참고 두 번 바닥에서 던졌습니다.")
        .contains("저도 손이 떨려 한 번 놓쳤습니다.")
        .as("가장 잦았던 뒤집힘의 조언")
        .contains("폭락장에서 버티는 건 인내심입니다.")
        .doesNotContain("{");

    // 크게 벌었으면: 판돈 15% 이상이 크게다. 팀장 자신이 가장 많이 벌었다. 태도 한마디는 뺐다 (382번).
    CompanyState.Result big = result(head, 100_000_000L, 20_000_000L);
    CompanyState.Result small = result(weak, 100_000_000L, 5_000_000L);
    CompanyState.Quarter boom = new CompanyState.Quarter();
    String won = trading(c, java.util.List.of(small, big), java.util.List.of(boom), "이번 분기");
    assertThat(won)
        .contains("25b")
        .doesNotContain("판돈")
        .contains("제가 20b로 팀을 끌었습니다.")
        .doesNotContain("잃었습니다");
    assertThat(texts().trading().get("bigUp").stream().map(l -> l.split("\\{")[0]))
        .anyMatch(won::startsWith);

    // 본전이면 팀원 줄이 없다. 다섯 번 넘게 뒤집히면 숫자로 읽는다.
    CompanyState.Result even = result(head, 100_000_000L, 0);
    even.flips.put("conviction", 5);
    String flat =
        trading(c, java.util.List.of(even), java.util.List.of(new CompanyState.Quarter()), "올해");
    assertThat(flat).startsWith("올해는 ").contains("저도 단톡방 말에 5번 흔들렸습니다.").doesNotContain("판돈");
  }

  private static investorgame.content.RaisingContent.Teams texts() {
    return TestContent.load().raising().company().teams();
  }

  private static CompanyState.Result result(Employee e, long stake, long pnl) {
    CompanyState.Result r = new CompanyState.Result();
    r.employeeId = e.id;
    r.name = e.name;
    r.desk = "semiconductor";
    r.stake = stake;
    r.pnl = pnl;
    return r;
  }

  private static String trading(
      CompanyState c,
      java.util.List<CompanyState.Result> results,
      java.util.List<CompanyState.Quarter> quarters,
      String period) {
    return ENGINE.teams.reports(c, results, quarters, period, 1).stream()
        .filter(r -> "semiconductor".equals(r.desk))
        .findFirst()
        .orElseThrow()
        .text;
  }

  private static String scoutLine(
      CompanyState c, java.util.List<CompanyState.Quarter> quarters, String period) {
    return ENGINE.teams.reports(c, java.util.List.of(), quarters, period, 1).stream()
        .filter(r -> ScoutEngine.SCOUT_DESK.equals(r.desk))
        .findFirst()
        .orElseThrow()
        .text;
  }
}
