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

  @Test
  void 분기와_연말마다_팀장이_팀_손익과_한_일을_보고한다() {
    for (int seed = 0; seed < 20; seed++) {
      CompanyState c = company(seed);
      CompanyState.Quarter q = ENGINE.settleQuarter(c, new HashSeededRandom(seed));
      assertThat(q.reports).extracting(r -> r.desk).containsExactly("semiconductor", "research");
      CompanyState.Report trading = q.reports.getFirst();
      assertThat(trading.leader).isEqualTo(c.employees.get(1).name);
      assertThat(trading.pnl).isEqualTo(q.staff);
      assertThat(trading.text).contains("이번 분기").doesNotContain("{");
      assertThat(q.reports.get(1).pnl).as("돕는 팀은 손익이 없다").isNull();
      CompanyState.Settlement s = ENGINE.settle(c, new HashSeededRandom(seed));
      assertThat(s.reports).isNotEmpty();
      assertThat(s.reports.getFirst().text).contains("올해");
      assertThat(s.reports.getFirst().pnl)
          .isEqualTo(s.results.stream().mapToLong(r -> r.pnl).sum());
    }
  }

  /** 돕는 자리는 그 기간에 한 일을 보고한다 (decisions.md 278번). 전에는 "이번 분기도 다른 데스크에 형광펜을 빌려줬습니다"처럼 늘 같은 빈말이었다. */
  @Test
  void 리서치_팀은_형광펜이_결정적_문장을_짚은_횟수를_보고한다() {
    CompanyState idle = company(1);
    CompanyState.Quarter none = ENGINE.settleQuarter(idle, new HashSeededRandom(1));
    assertThat(none.highlightChances).as("회의를 열지 않고 넘겼다").isZero();
    assertThat(none.reports.get(1).text).isEqualTo("이번 분기에는 형광펜을 그을 회의가 없었습니다.");

    for (int seed = 0; seed < 20; seed++) {
      CompanyState c = company(seed);
      ENGINE.macro.convene(c, new HashSeededRandom(seed));
      // 분기를 넘기면 다음 분기 회의로 바뀌므로 그은 문장을 먼저 본다.
      Integer at = c.macro.highlightIndex;
      int expected = at != null && c.macro.sentences.get(at).decisive ? 1 : 0;
      CompanyState.Quarter q = ENGINE.settleQuarter(c, new HashSeededRandom(seed));
      assertThat(q.highlightChances).isEqualTo(1);
      String text = q.reports.get(1).text;
      assertThat(q.highlights).isEqualTo(at == null ? 0 : 1);
      if (q.highlights == 0) {
        assertThat(text).startsWith("이번 분기에는 기사 방향을 못 읽어 형광펜을 긋지 못했습니다.");
      } else {
        // 다 맞았으면 뿌듯하게, 하나도 못 맞혔으면 면목 없게 (290번).
        assertThat(text)
            .startsWith(
                q.highlightHits == 1
                    ? "이번 분기 형광펜을 1번 그었고, 1번 모두 결정적 문장을 짚었습니다."
                    : "이번 분기 형광펜을 1번 그었는데, 한 번도 결정적 문장을 짚지 못했습니다.");
        assertThat(q.highlightHits).isEqualTo(expected);
      }
      assertThat(text).doesNotContain("빌려줬");
    }
  }

  @Test
  void 종목_발굴팀은_가져온_종목의_오르내림을_보고한다() {
    CompanyState c = new CompanyState();
    c.number = 2;
    c.capital = 600_000_000L;
    c.era = "plain";
    ENGINE.startYear(c, new HashSeededRandom(1));
    ENGINE.hire(c, stats(50));
    ENGINE.hire(c, stats(50));
    ENGINE.place(c, Map.of(1, "semiconductor", 2, MacroEngine.SCOUT_DESK));
    CompanyState.Quarter up = new CompanyState.Quarter();
    up.scoutStock = "삼송바이오";
    up.scoutUp = true;
    up.scoutPercent = 24;
    CompanyState.Quarter down = new CompanyState.Quarter();
    down.scoutStock = "넥손게임즈";
    down.scoutUp = false;
    down.scoutPercent = 35;
    CompanyState.Quarter quiet = new CompanyState.Quarter();

    assertThat(scoutLine(c, java.util.List.of(up), "이번 분기"))
        .startsWith("이번 분기 삼송바이오를 물어 왔고, 회의 뒤 24% 올랐습니다.");
    assertThat(scoutLine(c, java.util.List.of(down), "이번 분기"))
        .startsWith("이번 분기 넥손게임즈를 물어 왔는데, 35% 빠졌습니다.");
    assertThat(scoutLine(c, java.util.List.of(quiet), "이번 분기"))
        .startsWith("이번 분기에는 물어 올 만한 종목이 없었습니다.");
    assertThat(scoutLine(c, java.util.List.of(up, quiet, down), "올해"))
        .isEqualTo("올해 종목 2개를 물어 와 1개가 올랐습니다.");
  }

  /** 돈을 굴리는 팀의 보고 (290번): 손익 크기·폭락·태도로 고른 머리줄, 팀원 성적, 뒤집힘 횟수, 조언. */
  @Test
  void 돈을_굴리는_팀장은_크기와_폭락과_태도와_팀원과_뒤집힘_횟수까지_보고한다() {
    CompanyState c = company(1);
    Employee weak = c.employees.get(0);
    Employee head = c.employees.get(1);
    CompanyState.Result a = result(weak, 100_000_000L, -30_000_000L);
    a.flips.put("patience", 2);
    CompanyState.Result b = result(head, 100_000_000L, -10_000_000L);
    b.flips.put("courage", 1);
    CompanyState.Quarter crashed = new CompanyState.Quarter();
    crashed.crash = true;
    crashed.macroStance = "DEFENSIVE";

    String text = trading(c, java.util.List.of(a, b), java.util.List.of(crashed), "올해");
    assertThat(text)
        .as("폭락장에서 잃은 머리줄")
        .containsAnyOf("폭락이 터져 올해 4,000만 원 잃었습니다.", "올해 폭락장에서 −4,000만 원입니다.")
        .as("방어 태도의 한마디")
        .contains("판돈을 줄여 둔 덕에 이 정도로 막았습니다.")
        .as("가장 크게 잃은 팀원")
        .contains(weak.name + "은 3,000만 원 잃었습니다. 제가 옆에서 더 챙기겠습니다.")
        .as("뒤집힘 횟수")
        .contains(weak.name + "이 못 참고 두 번 바닥에서 던졌습니다.")
        .contains("저도 손이 떨려 한 번 놓쳤습니다.")
        .as("가장 잦았던 뒤집힘의 조언")
        .contains("폭락장에서 버티는 건 인내심입니다.")
        .doesNotContain("{");

    // 크게 벌고 공격했으면: 판돈 15% 이상이 크게다. 팀장 자신이 가장 많이 벌었다.
    CompanyState.Result big = result(head, 100_000_000L, 20_000_000L);
    CompanyState.Result small = result(weak, 100_000_000L, 5_000_000L);
    CompanyState.Quarter boom = new CompanyState.Quarter();
    boom.macroStance = "AGGRESSIVE";
    String won = trading(c, java.util.List.of(small, big), java.util.List.of(boom), "이번 분기");
    assertThat(won)
        .contains("2,500만 원")
        .contains("판돈을 키운 게 맞았습니다.")
        .contains("제가 2,000만 원으로 팀을 끌었습니다.")
        .doesNotContain("잃었습니다");
    assertThat(texts().trading().get("bigUp").stream().map(l -> l.split("\\{")[0]))
        .anyMatch(won::startsWith);

    // 중립·본전이면 태도와 팀원 줄이 없다. 다섯 번 넘게 뒤집히면 숫자로 읽는다.
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
        .filter(r -> MacroEngine.SCOUT_DESK.equals(r.desk))
        .findFirst()
        .orElseThrow()
        .text;
  }
}
