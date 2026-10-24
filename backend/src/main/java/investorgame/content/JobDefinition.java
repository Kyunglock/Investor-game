package investorgame.content;

/**
 * 직업. 돈을 버는 수단이며 섹터와 무관하다 (decisions.md 4번).
 *
 * @param offered 직업 선택·이직 제안에 나오는가. 직접 세운 회사의 대표(직장 장면의 becomeJob)는 false다 (decisions.md 52번)
 */
public record JobDefinition(
    String code,
    String title,
    int weight,
    long baseMonthlySalary,
    int raisePercentPerYear,
    Boolean offered) {

  public JobDefinition {
    offered = offered == null || offered;
  }
}
