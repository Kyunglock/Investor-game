package investorgame.result;

import investorgame.common.Stats;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * deviationCounts는 능력치별 이탈 횟수다. finalStats는 종료 시점 능력치 스냅샷이다 (decisions.md 21번). ending은 끝난 이유이고
 * 파산이면 finalAge는 파산한 나이, finalAsset은 음수다 (27번).
 */
public record GameResult(
    UUID gameId,
    UUID sessionId,
    String contentVersion,
    long initialAsset,
    long finalAsset,
    int finalAge,
    Ending ending,
    Stats finalStats,
    Map<String, Integer> deviationCounts,
    OffsetDateTime startedAt,
    OffsetDateTime endedAt) {}
