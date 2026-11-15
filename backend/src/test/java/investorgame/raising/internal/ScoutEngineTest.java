package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * 종목 발굴 (decisions.md 267번): 종목회의를 열 때 직원이 종목을 물어 온다. 기회를 쓴 회의는 꼭 열린다 (523번). 실제 콘텐츠와
 * application.yml 수치로 돌린다.
 */
class ScoutEngineTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final CompanyEngine ENGINE =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);

  private static Map<String, Integer> stats(int insight) {
    return Map.of("insight", insight, "patience", 60, "courage", 60, "conviction", 60, "luck", 50);
  }

  /** 회의를 준비만 해 둔 회사: 아직 아무도 물어 오지 않았다. */
  private static CompanyState prepared(long seed) {
    HashSeededRandom random = new HashSeededRandom(seed);
    CompanyState c = ENGINE.open(random, 1_000_000_000_000L);
    c.building = ENGINE.grade((long) c.capital);
    c.meetings = 1;
    c.invest = ENGINE.invest.create(c, random);
    return c;
  }

  @Test
  void 돈을_굴리는_사람이_없으면_아무도_물어_오지_않는다() {
    CompanyState c = prepared(3);
    ENGINE.hire(c, stats(90));
    ENGINE.place(c, Map.of(1, "scout"));
    ENGINE.scout.discover(c, new HashSeededRandom(3));
    assertThat(c.invest.found).isFalse();
    assertThat(ENGINE.invest.open(c)).isFalse();
  }

  @Test
  void 종목_발굴팀_직원이_종목을_물어_오고_직함으로_불린다() {
    CompanyState c = prepared(5);
    ENGINE.hire(c, stats(60));
    ENGINE.hire(c, stats(95));
    ENGINE.place(c, Map.of(1, "day", 2, "scout"));
    ENGINE.scout.discover(c, new HashSeededRandom(5));
    assertThat(c.invest.found).isTrue();
    assertThat(c.invest.finderId).isEqualTo(2);
    assertThat(c.invest.finderDesk).isEqualTo("scout");
    assertThat(c.invest.finderRole).isNotBlank();
    assertThat(c.invest.pitch).isNotBlank();
    assertThat(ENGINE.invest.open(c)).isTrue();
  }

  @Test
  void 발굴_담당이_없어도_돈을_굴리는_직원이_꼭_하나_물어_온다() {
    for (long seed = 0; seed < 50; seed++) {
      CompanyState c = prepared(seed);
      ENGINE.hire(c, stats(40));
      ENGINE.hire(c, stats(40));
      ENGINE.place(c, Map.of(1, "day", 2, "bio"));
      ENGINE.scout.discover(c, new HashSeededRandom(seed));
      assertThat(c.invest.found).as("seed " + seed).isTrue();
      assertThat(c.invest.finderId).isIn(1, 2);
    }
  }

  @Test
  void 발굴팀이_굴려서_못_찾아도_안목이_가장_높은_발굴_담당이_가져온다() {
    int seen = 0;
    for (long seed = 0; seed < 200; seed++) {
      CompanyState c = prepared(seed);
      ENGINE.hire(c, stats(50));
      ENGINE.hire(c, stats(1));
      ENGINE.hire(c, stats(5));
      ENGINE.place(c, Map.of(1, "day", 2, "scout", 3, "scout"));
      ENGINE.scout.discover(c, new HashSeededRandom(seed));
      assertThat(c.invest.found).isTrue();
      seen++;
    }
    assertThat(seen).isEqualTo(200);
  }

  @Test
  void 안목이_높은_사람이_가져온_종목이_더_자주_오른다() {
    int high = 0;
    int low = 0;
    for (long seed = 0; seed < 400; seed++) {
      high += up(seed, 95) ? 1 : 0;
      low += up(seed, 5) ? 1 : 0;
    }
    assertThat(high).isGreaterThan(low);
  }

  private static boolean up(long seed, int insight) {
    CompanyState c = prepared(seed);
    ENGINE.hire(c, stats(60));
    ENGINE.hire(c, stats(insight));
    ENGINE.place(c, Map.of(1, "day", 2, "scout"));
    ENGINE.scout.discover(c, new HashSeededRandom(seed));
    return c.invest.up;
  }
}
