package investorgame.content;

import java.util.List;

/**
 * 뉴스 정의 (specs/event.md 6절). 뉴스 연결(followups)은 아직 다루지 않는다.
 *
 * @param styles 이 뉴스가 나오는 투자 스타일. null이면 모든 스타일
 */
public record NewsDefinition(
    String code,
    String sector,
    boolean root,
    int weight,
    String title,
    String body,
    List<String> styles,
    Magnitude magnitude,
    DirectionRule directionRule) {

  public record Magnitude(int minBp, int maxBp) {}

  /** type은 아직 FREE만 쓴다. upBp 확률로 오른다. */
  public record DirectionRule(String type, int upBp) {}

  public boolean appearsFor(String style) {
    return styles == null || style == null || styles.contains(style);
  }
}
