package investorgame.event;

import java.util.UUID;

/**
 * 알림성 생활 이벤트. 선택이 없고 만들어지는 순간 해결된다. 돈의 반영은 진행이 자산에 요청한다.
 *
 * @param amount 양수 수입, 음수 지출(원). salaryPercent가 0일 때
 * @param salaryPercent 0보다 크면 월급 × percent / 100 을 수입으로 (진행이 계산)
 * @param assetPercent 0보다 크면 지출을 순자산 × percent / 100 까지 키운다 (진행이 계산)
 */
public record Notice(
    UUID eventId,
    int occursDay,
    String code,
    String title,
    String body,
    long amount,
    int salaryPercent,
    int assetPercent) {}
