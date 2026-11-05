package investorgame.raising;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 관리자 플레이 기록의 육성 판 한 줄 (증권사 육성 설계 11.5절: 어느 카드에서 많이 나가는지). 세션을 따지지 않는 관리용 값이다.
 *
 * @param status ACTIVE·ENDED·ABANDONED
 * @param card 닿은 카드 번호(0부터). 끝난 판이면 카드 수
 * @param kind 멈춘 카드의 종류. 끝난 판이면 null
 * @param overallGrade 입사 심사의 종합 등급. 끝나지 않았으면 null
 */
public record RunSummary(
    UUID runId,
    UUID sessionId,
    String status,
    boolean scripted,
    boolean recruit,
    int card,
    int cardCount,
    CardKind kind,
    String overallGrade,
    long fund,
    long totalAsset,
    int flips,
    OffsetDateTime startedAt,
    OffsetDateTime updatedAt) {}
