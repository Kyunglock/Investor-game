package investorgame.event;

/** traitsComplete: 이 완료로 성향 이벤트가 모두 끝났는가. 진행은 이때 투자 스타일을 확정한다. */
public record CompleteResult(boolean traitsComplete) {}
