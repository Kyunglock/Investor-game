package investorgame.content;

/**
 * 단서 기사의 오름·내림 문장 하나와 그 요지 (decisions.md 272번). 직원은 회의에서 기사 문장을 따오지 않고 요지를 엮어 자기 말로 판단을 말한다. 요지는
 * "~다"로 끝나는 짧은 말이라 "~다는 점", "~다면"처럼 이어 붙는다. 문장과 요지의 {stock}·{sectorName}은 종목·섹터 이름으로 바뀐다.
 *
 * @param text 기사에 실리는 문장
 * @param point 직원이 줄여 말하는 요지
 * @param topic 같은 사건을 다루는 문장끼리 다는 꼬리표. 한 기사에 같은 꼬리표의 반대쪽 문장은 함께 나오지 않는다(#341: 같은 실사를 두고 "지적 없이
 *     마쳤다"와 "지적이 세 건 나왔다"가 나란히 나왔다). 없으면 null
 */
public record Clue(String text, String point, String topic) {}
