package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 거시경제 회의와 종목 발굴 (decisions.md 266·267번, #329). 실제 콘텐츠와 application.yml 수치로 돌린다. */
class MacroEngineTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final CompanyEngine ENGINE =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);

  private static Map<String, Integer> stats(int insight) {
    return Map.of("insight", insight, "patience", 60, "courage", 60, "conviction", 60, "luck", 50);
  }

  /** 2호 회사로 연다: 첫 회사의 첫해에는 꼭 누가 종목을 물어 온다(267번). */
  private static CompanyState second(long seed) {
    CompanyState company = new CompanyState();
    company.number = 2;
    company.capital = 100_000_000L;
    company.era = "plain";
    ENGINE.startYear(company, new HashSeededRandom(seed));
    return company;
  }

  @Test
  void 해마다_거시경제_회의가_오고_숨은_방향은_호황이면_오름_폭락장이면_내림이다() {
    int omens = 0;
    for (int seed = 0; seed < 300; seed++) {
      CompanyState c = second(seed);
      CompanyState.Macro macro = c.macro;
      assertThat(macro).isNotNull();
      assertThat(macro.stance).isNull();
      assertThat(macro.sentences.stream().filter(s -> s.decisive)).hasSize(1);
      if ("boom".equals(c.phase)) {
        assertThat(macro.up).isTrue();
      }
      if (CompanyEngine.CRASH.equals(c.phase)) {
        assertThat(macro.up).isFalse();
      }
      // 연초 회의의 폭락 조짐은 거시경제 기사로도 옮긴다.
      if (c.omen != null) {
        omens++;
        assertThat(macro.sentences).anyMatch(s -> s.omen && s.text.equals(c.omen));
      } else {
        assertThat(macro.sentences).noneMatch(s -> s.omen);
      }
      CompanyState again = second(seed);
      assertThat(again.macro.topic).isEqualTo(macro.topic);
      assertThat(again.macro.up).isEqualTo(macro.up);
    }
    assertThat(omens).isPositive();
  }

  @Test
  void 공격은_판돈을_키우고_방어는_줄인다() {
    for (int seed = 0; seed < 20; seed++) {
      long[] stakes = new long[3];
      int i = 0;
      for (String stance : MacroEngine.STANCES) {
        CompanyState c = second(seed);
        ENGINE.hire(c, stats(60));
        ENGINE.place(c, Map.of(1, "bio"));
        ENGINE.macro.decide(c, stance, new HashSeededRandom(seed));
        if (ENGINE.invest.open(c)) {
          ENGINE.invest.decide(c, InvestEngine.HOLD, new HashSeededRandom(seed));
        }
        CompanyState.Settlement s = ENGINE.settle(c, new HashSeededRandom(seed));
        stakes[i++] = s.results.getFirst().stake;
        assertThat(s.macroStance).isEqualTo(stance);
        assertThat(s.macroLines).hasSize(3);
      }
      assertThat(stakes[0]).isEqualTo(stakes[1] * 130 / 100);
      assertThat(stakes[2]).isEqualTo(stakes[1] * 80 / 100);
    }
  }

  @Test
  void 고르지_않고_결산하면_중립이고_종목은_아무도_물어_오지_않는다() {
    CompanyState c = second(3);
    ENGINE.hire(c, stats(60));
    ENGINE.place(c, Map.of(1, "bio"));
    assertThat(ENGINE.invest.open(c)).as("물어 오기 전에는 종목 회의가 없다").isFalse();
    assertThatThrownBy(() -> ENGINE.invest.decide(c, InvestEngine.BUY, new HashSeededRandom(3)))
        .isInstanceOf(InvalidRequestException.class);
    CompanyState.Settlement s = ENGINE.settle(c, new HashSeededRandom(3));
    assertThat(s.macroStance).isEqualTo(MacroEngine.NEUTRAL);
    assertThat(s.investTitle).isNull();
  }

  @Test
  void 한_해에_한_번_고르고_없는_태도는_못_고르고_돈을_굴리는_사람이_없으면_열지_못한다() {
    CompanyState empty = second(1);
    assertThat(ENGINE.macro.open(empty)).isFalse();
    assertThatThrownBy(() -> ENGINE.macro.convene(empty, new HashSeededRandom(1)))
        .isInstanceOf(InvalidRequestException.class);

    CompanyState c = second(1);
    ENGINE.hire(c, stats(60));
    ENGINE.place(c, Map.of(1, "bio"));
    assertThatThrownBy(() -> ENGINE.macro.decide(c, "ALL_IN", new HashSeededRandom(1)))
        .isInstanceOf(InvalidRequestException.class);
    ENGINE.macro.decide(c, MacroEngine.DEFENSIVE, new HashSeededRandom(1));
    assertThat(c.macro.remarks).as("바로 골라도 연 셈 친다").hasSize(1);
    assertThatThrownBy(
            () -> ENGINE.macro.decide(c, MacroEngine.AGGRESSIVE, new HashSeededRandom(1)))
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 회의를_열면_한마디가_굳어_배치를_바꿔도_그대로다() {
    CompanyState c = second(4);
    ENGINE.hire(c, stats(20));
    ENGINE.hire(c, stats(90));
    ENGINE.place(c, Map.of(1, "bio"));
    ENGINE.macro.convene(c, new HashSeededRandom(4));
    assertThat(c.macro.remarks).hasSize(1);
    String said = c.macro.remarks.getFirst().text;
    ENGINE.place(c, Map.of(1, "bio", 2, "research"));
    ENGINE.macro.convene(c, new HashSeededRandom(4));
    assertThat(c.macro.remarks).hasSize(1);
    assertThat(c.macro.remarks.getFirst().text).isEqualTo(said);
    assertThat(said).doesNotContain("{");
  }

  @Test
  void 순풍_자리는_더_벌고_역풍_자리는_덜_번다() {
    CompanyState c = second(5);
    String side = c.macro.up ? "UP" : "DOWN";
    var wind = ENGINE.macro.topic(c.macro).winds().get(side);
    for (String desk : wind.tail()) {
      assertThat(ENGINE.macro.windBp(c, desk)).isEqualTo(PROPERTIES.macro().windBp());
    }
    for (String desk : wind.head()) {
      assertThat(ENGINE.macro.windBp(c, desk)).isEqualTo(-PROPERTIES.macro().windBp());
    }
    assertThat(ENGINE.macro.windBp(c, "day")).isZero();
  }

  @Test
  void 방어로_돌리면_폭락장에_덜_빠진다() {
    int trials = 0;
    long neutral = 0;
    long defensive = 0;
    for (int seed = 0; seed < 400 && trials < 40; seed++) {
      CompanyState probe = second(seed);
      if (!CompanyEngine.CRASH.equals(probe.phase)) {
        continue;
      }
      trials++;
      for (String stance : new String[] {MacroEngine.NEUTRAL, MacroEngine.DEFENSIVE}) {
        CompanyState c = second(seed);
        // 폭락장에 잃는 약한 직원: 판돈이 줄어든 만큼, 시장 손익이 줄어든 만큼 덜 잃는다.
        ENGINE.hire(
            c, Map.of("insight", 20, "patience", 20, "courage", 20, "conviction", 20, "luck", 20));
        ENGINE.place(c, Map.of(1, "bio"));
        ENGINE.macro.decide(c, stance, new HashSeededRandom(seed));
        if (ENGINE.invest.open(c)) {
          ENGINE.invest.decide(c, InvestEngine.HOLD, new HashSeededRandom(seed));
        }
        long pnl = ENGINE.settle(c, new HashSeededRandom(seed)).results.getFirst().pnl;
        if (stance.equals(MacroEngine.NEUTRAL)) {
          neutral += pnl;
        } else {
          defensive += pnl;
        }
      }
    }
    assertThat(trials).isPositive();
    assertThat(defensive).isGreaterThan(neutral);
  }

  @Test
  void 종목_발굴팀_직원이_종목을_물어_오고_직함으로_불린다() {
    int found = 0;
    int trials = 200;
    for (int seed = 0; seed < trials; seed++) {
      CompanyState c = second(seed);
      ENGINE.hire(c, stats(90));
      ENGINE.hire(c, stats(90));
      ENGINE.place(c, Map.of(1, "bio", 2, "scout"));
      ENGINE.macro.decide(c, MacroEngine.NEUTRAL, new HashSeededRandom(seed));
      if (Boolean.TRUE.equals(c.invest.found)) {
        found++;
        assertThat(ENGINE.invest.open(c)).isTrue();
        if (c.invest.finderId == 2) {
          assertThat(c.invest.finderRole).as("종합 A면 직함 가운데").isEqualTo("종목 발굴 담당");
          assertThat(c.invest.pitch).doesNotContain("{").contains(ENGINE.stockName(c.invest.stock));
          assertThat(c.invest.clarity).as("안목 90이면 또렷한 기사").isEqualTo("clear");
        }
      }
    }
    // 안목 90 발굴 담당: 40% + 45% = 85%. 놓쳐도 섹터 데스크(바이오)가 15%로 가져온다.
    assertThat(found / (double) trials).isBetween(0.8, 0.95);
  }

  @Test
  void 발굴_담당이_없으면_종목_회의가_드물다() {
    int found = 0;
    int trials = 400;
    for (int seed = 0; seed < trials; seed++) {
      CompanyState c = second(seed);
      ENGINE.hire(c, stats(60));
      ENGINE.place(c, Map.of(1, "day"));
      ENGINE.macro.decide(c, MacroEngine.NEUTRAL, new HashSeededRandom(seed));
      found += Boolean.TRUE.equals(c.invest.found) ? 1 : 0;
    }
    assertThat(found).as("단타 데스크는 섹터가 없어 물어 오지 않는다").isZero();
  }

  @Test
  void 첫_회사의_첫해에는_돈을_굴리는_직원이_꼭_하나_물어_온다() {
    for (int seed = 0; seed < 50; seed++) {
      CompanyState c = ENGINE.open(new HashSeededRandom(seed), 100_000_000L);
      ENGINE.hire(c, stats(50));
      ENGINE.place(c, Map.of(1, "day"));
      ENGINE.macro.decide(c, MacroEngine.AGGRESSIVE, new HashSeededRandom(seed));
      assertThat(c.invest.found).isTrue();
      assertThat(c.invest.finderName).isEqualTo(c.employees.getFirst().name);
    }
  }

  @Test
  void 안목이_높은_사람이_가져온_종목이_더_자주_오른다() {
    int sharp = 0;
    int dull = 0;
    int trials = 600;
    for (int seed = 0; seed < trials; seed++) {
      CompanyState high = second(seed);
      CompanyState.Employee a = ENGINE.hire(high, stats(100));
      a.desk = "scout";
      sharp += ENGINE.invest.found(high, a, null, new HashSeededRandom(seed)).up ? 1 : 0;
      CompanyState low = second(seed);
      CompanyState.Employee b = ENGINE.hire(low, stats(5));
      b.desk = "scout";
      CompanyState.Invest rumor = ENGINE.invest.found(low, b, null, new HashSeededRandom(seed));
      dull += rumor.up ? 1 : 0;
      assertThat(rumor.clarity).as("소문은 흐리다").isEqualTo("foggy");
    }
    assertThat(sharp - dull).isGreaterThan(trials / 5);
  }
}
