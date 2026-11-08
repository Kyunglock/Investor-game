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

  /** 회사를 차리고 올해 종목을 누가 물어 온 셈 친다: 이 시험은 종목 회의 자체를 본다 (발굴은 ScoutEngineTest, decisions.md 267번). */
  private static CompanyState opened(HashSeededRandom random, long capital) {
    CompanyState company = ENGINE.open(random, capital);
    company.invest.found = true;
    return company;
  }

  /** 단타 데스크에 직원 한 명을 앉힌 회사. 폭락장이면 손 뒤집힘이 인내심으로 바뀌므로 보통 해로 둔다. */
  private static CompanyState company(long seed, Map<String, Integer> trader) {
    CompanyState company = opened(new HashSeededRandom(seed), 100_000_000L);
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
      CompanyState.Invest a = opened(new HashSeededRandom(seed), 100_000_000L).invest;
      CompanyState.Invest b = opened(new HashSeededRandom(seed), 100_000_000L).invest;
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
    CompanyState empty = opened(new HashSeededRandom(1), 100_000_000L);
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
    String title = company.invest.title;
    CompanyState.Settlement s = ENGINE.settle(company, new HashSeededRandom(2));
    // 연말 결산서(240번): 회의는 소식 줄이 아니라 따로 실린다(지켜봤으니 0).
    assertThat(s.investTitle).isEqualTo(title);
    assertThat(s.investTotal).isZero();
    assertThat(s.lines).noneMatch(l -> l.startsWith("투자 회의"));
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
    CompanyState company = opened(new HashSeededRandom(5), 300_000_000L);
    ENGINE.hire(company, stats(50, 50, 0, 50));
    ENGINE.hire(company, stats(50, 100, 100, 100));
    ENGINE.hire(company, stats(100, 50, 50, 50));
    ENGINE.place(company, Map.of(1, "day", 2, "day", 3, "research"));
    company.phase = "normal";
    var remarks = ENGINE.invest.liveRemarks(company, new HashSeededRandom(5));
    assertThat(remarks).hasSize(3);
    assertThat(ENGINE.invest.stubbornLevel(remarks.get(0).stubbornBp())).isEqualTo("HIGH");
    assertThat(ENGINE.invest.stubbornLevel(remarks.get(1).stubbornBp())).isEqualTo("LOW");
    assertThat(remarks.get(2).stubbornBp()).as("리서치 팀은 돈을 굴리지 않는다").isNull();
    assertThat(remarks).allMatch(r -> r.text() != null);

    int decisive = 0;
    for (int seed = 0; seed < 100; seed++) {
      CompanyState trial = opened(new HashSeededRandom(seed), 100_000_000L);
      ENGINE.hire(trial, stats(100, 50, 50, 50));
      ENGINE.place(trial, Map.of(1, "research"));
      var highlight = ENGINE.invest.liveHighlight(trial, new HashSeededRandom(seed));
      assertThat(highlight).isPresent();
      if (trial.invest.sentences.get(highlight.get().index()).decisive) {
        decisive++;
      }
    }
    assertThat(decisive).as("안목 100이면 대개 결정적 문장에 긋는다").isGreaterThan(80);
    CompanyState none = opened(new HashSeededRandom(1), 100_000_000L);
    assertThat(ENGINE.invest.liveHighlight(none, new HashSeededRandom(1))).isEmpty();
  }

  /**
   * 한마디는 안목에 따라 다르다 (decisions.md 239번): 안목이 낮으면 기사를 근거로 들지 않고 감·소문으로 말하고, 높으면 결정적 문장의 요지를 근거로 든다.
   * 누구도 기사 문장을 따오지 않는다(272번). 리서치 팀 형광펜은 반만 빌려, 안목이 낮은 직원은 리서치 팀만큼 맞히지 못한다.
   */
  @Test
  void 한마디는_안목에_따라_말투와_근거와_맞히는_정도가_다르다() {
    int sharpRight = 0;
    int missedDecisive = 0;
    int dullRight = 0;
    int trials = 300;
    int clear = 0;
    for (int seed = 0; seed < trials; seed++) {
      // E(3억)라 자리가 셋: 안목 낮은 직원, 안목 높은 직원, 리서치 팀(안목 만점).
      CompanyState c = opened(new HashSeededRandom(seed), 300_000_000L);
      ENGINE.hire(c, stats(0, 50, 50, 50));
      ENGINE.hire(c, stats(90, 50, 50, 50));
      ENGINE.hire(c, stats(100, 50, 50, 50));
      ENGINE.place(c, Map.of(1, "day", 2, "day", 3, "research"));
      c.phase = "normal";
      var remarks = ENGINE.invest.liveRemarks(c, new HashSeededRandom(seed));
      var dull = remarks.get(0);
      var sharp = remarks.get(1);
      String truth = c.invest.up ? "UP" : "DOWN";
      var points = c.invest.sentences.stream().map(x -> x.point).filter(p -> p != null).toList();
      assertThat(points).as("오름·내림 문장에는 요지가 있다").hasSize(3);
      assertThat(points).noneMatch(dull.text()::contains).as("안목이 낮으면 기사를 근거로 들지 않는다");
      if (!"NEUTRAL".equals(sharp.read())) {
        assertThat(points).as("안목이 높으면 요지를 근거로 든다").anyMatch(sharp.text()::contains);
      }
      for (var r : remarks) {
        assertThat(r.text()).doesNotContain("{").doesNotContain("‘");
        for (var x : c.invest.sentences) {
          assertThat(r.text()).as("기사 문장을 따오지 않는다").doesNotContain(x.text.substring(0, 12));
        }
      }
      if (sharp.read().equals(truth)) {
        String decisive =
            c.invest.sentences.stream().filter(x -> x.decisive).findFirst().orElseThrow().point;
        if (!sharp.text().contains(decisive)) {
          missedDecisive++;
        }
      }
      // 맞히는 정도는 또렷한 기사에서 견준다(241번: 흐린 기사는 모두 덜 맞힌다).
      if (!"clear".equals(c.invest.clarity)) {
        continue;
      }
      clear++;
      if (sharp.read().equals(truth)) {
        sharpRight++;
      }
      if (dull.read().equals(truth)) {
        dullRight++;
      }
    }
    assertThat(missedDecisive).as("맞게 읽은 높은 안목은 결정적 문장의 요지를 근거로 든다").isZero();
    assertThat(clear).isGreaterThan(trials / 5);
    assertThat(sharpRight).isGreaterThan(clear * 85 / 100);
    // 형광펜을 반만 빌려(안목 0 → 50) 맞히는 정도가 안목 높은 직원보다 확실히 낮다.
    assertThat(dullRight).isLessThan(sharpRight - clear / 10);
  }

  /**
   * 기사가 흐리면 안목 높은 직원끼리도 의견이 갈린다 (decisions.md 241번). 전에는 모두 안목이 높으면 늘 같은 쪽을 말했다. 가장 흐린 기사에서는
   * "애매하다"고 말한다.
   */
  @Test
  void 흐린_기사에서는_안목_높은_직원끼리도_의견이_갈린다() {
    Map<String, int[]> splits = new java.util.HashMap<>();
    for (int seed = 0; seed < 600; seed++) {
      CompanyState c = opened(new HashSeededRandom(seed), 100_000_000L);
      ENGINE.hire(c, stats(90, 50, 50, 50));
      ENGINE.hire(c, stats(90, 50, 50, 50));
      ENGINE.place(c, Map.of(1, "day", 2, "bio"));
      c.phase = "normal";
      var remarks = ENGINE.invest.liveRemarks(c, new HashSeededRandom(seed));
      int[] count = splits.computeIfAbsent(c.invest.clarity, k -> new int[2]);
      count[0]++;
      if (!remarks.get(0).read().equals(remarks.get(1).read())) {
        count[1]++;
      }
      if ("foggy".equals(c.invest.clarity)) {
        assertThat(remarks)
            .filteredOn(r -> !r.read().equals("NEUTRAL"))
            .allMatch(r -> r.text().matches(".*(애매|반반|갈릴).*"));
      }
    }
    assertThat(splits).containsOnlyKeys("clear", "murky", "foggy");
    double clear = splits.get("clear")[1] / (double) splits.get("clear")[0];
    double foggy = splits.get("foggy")[1] / (double) splits.get("foggy")[0];
    assertThat(clear).as("또렷한 기사는 대개 한목소리").isLessThan(0.3);
    assertThat(foggy).as("가장 흐린 기사는 절반 넘게 갈린다").isGreaterThan(0.45);
  }

  /**
   * 회의를 열면 한마디와 형광펜을 굳힌다 (#312, decisions.md 249번). 열기 전에는 보이지 않고, 연 뒤에는 리서치 팀을 바꿔도 그대로라 한마디가 뒤집히는
   * 것으로 정답을 알아낼 수 없다.
   */
  @Test
  void 회의를_열면_한마디와_형광펜이_굳어_배치를_바꿔도_그대로다() {
    for (long seed = 0; seed < 40; seed++) {
      CompanyState c = opened(new HashSeededRandom(seed), 300_000_000L);
      ENGINE.hire(c, stats(10, 50, 50, 50));
      ENGINE.hire(c, stats(10, 50, 50, 50));
      ENGINE.hire(c, stats(100, 50, 50, 50));
      c.phase = "normal";
      ENGINE.place(c, Map.of(1, "day", 2, "bio"));
      HashSeededRandom random = new HashSeededRandom(seed);
      assertThat(ENGINE.invest.remarks(c)).as("열기 전에는 한마디가 없다").isEmpty();
      assertThat(ENGINE.invest.highlight(c)).isEmpty();

      ENGINE.invest.convene(c, random);
      assertThat(ENGINE.invest.convened(c)).isTrue();
      List<String> reads = ENGINE.invest.remarks(c).stream().map(r -> r.read).toList();
      assertThat(reads).hasSize(2);
      assertThat(ENGINE.invest.highlight(c)).as("리서치 팀이 없을 때 열었다").isEmpty();

      // 안목 100인 사람을 리서치 팀에 앉혀도 한마디와 형광펜은 연 때 그대로다.
      ENGINE.place(c, Map.of(1, "day", 2, "bio", 3, "research"));
      ENGINE.invest.convene(c, random);
      assertThat(ENGINE.invest.remarks(c).stream().map(r -> r.read).toList()).isEqualTo(reads);
      assertThat(ENGINE.invest.highlight(c)).isEmpty();

      // 정할 때의 제 판단도 회의에서 한 말 그대로다.
      ENGINE.invest.decide(c, InvestEngine.HOLD, random);
      for (CompanyState.InvestResult r : c.invest.results) {
        if (InvestEngine.OWN.equals(r.follow)) {
          String said =
              ENGINE.invest.remarks(c).stream()
                  .filter(x -> x.employeeId == r.employeeId)
                  .findFirst()
                  .orElseThrow()
                  .read;
          assertThat(r.action)
              .isEqualTo(
                  switch (said) {
                    case "UP" -> InvestEngine.BUY;
                    case "DOWN" -> InvestEngine.SELL;
                    default -> InvestEngine.HOLD;
                  });
        }
      }
    }
  }

  @Test
  void 열_수_없는_회의는_열지_못하고_바로_정하면_연_셈_친다() {
    CompanyState empty = opened(new HashSeededRandom(1), 100_000_000L);
    assertThatThrownBy(() -> ENGINE.invest.convene(empty, new HashSeededRandom(1)))
        .isInstanceOf(InvalidRequestException.class);
    CompanyState c = company(3, stats(50, 50, 50, 50));
    ENGINE.invest.decide(c, InvestEngine.BUY, new HashSeededRandom(3));
    assertThat(ENGINE.invest.convened(c)).isTrue();
    assertThat(ENGINE.invest.remarks(c)).hasSize(1);
  }

  /** 크게 하면 판돈이 두 배고 직원이 사장 말을 덜 듣는다. 지켜보면 놓친 돈이 남는다 (#323, decisions.md 260번). */
  @Test
  void 크게_하면_판돈이_두_배고_지켜보면_놓친_돈이_남는다() {
    int bossSmall = 0;
    int bossBig = 0;
    for (long seed = 0; seed < 300; seed++) {
      CompanyState small = company(seed, stats(50, 50, 30, 30));
      CompanyState big = company(seed, stats(50, 50, 30, 30));
      String right = right(small);
      ENGINE.invest.decide(small, right, false, new HashSeededRandom(seed));
      ENGINE.invest.decide(big, right, true, new HashSeededRandom(seed));
      assertThat(big.invest.big).isTrue();
      CompanyState.InvestResult a = small.invest.results.getFirst();
      CompanyState.InvestResult b = big.invest.results.getFirst();
      if (InvestEngine.BOSS.equals(a.follow) && InvestEngine.BOSS.equals(b.follow)) {
        assertThat(b.pnl).as("같은 판단이면 손익이 두 배").isEqualTo(a.pnl * 2);
      }
      bossSmall += InvestEngine.BOSS.equals(a.follow) ? 1 : 0;
      bossBig += InvestEngine.BOSS.equals(b.follow) ? 1 : 0;
    }
    assertThat(bossBig).as("크게 하면 사장 말을 덜 듣는다").isLessThan(bossSmall);

    CompanyState hold = company(1, stats(50, 50, 50, 50));
    assertThatThrownBy(
            () -> ENGINE.invest.decide(hold, InvestEngine.HOLD, true, new HashSeededRandom(1)))
        .isInstanceOf(InvalidRequestException.class);
    ENGINE.invest.decide(hold, InvestEngine.HOLD, false, new HashSeededRandom(1));
    assertThat(hold.invest.missed).as("지켜봤으면 놓친 돈").isPositive();
    CompanyState bought = company(1, stats(50, 50, 50, 50));
    ENGINE.invest.decide(bought, InvestEngine.BUY, new HashSeededRandom(1));
    assertThat(bought.invest.missed).isNull();
  }

  /**
   * 토론이 먼저 (decisions.md 279·352번): 회의를 열면 한마디를 안목만큼 저울질해 직원들이 사자·팔자 한쪽으로 기운다(teamCall). 지켜보지는 않는다.
   * 결정은 사장이 하고, "너희가 알아서 해"(TEAM)는 더는 고를 수 없다.
   */
  @Test
  void 회의를_열면_직원_한마디를_안목만큼_저울질해_한쪽으로_기운다() {
    int agreed = 0;
    int decided = 0;
    for (int seed = 0; seed < 200; seed++) {
      CompanyState c = opened(new HashSeededRandom(seed), 300_000_000L);
      ENGINE.hire(c, stats(90, 50, 50, 50));
      ENGINE.hire(c, stats(90, 50, 50, 50));
      ENGINE.place(c, Map.of(1, "day", 2, "bio"));
      c.phase = "normal";
      ENGINE.invest.convene(c, new HashSeededRandom(seed));
      long ups = c.invest.remarks.stream().filter(r -> "UP".equals(r.read)).count();
      long downs = c.invest.remarks.stream().filter(r -> "DOWN".equals(r.read)).count();
      assertThat(c.invest.choice).as("열기만 해서는 정해지지 않는다").isNull();
      assertThat(c.invest.teamCall).isIn(InvestEngine.BUY, InvestEngine.SELL);
      assertThat(c.invest.teamBuy).isEqualTo(ups * 100);
      assertThat(c.invest.teamSell).isEqualTo(downs * 100);
      assertThat(c.invest.debate).isNotEmpty();
      if (ups != downs) {
        decided++;
        if (c.invest.teamCall.equals(ups > downs ? InvestEngine.BUY : InvestEngine.SELL)) {
          agreed++;
        }
      }
      // 사장이 고르면 그대로 사장 결정이다: 토론은 그대로 남는다.
      ENGINE.invest.decide(c, InvestEngine.SELL, new HashSeededRandom(seed));
      assertThat(c.invest.delegated).isFalse();
      assertThat(c.invest.choice).isEqualTo(InvestEngine.SELL);
      assertThat(c.invest.debate).isNotEmpty();
    }
    // 둘 다 같은 쪽이면 늘 그쪽, 갈리면 무게대로 반반이라 다수 쪽이 대개 이긴다.
    assertThat(agreed).isGreaterThan(decided * 7 / 10);

    CompanyState big = opened(new HashSeededRandom(1), 100_000_000L);
    ENGINE.hire(big, stats(50, 50, 50, 50));
    ENGINE.place(big, Map.of(1, "day"));
    assertThatThrownBy(() -> ENGINE.invest.decide(big, "TEAM", new HashSeededRandom(1)))
        .as("너희가 알아서 해는 뺐다 (352번)")
        .isInstanceOf(InvalidRequestException.class);
    assertThat(big.invest.choice).isNull();
  }

  /**
   * 회의를 열면 토론한다 (decisions.md 285·352번): 사자던 직원은 매수파, 팔자던 직원은 매도파로 두 번씩 번갈아 말하고, 이긴 쪽이 결판을 내고 진 쪽이
   * 투덜댄다. 말에는 기사의 요지가 들어가고 기사를 따오지 않는다. 한쪽이 비면 모르겠다던 직원이나 옆자리 사람이 그쪽을 든다.
   */
  @Test
  void 회의를_열면_매수파와_매도파가_번갈아_토론하고_이긴_쪽이_결판낸다() {
    for (int seed = 0; seed < 60; seed++) {
      CompanyState c = opened(new HashSeededRandom(seed), 300_000_000L);
      ENGINE.hire(c, stats(90, 50, 50, 50));
      ENGINE.hire(c, stats(20, 50, 50, 50));
      ENGINE.place(c, Map.of(1, "day", 2, "bio"));
      c.phase = "normal";
      ENGINE.invest.convene(c, new HashSeededRandom(seed));
      List<CompanyState.DebateLine> debate = c.invest.debate;
      assertThat(debate).hasSize(7);
      for (int i = 0; i < 4; i++) {
        assertThat(debate.get(i).side).isEqualTo(i % 2 == 0 ? "BUY" : "SELL");
        assertThat(debate.get(i).last).isFalse();
        assertThat(debate.get(i).kind).isEqualTo(InvestEngine.TALK);
        assertThat(debate.get(i).text).doesNotContain("{").doesNotContain("‘");
      }
      // 결판 세 박자 (295번): 사회가 무게를 읽으며 표결을 부르고, 이긴 쪽이 선언하고, 진 쪽이 토를 달고 물러난다.
      assertThat(debate.get(4).kind).isEqualTo(InvestEngine.TALLY);
      assertThat(debate.get(4).last).isTrue();
      assertThat(debate.get(4).text)
          .contains("매수 " + c.invest.teamBuy)
          .contains("매도 " + c.invest.teamSell);
      assertThat(debate.get(5).kind).isEqualTo(InvestEngine.WIN);
      assertThat(debate.get(5).side).isEqualTo(c.invest.teamCall);
      assertThat(debate.get(6).kind).isEqualTo(InvestEngine.LOSE);
      assertThat(debate.get(6).side).isNotEqualTo(c.invest.choice);
      for (CompanyState.Remark r : c.invest.remarks) {
        if ("UP".equals(r.read)) {
          assertThat(debate)
              .filteredOn(d -> d.name.equals(r.name))
              .allMatch(d -> "BUY".equals(d.side));
        } else if ("DOWN".equals(r.read)) {
          assertThat(debate)
              .filteredOn(d -> d.name.equals(r.name))
              .allMatch(d -> "SELL".equals(d.side));
        }
      }
      // 두 사람뿐이라 양쪽이 다 차려면 누군가는 끌려 나온다: 이름은 늘 회의에 온 직원이거나 옆자리 사람이다.
      List<String> names =
          new java.util.ArrayList<>(c.invest.remarks.stream().map(r -> r.name).toList());
      names.addAll(List.of("옆자리 신입", "지나가던 인턴"));
      assertThat(debate).allMatch(d -> names.contains(d.name));
    }
    // 창을 거치지 않고 바로 정해도(옛 화면·시험) 토론은 연 셈 쳐서 남는다.
    CompanyState boss = opened(new HashSeededRandom(1), 100_000_000L);
    ENGINE.hire(boss, stats(50, 50, 50, 50));
    ENGINE.place(boss, Map.of(1, "day"));
    ENGINE.invest.decide(boss, InvestEngine.BUY, new HashSeededRandom(1));
    assertThat(boss.invest.debate).isNotEmpty();
    assertThat(boss.invest.choice).isEqualTo(InvestEngine.BUY);
  }

  /** 토론은 팀장만 한다 (decisions.md 295번): 같은 자리에 셋이면 팀장만 말하고, 팀장과 다른 의견 쪽은 그쪽 안목 1위 하나만 말한다. */
  @Test
  void 토론은_팀장만_한다() {
    int leaderOnly = 0;
    for (int seed = 0; seed < 40; seed++) {
      CompanyState c = opened(new HashSeededRandom(seed), 300_000_000L);
      ENGINE.hire(c, stats(80, 50, 50, 50));
      ENGINE.hire(c, stats(30, 50, 50, 50));
      ENGINE.hire(c, stats(30, 50, 50, 50));
      ENGINE.place(c, Map.of(1, "day", 2, "day", 3, "day"));
      c.phase = "normal";
      ENGINE.invest.convene(c, new HashSeededRandom(seed));
      String leader = ENGINE.teams.leaderOf(c, "day").orElseThrow().name;
      List<CompanyState.DebateLine> debate = c.invest.debate;
      String leaderSide =
          debate.stream()
              .filter(d -> d.name.equals(leader))
              .map(d -> d.side)
              .findFirst()
              .orElse(null);
      if (leaderSide != null) {
        leaderOnly++;
        assertThat(debate.stream().filter(d -> d.side.equals(leaderSide)).map(d -> d.name))
            .containsOnly(leader);
      }
      assertThat(debate.stream().map(d -> d.name).distinct()).hasSizeLessThanOrEqualTo(2);
    }
    assertThat(leaderOnly).as("팀장이 의견을 낸 판이 있다").isPositive();
  }

  /** 맡기기는 없다 (decisions.md 352번): TEAM을 보내면 400이고 아무것도 정해지지 않는다. */
  @Test
  void 너희가_알아서_해는_고를_수_없다() {
    CompanyState c = opened(new HashSeededRandom(3), 300_000_000L);
    ENGINE.hire(c, stats(60, 50, 50, 50));
    ENGINE.place(c, Map.of(1, "day"));
    c.phase = "normal";
    assertThatThrownBy(() -> ENGINE.invest.decide(c, "TEAM", false, new HashSeededRandom(3)))
        .isInstanceOf(InvalidRequestException.class);
    assertThat(c.invest.choice).isNull();
  }

  /** 막판 뒤집기는 없다 (decisions.md 381번): S 이상 직원이 앉아 있어도 사장이 정하면 그대로 정해지고, 등급 효과 줄에 "잠깐만요"가 붙지 않는다. */
  @Test
  void 사장이_정하면_막판_뒤집기_없이_바로_정해진다() {
    assertThat(ENGINE.perkLine(stats(75, 75, 75, 75), 0)).doesNotContain("잠깐만요");
    for (int seed = 0; seed < 50; seed++) {
      CompanyState c = opened(new HashSeededRandom(seed), 300_000_000L);
      CompanyState.Employee legend = ENGINE.hire(c, stats(100, 100, 100, 100));
      legend.rank = 3; // SSS + 3 = Z
      ENGINE.hire(c, stats(75, 75, 75, 75));
      ENGINE.place(c, Map.of(1, "day", 2, "bio"));
      c.phase = "normal";
      ENGINE.invest.decide(c, InvestEngine.BUY, new HashSeededRandom(seed));
      assertThat(c.invest.choice).isEqualTo(InvestEngine.BUY);
    }
  }

  private static String credit(String read, String choice, boolean up) {
    CompanyState c = new CompanyState();
    CompanyState.Invest i = new CompanyState.Invest();
    i.stock = TestContent.load().stocksOf("game").getFirst().code();
    i.finderId = 7;
    i.finderName = "이도담";
    i.choice = choice;
    i.up = up;
    i.magnitudeBp = 3500;
    CompanyState.Remark r = new CompanyState.Remark();
    r.employeeId = 7;
    r.read = read;
    i.remarks = List.of(r);
    c.invest = i;
    return ENGINE.invest.credit(c);
  }

  /** #340: 맺음말은 물어 온 사람의 회의 의견도 본다. */
  @Test
  void 물어_온_사람의_맺음말은_그_사람의_회의_의견을_본다() {
    // 팔자고 했는데 사장이 사서 빠졌다: 그 말을 들을 걸 그랬다
    assertThat(credit("DOWN", InvestEngine.BUY, false)).contains("들을 걸 그랬다").contains("빠졌다");
    // 팔자고 했고 사장도 팔았고 빠졌다: 칭찬
    assertThat(credit("DOWN", InvestEngine.SELL, false)).contains("그 말이 맞았다");
    // 팔자고 했는데 올랐다: 본인은 팔자고 했다
    assertThat(credit("DOWN", InvestEngine.SELL, true)).contains("본인은 팔자고");
    // 사자고 했는데 빠졌다: 지금처럼 탓한다
    assertThat(credit("UP", InvestEngine.BUY, false)).contains("소문 말고");
    // 사자고 했고 올랐다: 눈이 맞았다
    assertThat(credit("UP", InvestEngine.BUY, true)).contains("눈이 맞았다");
  }

  /** #340: 같은 기사를 다시 뽑아도 고를 수 있는 다른 종목이 있으면 지난 종목과 지난 한마디는 쉰다. */
  @Test
  void 지난_분기와_같은_종목과_같은_한마디는_이어_나오지_않는다() {
    int alternatives = 0;
    for (int seed = 0; seed < 40; seed++) {
      CompanyState c = ENGINE.open(new HashSeededRandom(seed), 100_000_000L);
      CompanyState.Employee finder = ENGINE.hire(c, stats(20, 50, 50, 50));
      HashSeededRandom random = new HashSeededRandom(seed);
      CompanyState.Invest first = ENGINE.invest.found(c, finder, null, random);
      c.invest = first;
      c.usedNews.remove(first.news);
      CompanyState.Invest again = ENGINE.invest.found(c, finder, null, random);
      assertThat(again.pitch).isNotEqualTo(first.pitch);
      if (!again.stock.equals(first.stock)) {
        alternatives++;
      }
      var news =
          TestContent.load().news().stream()
              .filter(n -> n.code().equals(first.news))
              .findFirst()
              .orElseThrow();
      long fitting =
          TestContent.load().stocksOf(news.sector()).stream()
              .filter(st -> news.fits(st.code()))
              .count();
      if (again.news.equals(first.news) && fitting > 1) {
        assertThat(again.stock).as("같은 기사면 다른 종목").isNotEqualTo(first.stock);
      }
    }
    assertThat(alternatives).isPositive();
  }

  /** #341: 같은 꼬리표를 단 반대쪽 문장은 한 기사에 함께 나오지 않는다. */
  @Test
  void 같은_사건의_반대_문장은_한_기사에_함께_나오지_않는다() {
    List<investorgame.content.Clue> ups =
        List.of(
            new investorgame.content.Clue("실사를 지적 없이 마쳤다.", "실사가 깨끗했다", "inspection"),
            new investorgame.content.Clue("수주가 늘었다.", "수주가 늘었다", null),
            new investorgame.content.Clue("값이 올랐다.", "값이 올랐다", null));
    List<investorgame.content.Clue> downs =
        List.of(
            new investorgame.content.Clue("실사에서 지적이 세 건 나왔다.", "실사에서 걸렸다", "inspection"),
            new investorgame.content.Clue("재고가 쌓였다.", "재고가 쌓였다", null),
            new investorgame.content.Clue("값이 내렸다.", "값이 내렸다", null));
    int together = 0;
    int clean = 0;
    for (int seed = 0; seed < 300; seed++) {
      var rng = new HashSeededRandom(seed).forKey("article", seed);
      List<String> texts =
          ENGINE.invest.article(ups, downs, List.of("중립."), seed % 2 == 0, rng, Map.of()).stream()
              .map(x -> x.text)
              .toList();
      boolean a = texts.contains("실사를 지적 없이 마쳤다.");
      boolean b = texts.contains("실사에서 지적이 세 건 나왔다.");
      together += a && b ? 1 : 0;
      clean += a || b ? 1 : 0;
    }
    assertThat(together).isZero();
    assertThat(clean).as("꼬리표 문장도 나오기는 한다").isPositive();
  }

  /**
   * 결과 뒤 양쪽 반응 (decisions.md 358번): 맞힌 쪽과 틀린 쪽이 한마디씩. 사장이 따른 쪽은 cheer/sorry, 안 따른 쪽은
   * toldYou/relief.
   */
  @Test
  void 결과가_드러나면_맞힌_쪽과_틀린_쪽이_한마디씩_한다() {
    int seen = 0;
    for (int seed = 0; seed < 40; seed++) {
      CompanyState c = opened(new HashSeededRandom(seed), 300_000_000L);
      ENGINE.hire(c, stats(90, 50, 50, 50));
      ENGINE.hire(c, stats(20, 50, 50, 50));
      ENGINE.place(c, Map.of(1, "day", 2, "bio"));
      c.phase = "normal";
      ENGINE.invest.convene(c, new HashSeededRandom(seed));
      ENGINE.invest.decide(c, InvestEngine.BUY, new HashSeededRandom(seed));
      List<CompanyState.DebateLine> reactions = c.invest.reactions;
      assertThat(reactions).hasSize(2);
      String right = c.invest.up ? InvestEngine.BUY : InvestEngine.SELL;
      for (CompanyState.DebateLine r : reactions) {
        assertThat(r.text).isNotBlank().doesNotContain("{");
        assertThat(r.kind).isEqualTo(r.side.equals(right) ? InvestEngine.WIN : InvestEngine.LOSE);
        // 말한 사람은 그쪽에서 토론한 사람이다.
        assertThat(c.invest.debate).anyMatch(d -> d.name.equals(r.name) && d.side.equals(r.side));
      }
      seen++;
    }
    assertThat(seen).isEqualTo(40);
  }
}
