package investorgame.raising;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 관리자 플레이 기록의 회사 한 줄 (decisions.md 228번). 3분 육성 판 대신 회사가 어디까지 갔는지 본다.
 *
 * @param number 사장이 차린 몇 번째 회사인가
 * @param sold 팔렸는가
 */
public record CompanySummary(
    UUID companyId,
    UUID sessionId,
    String status,
    int number,
    String era,
    long capital,
    String grade,
    int employees,
    boolean sold,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {}
