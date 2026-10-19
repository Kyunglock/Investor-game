package investorgame.content;

/**
 * 아파트를 살 수 있는 지역 (주거 설계 3절). 부동산은 아파트로만 한다.
 *
 * @param basePrice 판 시작(15세) 시세. 추세를 따라 25세에 서울 약 10억, 경기 약 6억이 된다
 * @param driftBpPerYear 연 추세(만분율)
 */
public record HomeRegion(String code, String name, long basePrice, int driftBpPerYear) {}
