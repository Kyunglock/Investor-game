package investorgame.housing;

import java.util.List;

/**
 * 주거 상태. 가격은 모른다: 시세는 진행이 시장에서 읽는다.
 *
 * @param region 아파트 전세나 자가일 때 지역. 아니면 null
 * @param deposit 지금 사는 집에 맡긴 보증금(월세·전세). 자가·부모님 집이면 0
 * @param jeonseLoan 보증금을 위해 받은 전세대출 잔액. 이자만 낸다
 * @param insured 전세보증보험에 들었는가. 들었으면 전세사기를 당해도 보증금을 돌려받는다
 * @param leaseEndDay 세 만기. 세입자가 아니면 null
 * @param homes 가진 아파트(최대 2채). 팔린 것은 빠진다
 */
public record HousingView(
    Tenure tenure,
    String region,
    long deposit,
    long monthlyRent,
    long jeonseLoan,
    boolean insured,
    Integer leaseEndDay,
    List<Home> homes) {

  public boolean ownsResidence() {
    return homes.stream().anyMatch(Home::residence);
  }

  /**
   * @param mortgage 주담대 잔액
   * @param residence 내가 사는 집인가. 아니면 세입자가 사는 갭투자 집
   * @param tenantDeposit 갭투자 집 세입자의 보증금. 팔거나 세입자가 나가면 돌려줘야 한다
   * @param tenantLeaseEndDay 갭투자 집 세입자의 만기
   * @param listedDay 매물로 내놓은 날. 안 내놓았으면 null
   */
  public record Home(
      int seq,
      String region,
      long purchasePrice,
      int purchaseDay,
      long mortgage,
      boolean residence,
      long tenantDeposit,
      Integer tenantLeaseEndDay,
      Integer listedDay) {}
}
