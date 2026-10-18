package investorgame.character;

/** 네 축의 확정 결과. investorTypeCode는 "{기간}-{위험}-{소신}"이며 이름은 진행이 콘텐츠에서 찾는다 (경제 개편 설계 4.2절). */
public record TraitResult(
    String investmentStyle,
    String riskProfile,
    String mindProfile,
    String interestSector,
    String investorTypeCode) {}
