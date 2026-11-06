package investorgame.content;

import java.util.List;

/**
 * 단서 기사의 재료 문장 (content/clues.json, 투자 원칙 장치 설계 3.1절). 기사 하나는 결정적 문장(숨은 방향과 같은 쪽) + 곁가지 둘 + 중립 하나로
 * 조립한다. 오름·내림 문장에는 직원이 말할 요지가 붙는다(272번). 문장의 {stock}·{sectorName}은 종목·섹터 이름으로 바뀐다.
 */
public record NewsClues(List<Clue> up, List<Clue> down, List<String> neutral) {}
