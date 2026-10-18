package investorgame.progress;

import java.util.List;

/** 선택 직후의 판 상태와 결과. 결과 화면에서 "선택 → 실제 행동 + 원인"을 보여 준다 (prd.md F6). */
public record ChoiceOutcome(GameView game, Outcome outcome) {

  /**
   * 뉴스가 아니면 actual은 chosen과 같고 trade, price는 null이다. 해결된 뒤에는 주가의 실제 방향을 보여 줘도 된다.
   *
   * @param message 직업 확정, 성향 확정, 투자 시작처럼 뉴스가 아닌 결과의 설명
   */
  public record Outcome(
      String kind,
      String chosen,
      String actual,
      List<DeviationView> deviations,
      Trade trade,
      Price price,
      List<Growth> growth,
      String message) {}

  public record DeviationView(String statCode, String from, String to) {}

  /** status: EXECUTED, HELD, NOTHING_TO_SELL, INSUFFICIENT_CASH. */
  public record Trade(String status, long amount) {}

  /** direction: UP 또는 DOWN. changeBp는 변동 폭(만분율). pnl은 이번 변동으로 생긴 손익(원). */
  public record Price(
      String sectorCode,
      String sectorName,
      String direction,
      int changeBp,
      long pnl,
      boolean lossSoftened) {}

  /** reason: DEVIATION(이탈 경험) 또는 TRAIT(성장기의 선택). */
  public record Growth(String statCode, int before, int after, String reason) {}
}
