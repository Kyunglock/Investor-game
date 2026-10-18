package investorgame.common;

import java.util.List;

/** DB와 이탈 원인 기록에 쓰는 능력치 코드. */
public final class StatCodes {

  public static final String INSIGHT = "insight";
  public static final String PATIENCE = "patience";
  public static final String COURAGE = "courage";
  public static final String CONVICTION = "conviction";
  public static final String LUCK = "luck";

  /** 생성 시 난수를 뽑는 순서이기도 하다 (character.md 4.1절). */
  public static final List<String> ALL = List.of(INSIGHT, PATIENCE, COURAGE, CONVICTION, LUCK);

  private StatCodes() {}
}
