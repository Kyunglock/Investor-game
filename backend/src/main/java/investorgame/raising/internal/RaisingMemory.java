package investorgame.raising.internal;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * 세션이 판을 넘어 기억하는 것: 열린 기능, 이미 본 설명, 단골 인물이 나온 횟수, 끝낸 판 수 (증권사 육성 설계 11.1절, 투자 원칙 장치 설계 2.1절).
 * raising_memory.state에 JSON으로 둔다.
 */
@JsonAutoDetect(
    fieldVisibility = Visibility.ANY,
    getterVisibility = Visibility.NONE,
    isGetterVisibility = Visibility.NONE)
class RaisingMemory {

  Set<String> unlocked = new LinkedHashSet<>();

  /** 한 줄 설명을 이미 보인 기능. 같은 설명은 다시 띄우지 않는다. */
  Set<String> tipsShown = new LinkedHashSet<>();

  Map<String, Integer> tempterCounts = new HashMap<>();
  int runsStarted;
  int runsFinished;

  /** 사장 명성 점수 (9.2절). 회사를 팔 때마다 오른다. */
  int famePoints;

  /** 판 회사 수. */
  int sales;
}
