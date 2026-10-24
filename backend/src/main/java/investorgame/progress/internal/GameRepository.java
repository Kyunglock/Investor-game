package investorgame.progress.internal;

import investorgame.common.Phase;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class GameRepository {

  private static final String COLUMNS =
      """
      id, session_id, status, phase, last_reported_day, start_age, end_age, seed,
      content_version, investing_start_day, created_at
      """;

  private final JdbcClient jdbc;
  private final Clock clock;

  GameRepository(JdbcClient jdbc, Clock clock) {
    this.jdbc = jdbc;
    this.clock = clock;
  }

  void abandonActive(UUID sessionId) {
    jdbc.sql(
            """
            UPDATE progress_game
            SET status = 'ABANDONED', ended_at = :now, updated_at = :now
            WHERE session_id = :sessionId AND status = 'ACTIVE'
            """)
        .param("sessionId", sessionId)
        .param("now", now())
        .update();
  }

  void insert(GameRow game) {
    jdbc.sql(
            """
            INSERT INTO progress_game
              (id, session_id, status, phase, last_reported_day, start_age, end_age, seed,
               content_version, version, created_at, updated_at)
            VALUES
              (:id, :sessionId, 'ACTIVE', :phase, 0, :startAge, :endAge, :seed,
               :contentVersion, 0, :now, :now)
            """)
        .param("id", game.id())
        .param("sessionId", game.sessionId())
        .param("phase", game.phase().name())
        .param("startAge", game.startAge())
        .param("endAge", game.endAge())
        .param("seed", game.seed())
        .param("contentVersion", game.contentVersion())
        .param("now", game.createdAt())
        .update();
  }

  /** 한 판의 요청을 직렬화한다. 진행 중인 판만 잠근다. */
  Optional<GameRow> lockActive(UUID sessionId, UUID gameId) {
    return jdbc.sql(
            "SELECT "
                + COLUMNS
                + """
                FROM progress_game
                WHERE id = :gameId AND session_id = :sessionId AND status = 'ACTIVE'
                FOR UPDATE
                """)
        .param("gameId", gameId)
        .param("sessionId", sessionId)
        .query(GameRow.class)
        .optional();
  }

  /** 세션의 가장 최근 판. 버려진 판은 제외한다. */
  Optional<GameRow> findLatest(UUID sessionId) {
    return jdbc.sql(
            "SELECT "
                + COLUMNS
                + """
                FROM progress_game
                WHERE session_id = :sessionId AND status IN ('ACTIVE', 'ENDED')
                ORDER BY created_at DESC
                LIMIT 1
                """)
        .param("sessionId", sessionId)
        .query(GameRow.class)
        .optional();
  }

  /** 최근에 시작한 판부터. 나이는 마지막 보고 시각으로 센다. */
  List<GameLine> recent(int limit, int daysPerYear) {
    return jdbc.sql(
            """
            SELECT id AS game_id, session_id, status, start_age,
                   start_age + last_reported_day / :daysPerYear AS age,
                   created_at AS started_at, updated_at, ended_at
            FROM progress_game
            ORDER BY created_at DESC
            LIMIT :limit
            """)
        .param("daysPerYear", daysPerYear)
        .param("limit", limit)
        .query(GameLine.class)
        .list();
  }

  record GameLine(
      UUID gameId,
      UUID sessionId,
      String status,
      int startAge,
      int age,
      OffsetDateTime startedAt,
      OffsetDateTime updatedAt,
      OffsetDateTime endedAt) {}

  void updateDay(UUID gameId, int day) {
    jdbc.sql(
            """
            UPDATE progress_game
            SET last_reported_day = :day, version = version + 1, updated_at = :now
            WHERE id = :gameId
            """)
        .param("day", day)
        .param("now", now())
        .param("gameId", gameId)
        .update();
  }

  void changePhase(UUID gameId, Phase phase) {
    jdbc.sql(
            """
            UPDATE progress_game
            SET phase = :phase, version = version + 1, updated_at = :now
            WHERE id = :gameId
            """)
        .param("phase", phase.name())
        .param("now", now())
        .param("gameId", gameId)
        .update();
  }

  void startInvesting(UUID gameId, int day) {
    jdbc.sql(
            """
            UPDATE progress_game
            SET phase = :phase, investing_start_day = :day, version = version + 1, updated_at = :now
            WHERE id = :gameId
            """)
        .param("phase", Phase.INVESTING.name())
        .param("day", day)
        .param("now", now())
        .param("gameId", gameId)
        .update();
  }

  void end(UUID gameId, OffsetDateTime endedAt) {
    jdbc.sql(
            """
            UPDATE progress_game
            SET status = 'ENDED', phase = :phase, ended_at = :endedAt, version = version + 1,
                updated_at = :endedAt
            WHERE id = :gameId
            """)
        .param("phase", Phase.ENDED.name())
        .param("endedAt", endedAt)
        .param("gameId", gameId)
        .update();
  }

  OffsetDateTime now() {
    return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
  }
}
