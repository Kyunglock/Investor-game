package investorgame.common;

/** 안목에 따른 힌트의 방향과 강도. 문구는 콘텐츠에서 고른다 (specs/behavior.md 4.4절). */
public record Hint(HintDirection direction, HintStrength strength) {

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
