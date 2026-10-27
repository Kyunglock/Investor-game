package investorgame.progress.internal;

import investorgame.common.Action;
import investorgame.event.ChoiceTicket;
import investorgame.progress.GameView.LogEntry;
import investorgame.result.PlayProfile.Habits;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 인생 기록에서 습관 지표를 센다 (행동 프로필·봇 설계 3절). 기록만 보므로 같은 판이면 언제나 같은 값이다. 모든 지표는 **확률이 끼기 전에 사용자가 고른
 * 행동**(chosen)으로 센다 (decisions.md 102번). 능력치 판정에 뒤집힌 것, 현금이 모자라 못 산 것은 성향이 아니다.
 */
final class PlayProfiles {

  private PlayProfiles() {}

  /**
   * @param investingYears 투자를 시작하고 지난 해 수
   * @param fullTradesPerYear 1년에 이만큼 자유 매매하면 tradeFrequency가 1이다
   */
  static Habits habits(
      List<LogEntry> log, int stockCount, double investingYears, int fullTradesPerYear) {
    int news = 0;
    int bought = 0;
    int sold = 0;
    int shakes = 0;
    int held = 0;
    int offers = 0;
    int borrowed = 0;
    int trades = 0;
    Set<Object> chosenStocks = new HashSet<>();
    for (LogEntry entry : log) {
      Object chosen = entry.payload().get("chosen");
      Object stock = entry.payload().get("stockCode");
      switch (entry.kind()) {
        case "NEWS" -> {
          news++;
          if (Action.BUY.name().equals(chosen)) {
            bought++;
            chosenStocks.add(stock);
          }
          sold += Action.SELL.name().equals(chosen) ? 1 : 0;
        }
        case "SHAKE" -> {
          shakes++;
          held += Action.HOLD.name().equals(chosen) ? 1 : 0;
        }
        case "LEVERAGE" -> {
          offers++;
          if (ChoiceTicket.Leverage.BORROW.equals(chosen)) {
            borrowed++;
            chosenStocks.add(stock);
          }
        }
        // 집값을 치르려고 판 것(reason: HOUSING)은 고른 매매가 아니다 (decisions.md 100번). 자유 매매는 판정이 없다(81번).
        case "TRADE" -> {
          if (!entry.payload().containsKey("reason")) {
            trades++;
            if (Action.BUY.name().equals(chosen)) {
              chosenStocks.add(stock);
            }
          }
        }
        default -> {}
      }
    }
    return new Habits(
        ratio(bought, news),
        ratio(sold, news),
        ratio(held, shakes),
        ratio(borrowed, offers),
        Math.min(1, trades / investingYears / fullTradesPerYear),
        ratio(chosenStocks.size(), stockCount));
  }

  private static double ratio(int part, int whole) {
    return whole == 0 ? 0 : (double) part / whole;
  }
}
