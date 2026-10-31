package investorgame.event;

import investorgame.common.Phase;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 이벤트를 정하는 데 필요한 다른 도메인의 사실. 진행이 모아서 넘긴다.
 *
 * @param startAge 판이 시작하는 나이. 나이로 정한 이벤트(성향, 취업, 결혼)를 게임 일수로 바꿀 때 쓴다
 * @param salaryStartDay 첫 월급을 받는 날. 직업이 없으면 null
 * @param traitsFinalized 투자 스타일이 확정되었는가. 직업 선택과 투자 시작 제안은 이후에만 나온다 (decisions.md 6번)
 * @param investingStartDay 투자를 시작한 날. 시작 전이면 null
 * @param endDay 판이 끝나는 날. 이 뒤로는 이벤트를 만들지 않는다
 * @param jobStartDay 지금 직업을 시작한 날(연차 기준). 실직 중이면 null
 * @param jobCode 지금 직업. 실직 중이면 null. 이직 제안은 이보다 월급이 많은 직업이 있을 때만 나온다
 * @param careerStartDay 처음 일을 시작한 날. 생활 이벤트(결혼·알림·일상 장면)는 이후에만 나온다. 한 번도 일한 적 없으면 null
 * @param retired 은퇴했는가. 은퇴 뒤에는 직업·직장 이벤트가 없다
 * @param married 결혼했는가
 * @param marriedDay 결혼한 날. 자녀 이벤트의 기준. 미혼이면 null
 * @param spouseJob 배우자의 직업(decisions.md 77번). 배우자가 월세살이를 그만하자는 장면의 문구가 이에 따라 다르다 (#116). 미혼이거나 소개
 *     없이 결혼한 옛 판이면 null
 * @param childrenCount 자녀 수
 * @param childBirthDays 자녀마다 태어난 날(순번 순). 나들이·행사는 그 아이의 나이에 맞는 것만 온다 (decisions.md 106번)
 * @param childLeaveDays 자녀마다 독립해 집을 나가는 날(순번 순). 그 뒤 자녀 결혼 선택이 온다 (decisions.md 68번)
 * @param heldStockCodes 지금 보유한 종목 코드. 흔들림(SHAKE)은 보유가 있을 때만 온다. 없으면 빈 목록
 * @param fullTimeInvestor 직업 대신 전업투자자를 골랐는가. 그러면 직업 선택·직장 장면이 더 오지 않는다
 * @param housing 주거 이벤트(독립·세 만기·집 사기)를 정하는 사실
 * @param heldDropBp 보유 종목별 최근 12달 고점 대비 낙폭(만분율, 하락이면 양수). 크게 빠진 종목이 있으면 빚투 제안이 온다
 * @param heldStocks 보유 종목별 사실(마지막으로 산 날, 최근 반년 가격 폭). 흔들림은 산 지 얼마 안 된 종목은 건너뛰고, 장면의 전제(급락·제자리걸음)에
 *     맞는 종목에만 온다 (decisions.md 109번). 모르는 종목은 빠져 있을 수 있다
 * @param family 가족 점수(0~100). 바닥이면 가족 여행·나들이 제안이 끊긴다 (decisions.md 111번)
 * @param netWorth 지금 순자산(원). 전업투자자의 장면(증권사 설립 등)은 순자산이 받쳐 줄 때만 온다
 * @param unaffordableStockCodes 한 주도 못 사는(현재가 > 현금) 종목. 들고 있지도 않으면 그 종목의 뉴스는 고를 게 없어 띄우지 않는다
 *     (decisions.md 59번)
 */
public record SchedulingContext(
    Phase phase,
    int startAge,
    String investmentStyle,
    String interestSector,
    Integer salaryStartDay,
    boolean traitsFinalized,
    Integer investingStartDay,
    int endDay,
    Integer jobStartDay,
    String jobCode,
    Integer careerStartDay,
    boolean retired,
    boolean married,
    Integer marriedDay,
    String spouseJob,
    int childrenCount,
    List<Integer> childBirthDays,
    List<Integer> childLeaveDays,
    List<String> heldStockCodes,
    boolean fullTimeInvestor,
    Map<String, Integer> heldDropBp,
    Map<String, HeldStock> heldStocks,
    HousingFacts housing,
    long netWorth,
    int family,
    Set<String> unaffordableStockCodes) {

  /**
   * 보유 종목 하나의 사실.
   *
   * @param lastBuyDay 마지막으로 산 날. 모르면 null
   * @param rangeBp 최근 반년 가격의 (고점 − 저점) / 현재가 (만분율). 작으면 제자리걸음이다
   */
  public record HeldStock(Integer lastBuyDay, int rangeBp) {}

  /** 흔들어도 되는 종목인가: 산 지 minHeldDays가 지났다(산 날을 모르면 된다). */
  public boolean heldLongEnough(String stockCode, int day, int minHeldDays) {
    HeldStock facts = heldStocks().get(stockCode);
    return facts == null || facts.lastBuyDay() == null || day - facts.lastBuyDay() >= minHeldDays;
  }

  /** 사거나 팔 수 있는 종목인가: 들고 있거나, 한 주는 살 수 있다. */
  public boolean tradable(String stockCode) {
    return heldStockCodes().contains(stockCode) || !unaffordableStockCodes().contains(stockCode);
  }
}
