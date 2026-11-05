package investorgame.raising.internal;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;

/** raising_memory. 세션이 회사를 넘어 기억하는 것(사장 명성)을 JSON 한 칸에 둔다. */
@Repository
class MemoryRepository {

  private final JdbcClient jdbc;
  private final JsonMapper json;
  private final Clock clock;

  MemoryRepository(JdbcClient jdbc, JsonMapper json, Clock clock) {
    this.jdbc = jdbc;
    this.json = json;
    this.clock = clock;
  }

  /** 세션의 기억. 없으면 빈 기억. 같은 세션의 동시 요청을 막으려고 있으면 잠근다. */
  RaisingMemory lock(UUID sessionId) {
    return jdbc.sql("SELECT state FROM raising_memory WHERE session_id = :sessionId FOR UPDATE")
        .param("sessionId", sessionId)
        .query((rs, i) -> json.readValue(rs.getString("state"), RaisingMemory.class))
        .optional()
        .orElseGet(RaisingMemory::new);
  }

  RaisingMemory find(UUID sessionId) {
    return jdbc.sql("SELECT state FROM raising_memory WHERE session_id = :sessionId")
        .param("sessionId", sessionId)
        .query((rs, i) -> json.readValue(rs.getString("state"), RaisingMemory.class))
        .optional()
        .orElseGet(RaisingMemory::new);
  }

  void save(UUID sessionId, RaisingMemory memory) {
    jdbc.sql(
            """
            INSERT INTO raising_memory (session_id, state, updated_at)
            VALUES (:sessionId, CAST(:state AS jsonb), :now)
            ON CONFLICT (session_id) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at
            """)
        .param("sessionId", sessionId)
        .param("state", json.writeValueAsString(memory))
        .param("now", OffsetDateTime.now(clock))
        .update();
  }
}
