package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 투자 회의 (decisions.md 229번). 실제 콘텐츠와 application.yml 수치로 돌린다. */
class InvestEngineTest {

  private static final CompanyEngine ENGINE =
      new CompanyEngine(
          TestContent.load(),
          TestBehavior.create(),
          TestBehavior.bind("raising.company", CompanyProperties.class));

  private static Map<String, Integer> stats(
      int insight, int patience, int courage, int conviction) {
    return Map.of(
        "insight",
        insight,
        "patience",
        patience,
        "courage",
        courage,
        "conviction",
        conviction,
        "luck",
        50);
  }

  /** 단타 데스크에 직원 한 명을 앉힌 회사. 폭락장이면 손 뒤집힘이 인내심으로 바뀌므로 보통 해로 둔다. */
  private static CompanyState company(long seed, Map<String, Integer> trader) {
    CompanyState company = ENGINE.open(new HashSeededRandom(seed), 100_000_000L);
    ENGINE.hire(company, trader);
    ENGINE.place(company, Map.of(1, "day"));
    company.phase = "normal";
    return company;
  }

  private static String wrong(CompanyState company) {
    return company.invest.up ? InvestEngine.SELL : InvestEngine.BUY;
  }

  private static String right(CompanyState company) {
    return company.invest.up ? InvestEngine.BUY : InvestEngine.SELL;
  }

  @Test
  void 해마다_단서_기사가_결정적_문장_하나와_반대쪽_곁가지를_갖고_같은_시드면_같다() {
    for (int seed = 0; seed < 100; seed++) {
      CompanyState.Invest a = ENGINE.open(new HashSeededRandom(seed), 100_000_000L).invest;
      CompanyState.Invest b = ENGINE.open(new HashSeededRandom(seed), 100_000_000L).invest;
      assertThat(a.sentences).hasSize(4);
      assertThat(a.sentences.stream().filter(s -> s.decisive)).hasSize(1);
      String other = a.up ? "DOWN" : "UP";
      assertThat(a.sentences).anyMatch(s -> s.sign.equals(other));
      assertThat(a.title).doesNotContain("{");
      assertThat(a.choice).isNull();
      assertThat(b.title).isEqualTo(a.title);
      assertThat(b.up).isEqualTo(a.up);
    }
  }

