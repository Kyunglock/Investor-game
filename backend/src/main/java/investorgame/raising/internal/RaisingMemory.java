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
}
