package investorgame.common;

/** 성별 (decisions.md 69번). 나는 판 시드로, 아이는 태어날 때 굴리고, 배우자는 나와 반대다. 그림을 가르는 데만 쓴다. */
public enum Sex {
  M,
  F;

  public Sex opposite() {
    return this == M ? F : M;
  }
}
