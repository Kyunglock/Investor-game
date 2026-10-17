package investorgame.event;

import investorgame.common.Phase;

/**
 * 이벤트를 정하는 데 필요한 다른 도메인의 사실. 진행이 모아서 넘긴다.
 *
 * @param salaryStartDay 첫 월급을 받는 날. 직업이 없으면 null
 * @param traitsFinalized 투자 스타일이 확정되었는가. 투자 시작 제안은 이후에만 나온다 (decisions.md 6번)
 * @param investingStartDay 투자를 시작한 날. 시작 전이면 null
 * @param endDay 판이 끝나는 날. 이 뒤로는 이벤트를 만들지 않는다
 */
public record SchedulingContext(
    Phase phase,
    String investmentStyle,
    String interestSector,
    Integer salaryStartDay,
    boolean traitsFinalized,
    Integer investingStartDay,
    int endDay) {}
