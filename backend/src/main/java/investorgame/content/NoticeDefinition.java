package investorgame.content;

import java.util.List;

/**
 * 알림성 생활 이벤트 (경제 개편 설계 7.3절). 선택이 없고 돈만 오간다.
 *
 * @param amount 양수면 수입, 음수면 지출(원). salaryPercent가 0일 때 쓴다
 * @param salaryPercent 0보다 크면 amount 대신 월급 × percent / 100을 수입으로 준다
 * @param assetPercent 0보다 크면 지출을 순자산 × percent / 100까지 키운다. amount는 최소 지출로 남는다(부자가 된 뒤에도 같은 돈만 쓰면
 *     어색하다)
 * @param requiresMarried true면 결혼한 뒤에만 나온다
 * @param requiresJob true면 직장에 다니는 동안에만 나온다(보너스·연말정산)
 * @param requiresChildren true면 자녀가 있을 때만 나온다(학원·입학)
 * @param excludeJobs 이 직업에게는 말이 안 되는 알림(농부에게 명절 보너스·연말정산). 비어 있으면 모든 직업 (decisions.md 134번)
 * @param childMinAge requiresChildren일 때 집에 있는 아이 가운데 이 나이 이상인 아이가 있어야 한다. null이면 제한 없음 (134번)
 * @param childMaxAge requiresChildren일 때 그 아이가 이 나이 이하여야 한다. null이면 제한 없음
 */
public record NoticeDefinition(
    String code,
    String title,
    String body,
    long amount,
    int salaryPercent,
    int assetPercent,
    int weight,
    boolean requiresMarried,
    boolean requiresJob,
    boolean requiresChildren,
    List<String> excludeJobs,
    Integer childMinAge,
    Integer childMaxAge) {

  public NoticeDefinition {
    excludeJobs = excludeJobs == null ? List.of() : List.copyOf(excludeJobs);
  }

  public boolean fitsJob(String jobCode) {
    return jobCode == null || !excludeJobs.contains(jobCode);
  }

  /** 아이 나이 조건이 있는가. */
  public boolean childAgeBound() {
    return childMinAge != null || childMaxAge != null;
  }

  public boolean fitsChildAge(int age) {
    return (childMinAge == null || age >= childMinAge)
        && (childMaxAge == null || age <= childMaxAge);
  }
}
