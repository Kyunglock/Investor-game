package investorgame.behavior;

import investorgame.common.Action;
import investorgame.common.Sentiment;
import investorgame.common.Stats;

/**
 * @param choice 사용자가 누른 선택
 * @param swaySentiment 줏대 판정에 쓰는 "다른 뉴스"의 분위기
 * @param holding 해당 섹터의 보유가 있는가
 */
public record ChoiceContext(Action choice, Stats stats, Sentiment swaySentiment, boolean holding) {}
