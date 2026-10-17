package investorgame.content;

import java.util.List;
import java.util.Map;

/**
 * 성향 장면. 성장기의 일상 딜레마(밸런스 게임)에서 어떤 행동을 고르는지로 투자 스타일과 관심 섹터를 유추한다 (decisions.md 5번). 같은 나이의 장면들이 하나의
 * 단계를 이루고, 판마다 단계별로 하나를 랜덤으로 뽑는다.
 *
 * @param age 이 장면이 속한 성장 단계의 나이
 */
public record TraitDefinition(
    String code, int age, String title, String body, List<Option> options) {

  /**
   * @param traitDeltas 키는 "style.<코드>" 또는 "sector.<코드>"다. 모든 선택지는 둘 다 하나 이상 가진다 (콘텐츠 검증)
   * @param note 이 행동에서 무엇이 드러났는지 한 줄로 알려 주는 문구
   */
  public record Option(String code, String label, Map<String, Integer> traitDeltas, String note) {}
}
