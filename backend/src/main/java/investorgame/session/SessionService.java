package investorgame.session;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** 계정 없는 익명 세션. 마지막 접속 후 정해진 시간이 지나면 만료된다 (decisions.md 9번). */
public interface SessionService {

  /** 새 세션을 발급한다. 토큰 원문은 이 반환값에만 있고 DB에는 해시만 저장한다. ip는 처음 접속한 주소 (decisions.md 63번). */
  IssuedSession issue(String ip);

  /** 토큰이 유효하면 세션 ID를 돌려주고 마지막 접속 시각·IP를 갱신한다. 만료되었거나 없으면 비어 있다. */
  Optional<UUID> resolve(String token, String ip);

  /** 마지막 접속이 최근인 세션부터 limit개. 관리자 플레이 기록용이며 만료된 세션도 포함한다. */
  List<SessionSummary> recent(int limit);
}
