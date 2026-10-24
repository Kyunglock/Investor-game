package investorgame.session;

import java.time.OffsetDateTime;
import java.util.UUID;

/** 관리자 플레이 기록용 세션 한 줄. 토큰 해시는 내보내지 않는다. */
public record SessionSummary(UUID id, OffsetDateTime createdAt, OffsetDateTime lastSeenAt) {}
