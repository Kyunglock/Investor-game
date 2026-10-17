package investorgame.event.internal;

import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** 모든 수치는 체감 테스트 후 조정할 초기값이다 (specs/event.md 7절). */
@ConfigurationProperties("event")
public record EventProperties(
    JobSettings job, TraitSettings trait, NewsSettings news, Map<String, StyleSettings> styles) {

  public static final String DEFAULT_STYLE = "default";

  /** 스타일이 아직 없거나 설정에 없는 코드이면 default를 쓴다. */
  public StyleSettings style(String code) {
    return code != null && styles.containsKey(code) ? styles.get(code) : styles.get(DEFAULT_STYLE);
  }

  public record Range(int min, int max) {}

  public record JobSettings(int day, int optionCount) {}

  public record TraitSettings(Range gapDays) {}

  /**
   * @param interestWeightPercent 관심 섹터 뉴스의 가중치 배율. 300이면 3배
   * @param noRepeatWindow 같은 뉴스 정의가 다시 나오지 않는 최근 개수
   */
  public record NewsSettings(int interestWeightPercent, int noRepeatWindow) {}

  /** 단기는 뉴스가 자주·크게, 장기는 드물게 (decisions.md 3번). */
  public record StyleSettings(Range newsGapDays, int magnitudePercent) {}
}
