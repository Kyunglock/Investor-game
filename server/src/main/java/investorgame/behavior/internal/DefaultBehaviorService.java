package investorgame.behavior.internal;

import investorgame.behavior.BehaviorService;
import investorgame.behavior.ChoiceContext;
import investorgame.behavior.Resolution;
import investorgame.common.Action;
import investorgame.common.Deviation;
import investorgame.common.Direction;
import investorgame.common.Hint;
import investorgame.common.Hint.HintDirection;
import investorgame.common.Hint.HintStrength;
import investorgame.common.Sentiment;
import investorgame.common.StatCodes;
import java.util.ArrayList;
import java.util.List;
import java.util.random.RandomGenerator;
import org.springframework.stereotype.Service;

/** 난수는 판정에 쓰이지 않는 단계도 항상 같은 순서로 뽑는다. 입력에 따라 순서가 바뀌면 재현성이 깨진다 (specs/behavior.md 4.3절). */
@Service
class DefaultBehaviorService implements BehaviorService {

  private static final int BP = 10_000;
  private static final int PERCENT = 100;

  private final BehaviorProperties properties;

  DefaultBehaviorService(BehaviorProperties properties) {
    this.properties = properties;
  }

  @Override
  public Resolution resolve(ChoiceContext context, RandomGenerator rng) {
    int convictionRoll = rng.nextInt(BP);
    int secondRoll = rng.nextInt(BP);
    int impulseRoll = rng.nextInt(PERCENT);

    List<Deviation> deviations = new ArrayList<>();
    Action action = context.choice();

    if (convictionRoll < deviationBp(context.stats().conviction())) {
      Action swayed = context.swaySentiment() == Sentiment.POS ? Action.BUY : Action.SELL;
      if (swayed != action) {
        deviations.add(new Deviation(StatCodes.CONVICTION, action, swayed));
        action = swayed;
      }
    }

    if (action == Action.HOLD) {
      if (secondRoll < deviationBp(context.stats().patience())) {
        Action impulse =
            context.holding() && impulseRoll < properties.impulseSellPercent()
                ? Action.SELL
                : Action.BUY;
        deviations.add(new Deviation(StatCodes.PATIENCE, Action.HOLD, impulse));
        action = impulse;
      }
    } else if (secondRoll < deviationBp(context.stats().courage())) {
      deviations.add(new Deviation(StatCodes.COURAGE, action, Action.HOLD));
      action = Action.HOLD;
    }
    return new Resolution(action, List.copyOf(deviations));
  }

  @Override
  public Hint hint(int insight, Direction truth, RandomGenerator rng) {
    int neutralRoll = rng.nextInt(PERCENT);
    int accuracyRoll = rng.nextInt(BP);
    int strongRoll = rng.nextInt(PERCENT);
    BehaviorProperties.HintSettings settings = properties.hint();

    if (insight < settings.neutralBelowInsight() && neutralRoll < settings.neutralPercent()) {
      return new Hint(HintDirection.NEUTRAL, HintStrength.MILD);
    }
    int accuracyBp = settings.accuracyBaseBp() + insight * settings.accuracyPerPointBp();
    Direction pointed = accuracyRoll < accuracyBp ? truth : opposite(truth);
    HintStrength strength =
        insight >= settings.strongFromInsight() && strongRoll < settings.strongPercent()
            ? HintStrength.STRONG
            : HintStrength.MILD;
    return new Hint(pointed == Direction.UP ? HintDirection.UP : HintDirection.DOWN, strength);
  }

  @Override
  public int lossFactorPercent(int luck, RandomGenerator rng) {
    BehaviorProperties.LuckSettings settings = properties.luck();
    return rng.nextInt(BP) < luck * settings.chancePerPointBp()
        ? settings.lossFactorPercent()
        : PERCENT;
  }

  /** 능력치가 0이면 상한, 100이면 0. */
  private int deviationBp(int stat) {
    return (PERCENT - stat) * properties.deviationCapBp() / PERCENT;
  }

  private static Direction opposite(Direction direction) {
    return direction == Direction.UP ? Direction.DOWN : Direction.UP;
  }
}
