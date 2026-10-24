package investorgame.progress;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 관리자 플레이 기록용 판 한 줄. 시드·능력치 같은 숨은 값은 없다. age는 끝난 판이면 끝난 나이, 아니면 마지막으로 보고된 나이(만)다. 끝난 판에만 결과(자산·엔딩)가
 * 있다.
 */
public record GameSummary(
    UUID gameId,
    UUID sessionId,
    String status,
    int startAge,
    int age,
    OffsetDateTime startedAt,
    OffsetDateTime updatedAt,
    OffsetDateTime endedAt,
    Long initialAsset,
    Long finalAsset,
    String ending) {}
