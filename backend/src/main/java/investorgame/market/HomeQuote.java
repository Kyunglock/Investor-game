package investorgame.market;

import java.util.List;

/**
 * 한 지역 아파트(84㎡) 시세.
 *
 * @param change12mBp 12달 전 대비 변동(만분율). 이력이 짧으면 있는 가장 오래된 값 대비
 * @param last12 최근 12달의 시세(이번 달 포함). 가장 오래된 것부터
 */
public record HomeQuote(String region, long price, int change12mBp, List<Long> last12) {}
