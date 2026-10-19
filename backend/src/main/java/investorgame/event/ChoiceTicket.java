package investorgame.event;

import investorgame.common.Direction;
import investorgame.common.Sentiment;
import investorgame.content.CareerDefinition;
import java.util.List;
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

  /** 보유 종목 흔들림: 버틴다(HOLD)·판다(SELL). 뉴스와 같은 판정·충격 흐름을 진행이 돌린다 (decisions.md 33번). */
  public record Shake() implements Effect {}

  /**
   * 주거 선택 (주거 설계 4절). definition은 move-out·lease-end·buy, fraud면 이번 만기에 빌라 집주인이 보증금을 돌려주지
   * 못한다(전세사기). 감당할 수 있는지는 진행이 시세·현금·소득으로 따진다.
   */
  public record Housing(String definition, boolean fraud) implements Effect {
    public static final String MOVE_OUT = "move-out";
    public static final String LEASE_END = "lease-end";
    public static final String BUY = "buy";
    public static final String KEEP = "KEEP";
    public static final String MONTHLY = "MONTHLY";
    public static final String VILLA = "VILLA";
    public static final String VILLA_INSURED = "VILLA_INSURED";
    public static final String APT_JEONSE = "APT_JEONSE";
    public static final String BUY_SEOUL = "BUY_SEOUL";
    public static final String BUY_GYEONGGI = "BUY_GYEONGGI";
    public static final String GAP = "GAP";
    public static final String PASS = "PASS";
    public static final List<String> RENTALS = List.of(MONTHLY, VILLA, VILLA_INSURED, APT_JEONSE);
  }

  /** 빚투 제안. borrow면 대출을 받아 그 종목을 더 산다. 판정 없이 고른 대로 한다 (decisions.md 39번). */
  public record Leverage(boolean borrow) implements Effect {
    public static final String BORROW = "BORROW";
    public static final String PASS = "PASS";
  }

  /**
   * 직업 선택. jobCode가 WAIT이면 고르지 않고 더 나은 자리를 기다리고, INVEST면 직업 대신 전업투자자가 된다 (decisions.md 26번, 35번).
   */
  public record Job(String jobCode) implements Effect {
    public static final String WAIT = "WAIT";
    public static final String INVEST = "INVEST";

    public boolean isWait() {
      return WAIT.equals(jobCode);
    }

    public boolean isInvest() {
      return INVEST.equals(jobCode);
    }

    /** WAIT·INVEST가 아니라 실제 직업 코드인가. */
    public static boolean isJobCode(String code) {
      return !WAIT.equals(code) && !INVEST.equals(code);
    }
  }

  /**
   * 직장 장면의 선택. 판정(능력치로 성공 확률)과 효과 반영은 진행이 한다.
   *
   * @param targetJobCode 이직 제안이면 옮길 직업. 아니면 null
   */
  public record Career(CareerDefinition.Option option, String targetJobCode) implements Effect {}

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
