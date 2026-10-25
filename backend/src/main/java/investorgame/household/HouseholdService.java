package investorgame.household;

import java.util.UUID;

/**
 * 가계 도메인의 입구 (경제 개편 설계 7절). 결혼·자녀·은퇴 상태를 소유하고 월 지출과 배우자 소득을 계산한다. 지출·입금 자체는 진행이 자산에 요청한다. 직업은 모르므로
 * "생활비가 언제부터 나가는가"는 진행이 정한다.
 */
public interface HouseholdService {

  /** 판 시작 시 빈 가계를 만든다. 이미 있으면 아무것도 하지 않는다. */
  void create(UUID gameId);

  HouseholdView get(UUID gameId);

  /** 이미 결혼했으면 InvalidRequestException. */
  void marry(UUID gameId, int gameDay);

  /** 자녀를 더한다. 1부터 시작하는 순번을 돌려준다. leaveAge는 아이가 독립해 집을 나가는 나이(세) (decisions.md 68번). */
  int addChild(UUID gameId, int gameDay, int leaveAge);

  /** 은퇴. 이미 은퇴했으면 아무것도 하지 않는다. */
  void retire(UUID gameId, int gameDay);

  /** 생활비(1인/부부) + 자녀 나이별 비용(독립하면 0). 물가는 기준 나이부터 연 복리. */
  long monthlyExpense(UUID gameId, int gameDay);

  /** 배우자 소득. 미혼이거나 은퇴 뒤면 0. 물가 반영. */
  long spouseIncome(UUID gameId, int gameDay);

  /** 연금. 은퇴 전이면 0, 은퇴 뒤 1인/부부 금액. 물가 반영 (decisions.md 27번). */
  /** 은퇴 뒤, 또는 은퇴 나이가 지난 뒤(정년 없는 직업으로 일하는 중이어도) 매달 연금. 그 전엔 0 (decisions.md 27·57번). */
  long pension(UUID gameId, int gameDay);

  long weddingCost(int gameDay);

  long childbirthCost(int gameDay);

  /** 기준 금액(취업 나이 시점)에 그날까지의 물가를 붙인다. 월세처럼 다른 도메인이 정한 금액에 쓴다. */
  long inflated(long amount, int gameDay);

  /** 이 날이 은퇴 나이의 첫날인가. */
  boolean retireMonth(int gameDay);
}
