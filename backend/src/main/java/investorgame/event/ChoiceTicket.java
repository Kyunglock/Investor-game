package investorgame.event;

import investorgame.common.Direction;
import investorgame.common.Sentiment;
import investorgame.content.CareerDefinition;
import investorgame.content.TraitDefinition;
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

    /** 세 만기에 집주인이 재계약을 거절했다. 만기와 같지만 '2년 더 살기'가 없다. 운이 나쁠수록 잦다 (#25). */
    public static final String LEASE_REFUSED = "lease-refused";

    public static final String BUY = "buy";
    public static final String CHEONGYAK = "cheongyak";

    /**
     * 결혼한 뒤 월세에 살면 배우자가 "언제까지 월세 살 거야?" 하고 묻는다 (#116). 정의 코드는 "spouse-rent:단계:자녀 수:배우자 직업"이고 단계는 물은
     * 횟수(1·2·3+)다. 미루거나 거스르면 행복도·가족 점수가 깎이고 다음에 더 세게 묻는다.
     */
    public static final String SPOUSE_RENT = "spouse-rent";

    public static final String SPOUSE_RENT_PREFIX = SPOUSE_RENT + ":";

    /** 배우자 요구에 "조금만 더 모으자"고 설득한다. 다음에 다시 묻는다. */
    public static final String WAIT = "WAIT";

    /** 배우자 뜻을 거스르고 그냥 월세에 산다. */
    public static final String STAY = "STAY";

    public static boolean isSpouseRent(String definition) {
      return definition != null && definition.startsWith(SPOUSE_RENT);
    }

    /** 단계(1부터). 옛 형식이나 모르는 코드는 1. */
    public static int spouseRentLevel(String definition) {
      String[] parts = definition.split(":", 4);
      return parts.length > 1 ? Integer.parseInt(parts[1]) : 1;
    }

    /** 물을 때의 자녀 수. */
    public static int spouseRentChildren(String definition) {
      String[] parts = definition.split(":", 4);
      return parts.length > 2 ? Integer.parseInt(parts[2]) : 0;
    }

    /** 배우자의 직업. 모르면 빈 문자열. */
    public static String spouseRentJob(String definition) {
      String[] parts = definition.split(":", 4);
      return parts.length > 3 ? parts[3] : "";
    }

    public static String spouseRentCode(int level, int children, String spouseJob) {
      return SPOUSE_RENT_PREFIX
          + level
          + ":"
          + children
          + ":"
          + (spouseJob == null ? "" : spouseJob);
    }

    public static final String APPLY = "APPLY";
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
  /**
   * 성향 장면의 선택. amount·outcomes는 콘텐츠 그대로: 결과는 진행이 판 시드로 굴린다 (decisions.md 41번). adult면 성인 장면이라 금액에
   * 물가가 붙는다 (75번).
   */
  public record Trait(
      Map<String, Integer> traitDeltas,
      Map<String, Integer> statDeltas,
      String note,
      long amount,
      List<TraitDefinition.Outcome> outcomes,
      boolean adult,
      int familyDelta)
      implements Effect {}

  public record Offer(boolean accepted) implements Effect {}

  /** 자녀 선택. 수락이면 진행이 가계와 자산에 반영한다. */
  public record Life(LifeKind kind, boolean accepted) implements Effect {}

  /** 결혼 선택 (decisions.md 77번). spouseCode는 콘텐츠의 배우자 조합 코드("n-p-e-l"). 수락이면 진행이 그 사람과 결혼시킨다. */
  public record Marriage(String spouseCode, boolean accepted) implements Effect {}

  /**
   * 자녀 결혼 (decisions.md 68번). 그때 물가의 결혼 비용 가운데 shareBp(만분율)만큼 대준다: 전부 10000, 절반 5000, 안 대주면 0.
   *
   * @param seq 결혼하는 자녀의 순번(1부터)
   */
  public record ChildWedding(int seq, int shareBp) implements Effect {
    public static final String FULL = "full";
    public static final String HALF = "half";
    public static final String NONE = "none";
  }

  /**
   * 가족 여행 제안 (decisions.md 71번). 보통 여행 비용의 몇 배(만분율)를 쓰는가: 초호화 40000, 보통 10000, 당일치기 2000, 안 가면 0.
   *
   * @param proposer 제안한 사람: spouse, parents, child:n
   * @param outing 아이의 나들이면 그 코드(park·zoo·camp·sports-day, decisions.md 87번), 가족 여행이면 null
   */
  public record FamilyTrip(String proposer, int costBp, String outing) implements Effect {
    public static final String LUXURY = "luxury";
    public static final String NORMAL = "normal";
    public static final String CHEAP = "cheap";
    public static final String NONE = "none";
  }

  public enum LifeKind {
    CHILD
  }
}
