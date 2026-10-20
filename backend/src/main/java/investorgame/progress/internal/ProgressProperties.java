package investorgame.progress.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 나이와 속도는 "일단 만들어 보고 판단"하기로 한 값이다 (decisions.md 2번).
 *
 * @param maxSkipDays 한 번의 시각 보고로 건너뛸 수 있는 최대 게임 일수
 * @param newsBuyRatioBp 뉴스 선택의 매수가 쓰는 현금 비율 (만분율)
 * @param leverageLoanBp 빚투를 고르면 빌리는 돈 = 총자산 × 이 비율 (만분율)
 * @param housing 주거 선택의 돈 계산 (주거 설계 3절)
 */
@ConfigurationProperties("progress")
public record ProgressProperties(
    int startAge,
    int endAge,
    int maxSkipDays,
    int newsBuyRatioBp,
    int leverageLoanBp,
    HousingRules housing) {

  /**
   * 주거 돈 계산. 비율은 만분율, 금액은 25세 기준(물가가 붙는다).
   *
   * @param ltvBp 집값 대비 주담대 한도
   * @param dsrBp 월 소득 대비 월 원리금 한도(기존 주담대 포함)
   * @param jeonseRatioBp 아파트 전세가 = 시세 × 이 비율. 갭투자 세입자 보증금도 이 값
   * @param villaSingleBp 빌라 전세 보증금 = 경기 아파트 시세 × 이 비율(1인)
   * @param villaFamilyBp 빌라 전세 보증금(부부·자녀)
   * @param jeonseLoanBp 전세대출 한도 = 보증금 × 이 비율. 소득이 없으면 0
   * @param renewRaiseBp 연장하면 보증금·월세가 이만큼 오른다
   * @param monthlySingle 월세(1인) 보증금·월세
   * @param monthlyFamily 월세(부부·자녀) 보증금·월세
   * @param conversionBpPerMonth 월세 보증금을 덜 내면 모자란 보증금 × 이 비율만큼 월세가 오른다(전월세 전환). 그래서 월세는 언제나 구할 수 있다
   * @param cheongyakPriceBp 청약 분양가 = 서울 아파트 시세 × 이 비율
   * @param saleChanceBp 매물이 한 달에 팔릴 확률. 서울 12달 변동이 fallingBp 이하면 saleChanceFallingBp, hotBp 이상이면
   *     saleChanceHotBp
   */
  public record HousingRules(
      int ltvBp,
      int dsrBp,
      int jeonseRatioBp,
      int villaSingleBp,
      int villaFamilyBp,
      int jeonseLoanBp,
      int renewRaiseBp,
      Rent monthlySingle,
      Rent monthlyFamily,
      int conversionBpPerMonth,
      int saleChanceBp,
      int saleChanceFallingBp,
      int saleChanceHotBp,
      int fallingBp,
      int hotBp,
      int cheongyakPriceBp) {}

  public record Rent(long deposit, long rent) {}
}
