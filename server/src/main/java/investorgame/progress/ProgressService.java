package investorgame.progress;

import java.util.Optional;
import java.util.UUID;

/**
 * 진행 도메인의 입구. 한 판의 조율을 맡고, 다른 게임 규칙 도메인을 호출하는 유일한 도메인이다 (domains.md 3절). 워킹 스켈레톤에는 판 시작, 조회, 시각 보고만
 * 있다. 이벤트·선택·종료는 agent5가 progress 스펙대로 추가한다.
 */
public interface ProgressService {

  /** 새 판을 시작한다. 진행 중인 판이 있으면 버리고(ABANDONED) 새로 만든다 (다시 시작하기). */
  GameView start(UUID sessionId);

  /** 세션의 진행 중인 판. 재접속 시 이어하기에 쓴다. */
  Optional<GameView> current(UUID sessionId);

  /** 클라이언트가 보고한 게임 일수로 판을 진행한다. 시각은 거꾸로 갈 수 없고, 한 번에 건너뛸 수 있는 구간에 상한이 있다. */
  GameView advance(UUID sessionId, UUID gameId, int day);
}
