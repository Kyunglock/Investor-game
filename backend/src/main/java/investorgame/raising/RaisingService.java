package investorgame.raising;

import java.util.Optional;
import java.util.UUID;

/**
 * 3분 육성 한 판 (증권사 육성 설계 3절). 나이도 시계도 없고 카드 수가 판의 끝이다. 요청마다 판을 잠그고 한 트랜잭션에서 처리한다. 능력치 판정과 형광펜은 행동
 * 도메인의 규칙을, 뉴스·종목·위기는 콘텐츠를 쓴다.
 */
public interface RaisingService {

  /** 새 판을 시작한다. 진행 중인 판이 있으면 버린다. 세션의 첫 판은 짜인 판이다 (11.2절). */
  RunView start(UUID sessionId);

  /** 세션의 가장 최근 판(진행 중 또는 끝남). */
  Optional<RunView> current(UUID sessionId);

  /**
   * 펼쳐진 카드에 선택을 낸다. card는 화면이 본 카드 번호로, 지금 카드와 다르면(두 번 누름, 늦은 요청) 400이다. 고를 수 없는 선택도 400.
   *
   * @throws investorgame.common.error.NotFoundException 세션의 진행 중인 판이 아닐 때
   */
  RunChoice choose(UUID sessionId, UUID runId, int card, String option);
}
