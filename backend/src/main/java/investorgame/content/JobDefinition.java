package investorgame.content;

/** 직업. 돈을 버는 수단이며 섹터와 무관하다 (decisions.md 4번). */
public record JobDefinition(
    String code, String title, int weight, long baseMonthlySalary, int raisePercentPerYear) {}
