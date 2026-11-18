package investorgame.raising.internal;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** 세션이 회사를 넘어 기억하는 것: 사장 명성과 판 회사 수 (증권사 육성 설계 9.2절). raising_memory.state에 JSON으로 둔다. */
// 3분 육성 시절의 칸(공채 판, 연봉, 열린 기능…)이 남은 옛 상태도 읽는다 (decisions.md 228번).
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonAutoDetect(
    fieldVisibility = Visibility.ANY,
    getterVisibility = Visibility.NONE,
    isGetterVisibility = Visibility.NONE)
class RaisingMemory {

  /** 사장 명성 점수 (9.2절). 회사를 팔 때마다 오른다. */
  int famePoints;

  /** 판 회사 수. */
  int sales;

  static final int AD_DRAW_LIMIT = 3;
  String adDrawDay;
  int catAdDraws;
  int weaponAdDraws;

  int adDrawLeft(boolean cat, String today) {
    return today.equals(adDrawDay)
        ? Math.max(0, AD_DRAW_LIMIT - (cat ? catAdDraws : weaponAdDraws))
        : AD_DRAW_LIMIT;
  }

  void useAdDraw(boolean cat, String today) {
    if (adDrawLeft(cat, today) == 0) {
      throw new investorgame.common.error.InvalidRequestException("오늘의 광고 뽑기를 모두 사용했어요");
    }
    if (!today.equals(adDrawDay)) {
      adDrawDay = today;
      catAdDraws = 0;
      weaponAdDraws = 0;
    }
    if (cat) catAdDraws++;
    else weaponAdDraws++;
  }
}
