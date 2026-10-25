package investorgame.result;

/** 판이 끝난 이유 (decisions.md 27번). NORMAL은 종료 나이에 도달, BANKRUPT는 다 팔아도 빚을 못 갚게 된 달의 파산. */
public enum Ending {
  NORMAL,
  BANKRUPT,
  /** 사용자가 중간에 그만뒀다 (decisions.md 68번). 그 나이에서 끝나고 결과는 그때의 자산이다. */
  QUIT
}
