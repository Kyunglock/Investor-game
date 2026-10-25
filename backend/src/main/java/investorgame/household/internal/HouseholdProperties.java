package investorgame.household.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 가계 수치 (경제 개편 설계 7.2절·13절). 금액은 원, 물가는 inflationBaseAge부터 연 복리.
 *
 * @param startAge 판이 시작하는 나이. progress.start-age와 같은 값을 따로 둔다 (도메인이 진행 설정을 읽지 않는다)
 * @param inflationBaseAge 이 나이부터 물가가 오른다 (취업 나이)
 * @param retireAge 월급과 배우자 소득이 끊기는 나이
 * @param pensionSingle 은퇴 뒤 매달 연금(1인). 물가 반영
 * @param pensionCouple 은퇴 뒤 매달 연금(부부)
 */
@ConfigurationProperties("household")
public record HouseholdProperties(
    long livingSingle,
    long livingCouple,
    ChildCost childCost,
    long weddingCost,
    long childbirthCost,
    long spouseIncome,
    long pensionSingle,
    long pensionCouple,
    int inflationPercent,
    int inflationBaseAge,
    int retireAge,
    int startAge) {

  /** 자녀 나이 구간별 월 비용. adult는 23세부터 독립해 나갈 때까지, 나간 뒤는 0 (decisions.md 68번). */
  public record ChildCost(long toAge6, long toAge12, long toAge18, long toAge22, long adult) {}
}
