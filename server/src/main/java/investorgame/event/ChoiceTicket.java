package investorgame.event;

import investorgame.common.Direction;
import investorgame.common.Sentiment;
import java.util.Map;
import java.util.UUID;

/** 진행 전용. 숨은 값을 포함하므로 응답에 그대로 내리지 않는다. 뉴스가 아니면 truth, swaySentiment는 null이다. */
public record ChoiceTicket(
    UUID eventId,
    EventKind kind,
    String optionCode,
    int seq,
    int occursDay,
    String sectorCode,
    Direction truth,
    int magnitudeBp,
    Sentiment swaySentiment,
    Effect effect) {

  /** 종류별로 진행이 다른 도메인에 반영할 효과. */
  public sealed interface Effect {}

  /** 판정과 자산 반영은 진행이 한다. */
  public record News() implements Effect {}

  public record Job(String jobCode) implements Effect {}

  /** note: 이 일상 행동에서 무엇이 드러났는지 알려 주는 문구. */
  public record Trait(Map<String, Integer> traitDeltas, String note) implements Effect {}

  public record Offer(boolean accepted) implements Effect {}
}
