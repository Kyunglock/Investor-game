package investorgame.behavior;

import investorgame.common.Action;
import investorgame.common.Sentiment;
import investorgame.common.Stats;

/**
 * @param choice 사용자가 누른 선택
 * @param swaySentiment 줏대 판정에 쓰는 "다른 뉴스"의 분위기. null이면(자유 매매) 줏대 판정을 건너뛴다
 * @param holding 해당 종목의 보유가 있는가
 */
public record ChoiceContext(Action choice, Stats stats, Sentiment swaySentiment, boolean holding) {}
