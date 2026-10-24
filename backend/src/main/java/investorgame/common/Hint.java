package investorgame.common;

/**
 * 안목에 따른 힌트의 방향·강도·구체성. 문구는 콘텐츠에서 고른다 (specs/behavior.md 4.4절). 방향이 맞을 확률은 안목이 정하고(28번), 얼마나 구체적으로
 * 말하는지(detail)도 안목이 정한다 (decisions.md 53번). 강도는 안목과 무관하다.
 */
public record Hint(HintDirection direction, HintStrength strength, Detail detail) {

  /** 안목 구간. 매매창의 안목 해석 문구 틀(analysis.json의 low/mid/high/expert)과 같은 경계다. */
  public enum Detail {
    LOW,
    MID,
    HIGH,
    EXPERT;

    public static Detail of(int insight) {
      if (insight < 30) {
        return LOW;
      }
      if (insight < 60) {
        return MID;
      }
      return insight < 80 ? HIGH : EXPERT;
    }

    /** 콘텐츠 키 (low·mid·high·expert). */
    public String key() {
      return name().toLowerCase();
    }
  }

  public enum HintDirection {
    UP,
    DOWN,
    NEUTRAL
  }

  public enum HintStrength {
    MILD,
    STRONG
  }
}
