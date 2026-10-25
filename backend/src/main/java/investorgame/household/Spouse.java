package investorgame.household;

/**
 * 배우자 (decisions.md 77번). income은 25세 기준 월 소득(원)이고 가계가 물가를 붙여 배우자 소득으로 넣는다. intro는 결혼 카드에 나온 소개 문장.
 * 이름은 없다 (90번).
 */
public record Spouse(String job, long income, String intro) {}
