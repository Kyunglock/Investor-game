package investorgame.market;

import java.util.Map;

/** 충격을 받은 종목만 담는다. 진행이 전후 평가액 차이로 사용자의 손익을 계산한다. */
public record ShockResult(Map<String, Long> before, Map<String, Long> after) {}
