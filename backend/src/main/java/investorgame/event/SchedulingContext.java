package investorgame.event;

import investorgame.common.Phase;
import java.util.List;
import java.util.Map;

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
 * @param childrenCount 자녀 수
 * @param heldStockCodes 지금 보유한 종목 코드. 흔들림(SHAKE)은 보유가 있을 때만 온다. 없으면 빈 목록
 * @param fullTimeInvestor 직업 대신 전업투자자를 골랐는가. 그러면 직업 선택·직장 장면이 더 오지 않는다
 * @param housing 주거 이벤트(독립·세 만기·집 사기)를 정하는 사실
 * @param heldDropBp 보유 종목별 최근 12달 고점 대비 낙폭(만분율, 하락이면 양수). 크게 빠진 종목이 있으면 빚투 제안이 온다
 * @param netWorth 지금 순자산(원). 전업투자자의 장면(증권사 설립 등)은 순자산이 받쳐 줄 때만 온다
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
    int childrenCount,
    List<String> heldStockCodes,
    boolean fullTimeInvestor,
    Map<String, Integer> heldDropBp,
    HousingFacts housing,
    long netWorth) {}
