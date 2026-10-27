package investorgame.result;

import java.time.LocalDate;

/**
 * 비슷한 플레이어를 찾기 위한 익명 행동 프로필 (행동 프로필·봇 설계 3절). 누구의 판인지 알 수 있는 값(세션·판 ID, 시각)은 담지 않는다.
 *
 * @param botPersona 봇이 플레이한 판이면 페르소나 코드, 사람이면 null
 * @param invested 체결된 매수 금액 누계
 * @param investPnl 매도 금액 + 남은 평가액 − 매수 금액. 월급과 상관없는 투자 성과다. 판정·숨은 방향·운이 섞이므로 게임 점수로 본다
 *     (decisions.md 102번)
 * @param investReturnBp investPnl / invested (만분율). 산 적이 없으면 0
 */
public record PlayProfile(
    String contentVersion,
    LocalDate endedOn,
    int finalAge,
    Ending ending,
    String botPersona,
    Habits habits,
    long invested,
    long investPnl,
    int investReturnBp) {

  /**
   * 0~1로 맞춘 습관 지표. 모두 확률(능력치 판정)이 끼기 전에 고른 행동으로 센다. 분모가 0이면(그런 장면이 한 번도 없었으면) 0이다.
   *
   * @param buy 뉴스 앞에서 사기로 고른 비율
   * @param sell 뉴스 앞에서 팔기로 고른 비율
   * @param shakeHold 흔들림 앞에서 버티기로 고른 비율
   * @param leverage 빚투 제안에서 빌리기로 고른 비율
   * @param tradeFrequency 투자 기간 1년당 자유 매매 횟수 ÷ 설정한 상한 (1까지)
   * @param diversification 사기로 고른 종목 수 ÷ 전체 종목 수
   */
  public record Habits(
      double buy,
      double sell,
      double shakeHold,
      double leverage,
      double tradeFrequency,
      double diversification) {

    /** result_profile.habits 열의 순서. */
    public double[] toVector() {
      return new double[] {buy, sell, shakeHold, leverage, tradeFrequency, diversification};
    }
  }
}
