package investorgame.result;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 최종 자산 순위표의 한 줄 (decisions.md 141번). 끝난 판에 사용자가 이름을 적어 올린 것만 있다. 세션과 연결되지 않아 세션이 만료돼도 남는다.
 * jobTitle은 끝날 때의 직업이며 없으면 null.
 */
public record RankingEntry(
    UUID gameId,
    String name,
    long finalAsset,
    int finalAge,
    Ending ending,
    String jobTitle,
    OffsetDateTime enteredAt) {}
