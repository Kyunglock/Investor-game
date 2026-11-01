package investorgame.progress;

import investorgame.result.Ending;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 최종 자산 순위표 (decisions.md 141번). 끝난 판에 이름을 적어 올린 사람만 있고, 자산이 큰 순서다. total은 순위표 전체 인원, entries는 그중
 * 앞쪽이다. 세션 없이도 볼 수 있는 공개 값이라 숨은 값은 물론 세션·판 ID도 없다.
 */
public record RankingView(List<Entry> entries, int total) {

  /** jobTitle은 끝날 때의 직업. 전업투자자였으면 "전업투자자", 없으면 null. */
  public record Entry(
      int rank,
      String name,
      long finalAsset,
      int finalAge,
      Ending ending,
      String jobTitle,
      OffsetDateTime enteredAt) {}
}
