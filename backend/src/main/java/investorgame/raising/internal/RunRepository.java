package investorgame.raising.internal;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;

/** raising_run·raising_memory. 상태는 JSON 한 칸이다. */
@Repository
class RunRepository {

  private static final String COLUMNS = "id, session_id, status, seed, scripted, state";

  private final JdbcClient jdbc;
  private final JsonMapper json;
  private final Clock clock;

  RunRepository(JdbcClient jdbc, JsonMapper json, Clock clock) {
    this.jdbc = jdbc;
    this.json = json;
    this.clock = clock;
  }

  record Row(UUID id, UUID sessionId, String status, long seed, boolean scripted, RunState state) {}

  void abandonActive(UUID sessionId) {
    jdbc.sql(
            """
            UPDATE raising_run SET status = 'ABANDONED', ended_at = :now, updated_at = :now
            WHERE session_id = :sessionId AND status = 'ACTIVE'
            """)
        .param("sessionId", sessionId)
        .param("now", now())
        .update();
  }

  void insert(Row row, String contentVersion) {
    jdbc.sql(
            """
            INSERT INTO raising_run
              (id, session_id, status, seed, scripted, state, content_version, created_at, updated_at)
            VALUES (:id, :sessionId, 'ACTIVE', :seed, :scripted, CAST(:state AS jsonb),
                    :contentVersion, :now, :now)
            """)
        .param("id", row.id())
        .param("sessionId", row.sessionId())
        .param("seed", row.seed())
        .param("scripted", row.scripted())
        .param("state", json.writeValueAsString(row.state()))
        .param("contentVersion", contentVersion)
        .param("now", now())
        .update();
  }

  /** 한 판의 요청을 직렬화한다. 진행 중인 판만 잠근다. */
  Optional<Row> lockActive(UUID sessionId, UUID runId) {
    return jdbc.sql(
            "SELECT "
                + COLUMNS
                + """
                 FROM raising_run
                WHERE id = :id AND session_id = :sessionId AND status = 'ACTIVE'
                FOR UPDATE
                """)
        .param("id", runId)
        .param("sessionId", sessionId)
        .query(this::map)
        .optional();
  }

  /** 끝난 판을 잠근다. 등록을 정할 때 쓴다. */
  Optional<Row> lockEnded(UUID sessionId, UUID runId) {
    return jdbc.sql(
            "SELECT "
                + COLUMNS
                + """
                 FROM raising_run
                WHERE id = :id AND session_id = :sessionId AND status = 'ENDED'
                FOR UPDATE
                """)
        .param("id", runId)
        .param("sessionId", sessionId)
        .query(this::map)
        .optional();
  }

  Optional<Row> latest(UUID sessionId) {
    return jdbc.sql(
            "SELECT "
                + COLUMNS
                + """
                 FROM raising_run
                WHERE session_id = :sessionId AND status <> 'ABANDONED'
                ORDER BY created_at DESC
                LIMIT 1
                """)
        .param("sessionId", sessionId)
        .query(this::map)
        .optional();
  }

  record Recent(Row row, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}

  List<Recent> recent(int limit) {
    return jdbc.sql(
            "SELECT "
                + COLUMNS
                + ", created_at, updated_at FROM raising_run ORDER BY created_at DESC LIMIT :limit")
        .param("limit", limit)
        .query(
            (rs, i) ->
                new Recent(
                    map(rs, i),
                    rs.getObject("created_at", OffsetDateTime.class),
                    rs.getObject("updated_at", OffsetDateTime.class)))
        .list();
  }

  void update(UUID runId, RunState state, boolean ended) {
    jdbc.sql(
            """
            UPDATE raising_run
            SET state = CAST(:state AS jsonb), updated_at = :now,
                status = CASE WHEN :ended THEN 'ENDED' ELSE status END,
                ended_at = CASE WHEN :ended AND ended_at IS NULL THEN :now ELSE ended_at END
            WHERE id = :id
            """)
        .param("id", runId)
        .param("state", json.writeValueAsString(state))
        .param("ended", ended)
        .param("now", now())
        .update();
  }

  /** 세션의 기억. 없으면 빈 기억. 같은 세션의 동시 요청을 막으려고 있으면 잠근다. */
  RaisingMemory lockMemory(UUID sessionId) {
    return jdbc.sql("SELECT state FROM raising_memory WHERE session_id = :sessionId FOR UPDATE")
        .param("sessionId", sessionId)
        .query((rs, i) -> json.readValue(rs.getString("state"), RaisingMemory.class))
        .optional()
        .orElseGet(RaisingMemory::new);
  }

  RaisingMemory memory(UUID sessionId) {
    return jdbc.sql("SELECT state FROM raising_memory WHERE session_id = :sessionId")
        .param("sessionId", sessionId)
        .query((rs, i) -> json.readValue(rs.getString("state"), RaisingMemory.class))
        .optional()
        .orElseGet(RaisingMemory::new);
  }

  void saveMemory(UUID sessionId, RaisingMemory memory) {
    jdbc.sql(
            """
            INSERT INTO raising_memory (session_id, state, updated_at)
            VALUES (:sessionId, CAST(:state AS jsonb), :now)
            ON CONFLICT (session_id) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at
            """)
        .param("sessionId", sessionId)
        .param("state", json.writeValueAsString(memory))
        .param("now", now())
        .update();
  }

  private Row map(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
    return new Row(
        rs.getObject("id", UUID.class),
        rs.getObject("session_id", UUID.class),
        rs.getString("status"),
        rs.getLong("seed"),
        rs.getBoolean("scripted"),
        json.readValue(rs.getString("state"), RunState.class));
  }

  private OffsetDateTime now() {
    return OffsetDateTime.now(clock);
  }
}
