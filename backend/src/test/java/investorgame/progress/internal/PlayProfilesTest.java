package investorgame.progress.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import investorgame.progress.GameView.LogEntry;
import investorgame.result.PlayProfile.Habits;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PlayProfilesTest {

  private static final int STOCKS = 18;
  private static final int FULL_TRADES_PER_YEAR = 12;

  private final List<LogEntry> log = new ArrayList<>();

  @Test
  void 기록이_없으면_모든_습관이_0이다() {
    assertThat(habits(10).toVector()).containsOnly(0.0);
  }

  @Test
  void 뉴스_앞의_매수_매도_비율은_판정_전에_고른_행동으로_센다() {
    news("ssj", "BUY", "BUY");
    news("sqh", "BUY", "HOLD");
    news("ctl", "HOLD", "BUY");
    news("ssj", "SELL", "SELL");

    Habits habits = habits(10);

    assertThat(habits.buy()).as("두 번째는 뒤집혀 못 샀어도 사기로 골랐다").isEqualTo(0.5);
    assertThat(habits.sell()).isEqualTo(0.25);
    assertThat(habits.diversification())
        .as("사기로 고른 종목은 ssj·sqh 둘. 뒤집혀 산 ctl은 세지 않는다")
        .isEqualTo(2.0 / STOCKS);
  }

  @Test
  void 흔들림에서_버티기로_고른_비율() {
    shake("HOLD", "HOLD");
    shake("SELL", "SELL");
    shake("HOLD", "SELL");

    assertThat(habits(10).shakeHold()).isCloseTo(2.0 / 3, within(1e-9));
  }

  @Test
  void 빚투는_빌리기로_고른_비율이고_현금이_모자라_못_산_것도_센다() {
    leverage("ctl", "BORROW", false);
    leverage("ssj", "PASS", false);

    Habits habits = habits(10);

    assertThat(habits.leverage()).isEqualTo(0.5);
    assertThat(habits.diversification()).isEqualTo(1.0 / STOCKS);
  }

  @Test
  void 자유_매매_빈도는_집값_마련_매도를_빼고_1년_상한으로_나눈다() {
    for (int i = 0; i < 60; i++) {
      trade("ssj", false);
    }
    trade("sqh", true);
    trade("sqh", true);

    assertThat(habits(10).tradeFrequency()).isEqualTo(0.5);
    assertThat(habits(2).tradeFrequency()).as("1년에 30번이면 상한을 넘어 1").isEqualTo(1);
  }

  @Test
  void 자유_매매로_산_종목도_분산에_들어간다() {
    trade("ssj", false);
    trade("sqh", true);

    assertThat(habits(10).diversification()).as("집값 마련 매도는 고른 매매가 아니다").isEqualTo(1.0 / STOCKS);
  }

  private Habits habits(double investingYears) {
    return PlayProfiles.habits(log, STOCKS, investingYears, FULL_TRADES_PER_YEAR);
  }

  private void news(String stock, String chosen, String actual) {
    log.add(
        entry(
            "NEWS",
            Map.of(
                "stockCode", stock, "chosen", chosen, "actual", actual, "deviations", List.of())));
  }

  private void shake(String chosen, String actual) {
    log.add(
        entry(
            "SHAKE",
            Map.of(
                "stockCode", "ssj", "chosen", chosen, "actual", actual, "deviations", List.of())));
  }

  private void leverage(String stock, String chosen, boolean borrowed) {
    log.add(entry("LEVERAGE", Map.of("stockCode", stock, "chosen", chosen, "borrowed", borrowed)));
  }

  private void trade(String stock, boolean forHousing) {
    log.add(
        entry(
            "TRADE",
            forHousing
                ? Map.of("stockCode", stock, "side", "SELL", "chosen", "SELL", "reason", "HOUSING")
                : Map.of("stockCode", stock, "side", "BUY", "chosen", "BUY")));
  }

  private LogEntry entry(String kind, Map<String, Object> payload) {
    return new LogEntry(log.size(), log.size(), kind, payload);
  }
}
