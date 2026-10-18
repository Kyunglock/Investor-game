package investorgame.content;

/**
 * 알림성 생활 이벤트 (경제 개편 설계 7.3절). 선택이 없고 돈만 오간다.
 *
 * @param amount 양수면 수입, 음수면 지출(원). salaryPercent가 0일 때 쓴다
 * @param salaryPercent 0보다 크면 amount 대신 월급 × percent / 100을 수입으로 준다
 * @param requiresMarried true면 결혼한 뒤에만 나온다
 */
public record NoticeDefinition(
    String code,
    String title,
    String body,
    long amount,
    int salaryPercent,
    int weight,
    boolean requiresMarried) {}
