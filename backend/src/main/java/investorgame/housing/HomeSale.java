package investorgame.housing;

/** 판 아파트. 진행이 판 돈에서 주담대와 세입자 보증금을 갚고 나머지를 현금으로 받는다. */
public record HomeSale(long price, long mortgage, long tenantDeposit, boolean residence) {}
