package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.StatCodes;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import investorgame.raising.CardKind;
import investorgame.raising.CardOutcome;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 육성 한 판의 규칙 (증권사 육성 설계 3·11절, 투자 원칙 장치 설계 1~3절). DB 없이 실제 콘텐츠와 application.yml 수치로 돌린다. */
class RunEngineTest {

  private static final RaisingProperties PROPERTIES =
      TestBehavior.bind("raising", RaisingProperties.class);
  private static final RunEngine ENGINE =
      new RunEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);
  private static final int NEWS_SLOT = PROPERTIES.deck().indexOf(RaisingProperties.Slot.NEWS);

  /** 매 카드의 첫 선택지(뉴스면 지켜본다)를 고르며 끝까지 간다. */
  private static List<CardOutcome> playThrough(RunState run, RaisingMemory memory, long seed) {
    List<CardOutcome> outcomes = new ArrayList<>();
    while (run.current != null) {
      String option =
          run.current.kind == CardKind.NEWS ? RunEngine.HOLD : run.current.options.getFirst().code;
      outcomes.add(ENGINE.choose(run, memory, option, new HashSeededRandom(seed)));
    }
    return outcomes;
  }

  @Test
  void 판은_덱의_카드_수만큼이고_입사_심사로_끝난다() {
    for (long seed = 1; seed <= 30; seed++) {
      RaisingMemory memory = new RaisingMemory();
      RunState run = ENGINE.create(new HashSeededRandom(seed), seed == 1, memory);
      List<CardOutcome> outcomes = playThrough(run, memory, seed);
      assertThat(outcomes).hasSize(PROPERTIES.deck().size());
      assertThat(outcomes.getLast().kind()).isEqualTo(CardKind.EXAM);
      assertThat(run.card).isEqualTo(PROPERTIES.deck().size());
      assertThat(memory.runsFinished).isEqualTo(1);
    }
  }

  @Test
  void 같은_시드와_같은_선택이면_같은_판이다() {
    JsonMapper json = JsonMapper.builder().build();
    RaisingMemory m1 = new RaisingMemory();
    RaisingMemory m2 = new RaisingMemory();
    RunState a = ENGINE.create(new HashSeededRandom(42), false, m1);
    RunState b = ENGINE.create(new HashSeededRandom(42), false, m2);
    playThrough(a, m1, 42);
    playThrough(b, m2, 42);
    assertThat(json.writeValueAsString(a)).isEqualTo(json.writeValueAsString(b));
  }

  @Test
  void 지나간_카드의_선택지는_고를_수_없다() {
    RaisingMemory memory = new RaisingMemory();
    RunState run = ENGINE.create(new HashSeededRandom(3), false, memory);
    assertThatThrownBy(() -> ENGINE.choose(run, memory, "NOPE", new HashSeededRandom(3)))
        .isInstanceOf(InvalidRequestException.class);
  }

  /**
   * 짜인 첫 판 (11.2절): 첫 뉴스는 기사만 읽어도 답이 보이고, 두 번째 뉴스는 무엇을 고르든 손이 뒤집히고, 세 번째 뉴스는 형광펜이 틀리고 기사가 맞는다. 처음에는
   * 사기·지켜보기만 있고, 형광펜을 본 다음 뉴스에 조금/크게가 열린다 (11.1절).
   */
  @Test
  void 짜인_첫_판은_가르칠_순간을_차례로_보여_준다() {
    for (String secondChoice : List.of(RunEngine.BUY, RunEngine.HOLD)) {
      RaisingMemory memory = new RaisingMemory();
      long seed = 7;
      RunState run = ENGINE.create(new HashSeededRandom(seed), true, memory);
      List<RunState.Card> news = new ArrayList<>();
      List<CardOutcome> newsOutcomes = new ArrayList<>();
      while (run.current != null && news.size() < 4) {
        RunState.Card card = run.current;
        if (card.kind != CardKind.NEWS) {
          ENGINE.choose(run, memory, card.options.getFirst().code, new HashSeededRandom(seed));
          continue;
        }
        news.add(card);
        String option = news.size() == 2 ? secondChoice : RunEngine.HOLD;
        newsOutcomes.add(ENGINE.choose(run, memory, option, new HashSeededRandom(seed)));
      }

      RunState.Card easy = news.get(0);
      String truth = easy.up ? "UP" : "DOWN";
      assertThat(easy.sentences)
          .filteredOn(s -> !s.sign.equals("NEUTRAL"))
          .allMatch(s -> s.sign.equals(truth));
      assertThat(easy.highlight).as("형광펜은 아직 닫혀 있다").isEqualTo(-1);
      assertThat(codes(easy)).containsExactly(RunEngine.BUY, RunEngine.HOLD);
      assertThat(newsOutcomes.get(0).flips()).isEmpty();

      assertThat(newsOutcomes.get(1).flips()).as(secondChoice + "를 골라도 뒤집힌다").hasSize(1);
      assertThat(newsOutcomes.get(1).actual())
          .as("조금/크게가 열리기 전이라 뒤집혀도 산다·지켜본다·판다 가운데 하나")
          .isIn(RunEngine.BUY, RunEngine.HOLD, RunEngine.SELL);
      assertThat(newsOutcomes.get(1).tip()).as("처음 뒤집히면 한 줄 설명").isNotBlank();
      assertThat(newsOutcomes.get(1).ifChosen()).as("고른 대로 했다면").isNotNull();

      RunState.Card mislead = news.get(2);
      assertThat(mislead.highlight).as("세 번째 뉴스에 형광펜이 열린다").isNotNegative();
      RunState.Sentence marked = mislead.sentences.get(mislead.highlight);
      assertThat(marked.decisive).isFalse();
      assertThat(marked.sign).isEqualTo(mislead.up ? "DOWN" : "UP");
      long withTruth =
          mislead.sentences.stream().filter(s -> s.sign.equals(mislead.up ? "UP" : "DOWN")).count();
      assertThat(withTruth).as("기사 다수결은 맞는다").isEqualTo(2);
      assertThat(mislead.tips).isNotEmpty();

      assertThat(codes(news.get(3))).contains(RunEngine.BUY_SMALL, RunEngine.BUY_BIG);
    }
  }

  private static List<String> codes(RunState.Card card) {
    return card.options.stream().map(o -> o.code).toList();
  }

  /** 같은 능력치로 두 번 뒤집히면 원칙 카드가 뉴스 자리를 대신하고, 판당 한 번이며, 건 장치는 그 판정을 막는다 (투자 원칙 장치 설계 1.2·1.3절). */
  @Test
  void 용기로_두_번_뒤집히면_자동이체_원칙_카드가_뜬다() {
    int offered = 0;
    for (long seed = 1; seed <= 80; seed++) {
      RaisingMemory memory = new RaisingMemory();
      memory.unlocked.addAll(List.of(RunEngine.UNLOCK_SIZE, RunEngine.UNLOCK_SELL));
      RunState run = ENGINE.create(new HashSeededRandom(seed), false, memory);
      run.stats.put(StatCodes.COURAGE, 1);
      run.stats.put(StatCodes.CONVICTION, 100);
      int principles = 0;
      boolean accepted = false;
      while (run.current != null) {
        RunState.Card card = run.current;
        String option = card.options.getFirst().code;
        if (card.kind == CardKind.PRINCIPLE) {
          principles++;
          assertThat(card.deviceStat).isEqualTo(StatCodes.COURAGE);
          option = RunEngine.ACCEPT;
          accepted = true;
        } else if (card.kind == CardKind.NEWS && accepted) {
          assertThat(codes(card)).contains(RunEngine.BUY_SMALL).doesNotContain(RunEngine.BUY_BIG);
          CardOutcome outcome =
              ENGINE.choose(run, memory, RunEngine.BUY_SMALL, new HashSeededRandom(seed));
          assertThat(outcome.flips())
              .as("자동이체가 사는 동안 용기 판정은 없다")
              .noneMatch(f -> f.statCode().equals(StatCodes.COURAGE));
          continue;
        } else if (card.kind == CardKind.NEWS) {
          option = RunEngine.BUY_BIG;
        }
        ENGINE.choose(run, memory, option, new HashSeededRandom(seed));
      }
      assertThat(principles).isLessThanOrEqualTo(PROPERTIES.principle().perRun());
      assertThat(run.card).isEqualTo(PROPERTIES.deck().size());
      offered += principles;
    }
    assertThat(offered).as("용기 1이면 대부분의 판에서 뜬다").isGreaterThan(40);
  }

  /**
   * 단서 기사의 맞히는 비율 (투자 원칙 장치 설계 3.1절). 목표: 기사만 읽고 다수결 60~65%, 안목 0의 형광펜 40%, 안목 100의 형광펜 95% 안팎. 빗나간
   * 형광펜이 반대쪽 곁가지를 새로 만들 때가 있어 다수결이 조금 흔들린다.
   */
  @Test
  void 기사만_읽기와_형광펜의_정답률() {
    int trials = 4000;
    double majority = majorityRate(trials, 50);
    assertThat(majority).isBetween(0.60, 0.68);
    assertThat(highlightRate(trials, 0)).isBetween(0.36, 0.44);
    assertThat(highlightRate(trials, 50)).isBetween(0.63, 0.73);
    assertThat(highlightRate(trials, 100)).isBetween(0.92, 0.98);
  }

  private static RunState.Card newsCard(long seed, int insight) {
    RaisingMemory memory = new RaisingMemory();
    memory.unlocked.add(RunEngine.UNLOCK_HIGHLIGHTER);
    memory.tipsShown.add(RunEngine.UNLOCK_HIGHLIGHTER);
    RunState run = ENGINE.create(new HashSeededRandom(seed), false, memory);
    run.stats.put(StatCodes.INSIGHT, insight);
    run.card = NEWS_SLOT;
    ENGINE.deal(run, memory, new HashSeededRandom(seed));
    return run.current;
  }

  private static double majorityRate(int trials, int insight) {
    int right = 0;
    for (int i = 0; i < trials; i++) {
      RunState.Card card = newsCard(i, insight);
      long up = card.sentences.stream().filter(s -> s.sign.equals("UP")).count();
      long down = card.sentences.stream().filter(s -> s.sign.equals("DOWN")).count();
      if ((up > down) == card.up) {
        right++;
      }
    }
    return right / (double) trials;
  }

  private static double highlightRate(int trials, int insight) {
    int marked = 0;
    int right = 0;
    for (int i = 0; i < trials; i++) {
      RunState.Card card = newsCard(i, insight);
      if (card.highlight < 0) {
        continue;
      }
      marked++;
      if (card.sentences.get(card.highlight).sign.equals(card.up ? "UP" : "DOWN")) {
        right++;
      }
    }
    return right / (double) marked;
  }

  /**
   * 공채 육성은 회사의 올해 시장에서 한다 (증권사 육성 설계 6.2절): 폭락장이면 반드시 위기가 오고 연초 회의의 조짐이 신입의 뉴스에도 나온다. 헛조짐은 뉴스에 한 번
   * 나오고 아무 일도 없다.
   */
  @Test
  void 공채_육성은_회사의_올해_시장과_같다() {
    String omen = TestContent.load().crises().getFirst().omens().getFirst();
    for (long seed = 1; seed <= 20; seed++) {
      RaisingMemory memory = new RaisingMemory();
      RunState crash =
          ENGINE.create(
              new HashSeededRandom(seed),
              false,
              memory,
              10_000_000,
              true,
              new RunEngine.Year("crash", omen),
              null);
      assertThat(crash.crisis.hits).isTrue();
      assertThat(crash.crisis.omens.getFirst()).as("연초 회의에서 본 그 조짐").isEqualTo(omen);
      List<CardOutcome> outcomes = playThrough(crash, memory, seed);
      assertThat(outcomes.stream().flatMap(o -> o.lines().stream()))
          .as("위기가 터진다")
          .anyMatch(line -> line.contains("시장 전체가 무너졌다"));

      RaisingMemory memory2 = new RaisingMemory();
      RunState rumor =
          ENGINE.create(
              new HashSeededRandom(seed),
              false,
              memory2,
              10_000_000,
              true,
              new RunEngine.Year("normal", omen),
              null);
      assertThat(rumor.crisis.hits).isFalse();
      assertThat(rumor.crisis.omens).containsExactly(omen);
      assertThat(playThrough(rumor, memory2, seed).stream().flatMap(o -> o.lines().stream()))
          .as("헛조짐은 아무 일도 없다")
          .noneMatch(line -> line.contains("시장 전체가 무너졌다"));

      RunState quiet =
          ENGINE.create(
              new HashSeededRandom(seed),
              false,
              new RaisingMemory(),
              10_000_000,
              true,
              new RunEngine.Year("boom", null),
              null);
      assertThat(quiet.crisis).as("조짐 없는 호황 해엔 위기가 없다").isNull();
    }
  }

  @Test
  void 호황인_해의_공채_육성은_오르는_뉴스가_많다() {
    assertThat(upRate("boom")).isGreaterThan(upRate("normal") + 0.08);
    assertThat(upRate("crash")).isLessThan(upRate("normal") - 0.05);
  }

  private static double upRate(String phase) {
    int up = 0;
    int trials = 2000;
    for (int seed = 0; seed < trials; seed++) {
      RaisingMemory memory = new RaisingMemory();
      RunState run =
          ENGINE.create(
              new HashSeededRandom(seed),
              false,
              memory,
              10_000_000,
              true,
              new RunEngine.Year(phase, null),
              null);
      run.card = NEWS_SLOT;
      ENGINE.deal(run, memory, new HashSeededRandom(seed));
      if (run.current.up) {
        up++;
      }
    }
    return up / (double) trials;
  }

  /** ZZ 사수가 붙은 공채 신입은 사수의 가장 높은 능력치 하나를 한 띠 높게 시작하고, 첫 카드에 그 한 줄이 뜬다 (2.4절). */
  @Test
  void 사수가_붙은_신입은_한_띠_높게_시작한다() {
    RaisingMemory m1 = new RaisingMemory();
    RaisingMemory m2 = new RaisingMemory();
    RunState plain =
        ENGINE.create(new HashSeededRandom(5), false, m1, 10_000_000, true, null, null);
    RunState mentored =
        ENGINE.create(
            new HashSeededRandom(5),
            false,
            m2,
            10_000_000,
            true,
            null,
            new RunEngine.Mentor("courage", 10, "사수 김대리가 붙었다."));
    assertThat(mentored.stats.get("courage"))
        .isEqualTo(Math.min(100, plain.stats.get("courage") + 10));
    assertThat(mentored.stats.get("insight")).isEqualTo(plain.stats.get("insight"));
    assertThat(mentored.current.tips.getFirst()).isEqualTo("사수 김대리가 붙었다.");
  }

  /** 위기 전조 돌아보기 (투자 원칙 장치 설계 3.3절): 위기가 터지면 조짐을 몇 번 봤고, 첫 조짐 때 팔았다면 얼마를 피했는지 한 줄 남긴다. */
  @Test
  void 위기가_터지면_조짐을_돌아본다() {
    String omen = TestContent.load().crises().getFirst().omens().getFirst();
    for (long seed = 1; seed <= 10; seed++) {
      RaisingMemory memory = new RaisingMemory();
      memory.unlocked.add(RunEngine.UNLOCK_SIZE);
      RunState run =
          ENGINE.create(
              new HashSeededRandom(seed),
              false,
              memory,
              10_000_000,
              true,
              new RunEngine.Year("crash", omen),
              null);
      while (run.current != null) {
        // 뉴스마다 크게 사서 위기 때 주식을 들고 있게 한다. 크게 사기가 없는 카드는 마지막 선택지.
        String option =
            run.current.options.stream().anyMatch(o -> o.code.equals(RunEngine.BUY_BIG))
                ? RunEngine.BUY_BIG
                : run.current.options.getLast().code;
        ENGINE.choose(run, memory, option, new HashSeededRandom(seed));
      }
      assertThat(run.highlights).as("판 요약에도 남는다").anyMatch(h -> h.startsWith("폭락 조짐을 2번 봤다."));
    }

    RaisingMemory memory = new RaisingMemory();
    RunState silent =
        ENGINE.create(
            new HashSeededRandom(3),
            false,
            memory,
            10_000_000,
            true,
            new RunEngine.Year("crash", null),
            null);
    playThrough(silent, memory, 3);
    assertThat(silent.highlights).contains("조짐 없이 왔다. 이번엔 아무도 몰랐다.");
  }
}
