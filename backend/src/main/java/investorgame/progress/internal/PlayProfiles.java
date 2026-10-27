package investorgame.progress.internal;

import investorgame.common.Action;
import investorgame.progress.GameView.LogEntry;
import investorgame.result.PlayProfile.Habits;
import java.util.List;

/**
 * 인생 기록에서 습관 지표를 센다 (행동 프로필·봇 설계 3절). 기록만 보므로 같은 판이면 언제나 같은 값이다. 매수·매도·버티기는 판정 전에 사용자가 고른
 * 행동(chosen)으로 센다. 성향은 고른 것에서 드러나고, 능력치에 뒤집힌 정도는 swayed가 따로 담는다.
 */
final class PlayProfiles {

  private PlayProfiles() {}

  /**
   * @param stocksBought 한 번이라도 산 종목 수 (자산의 매매 누계)
   * @param investingYears 투자를 시작하고 지난 해 수
   * @param fullTradesPerYear 1년에 이만큼 자유 매매하면 tradeFrequency가 1이다
   */
  static Habits habits(
      List<LogEntry> log,
      int stocksBought,
      int stockCount,
      double investingYears,
      int fullTradesPerYear) {
    int news = 0;
    int bought = 0;
    int sold = 0;
    int shakes = 0;
    int held = 0;
    int offers = 0;
    int borrowed = 0;
    int deviations = 0;
    int trades = 0;
    for (LogEntry entry : log) {
      switch (entry.kind()) {
        case "NEWS" -> {
          news++;
          String chosen = (String) entry.payload().get("chosen");
          bought += Action.BUY.name().equals(chosen) ? 1 : 0;
          sold += Action.SELL.name().equals(chosen) ? 1 : 0;
          deviations += ((List<?>) entry.payload().get("deviations")).size();
        }
        case "SHAKE" -> {
          shakes++;
          held += Action.HOLD.name().equals(entry.payload().get("chosen")) ? 1 : 0;
          deviations += ((List<?>) entry.payload().get("deviations")).size();
        }
        case "LEVERAGE" -> {
          offers++;
          borrowed += Boolean.TRUE.equals(entry.payload().get("borrowed")) ? 1 : 0;
        }
        // 집값을 치르려고 판 것(reason: HOUSING)은 고른 매매가 아니다 (decisions.md 100번).
        case "TRADE" -> trades += entry.payload().containsKey("reason") ? 0 : 1;
        default -> {}
      }
    }
    return new Habits(
        ratio(bought, news),
        ratio(sold, news),
        ratio(held, shakes),
        ratio(borrowed, offers),
        Math.min(1, ratio(deviations, news + shakes)),
        Math.min(1, trades / investingYears / fullTradesPerYear),
        ratio(stocksBought, stockCount));
  }

  private static double ratio(int part, int whole) {
    return whole == 0 ? 0 : (double) part / whole;
  }
}
