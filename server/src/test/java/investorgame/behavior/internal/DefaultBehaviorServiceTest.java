package investorgame.behavior.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.ChoiceContext;
import investorgame.behavior.Resolution;
import investorgame.common.Action;
import investorgame.common.Deviation;
import investorgame.common.Direction;
import investorgame.common.Hint;
import investorgame.common.Hint.HintDirection;
import investorgame.common.Hint.HintStrength;
import investorgame.common.Sentiment;
import investorgame.common.Stats;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.SplittableRandom;
import java.util.function.Predicate;
import java.util.random.RandomGenerator;
import org.junit.jupiter.api.Test;

/** specs/behavior.md 7절의 시나리오. 난수는 정해 둔 값을 차례로 돌려주는 대역을 쓴다. */
class DefaultBehaviorServiceTest {

  private static final int TRIALS = 20_000;
  private static final int MISS = 9_999;
  private static final int HIT = 0;

  private final DefaultBehaviorService service =
      new DefaultBehaviorService(
          new BehaviorProperties(
              5000,
              40,
              new BehaviorProperties.HintSettings(2500, 55, 35, 50, 65, 70),
              new BehaviorProperties.LuckSettings(30, 30)));

  @Test
  void 인내심과_줏대가_100이면_관망은_그대로다() {
    Resolution r =
        resolve(Action.HOLD, stats(50, 100, 50, 100, 50), Sentiment.POS, false, HIT, HIT, HIT);
    assertThat(r.actual()).isEqualTo(Action.HOLD);
    assertThat(r.deviations()).isEmpty();
  }

  @Test
  void 용기와_줏대가_100이면_매수는_그대로다() {
    Resolution r =
        resolve(Action.BUY, stats(50, 50, 100, 100, 50), Sentiment.NEG, false, HIT, HIT, HIT);
    assertThat(r.actual()).isEqualTo(Action.BUY);
    assertThat(r.deviations()).isEmpty();
  }

  @Test
  void 인내심이_부족하면_보유가_없을_때_충동_매수한다() {
    Resolution r =
        resolve(Action.HOLD, stats(50, 0, 50, 100, 50), Sentiment.POS, false, MISS, HIT, HIT);
    assertThat(r.actual()).isEqualTo(Action.BUY);
    assertThat(r.deviations()).containsExactly(new Deviation("patience", Action.HOLD, Action.BUY));
  }

  @Test
  void 인내심이_부족하고_보유가_있으면_충동_매도할_수_있다() {
    assertThat(
            resolve(Action.HOLD, stats(50, 0, 50, 100, 50), Sentiment.POS, true, MISS, HIT, 39)
                .actual())
        .isEqualTo(Action.SELL);
    assertThat(
            resolve(Action.HOLD, stats(50, 0, 50, 100, 50), Sentiment.POS, true, MISS, HIT, 40)
                .actual())
        .isEqualTo(Action.BUY);
  }

  @Test
  void 용기가_부족하면_매수를_누르고도_관망한다() {
    Resolution r =
        resolve(Action.BUY, stats(50, 50, 0, 100, 50), Sentiment.POS, false, MISS, HIT, HIT);
    assertThat(r.actual()).isEqualTo(Action.HOLD);
    assertThat(r.deviations()).containsExactly(new Deviation("courage", Action.BUY, Action.HOLD));
  }

  @Test
  void 줏대가_부족하면_다른_뉴스를_따른다() {
    Resolution r =
        resolve(Action.BUY, stats(50, 50, 100, 0, 50), Sentiment.NEG, false, HIT, MISS, HIT);
    assertThat(r.actual()).isEqualTo(Action.SELL);
    assertThat(r.deviations())
        .containsExactly(new Deviation("conviction", Action.BUY, Action.SELL));
  }

  @Test
  void 다른_뉴스가_같은_방향이면_이탈로_기록하지_않는다() {
    Resolution r =
        resolve(Action.BUY, stats(50, 50, 100, 0, 50), Sentiment.POS, false, HIT, MISS, HIT);
    assertThat(r.actual()).isEqualTo(Action.BUY);
    assertThat(r.deviations()).isEmpty();
  }

  @Test
  void 줏대로_바뀐_행동은_이어서_용기_판정을_받는다() {
    Resolution r =
        resolve(Action.HOLD, stats(50, 50, 0, 0, 50), Sentiment.POS, false, HIT, HIT, HIT);
    assertThat(r.actual()).isEqualTo(Action.HOLD);
    assertThat(r.deviations())
        .containsExactly(
            new Deviation("conviction", Action.HOLD, Action.BUY),
            new Deviation("courage", Action.BUY, Action.HOLD));
  }

