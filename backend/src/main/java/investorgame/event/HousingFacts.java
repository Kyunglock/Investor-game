package investorgame.event;

/**
 * 주거 이벤트를 정하는 데 필요한 사실 (주거 설계 4절). 진행이 주거·시장에서 모아 넘긴다.
 *
 * @param tenure 거주 형태 코드(PARENTS, MONTHLY, VILLA_JEONSE, APT_JEONSE, OWN)
 * @param leaseEndDay 세 만기. 세입자가 아니면 null
 * @param homes 가진 아파트 수
 * @param ownsResidence 사는 집이 내 집인가
 * @param villaUninsured 보증보험 없이 빌라 전세를 사는가. 만기 때 전세사기를 당할 수 있다
 * @param lastChildDay 막내가 태어난 날. 자녀가 없으면 null
 * @param seoulChange12mBp 서울 아파트 12달 변동(만분율). 크게 오르면 "집 살까?"가 온다
 * @param luck 운(0~100). 운이 나쁠수록 세 만기에 집주인이 재계약을 거절하기 쉽다 (#25)
 * @param cheongyakAffordable 영끌(현금 + 돌려받을 보증금 + LTV·DSR 한도 주담대)로 분양가를 치를 수 있는가. 아니면 분양 공고 자체가 오지
 *     않는다 (#26)
 */
public record HousingFacts(
    String tenure,
    Integer leaseEndDay,
    int homes,
    boolean ownsResidence,
    boolean villaUninsured,
    Integer lastChildDay,
    int seoulChange12mBp,
    int luck,
    boolean cheongyakAffordable) {

  public static final HousingFacts PARENTS =
      new HousingFacts("PARENTS", null, 0, false, false, null, 0, 50, false);
}
