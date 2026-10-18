package investorgame.character;

import java.util.List;

/**
 * 위험·소신 축의 후보 코드 목록. 점수가 하나도 없는 축은 이 후보에서 난수로 정한다. 캐릭터는 콘텐츠를 읽지 않으므로 진행이 넘긴다.
 *
 * @param risks 위험 축 코드 (예 bold, safe)
 * @param minds 소신 축 코드 (예 own, crowd)
 */
public record TraitAxes(List<String> risks, List<String> minds) {}
