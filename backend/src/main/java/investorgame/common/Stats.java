package investorgame.common;

import java.util.Map;

/** 규칙이 정해진 능력치 5종. 값은 0~100. */
public record Stats(int insight, int patience, int courage, int conviction, int luck) {

  public Stats {
    requireInRange(StatCodes.INSIGHT, insight);
    requireInRange(StatCodes.PATIENCE, patience);
    requireInRange(StatCodes.COURAGE, courage);
    requireInRange(StatCodes.CONVICTION, conviction);
    requireInRange(StatCodes.LUCK, luck);
  }

  public static Stats fromCodes(Map<String, Integer> values) {
    return new Stats(
        require(values, StatCodes.INSIGHT),
        require(values, StatCodes.PATIENCE),
        require(values, StatCodes.COURAGE),
        require(values, StatCodes.CONVICTION),
        require(values, StatCodes.LUCK));
  }

  public Map<String, Integer> toCodes() {
    return Map.of(
        StatCodes.INSIGHT, insight,
        StatCodes.PATIENCE, patience,
        StatCodes.COURAGE, courage,
        StatCodes.CONVICTION, conviction,
        StatCodes.LUCK, luck);
  }

  private static int require(Map<String, Integer> values, String code) {
    Integer value = values.get(code);
    if (value == null) {
      throw new IllegalArgumentException("능력치가 없다: " + code);
    }
    return value;
  }

  private static void requireInRange(String code, int value) {
    if (value < 0 || value > 100) {
      throw new IllegalArgumentException("능력치 범위(0~100)를 벗어났다: " + code + "=" + value);
    }
  }
}
