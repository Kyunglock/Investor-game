package investorgame.character;

import investorgame.common.Stats;
import java.util.UUID;

/** 직업, 투자 스타일, 관심 섹터는 확정 전 null이다. */
public record CharacterView(
    UUID gameId,
    Stats stats,
    Stats initialStats,
    String jobCode,
    Integer jobStartDay,
    String investmentStyle,
    String interestSector) {}
