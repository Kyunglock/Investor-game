package investorgame.character;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.random.RandomGenerator;

/** 캐릭터 도메인의 입구 (specs/character.md). */
public interface CharacterService {

  /** 판 시작 시 능력치를 랜덤으로 만든다. 같은 gameId로 다시 부르면 기존 캐릭터를 돌려준다. */
  CharacterView create(UUID gameId, RandomGenerator rng);

  CharacterView get(UUID gameId);

  /** 직업을 확정한다. 판당 한 번만 가능하다(이직 불가). */
  void assignJob(UUID gameId, String jobCode, int startDay);

  /** 성향 이벤트의 선택 하나를 점수로 누적한다. 키는 "style.<코드>" 또는 "sector.<코드>". */
  void recordTraitChoice(UUID gameId, Map<String, Integer> traitDeltas);

  /** 누적 점수로 투자 스타일과 관심 섹터를 확정한다. 이미 확정되었으면 그 값을 돌려준다. */
  TraitResult finalizeTraits(UUID gameId, RandomGenerator rng);

  /** 성장 원인을 반영한다. 운은 성장하지 않는다. 경험치를 얻은 능력치의 변화만 돌려준다. */
  List<StatChange> grow(UUID gameId, List<GrowthSource> sources, int gameDay);

  /** 연차(년). 직업이 없으면 0. */
  int tenureYears(UUID gameId, int currentDay);
}
