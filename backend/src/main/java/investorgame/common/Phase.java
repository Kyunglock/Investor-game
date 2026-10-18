package investorgame.common;

/** 판의 단계. 성장기에는 성향 이벤트, 취업 후 저축기에는 투자 시작 제안, 투자기에는 뉴스가 나온다. */
public enum Phase {
  CHILDHOOD,
  SAVING,
  INVESTING,
  ENDED
}
