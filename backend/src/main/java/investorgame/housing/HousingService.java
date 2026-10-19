package investorgame.housing;

import java.util.UUID;

/**
 * 주거 도메인의 입구 (주거 설계 2절). 거주 형태·보증금·만기·보유 아파트·주담대·전세대출·매물 상태를 소유한다. 시세와 금리는 모른다: 진행이 시장에서 읽어 넘긴다. 돈의
 * 입출금은 진행이 자산에 요청한다.
 */
public interface HousingService {

  /** 판 시작 시 부모님 집에 산다. 이미 있으면 아무것도 하지 않는다. */
  void create(UUID gameId);

  HousingView get(UUID gameId);

  /** 세를 든다(이사). 만기는 lease-years 뒤. 끝난 세를 돌려준다(자가였으면 보증금 0). */
  Lease rent(
      UUID gameId,
      Tenure tenure,
      String region,
      long deposit,
      long monthlyRent,
      long jeonseLoan,
      boolean insured,
      int day);

  /** 같은 집에 lease-years 더 산다. 보증금·월세·전세대출이 바뀐다. 세입자가 아니면 오류. */
  void renew(UUID gameId, long deposit, long monthlyRent, long jeonseLoan, int day);

  /** 내가 살 아파트를 산다. 끝난 세를 돌려준다. 이미 2채면 오류. */
  Lease buyResidence(UUID gameId, String region, long price, long mortgage, int day);

  /** 세입자를 끼고 아파트를 산다(갭투자). 주담대 없이 세입자 보증금 + 현금. 이미 2채면 오류. */
  void buyGap(UUID gameId, String region, long price, long tenantDeposit, int day);

  /** 매물로 내놓거나(day) 거둔다(null). */
  void setListed(UUID gameId, int seq, Integer listedDay);

  /** 매수자가 나와 팔린다. 내가 살던 집이면 거주 형태가 월세(보증금 0, 만기 오늘)로 바뀌어 곧 이사할 곳을 고른다. */
  HomeSale sell(UUID gameId, int seq, long price, int day);

  /** 갭투자 집의 세입자를 새로 받는다(만기). 보증금이 바뀌면 차액은 진행이 정산한다. */
  void releaseTenant(UUID gameId, int seq, long tenantDeposit, int day);

  /** 한 달 주거비를 계산하고 주담대 원금을 줄인다. 같은 날 두 번 부르면 두 번 낸다: 진행이 달마다 한 번 부른다. */
  MonthlyHousingCost settleMonth(UUID gameId, int mortgageRateBp, int day);

  /** 세의 한 달 부담: 월세 + 전세대출 이자(주담대 금리 + 스프레드) + 보증보험료. 화면과 선택지 계산에 쓴다. */
  long leaseMonthlyCost(
      long monthlyRent, long jeonseLoan, long deposit, boolean insured, int mortgageRateBp);

  /** 주담대 원금 principal을 지금 금리로 남은 기간 동안 원리금균등으로 갚을 때 월 상환액. 대출 심사(DSR)에 쓴다. */
  long monthlyPayment(long principal, int mortgageRateBp);
}
