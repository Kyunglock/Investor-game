package investorgame.content;

/**
 * 자녀 결혼 선택의 문구 (decisions.md 68번). title·body의 {child}는 첫째·둘째·셋째로 바뀐다. 선택지는 전부 대준다 / 절반만 보탠다 / 안
 * 대준다 셋이다.
 */
public record ChildWeddingText(
    String title, String body, String fullLabel, String halfLabel, String noneLabel) {}
