package investorgame.content;

import java.util.List;
import java.util.Map;

/** 성향 이벤트. 상황을 주고 어떻게 행동하는지로 투자 스타일과 관심 섹터를 정한다 (decisions.md 5번). */
public record TraitDefinition(
    String code, int order, String title, String body, List<Option> options) {

  /** traitDeltas의 키는 "style.<코드>" 또는 "sector.<코드>"다 (specs/character.md 4.3절). */
  public record Option(String code, String label, Map<String, Integer> traitDeltas) {}
}
