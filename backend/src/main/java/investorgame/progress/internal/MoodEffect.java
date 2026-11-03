package investorgame.progress.internal;

import investorgame.common.Stats;

/**
 * 행복도와 가족 점수가 게임에 주는 영향 (#230, decisions.md 165번). 마음이 가라앉으면 판단이 흔들리고, 마음이 편하면 조금 단단해진다. 가족이 화목하면
 * 행복이 돌아오는 자리가 높아진다.
 */
final class MoodEffect {

  /** 이 아래면 마음이 가라앉은 것이다. */
  static final int LOW = 30;

  /** 이 이상이면 마음이 편한 것이다. */
  static final int HIGH = 70;

  /** 마음이 가라앉았을 때 인내·줏대에서 빠지는 점수. */
  static final int LOW_PENALTY = 10;

  /** 마음이 편할 때 인내·줏대에 더해지는 점수. */
  static final int HIGH_BONUS = 5;

  /** 직장 판정: 행복도 1점이 50에서 멀어질 때마다 성공 확률이 이만큼(만분율) 움직인다. ±500이 끝이다. */
  static final int CAREER_BP_PER_POINT = 10;

  static final int CAREER_BP_CAP = 500;

  private MoodEffect() {}

  /** 뉴스·흔들림의 판정에 쓰는 능력치. 인내(못 참고 팔기)와 줏대(꼬드김)만 마음을 탄다. */
  static Stats steadied(Stats stats, int happiness) {
    int shift = happiness < LOW ? -LOW_PENALTY : happiness >= HIGH ? HIGH_BONUS : 0;
    if (shift == 0) {
      return stats;
    }
    return new Stats(
        stats.insight(),
        clamp(stats.patience() + shift),
        stats.courage(),
        clamp(stats.conviction() + shift),
        stats.luck());
  }

  static boolean low(int happiness) {
    return happiness < LOW;
  }

  /** 직장 장면의 성공 확률 보정(만분율). 지치고 우울하면 일도 안 풀린다. */
  static int careerBonusBp(int happiness) {
    int bp = (happiness - 50) * CAREER_BP_PER_POINT;
    return Math.max(-CAREER_BP_CAP, Math.min(CAREER_BP_CAP, bp));
  }

  private static int clamp(int value) {
    return Math.max(0, Math.min(100, value));
  }
}
