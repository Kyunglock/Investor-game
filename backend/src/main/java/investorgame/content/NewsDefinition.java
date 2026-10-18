package investorgame.content;

import java.util.List;

/**
 * 뉴스 정의 (specs/event.md 6절). 뉴스 연결(followups)은 아직 다루지 않는다. 제목·본문의 "{stock}"은 뽑힌 종목 이름으로 바뀐다.
 *
 * @param styles 이 뉴스가 나오는 투자 스타일. null이면 모든 스타일
 * @param sectorWide true면 충격이 섹터 모든 종목에 같은 폭으로 간다. false(기본)면 뽑힌 종목에 가고 같은 섹터에 일부 파급된다
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
    DirectionRule directionRule,
    Boolean sectorWide) {

  public NewsDefinition {
    // JSON에 없으면 false. 기본형이면 Jackson이 null을 거부하므로 래퍼로 받아 정리한다.
    sectorWide = sectorWide != null && sectorWide;
  }

  public record Magnitude(int minBp, int maxBp) {}

  /** type은 아직 FREE만 쓴다. upBp 확률로 오른다. */
  public record DirectionRule(String type, int upBp) {}

  public boolean appearsFor(String style) {
    return styles == null || style == null || styles.contains(style);
  }
}
