package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import investorgame.raising.CompanyView;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 회의 팀 합산 등급 (decisions.md 353번, #400). */
class TeamGradeTest {

  private static final CompanyEngine ENGINE =
      new CompanyEngine(
          TestContent.load(),
          TestBehavior.create(),
          TestBehavior.bind("raising.company", CompanyProperties.class));

  private static Map<String, Integer> stats(int insight, int others) {
    return Map.of(
        "insight", insight,
        "patience", others,
        "courage", others,
        "conviction", others,
        "luck", others);
  }

  @Test
  void 앉은_사람이_없으면_없고_안목이_높을수록_종목_회의_등급이_오른다() {
    CompanyState c = ENGINE.open(new HashSeededRandom(1), 150_000_000L);
    assertThat(ENGINE.teamGrade.of(c, TeamGrade.INVEST)).isNull();
    CompanyState.Employee sharp = ENGINE.hire(c, stats(90, 40));
    ENGINE.place(c, Map.of(sharp.id, "day"));
    CompanyView.TeamGrade invest = ENGINE.teamGrade.of(c, TeamGrade.INVEST);
    CompanyView.TeamGrade macro = ENGINE.teamGrade.of(c, TeamGrade.MACRO);
    // 종목 회의는 안목이 절반: 90·40이면 65점(A). 거시경제 회의는 안목 35%라 57점(B).
    assertThat(invest.score()).isEqualTo(65);
    assertThat(invest.grade()).isEqualTo("A");
    assertThat(invest.members()).isEqualTo(1);
    assertThat(invest.hint()).contains("열에 일곱");
    assertThat(macro.score()).isLessThan(invest.score());
    assertThat(macro.grade()).isEqualTo("B");
  }

  @Test
  void 앉은_사람의_평균이고_잘하는_셋까지만_센다() {
    CompanyState c = ENGINE.open(new HashSeededRandom(2), 150_000_000L);
    CompanyState.Employee a = ENGINE.hire(c, stats(80, 80));
    CompanyState.Employee b = ENGINE.hire(c, stats(80, 80));
    ENGINE.place(c, Map.of(a.id, "day", b.id, "bio"));
    // 둘 다 제 자리의 팀장이라 +2.
    assertThat(ENGINE.teamGrade.of(c, TeamGrade.INVEST).score()).isEqualTo(82);
    // 자리는 셋(354번): 못하는 사람을 셋째로 앉히면 셋의 평균이라 내려간다(잘하는 셋까지만 센다).
    CompanyState.Employee weak = ENGINE.hire(c, stats(10, 10));
    ENGINE.place(c, Map.of(a.id, "day", b.id, "bio", weak.id, "semiconductor"));
    assertThat(ENGINE.teamGrade.of(c, TeamGrade.INVEST).score()).isEqualTo(59);
    assertThat(ENGINE.teamGrade.of(c, TeamGrade.INVEST).members()).isEqualTo(3);
    // 못하는 사람 둘뿐이면 그 둘의 평균이라 낮다.
    CompanyState low = ENGINE.open(new HashSeededRandom(3), 150_000_000L);
    CompanyState.Employee x = ENGINE.hire(low, stats(20, 20));
    CompanyState.Employee y = ENGINE.hire(low, stats(20, 20));
    ENGINE.place(low, Map.of(x.id, "day", y.id, "bio"));
    assertThat(ENGINE.teamGrade.of(low, TeamGrade.INVEST).grade()).isEqualTo("E");
  }

  @Test
  void 리서치_팀과_팀장_둘은_보너스다() {
    CompanyState c = ENGINE.open(new HashSeededRandom(4), 150_000_000L);
    CompanyState.Employee a = ENGINE.hire(c, stats(50, 50));
    ENGINE.place(c, Map.of(a.id, "day"));
    int alone = ENGINE.teamGrade.of(c, TeamGrade.INVEST).score();
    assertThat(alone).isEqualTo(50);
    CompanyState.Employee r = ENGINE.hire(c, stats(50, 50));
    ENGINE.place(c, Map.of(a.id, "day", r.id, "research"));
    // 리서치 팀 +4, 팀장이 둘(단타·리서치) +2.
    assertThat(ENGINE.teamGrade.of(c, TeamGrade.INVEST).score()).isEqualTo(56);
  }
}
