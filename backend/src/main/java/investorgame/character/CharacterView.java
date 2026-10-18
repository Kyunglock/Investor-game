package investorgame.character;

import investorgame.common.Stats;
import java.util.UUID;

/**
 * 직업, 네 축(기간·위험·소신·관심), 투자자 유형은 확정 전 null이다.
 *
 * @param jobCode 지금 직업. 실직 중이면 null
 * @param jobStartDay 지금 직업을 시작한 날(연차 기준). 실직 중이면 null
 * @param careerStartDay 처음 일을 시작한 날. 생활비는 이때부터 나간다. 한 번도 일한 적 없으면 null
 * @param salaryBonusBp 연봉 협상·승진으로 쌓인 인상분(만분율). 직장을 옮기거나 잃으면 0으로 돌아간다
 */
public record CharacterView(
    UUID gameId,
    Stats stats,
    Stats initialStats,
    String jobCode,
    Integer jobStartDay,
    Integer careerStartDay,
    int salaryBonusBp,
    String investmentStyle,
    String riskProfile,
    String mindProfile,
    String interestSector,
    String investorType) {}
