package investorgame.character.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** 성장 속도는 사용자가 위임한 초기값이다 (decisions.md "스펙을 쓰며 확정된 것"). */
@ConfigurationProperties("character")
public record CharacterProperties(InitialStat initialStat, Growth growth) {

  public record InitialStat(int min, int max) {}

  /**
   * @param deviationExp 이탈 한 번의 경험치
   * @param expPerPoint 능력치 +1에 필요한 경험치
   * @param maxStat 성장 상한
   */
  public record Growth(int deviationExp, int expPerPoint, int maxStat) {}
}
