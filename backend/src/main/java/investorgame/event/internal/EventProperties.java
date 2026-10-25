package investorgame.event.internal;

import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** 모든 수치는 체감 테스트 후 조정할 초기값이다 (specs/event.md 7절). 성향 이벤트의 나이는 콘텐츠가 정한다. */
@ConfigurationProperties("event")
public record EventProperties(
    JobSettings job,
    CareerSettings career,
    TraitSettings trait,
    NewsSettings news,
    LifeSettings life,
    NoticeSettings notice,
    ShakeSettings shake,
    LeverageSettings leverage,
    HousingSettings housing,
    Map<String, StyleSettings> styles) {

  public static final String DEFAULT_STYLE = "default";

  /** 스타일이 아직 없거나 설정에 없는 코드이면 default를 쓴다. */
  public StyleSettings style(String code) {
    return code != null && styles.containsKey(code) ? styles.get(code) : styles.get(DEFAULT_STYLE);
  }

  public record Range(int min, int max) {}

  /**
   * @param age 첫 직업 선택이 오는 나이. 성향이 다 정해지기 전에는 오지 않는다
   * @param optionCount 직업 선택지 수 ("기다린다" 제외)
   * @param waitDays "더 나은 자리를 기다린다"를 고르면 이 뒤에 다시 온다
   * @param maxWaits 연속으로 기다릴 수 있는 횟수. 넘으면 "기다린다" 선택지가 없다
   * @param rehireDays 실직한 뒤 다시 직업 선택이 오기까지
   */
  public record JobSettings(int age, int optionCount, int waitDays, int maxWaits, int rehireDays) {}

  /**
   * @param gapDays 직장 장면 사이 간격(일). 직업이 있을 때만
   * @param lastAge 이 나이를 넘으면 직업·직장 이벤트가 오지 않는다
   */
  public record CareerSettings(Range gapDays, int lastAge) {}

  /** adultGapDays: 취업 뒤 일상 장면(adult 성향 장면) 사이 간격(일). 풀을 다 쓰면 더 오지 않는다. */
  public record TraitSettings(Range adultGapDays) {}

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
   * @param childWeddingGapYears 자녀가 독립한 뒤 결혼 선택까지 (decisions.md 68번)
   */
  public record LifeSettings(
      Range marriageAge,
      int marriageRetryYears,
      int marriageLastAge,
      Range childFirstGapYears,
      Range childGapYears,
      int maxChildren,
      int childLastAge,
      Range childWeddingGapYears) {}

  /** 알림성 이벤트 간격(일). 직업이 생긴 뒤부터. */
  public record NoticeSettings(Range gapDays) {}

  /**
   * 보유 종목 흔들림 (decisions.md 33번).
   *
   * @param gapDays 흔들림 사이 간격(일). 보유가 있을 때만
   * @param upBp 선택 뒤 그 종목이 오를 확률(만분율). 버틴 쪽이 조금 유리하게
   * @param magnitudeBp 선택 뒤 변동 폭 구간(만분율)
   */
  public record ShakeSettings(Range gapDays, int upBp, Range magnitudeBp) {}

  /**
   * 빚투 제안 (decisions.md 39번).
   *
   * @param dropBp 보유 종목이 12달 고점보다 이만큼(만분율) 넘게 빠지면 묻는다
   * @param gapDays 빚투 제안 사이 최소 간격(일)
   */
  public record LeverageSettings(int dropBp, int gapDays) {}

  /**
   * 주거 이벤트 (주거 설계 4절).
   *
   * @param fraudBp 보증보험 없는 빌라 전세가 만기 때 보증금을 못 돌려받을 확률(만분율)
   * @param buyGapDays "집 살까?" 사이 최소 간격(일)
   * @param surgeBp 서울 아파트가 12달 새 이만큼 넘게 오르면 "집 살까?"가 온다
   * @param cheongyakGapDays 집이 없으면 이 간격으로 청약 공고가 온다(처음은 독립하고 이만큼 뒤)
   * @param refuseBp 세 만기에 집주인이 재계약을 거절할 확률(만분율). 운 0이면 unlucky, 100이면 lucky, 그 사이는 직선 (#25)
   */
  public record HousingSettings(
      int fraudBp, int buyGapDays, int surgeBp, int cheongyakGapDays, Refuse refuseBp) {}

  /** 운에 따른 재계약 거절 확률의 양 끝(만분율). */
  public record Refuse(int unlucky, int lucky) {}

  /** 단기는 뉴스가 자주·크게, 장기는 드물게 (decisions.md 3번). */
  public record StyleSettings(Range newsGapDays, int magnitudePercent) {}
}
