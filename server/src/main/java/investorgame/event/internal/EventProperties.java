package investorgame.event.internal;

import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** 모든 수치는 체감 테스트 후 조정할 초기값이다 (specs/event.md 7절). 성향 이벤트의 나이는 콘텐츠가 정한다. */
@ConfigurationProperties("event")
public record EventProperties(
    JobSettings job,
    NewsSettings news,
    LifeSettings life,
    NoticeSettings notice,
    Map<String, StyleSettings> styles) {

  public static final String DEFAULT_STYLE = "default";

  /** 스타일이 아직 없거나 설정에 없는 코드이면 default를 쓴다. */
  public StyleSettings style(String code) {
    return code != null && styles.containsKey(code) ? styles.get(code) : styles.get(DEFAULT_STYLE);
  }

  public record Range(int min, int max) {}

  /** age: 직업 선택이 오는 나이. 성향이 다 정해지기 전에는 오지 않는다. */
  public record JobSettings(int age, int optionCount) {}

  /**
   * @param interestWeightPercent 관심 섹터 뉴스의 가중치 배율. 300이면 3배
   * @param noRepeatWindow 같은 뉴스 정의가 다시 나오지 않는 최근 개수
   */
  public record NewsSettings(int interestWeightPercent, int noRepeatWindow) {}

  /**
   * 결혼·자녀 이벤트 시점 (경제 개편 설계 7.3절). 나이는 세, 간격은 년.
   *
   * @param marriageAge 첫 결혼 제안 나이 구간
   * @param marriageRetryYears 거절 뒤 다시 묻는 간격
   * @param marriageLastAge 이 나이를 넘으면 묻지 않는다
   * @param childFirstGapYears 결혼 뒤 첫 자녀 제안까지
   * @param childGapYears 자녀 제안 사이 간격
   * @param maxChildren 최대 자녀 수
   * @param childLastAge 이 나이를 넘으면 묻지 않는다
   */
  public record LifeSettings(
      Range marriageAge,
      int marriageRetryYears,
      int marriageLastAge,
      Range childFirstGapYears,
      Range childGapYears,
      int maxChildren,
      int childLastAge) {}

  /** 알림성 이벤트 간격(일). 직업이 생긴 뒤부터. */
  public record NoticeSettings(Range gapDays) {}

  /** 단기는 뉴스가 자주·크게, 장기는 드물게 (decisions.md 3번). */
  public record StyleSettings(Range newsGapDays, int magnitudePercent) {}
}
