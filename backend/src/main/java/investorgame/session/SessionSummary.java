package investorgame.session;

import java.time.OffsetDateTime;
import java.util.UUID;

/** 관리자 플레이 기록용 세션 한 줄. 토큰 해시는 내보내지 않는다. IP는 처음·마지막 접속 주소 (decisions.md 63번). */
public record SessionSummary(
    UUID id, OffsetDateTime createdAt, OffsetDateTime lastSeenAt, String firstIp, String lastIp) {}
