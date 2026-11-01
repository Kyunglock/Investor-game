package investorgame.content;

/**
 * 집들이 문구 (decisions.md 140번). 집을 산 뒤 얼마 지나 사람들을 부를지 묻는다. 선택지는 가족 여행과 같은 넷(크게 / 보통 / 조촐하게 / 안 한다)이고
 * 결과 문구가 선택마다 따로 있다.
 */
public record HousewarmingText(
    String title,
    String body,
    String luxuryLabel,
    String normalLabel,
    String cheapLabel,
    String noneLabel,
    String luxuryText,
    String normalText,
    String cheapText,
    String noneText) {}
