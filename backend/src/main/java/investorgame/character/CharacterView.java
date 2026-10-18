package investorgame.character;

import investorgame.common.Stats;
import java.util.UUID;

/** 직업, 네 축(기간·위험·소신·관심), 투자자 유형은 확정 전 null이다. */
public record CharacterView(
    UUID gameId,
    Stats stats,
    Stats initialStats,
    String jobCode,
    Integer jobStartDay,
    String investmentStyle,
    String riskProfile,
    String mindProfile,
    String interestSector,
    String investorType) {}
