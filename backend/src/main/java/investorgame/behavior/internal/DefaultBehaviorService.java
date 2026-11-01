package investorgame.behavior.internal;

import investorgame.behavior.BehaviorService;
import investorgame.behavior.ChoiceContext;
import investorgame.behavior.Reading;
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

  /** 줏대 이탈의 꼬드김 출처. 화면 문구는 프론트(labels.ts)가 코드별로 가진다 (behavior.md 4.2절). */
  static final List<String> TEMPTERS =
      List.of("youtuber", "friend", "community", "broadcast", "relative");

  private final BehaviorProperties properties;

  DefaultBehaviorService(BehaviorProperties properties) {
    this.properties = properties;
  }

  @Override
  public Resolution resolve(ChoiceContext context, RandomGenerator rng) {
    int convictionRoll = rng.nextInt(BP);
    int secondRoll = rng.nextInt(BP);
    int tempterRoll = rng.nextInt(TEMPTERS.size());

    List<Deviation> deviations = new ArrayList<>();
    Action action = context.choice();

    // 줏대: 누군가(유튜버·지인…)가 "다른 뉴스"를 들고 꼬드긴다. "다른 뉴스"가 없는 자유 매매는 건너뛴다. 난수는 이미 뽑았으므로 순서는 그대로다.
    if (context.swaySentiment() != null
        && convictionRoll < deviationBp(context.stats().conviction())) {
      Action tempted = tempted(context.swaySentiment(), action, context.holding());
      if (tempted != action) {
        deviations.add(
            new Deviation(StatCodes.CONVICTION, action, tempted, TEMPTERS.get(tempterRoll)));
        action = tempted;
      }
    }

    if (action == Action.HOLD) {
      // 인내심: 들고 있는 걸 지켜보려다 못 참고 판다. 보유가 없으면 참을 것도 없다 (관망→매수는 줏대만 만든다).
      if (context.holding() && secondRoll < deviationBp(context.stats().patience())) {
        deviations.add(new Deviation(StatCodes.PATIENCE, Action.HOLD, Action.SELL));
        action = Action.SELL;
      }
    } else if (secondRoll < deviationBp(context.stats().courage())) {
      deviations.add(new Deviation(StatCodes.COURAGE, action, Action.HOLD));
      action = Action.HOLD;
    }
    // 꼬드김에 넘어갔다가 용기가 없어 제자리로 돌아왔으면 결과는 고른 그대로다: 이탈로 치지 않는다 (decisions.md 125번).
    if (action == context.choice()) {
      return new Resolution(action, List.of());
    }
    return new Resolution(action, List.copyOf(deviations));
  }

  /**
   * 꼬드김이 미는 행동. 좋은 소식이면 사라고, 나쁜 소식이면 팔라고 한다. 팔 게 없으면(보유 없음) 사려던 사람은 접고(HOLD) 관망하던 사람은 그대로다. 보유 없이
   * SELL이 되는 일은 없다.
   */
  private static Action tempted(Sentiment sway, Action current, boolean holding) {
    if (sway == Sentiment.POS) {
      return Action.BUY;
    }
    return holding ? Action.SELL : Action.HOLD;
  }

  @Override
  public Hint hint(int insight, Direction truth, RandomGenerator rng) {
    int neutralRoll = rng.nextInt(PERCENT);
    int accuracyRoll = rng.nextInt(BP);
    int strongRoll = rng.nextInt(PERCENT);
    BehaviorProperties.HintSettings settings = properties.hint();

    if (insight < settings.neutralBelowInsight() && neutralRoll < settings.neutralPercent()) {
      return new Hint(HintDirection.NEUTRAL, HintStrength.MILD, Hint.Detail.of(insight));
    }
    int accuracyBp = settings.accuracyBaseBp() + insight * settings.accuracyPerPointBp();
    Direction pointed = accuracyRoll < accuracyBp ? truth : opposite(truth);
    // 강도는 안목과 무관하다. 낮은 안목의 "아주 좋다!"는 자신만만한 헛소리다 (decisions.md 28번).
    HintStrength strength =
        strongRoll < settings.strongPercent() ? HintStrength.STRONG : HintStrength.MILD;
    return new Hint(
        pointed == Direction.UP ? HintDirection.UP : HintDirection.DOWN,
        strength,
        Hint.Detail.of(insight));
  }

  @Override
  public int luckFactorPercent(int luck, Direction truth, RandomGenerator rng) {
    BehaviorProperties.LuckSettings settings = properties.luck();
    if (rng.nextInt(BP) >= luck * settings.chancePerPointBp()) {
      return PERCENT;
    }
    return truth == Direction.DOWN ? settings.lossFactorPercent() : settings.gainBonusPercent();
  }

  @Override
  public Reading analyze(int insight, int truth, int choices, RandomGenerator rng) {
    int readRoll = rng.nextInt(BP);
    int guessRoll = rng.nextInt(Math.max(1, choices));
    int confidentRoll = rng.nextInt(PERCENT);
    BehaviorProperties.AnalysisSettings settings = properties.analysis();

    // 틀릴 때 정답의 반대가 아니라 찍기를 쓴다. 반대로 하면 안목이 낮을수록 뒤집어 읽는 게 정답이 된다 (매매창 설계 4.2절).
    boolean read = readRoll < insight * settings.readAtMaxBp() / PERCENT;
    int index = read ? truth : guessRoll;
    return new Reading(index, confidentRoll < settings.confidentPercent());
  }

  /** 능력치가 0이면 상한, 100이면 0. */
  private int deviationBp(int stat) {
    return (PERCENT - stat) * properties.deviationCapBp() / PERCENT;
  }

  private static Direction opposite(Direction direction) {
    return direction == Direction.UP ? Direction.DOWN : Direction.UP;
  }
}
