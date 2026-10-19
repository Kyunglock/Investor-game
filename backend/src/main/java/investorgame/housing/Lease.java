package investorgame.housing;

/** 이사하거나 집을 사면서 끝난 세. 진행이 보증금을 돌려받고(전세사기면 못 받고) 전세대출을 갚는다. */
public record Lease(Tenure tenure, long deposit, long jeonseLoan, boolean insured) {}
