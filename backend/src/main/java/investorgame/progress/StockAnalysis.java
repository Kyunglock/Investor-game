package investorgame.progress;

/**
 * 한 종목의 추세 사실과 안목 해석 (매매창 설계 2.1절). 사실은 안목과 상관없이 정확하다.
 *
 * @param facts 이동평균·고점 대비 같은 숫자. 해석이 이 숫자와 어긋나면 플레이어가 알아챌 수 있다
 */
public record StockAnalysis(String stockCode, Facts facts, Analysis analysis) {

  /**
   * @param ma6 6개월 이동평균(이번 달 포함). 이력이 짧으면 있는 만큼
   * @param ma12 12개월 이동평균
   * @param high12 최근 12달 최고가
   * @param low12 최근 12달 최저가
   * @param dropFromHighBp 고점 대비 하락률(만분율, 양수)
   * @param riseFromLowBp 저점 대비 상승률(만분율, 양수)
   * @param change3mBp 최근 3달 변화율
   * @param change12mBp 최근 12달 변화율
   * @param sectorChange12mBp 같은 섹터 종목들의 12달 변화율 평균
   * @param monthsVsMa12 12개월선 위(양수)·아래(음수)로 이어진 달 수
   */
  public record Facts(
      long ma6,
      long ma12,
      long high12,
      long low12,
      int dropFromHighBp,
      int riseFromLowBp,
      int change3mBp,
      int change12mBp,
      int sectorChange12mBp,
      int monthsVsMa12) {}
}
