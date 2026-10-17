package investorgame.character;

import java.util.UUID;
import java.util.random.RandomGenerator;

/** 캐릭터 도메인의 입구 (specs/character.md). 워킹 스켈레톤에는 생성과 조회만 있다. 직업, 성향, 성장은 agent1이 스펙대로 추가한다. */
public interface CharacterService {

  /** 판 시작 시 능력치를 랜덤으로 만든다. 같은 gameId로 다시 부르면 기존 캐릭터를 돌려준다. */
  CharacterView create(UUID gameId, RandomGenerator rng);

  CharacterView get(UUID gameId);
}
