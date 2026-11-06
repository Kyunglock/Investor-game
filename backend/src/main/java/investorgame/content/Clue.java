package investorgame.content;

/**
 * 단서 기사의 오름·내림 문장 하나와 그 요지 (decisions.md 272번). 직원은 회의에서 기사 문장을 따오지 않고 요지를 엮어 자기 말로 판단을 말한다. 요지는
 * "~다"로 끝나는 짧은 말이라 "~다는 점", "~다면"처럼 이어 붙는다. 문장과 요지의 {stock}·{sectorName}은 종목·섹터 이름으로 바뀐다.
 *
 * @param text 기사에 실리는 문장
 * @param point 직원이 줄여 말하는 요지
 */
public record Clue(String text, String point) {}
