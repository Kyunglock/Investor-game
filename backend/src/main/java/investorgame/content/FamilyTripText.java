package investorgame.content;

/**
 * 가족 여행 제안의 문구 (decisions.md 71번). title·body의 {who}는 제안한 사람(배우자·부모님·첫째…)으로 바뀐다. 선택지는 초호화 / 보통 /
 * 당일치기 / 안 간다 넷이다.
 */
public record FamilyTripText(
    String title,
    String body,
    String spouse,
    String parents,
    String luxuryLabel,
    String normalLabel,
    String cheapLabel,
    String noneLabel) {}
