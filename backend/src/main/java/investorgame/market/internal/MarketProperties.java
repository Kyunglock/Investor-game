package investorgame.market.internal;

import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 월 단위 가격 변동 수치 (경제 개편 설계 5.3절). 체감 후 조정한다.
 *
 * @param sectorVolatilityBp 섹터 공통 월간 잡음 폭 (±)
 * @param volatilityBp 종목 변동성 등급(low/mid/high)별 월간 잡음 폭 (±)
 * @param spilloverPercent 종목 뉴스가 같은 섹터 다른 종목에 미치는 비율
 * @param minPrice 가격 바닥(원)
 * @param cycle 경기 흐름: 불안한 시기·전조·위기 (decisions.md 38번)
 * @param homes 아파트 시세의 월 잡음 폭(±, 만분율). 추세는 콘텐츠(homes.json)가 정한다
 * @param mortgage 주담대 금리 (주거 설계 3절)
 * @param indicators 거시 지표 (매매창 설계 3.1절). 표시만 하고 가격에는 영향이 없다
 */
@ConfigurationProperties("market")
public record MarketProperties(
    int sectorVolatilityBp,
    Map<String, Integer> volatilityBp,
    int spilloverPercent,
    long minPrice,
    Cycle cycle,
    Homes homes,
    Mortgage mortgage,
    Indicators indicators) {

  public record Homes(int volatilityBp) {}

  /**
   * 거시 지표 생성. 지표마다 달마다 목표 쪽으로 revertPercent만큼 다가가고 잡음이 붙는다. 목표는 경기 흐름의 구간이 정한다: 평소 base, 전조 구간
   * alarm(갈래가 strongScenarios에 있으면 alarmStrong), 빠지는 동안 fall(fallStrong), 회복 recovery. 평온한 달에도
   * fakeStartPercent로 가짜 신호가 시작돼 fakeMonths 동안 alarm 쪽으로 기운다.
   *
   * @param panicMonths 빠지기 시작한 첫 몇 달. panic이 0이 아닌 지표는 이 동안 panic을 목표로 한다(거래대금이 치솟았다가 마르는 모양)
   */
  public record Indicators(
      int revertPercent,
      int fakeStartPercent,
      Range fakeMonths,
      int panicMonths,
      Map<String, Indicator> series) {

    public Indicator of(String code) {
      Indicator indicator = series.get(code);
      if (indicator == null) {
        throw new IllegalArgumentException("지표 설정이 없다: " + code);
      }
      return indicator;
    }
  }

  public record Indicator(
      int base,
      int alarm,
      int alarmStrong,
      int fall,
      int fallStrong,
      int recovery,
      int panic,
      int noise,
      int min,
      int max,
      List<String> strongScenarios) {}

  /**
   * 금리 = 지난달 금리 + (기준 + 위기 가산 − 지난달) × revertPercent / 100 + 잡음. 기준으로 천천히 되돌아가고 [minBp, maxBp]로
   * 자른다.
   *
   * @param baseBp 평소 금리(연)
   * @param crisisBp 위기로 빠지는 동안 기준에 더하는 값
   * @param recoveryBp 회복하는 동안 기준에 더하는 값(음수면 내린다)
   * @param noiseBp 달마다 잡음 폭(±)
   */
  public record Mortgage(
      int baseBp,
      int crisisBp,
      int recoveryBp,
      int noiseBp,
      int revertPercent,
      int minBp,
      int maxBp) {}

  public record Range(int min, int max) {}

  /**
   * 한 판에 불안한 시기가 windows번 온다. 시기마다 먼저 silentPercent로 전조 없는 위기인지 굴리고, 아니면 전조를 omens개 흘린 뒤 결과를
   * outcomePercent(대공황·불황·조정, 나머지는 아무 일 없음)로 굴린다. 월은 판 시작(15세)부터 센다.
   *
   * @param firstMonth 위기가 시작할 수 있는 가장 이른 달
   * @param lastMonth 위기가 시작할 수 있는 가장 늦은 달
   * @param omenLeadMonths 전조가 위기 시작보다 몇 달 앞서부터 흩어지는가
   * @param silentDepressionPercent 전조 없는 위기 중 대공황 비율(나머지는 불황)
   * @param rumorFirstMonth 헛소문이 나올 수 있는 가장 이른 달
   * @param rumorLastMonth 헛소문이 나올 수 있는 가장 늦은 달
   * @param rumorGapMonths 헛소문 사이 간격. 불안한 시기·위기와 겹치는 달은 건너뛴다
   */
  public record Cycle(
      Range windows,
      int firstMonth,
      int lastMonth,
      Range omens,
      Range omenLeadMonths,
      int silentPercent,
      int silentDepressionPercent,
      Map<String, Integer> outcomePercent,
      Map<String, Shape> shapes,
      int rumorFirstMonth,
      int rumorLastMonth,
      Range rumorGapMonths) {

    public Shape shapeOf(String severity) {
      Shape shape = shapes.get(severity);
      if (shape == null) {
        throw new IllegalArgumentException("위기 모양 설정이 없다: " + severity);
      }
      return shape;
    }
  }

  /** 위기의 모양. 빠지는 달 수·다달이 빠지는 폭, 회복하는 달 수·다달이 오르는 폭. */
  public record Shape(Range fallMonths, Range fallBp, Range recoveryMonths, Range recoveryBp) {}

  public int volatilityOf(String grade) {
    Integer value = volatilityBp.get(grade);
    if (value == null) {
      throw new IllegalArgumentException("변동성 등급 설정이 없다: " + grade);
    }
    return value;
  }
}
