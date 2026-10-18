package investorgame.event;

import investorgame.common.Phase;

/**
 * 이벤트를 정하는 데 필요한 다른 도메인의 사실. 진행이 모아서 넘긴다.
 *
 * @param startAge 판이 시작하는 나이. 나이로 정한 이벤트(성향, 취업, 결혼)를 게임 일수로 바꿀 때 쓴다
 * @param salaryStartDay 첫 월급을 받는 날. 직업이 없으면 null
 * @param traitsFinalized 투자 스타일이 확정되었는가. 직업 선택과 투자 시작 제안은 이후에만 나온다 (decisions.md 6번)
 * @param investingStartDay 투자를 시작한 날. 시작 전이면 null
 * @param endDay 판이 끝나는 날. 이 뒤로는 이벤트를 만들지 않는다
 * @param jobStartDay 직업을 시작한 날. 생활 이벤트(결혼·알림)는 이후에만 나온다. 없으면 null
 * @param married 결혼했는가
 * @param marriedDay 결혼한 날. 자녀 이벤트의 기준. 미혼이면 null
 * @param childrenCount 자녀 수
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
    boolean married,
    Integer marriedDay,
    int childrenCount) {}
