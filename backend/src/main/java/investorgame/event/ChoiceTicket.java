package investorgame.event;

import investorgame.common.Direction;
import investorgame.common.Sentiment;
import java.util.Map;
import java.util.UUID;

/**
 * 진행 전용. 숨은 값을 포함하므로 응답에 그대로 내리지 않는다. 뉴스가 아니면 stockCode, truth, swaySentiment는 null이다.
 *
 * @param stockCode 뉴스의 매매 대상 종목
 * @param sectorWide 뉴스 충격이 섹터 전체인가
 */
public record ChoiceTicket(
    UUID eventId,
    EventKind kind,
    String optionCode,
    int seq,
    int occursDay,
    String sectorCode,
    String stockCode,
    boolean sectorWide,
    Direction truth,
    int magnitudeBp,
    Sentiment swaySentiment,
    Effect effect) {

  /** 종류별로 진행이 다른 도메인에 반영할 효과. */
  public sealed interface Effect {}

  /** 판정과 자산 반영은 진행이 한다. */
  public record News() implements Effect {}

  public record Job(String jobCode) implements Effect {}

  /**
   * @param traitDeltas 네 축 점수 ("style.", "risk.", "mind.", "sector.")
   * @param statDeltas 즉시 더해지는 능력치 변화 (운 제외). 없으면 빈 맵
   * @param note 이 일상 행동에서 무엇이 드러났는지 알려 주는 문구
   */
  public record Trait(
      Map<String, Integer> traitDeltas, Map<String, Integer> statDeltas, String note)
      implements Effect {}

  public record Offer(boolean accepted) implements Effect {}

  /** 결혼·자녀 선택. 수락이면 진행이 가계와 자산에 반영한다. */
  public record Life(LifeKind kind, boolean accepted) implements Effect {}

  public enum LifeKind {
    MARRIAGE,
    CHILD
  }
}
