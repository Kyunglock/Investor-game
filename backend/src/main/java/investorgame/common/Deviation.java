package investorgame.common;

/** 판정 한 단계에서 선택이 바뀐 기록. 어떤 능력치 때문에 무엇이 무엇으로 바뀌었는지 남긴다. */
public record Deviation(String statCode, Action from, Action to) {}
