package investorgame.content;

import java.util.List;

/**
 * 직업. 돈을 버는 수단이며 섹터와 무관하다 (decisions.md 4번).
 *
 * @param offered 직업 선택·이직 제안에 나오는가. 직접 세운 회사의 대표(직장 장면의 becomeJob)는 false다 (decisions.md 52번)
 * @param retires 60세(household.retire-age)에 정년퇴직하는가. 직접 세운 회사·자영(농부)은 false라 월급이 계속 나오고 연금도 같이 받는다
 *     (57번)
 * @param movesTo 이직 제안(직장 장면의 moveJob)으로 옮겨 갈 수 있는 직업 코드. 같은 직종만 적고, 자기 코드를 넣으면 "같은 일, 다른 회사"로 옮긴다.
 *     비어 있으면 이직 제안이 오지 않는다 (130번)
 */
public record JobDefinition(
    String code,
    String title,
    int weight,
    long baseMonthlySalary,
    int raisePercentPerYear,
    Boolean offered,
    Boolean retires,
    List<String> movesTo) {

  public JobDefinition {
    movesTo = movesTo == null ? List.of() : List.copyOf(movesTo);
    offered = offered == null || offered;
    retires = retires == null || retires;
  }
}
