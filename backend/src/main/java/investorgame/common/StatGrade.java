package investorgame.common;

/**
 * 능력치 등급. 점수(0~100)를 띠로 나눈 것이라 점수가 바뀌면 등급도 따라 바뀐다. 태어날 때는 등급을 먼저 뽑고(확률은
 * character.initial-stat.grade-percent) 그 띠 안에서 점수를 뽑는다 (decisions.md 24번). 프론트의 grade.ts가 같은 띠를
 * 쓴다.
 */
public enum StatGrade {
  SSS(90, 100),
  SS(80, 89),
  S(70, 79),
  A(60, 69),
  B(50, 59),
  C(40, 49),
  D(30, 39),
  E(20, 29),
  F(0, 19);

  private final int min;
  private final int max;

  StatGrade(int min, int max) {
    this.min = min;
    this.max = max;
  }

  /** 이 등급의 가장 낮은 점수. */
  public int min() {
    return min;
  }

  /** 이 등급의 가장 높은 점수. */
  public int max() {
    return max;
  }

  /** 점수가 속한 등급. */
  public static StatGrade of(int value) {
    for (StatGrade grade : values()) {
      if (value >= grade.min) {
        return grade;
      }
    }
    throw new IllegalArgumentException("능력치 범위(0~100)를 벗어났다: " + value);
  }
}
