package investorgame.content;

/**
 * 투자자 유형. 코드는 "{기간}-{위험}-{소신}" (예 long-safe-own)이며 기간 2 × 위험 2 × 소신 2 = 8종이 모두 있어야 한다 (경제 개편 설계
 * 4.2절).
 */
public record InvestorType(String code, String name, String description) {}
