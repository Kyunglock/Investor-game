package investorgame.common;

/**
 * 판정 한 단계에서 선택이 바뀐 기록. 어떤 능력치 때문에 무엇이 무엇으로 바뀌었는지 남긴다.
 *
 * @param source 줏대 이탈일 때 누구의 꼬드김이었는지(behavior.md 4.2절의 꼬드김 출처 코드). 다른 능력치의 이탈이면 null
 */
public record Deviation(String statCode, Action from, Action to, String source) {

  public Deviation(String statCode, Action from, Action to) {
    this(statCode, from, to, null);
  }
}
