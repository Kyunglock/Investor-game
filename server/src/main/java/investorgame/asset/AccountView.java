package investorgame.asset;

import java.util.Map;
import java.util.UUID;

/** 금액은 원 단위. holdings는 섹터 코드별 보유 평가액이다. */
public record AccountView(UUID gameId, long cash, long initialCash, Map<String, Long> holdings) {}