  @Test
  void 같은_시드면_같은_결과다() {
    Stats weak = stats(0, 0, 0, 0, 0);
    for (int seed = 0; seed < 100; seed++) {
      ChoiceContext context = new ChoiceContext(Action.HOLD, weak, Sentiment.NEG, true);
      assertThat(service.resolve(context, new SplittableRandom(seed)))
          .isEqualTo(service.resolve(context, new SplittableRandom(seed)));
    }
  }

  @Test
  void 이탈_확률은_능력치_0이면_약_50퍼센트_100이면_0이다() {
    assertThat(courageDeviationRate(0)).isBetween(0.48, 0.52);
    assertThat(courageDeviationRate(100)).isZero();
  }

  @Test
  void 안목_0의_힌트는_모호하지_않을_때_약_25퍼센트_맞는다() {
    assertThat(hintAccuracy(0)).isBetween(0.23, 0.27);
  }

  @Test
  void 안목_100의_힌트는_약_80퍼센트_맞고_모호하지_않다() {
    assertThat(hintAccuracy(100)).isBetween(0.78, 0.82);
    SplittableRandom rng = new SplittableRandom(1);
    for (int i = 0; i < TRIALS; i++) {
      assertThat(service.hint(100, Direction.UP, rng).direction())
          .isNotEqualTo(HintDirection.NEUTRAL);
    }
  }

  @Test
  void 모호와_강한_힌트의_경계() {
    assertThat(anyHint(34, h -> h.direction() == HintDirection.NEUTRAL)).isTrue();
    assertThat(anyHint(35, h -> h.direction() == HintDirection.NEUTRAL)).isFalse();
    assertThat(anyHint(64, h -> h.strength() == HintStrength.STRONG)).isFalse();
    assertThat(anyHint(65, h -> h.strength() == HintStrength.STRONG)).isTrue();
  }

  @Test
  void 운_0이면_손실을_줄이지_않고_100이면_약_30퍼센트_줄인다() {
    SplittableRandom rng = new SplittableRandom(7);
    int softened0 = 0;
    int softened100 = 0;
    for (int i = 0; i < TRIALS; i++) {
      softened0 += service.lossFactorPercent(0, rng) < 100 ? 1 : 0;
      softened100 += service.lossFactorPercent(100, rng) < 100 ? 1 : 0;
    }
    assertThat(softened0).isZero();
    assertThat((double) softened100 / TRIALS).isBetween(0.28, 0.32);
  }

  @Test
  void 능력치_범위를_벗어나면_거부한다() {
    assertThatThrownBy(() -> stats(-1, 50, 50, 50, 50))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> stats(50, 101, 50, 50, 50))
        .isInstanceOf(IllegalArgumentException.class);
  }

  private Resolution resolve(
      Action choice, Stats stats, Sentiment sway, boolean holding, int... rolls) {
    return service.resolve(new ChoiceContext(choice, stats, sway, holding), new Scripted(rolls));
  }

  private double courageDeviationRate(int courage) {
    SplittableRandom rng = new SplittableRandom(3);
    int deviated = 0;
    for (int i = 0; i < TRIALS; i++) {
      ChoiceContext context =
          new ChoiceContext(Action.BUY, stats(50, 50, courage, 100, 50), Sentiment.POS, false);
      deviated += service.resolve(context, rng).actual() != Action.BUY ? 1 : 0;
    }
    return (double) deviated / TRIALS;
  }

  private double hintAccuracy(int insight) {
    SplittableRandom rng = new SplittableRandom(5);
    int pointed = 0;
    int correct = 0;
    for (int i = 0; i < TRIALS; i++) {
      Hint hint = service.hint(insight, Direction.UP, rng);
      if (hint.direction() != HintDirection.NEUTRAL) {
        pointed++;
        correct += hint.direction() == HintDirection.UP ? 1 : 0;
      }
    }
    return (double) correct / pointed;
  }

  private boolean anyHint(int insight, Predicate<Hint> condition) {
    SplittableRandom rng = new SplittableRandom(11);
    for (int i = 0; i < 2_000; i++) {
      if (condition.test(service.hint(insight, Direction.UP, rng))) {
        return true;
      }
    }
    return false;
  }

  private static Stats stats(int insight, int patience, int courage, int conviction, int luck) {
    return new Stats(insight, patience, courage, conviction, luck);
  }

  /** nextInt(bound)마다 정해 둔 값을 차례로 돌려준다. 판정은 "값 < 확률"이면 걸리므로 HIT(0)은 걸리고 MISS(9999)는 안 걸린다. */
  private static final class Scripted implements RandomGenerator {
    private final Deque<Integer> values = new ArrayDeque<>();

    Scripted(int... values) {
      for (int value : values) {
        this.values.add(value);
      }
    }

    @Override
    public int nextInt(int bound) {
      return Math.min(values.removeFirst(), bound - 1);
    }

    @Override
    public long nextLong() {
      throw new UnsupportedOperationException("판정은 nextInt(bound)만 쓴다");
    }
  }
}
