package investorgame.progress.internal;

import investorgame.common.Phase;
import java.time.OffsetDateTime;
import java.util.UUID;

/** progress_game 한 행. 시드를 포함하므로 internal 밖으로 내보내지 않는다. */
record GameRow(
    UUID id,
    UUID sessionId,
    String status,
    Phase phase,
    int lastReportedDay,
    int startAge,
    int endAge,
    long seed,
    String contentVersion,
    Integer investingStartDay,
    OffsetDateTime createdAt) {

  boolean ended() {
    return "ENDED".equals(status);
  }
}
