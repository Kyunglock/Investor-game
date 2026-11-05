package investorgame.raising;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 관리자 플레이 기록의 회사 한 줄 (decisions.md 228번). 3분 육성 판 대신 회사가 어디까지 갔는지 본다.
 *
 * @param number 사장이 차린 몇 번째 회사인가
 * @param year 지금 해. 시대가 끝났으면 turns + 1
 * @param sold 팔렸는가
 * @param settled 결산한 해의 수
 */
public record CompanySummary(
    UUID companyId,
    UUID sessionId,
    String status,
    int number,
    String era,
    int year,
    int settled,
    long capital,
    String grade,
    int employees,
    boolean sold,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {}