  @Test
  void 돈을_굴리는_직원이_있으면_회의를_해야_결산한다() {
    CompanyState empty = ENGINE.open(new HashSeededRandom(1), 100_000_000L);
    assertThat(ENGINE.invest.open(empty)).as("돈을 굴리는 사람이 없으면 건너뛴다").isFalse();
    ENGINE.settle(empty, new HashSeededRandom(1));
    assertThat(empty.invest).as("다음 해 회의가 온다").isNotNull();

    CompanyState company = company(2, stats(50, 50, 50, 50));
    assertThatThrownBy(() -> ENGINE.settle(company, new HashSeededRandom(2)))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> ENGINE.invest.decide(company, "SHORT", new HashSeededRandom(2)))
        .isInstanceOf(InvalidRequestException.class);
    ENGINE.invest.decide(company, InvestEngine.HOLD, new HashSeededRandom(2));
    assertThatThrownBy(
            () -> ENGINE.invest.decide(company, InvestEngine.BUY, new HashSeededRandom(2)))
        .as("한 해에 한 번")
        .isInstanceOf(InvalidRequestException.class);
    CompanyState.Settlement s = ENGINE.settle(company, new HashSeededRandom(2));
    assertThat(s.lines).anyMatch(l -> l.startsWith("투자 회의"));
  }

  /** 줏대·용기가 만점이면 사장 말대로 하고, 맞히면 벌고 틀리면 잃고, 지켜보면 0. 손익은 바로 자본에 들어간다. */
  @Test
  void 고집이_없는_직원은_사장_말대로_한다() {
    CompanyState company = company(3, stats(50, 100, 100, 100));
    long before = company.capital;
    ENGINE.invest.decide(company, right(company), new HashSeededRandom(3));
    CompanyState.InvestResult r = company.invest.results.getFirst();
    assertThat(r.follow).isEqualTo(InvestEngine.BOSS);
    assertThat(r.line).contains("사장 말대로");
    assertThat(r.pnl).isPositive();
    assertThat(company.capital).isEqualTo(before + r.pnl);

    CompanyState loser = company(3, stats(50, 100, 100, 100));
    ENGINE.invest.decide(loser, wrong(loser), new HashSeededRandom(3));
    assertThat(loser.invest.results.getFirst().pnl).isNegative();

    CompanyState holder = company(3, stats(50, 100, 100, 100));
    ENGINE.invest.decide(holder, InvestEngine.HOLD, new HashSeededRandom(3));
    assertThat(holder.invest.total).isZero();
  }

  /** 용기가 낮은 단타 직원은 "제가 알아서 할게요" 하고 제 판단대로 한다. 안목이 좋으면 제멋대로 한 쪽이 맞을 때가 많다. */
  @Test
  void 고집_센_직원은_제멋대로_하고_맞을_때도_있다() {
    int rogue = 0;
    int rogueRight = 0;
    for (int seed = 0; seed < 300; seed++) {
      CompanyState company = company(seed, stats(100, 50, 0, 100));
      ENGINE.invest.decide(company, wrong(company), new HashSeededRandom(seed));
      CompanyState.InvestResult r = company.invest.results.getFirst();
      if (InvestEngine.OWN.equals(r.follow)) {
        rogue++;
        assertThat(r.line).contains("제가 알아서 할게요");
        if (r.pnl > 0) {
          rogueRight++;
        }
      }
    }
    assertThat(rogue).as("용기 0이면 자주 뒤집힌다").isGreaterThan(50);
    assertThat(rogueRight).as("안목이 좋은 직원의 고집은 대개 맞는다").isGreaterThan(rogue / 2);
  }

  @Test
  void 줏대가_없는_직원은_단골_인물_말을_듣는다() {
    int swayed = 0;
    for (int seed = 0; seed < 300; seed++) {
      CompanyState company = company(seed, stats(50, 100, 100, 0));
      ENGINE.invest.decide(company, InvestEngine.HOLD, new HashSeededRandom(seed));
      CompanyState.InvestResult r = company.invest.results.getFirst();
      if (InvestEngine.SWAY.equals(r.follow)) {
        swayed++;
        assertThat(r.line).contains(ENGINE.invest.tempterName(company.invest.tempter));
      }
    }
    assertThat(swayed).isGreaterThan(30);
  }

  /**
   * 맞대결 막대(235번): 일어난 쪽이 상대다. 꼬드김이면 줏대가, 제 판단이면 자리 능력치(단타 = 용기)가 사장 쪽을 지킨다. 사장 말대로 했으면 사장과 다른 것이
   * 상대고, 상대 행동은 사장이 고른 것과 늘 다르다.
   */
  @Test
  void 결과마다_사장_말과_맞붙은_행동과_지킨_능력치가_있다() {
    for (int seed = 0; seed < 200; seed++) {
      CompanyState company = company(seed, stats(60, 50, 10, 10));
      String choice = List.of(InvestEngine.BUY, InvestEngine.SELL, InvestEngine.HOLD).get(seed % 3);
      ENGINE.invest.decide(company, choice, new HashSeededRandom(seed));
      CompanyState.InvestResult r = company.invest.results.getFirst();
      if (r.rival == null) {
        assertThat(r.follow).isEqualTo(InvestEngine.BOSS);
        assertThat(r.guard).isNull();
        continue;
      }
      assertThat(r.rival).isNotEqualTo(choice);
      if (!InvestEngine.BOSS.equals(r.follow)) {
        assertThat(r.rivalKind).isEqualTo(r.follow);
        assertThat(r.rival).isEqualTo(r.action);
      }
      assertThat(r.guard)
          .isEqualTo(InvestEngine.SWAY.equals(r.rivalKind) ? "conviction" : "courage");
    }
  }

  /** 고르기 전에 낌새가 보인다: 고집 센 직원은 HIGH, 만점이면 LOW. 리서치 팀은 형광펜을 긋고 돈을 굴리지 않아 고집이 없다. */
  @Test
  void 고르기_전에_한마디와_고집과_형광펜이_보인다() {
    // E(3억)라 자리가 셋이다.
    CompanyState company = ENGINE.open(new HashSeededRandom(5), 300_000_000L);
    ENGINE.hire(company, stats(50, 50, 0, 50));
    ENGINE.hire(company, stats(50, 100, 100, 100));
    ENGINE.hire(company, stats(100, 50, 50, 50));
    ENGINE.place(company, Map.of(1, "day", 2, "day", 3, "research"));
    company.phase = "normal";
    var remarks = ENGINE.invest.remarks(company, new HashSeededRandom(5));
    assertThat(remarks).hasSize(3);
    assertThat(ENGINE.invest.stubbornLevel(remarks.get(0).stubbornBp())).isEqualTo("HIGH");
    assertThat(ENGINE.invest.stubbornLevel(remarks.get(1).stubbornBp())).isEqualTo("LOW");
    assertThat(remarks.get(2).stubbornBp()).as("리서치 팀은 돈을 굴리지 않는다").isNull();
    assertThat(remarks).allMatch(r -> r.text() != null);

    int decisive = 0;
    for (int seed = 0; seed < 100; seed++) {
      CompanyState trial = ENGINE.open(new HashSeededRandom(seed), 100_000_000L);
      ENGINE.hire(trial, stats(100, 50, 50, 50));
      ENGINE.place(trial, Map.of(1, "research"));
      var highlight = ENGINE.invest.highlight(trial, new HashSeededRandom(seed));
      assertThat(highlight).isPresent();
      if (trial.invest.sentences.get(highlight.get().index()).decisive) {
        decisive++;
      }
    }
    assertThat(decisive).as("안목 100이면 대개 결정적 문장에 긋는다").isGreaterThan(80);
    CompanyState none = ENGINE.open(new HashSeededRandom(1), 100_000_000L);
    assertThat(ENGINE.invest.highlight(none, new HashSeededRandom(1))).isEmpty();
  }

  /**
   * 한마디는 안목에 따라 다르다 (decisions.md 239번): 안목이 낮으면 기사를 따오지 않고 감·소문으로 말하고, 높으면 결정적 문장을 따온다. 리서치 팀 형광펜은
   * 반만 빌려, 안목이 낮은 직원은 리서치 팀만큼 맞히지 못한다.
   */
  @Test
  void 한마디는_안목에_따라_말투와_근거와_맞히는_정도가_다르다() {
    int sharpRight = 0;
    int sharpDecisive = 0;
    int dullRight = 0;
    int trials = 300;
    for (int seed = 0; seed < trials; seed++) {
      // E(3억)라 자리가 셋: 안목 낮은 직원, 안목 높은 직원, 리서치 팀(안목 만점).
      CompanyState c = ENGINE.open(new HashSeededRandom(seed), 300_000_000L);
      ENGINE.hire(c, stats(0, 50, 50, 50));
      ENGINE.hire(c, stats(90, 50, 50, 50));
      ENGINE.hire(c, stats(100, 50, 50, 50));
      ENGINE.place(c, Map.of(1, "day", 2, "day", 3, "research"));
      c.phase = "normal";
      var remarks = ENGINE.invest.remarks(c, new HashSeededRandom(seed));
      var dull = remarks.get(0);
      var sharp = remarks.get(1);
      String truth = c.invest.up ? "UP" : "DOWN";
      assertThat(dull.text()).as("안목이 낮으면 기사를 따오지 않는다").doesNotContain("‘");
      assertThat(sharp.text()).as("안목이 높으면 기사를 따온다").contains("‘");
      assertThat(sharp.text()).doesNotContain("{");
      // 화면이 한마디를 큰따옴표로 감싸므로 따온 문장으로 시작하지 않는다.
      assertThat(remarks).noneMatch(r -> r.text().startsWith("‘"));
      if (sharp.read().equals(truth)) {
        sharpRight++;
        String decisive =
            c.invest.sentences.stream().filter(x -> x.decisive).findFirst().orElseThrow().text;
        if (sharp.text().contains(decisive.substring(0, 10))) {
          sharpDecisive++;
        }
      }
      if (dull.read().equals(truth)) {
        dullRight++;
      }
    }
    assertThat(sharpDecisive).as("맞게 읽은 높은 안목은 결정적 문장을 짚는다").isEqualTo(sharpRight);
    assertThat(sharpRight).isGreaterThan(trials * 85 / 100);
    // 형광펜을 반만 빌려(안목 0 → 50) 맞히는 정도가 안목 높은 직원보다 확실히 낮다.
    assertThat(dullRight).isLessThan(sharpRight - trials / 10);
  }
}
