package investorgame.behavior;

import investorgame.common.Action;
import investorgame.common.Sentiment;
import investorgame.common.Stats;

/**
 * @param choice 사용자가 누른 선택
 * @param swaySentiment 줏대 판정에 쓰는 "다른 뉴스"의 분위기. null이면(자유 매매) 줏대 판정을 건너뛴다
 * @param holding 해당 종목의 보유가 있는가
 * @param guards 투자 원칙 장치가 막아 둔 판정 (투자 원칙 장치 설계 1.1절)
 */
public record ChoiceContext(
    Action choice, Stats stats, Sentiment swaySentiment, boolean holding, Guards guards) {

  public ChoiceContext(Action choice, Stats stats, Sentiment swaySentiment, boolean holding) {
    this(choice, stats, swaySentiment, holding, Guards.NONE);
  }

  /**
   * 장치가 막는 판정. 막힌 판정은 일어나지 않지만 난수는 그대로 뽑는다(재현성).
   *
   * @param conviction 단톡방 나가기: 꼬드김 판정을 막는다
   * @param patience 증권 앱 지우기: 못 참고 파는 판정을 막는다
   * @param courageBuy 적립식 자동이체: 매수 쪽 용기 판정을 막는다. 매도 쪽(못 팖)은 막지 않는다
   */
  public record Guards(boolean conviction, boolean patience, boolean courageBuy) {

    public static final Guards NONE = new Guards(false, false, false);
  }
}
