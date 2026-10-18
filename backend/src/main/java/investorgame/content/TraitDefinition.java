package investorgame.content;

import java.util.List;
import java.util.Map;

/**
 * 성향 장면. 성장기의 구체적인 상황에서 어떤 행동을 고르는지로 네 축(기간·위험·소신·관심)과 능력치를 움직인다 (경제 개편 설계 4절). 같은 나이의 장면들이 하나의 단계를
 * 이루고, 판마다 단계별로 하나를 랜덤으로 뽑는다.
 *
 * @param age 이 장면이 속한 성장 단계의 나이. adult 장면은 단계가 없으므로 표시용이다
 * @param adult true면 성장기 단계가 아니라 취업 뒤 일상 장면이다. 간격을 두고 랜덤하게 오며 성향(스타일)은 바꾸지 않고 능력치만 움직인다
 */
public record TraitDefinition(
    String code, int age, Boolean adult, String title, String body, List<Option> options) {

  /** JSON에 adult가 없으면 성장기 장면이다. */
  public TraitDefinition {
    adult = adult != null && adult;
  }

  /**
   * @param traitDeltas 키는 "style.<코드>", "sector.<코드>", "risk.<코드>", "mind.<코드>"다. 모든 선택지는 style과
   *     sector를 하나 이상 가진다 (콘텐츠 검증)
   * @param statDeltas 선택 즉시 더해지는 능력치 변화. 키는 insight, patience, courage, conviction (운 금지). JSON에
   *     없으면 빈 맵
   * @param note 이 행동에서 무엇이 드러났는지 한 줄로 알려 주는 문구
   */
  public record Option(
      String code,
      String label,
      Map<String, Integer> traitDeltas,
      Map<String, Integer> statDeltas,
      String note) {

    public Option {
      statDeltas = statDeltas == null ? Map.of() : Map.copyOf(statDeltas);
    }
  }
}
