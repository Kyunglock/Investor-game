package investorgame.session;

import java.util.Optional;
import java.util.UUID;

/** 계정 없는 익명 세션. 마지막 접속 후 정해진 시간이 지나면 만료된다 (decisions.md 9번). */
public interface SessionService {

  /** 새 세션을 발급한다. 토큰 원문은 이 반환값에만 있고 DB에는 해시만 저장한다. */
  IssuedSession issue();

  /** 토큰이 유효하면 세션 ID를 돌려주고 마지막 접속 시각을 갱신한다. 만료되었거나 없으면 비어 있다. */
  Optional<UUID> resolve(String token);
}
