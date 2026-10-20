package investorgame.housing.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 주거 수치 (주거 설계 3절).
 *
 * @param leaseYears 세 계약 기간(년)
 * @param maxHomes 가질 수 있는 아파트 수
 * @param mortgageYears 주담대 만기(년). 원리금균등
 * @param jeonseLoanSpreadBp 전세대출 금리 = 주담대 금리 + 이 값(음수면 낮다)
 * @param insuranceBpPerYear 전세보증보험료(연, 보증금 대비 만분율)
 */
@ConfigurationProperties("housing")
public record HousingProperties(
    int leaseYears,
    int maxHomes,
    int mortgageYears,
    int jeonseLoanSpreadBp,
    int insuranceBpPerYear) {}
