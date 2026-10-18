package investorgame.character.internal;

import investorgame.common.StatGrade;
import java.util.EnumMap;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** 성장 속도는 사용자가 위임한 초기값이다 (decisions.md "스펙을 쓰며 확정된 것"). */
@ConfigurationProperties("character")
public record CharacterProperties(InitialStat initialStat, Growth growth, TraitStat traitStat) {

  /**
   * 태어날 때 능력치마다 등급을 먼저 뽑고, 그 등급의 점수 띠 안에서 균등하게 점수를 뽑는다 (decisions.md 24번).
   *
   * @param floor 가장 낮은 등급(F)도 이 점수 아래로는 태어나지 않는다
   * @param gradePercent 등급별 확률(%). 모든 등급이 있어야 하고 합이 100이어야 한다
   */
  public record InitialStat(int floor, Map<StatGrade, Integer> gradePercent) {
    public InitialStat {
      gradePercent = Map.copyOf(new EnumMap<>(gradePercent));
      int sum = 0;
      for (StatGrade grade : StatGrade.values()) {
        Integer percent = gradePercent.get(grade);
        if (percent == null || percent < 0) {
          throw new IllegalArgumentException("등급 확률이 없거나 음수다: " + grade);
        }
        sum += percent;
      }
      if (sum != 100) {
        throw new IllegalArgumentException("등급 확률의 합이 100이 아니다: " + sum);
      }
      if (floor < 0 || floor > StatGrade.F.max()) {
        throw new IllegalArgumentException("floor는 F 등급 띠(0~" + StatGrade.F.max() + ") 안이어야 한다");
      }
    }
  }

  /**
   * @param deviationExp 이탈 한 번의 경험치
   * @param expPerPoint 능력치 +1에 필요한 경험치
   * @param maxStat 성장 상한
   */
  public record Growth(int deviationExp, int expPerPoint, int maxStat) {}

  /**
   * @param min 성향 선택으로 내려갈 수 있는 능력치 하한. 상한은 growth.maxStat
   */
  public record TraitStat(int min) {}
}
