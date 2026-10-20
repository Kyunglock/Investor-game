package investorgame.housing;

/** 한 달 주거비. 진행이 합계를 자산에서 뺀다. mortgagePrincipal만큼 주담대 잔액이 줄었다. */
public record MonthlyHousingCost(
    long rent, long mortgageInterest, long mortgagePrincipal, long jeonseInterest, long insurance) {

  public long total() {
    return rent + mortgageInterest + mortgagePrincipal + jeonseInterest + insurance;
  }
}
