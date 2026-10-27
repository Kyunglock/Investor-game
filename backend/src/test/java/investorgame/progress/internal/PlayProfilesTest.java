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
    assertThat(habits(0, 10).toVector()).containsOnly(0.0);
  }

  @Test
  void 뉴스_앞의_매수_매도_비율은_판정_전에_고른_행동으로_센다() {
    news("BUY", "BUY", 0);
    news("BUY", "SELL", 1);
    news("HOLD", "HOLD", 0);
    news("SELL", "SELL", 0);

    Habits habits = habits(0, 10);

    assertThat(habits.buy()).as("두 번째는 뒤집혀 팔았어도 사기로 골랐다").isEqualTo(0.5);
    assertThat(habits.sell()).isEqualTo(0.25);
    assertThat(habits.swayed()).isEqualTo(0.25);
  }

  @Test
  void 흔들림에서_버티기로_고른_비율과_빚투로_실제_빚을_낸_비율() {
    shake("HOLD", "HOLD", 0);
    shake("SELL", "SELL", 2);
    shake("HOLD", "SELL", 0);
    leverage(true);
    leverage(false);

    Habits habits = habits(0, 10);

    assertThat(habits.shakeHold()).isCloseTo(2.0 / 3, within(1e-9));
    assertThat(habits.leverage()).isEqualTo(0.5);
    assertThat(habits.swayed())
        .as("한 선택에 이탈이 둘이어도 비율은 이탈 수 / 선택 수")
        .isCloseTo(2.0 / 3, within(1e-9));
  }

  @Test
  void 이탈이_선택보다_많아도_1을_넘지_않는다() {
    news("BUY", "SELL", 2);

    assertThat(habits(0, 10).swayed()).isEqualTo(1);
  }

  @Test
  void 자유_매매_빈도는_집값_마련_매도를_빼고_1년_상한으로_나눈다() {
    for (int i = 0; i < 60; i++) {
      trade(false);
    }
    trade(true);
    trade(true);

    assertThat(habits(0, 10).tradeFrequency()).isEqualTo(0.5);
    assertThat(habits(0, 2).tradeFrequency()).as("1년에 30번이면 상한을 넘어 1").isEqualTo(1);
  }

  @Test
  void 분산은_산_종목_수_나누기_전체_종목_수다() {
    assertThat(habits(9, 10).diversification()).isEqualTo(0.5);
  }

  private Habits habits(int stocksBought, double investingYears) {
    return PlayProfiles.habits(log, stocksBought, STOCKS, investingYears, FULL_TRADES_PER_YEAR);
  }

  private void news(String chosen, String actual, int deviations) {
    log.add(
        entry(
            "NEWS",
            Map.of("chosen", chosen, "actual", actual, "deviations", deviations(deviations))));
  }

  private void shake(String chosen, String actual, int deviations) {
    log.add(
        entry(
            "SHAKE",
            Map.of("chosen", chosen, "actual", actual, "deviations", deviations(deviations))));
  }

  private void leverage(boolean borrowed) {
    log.add(entry("LEVERAGE", Map.of("stockCode", "ssj", "borrowed", borrowed)));
  }

  private void trade(boolean forHousing) {
    log.add(
        entry(
            "TRADE",
            forHousing
                ? Map.of("side", "SELL", "deviations", List.of(), "reason", "HOUSING")
                : Map.of("side", "BUY", "deviations", List.of())));
  }

  private LogEntry entry(String kind, Map<String, Object> payload) {
    return new LogEntry(log.size(), log.size(), kind, payload);
  }

  private static List<Map<String, Object>> deviations(int count) {
    List<Map<String, Object>> list = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      list.add(Map.of("statCode", "conviction"));
    }
    return list;
  }
}
