package investorgame.raising.internal;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;

/** raising_company. 상태는 JSON 한 칸이다. */
@Repository
class CompanyRepository {

  private final JdbcClient jdbc;
  private final JsonMapper json;
  private final Clock clock;

  CompanyRepository(JdbcClient jdbc, JsonMapper json, Clock clock) {
    this.jdbc = jdbc;
    this.json = json;
    this.clock = clock;
  }

  record Row(UUID id, UUID sessionId, String status, long seed, CompanyState state) {}

  void insert(Row row) {
    jdbc.sql(
            """
            INSERT INTO raising_company (id, session_id, status, seed, state, created_at, updated_at)
            VALUES (:id, :sessionId, 'ACTIVE', :seed, CAST(:state AS jsonb), :now, :now)
            """)
        .param("id", row.id())
        .param("sessionId", row.sessionId())
        .param("seed", row.seed())
        .param("state", json.writeValueAsString(row.state()))
        .param("now", now())
        .update();
  }

  /** 돌고 있는 회사를 잠근다. */
  Optional<Row> lockActive(UUID sessionId) {
    return jdbc.sql(
            """
            SELECT id, session_id, status, seed, state FROM raising_company
            WHERE session_id = :sessionId AND status = 'ACTIVE'
            FOR UPDATE
            """)
        .param("sessionId", sessionId)
        .query(this::map)
        .optional();
  }

  /** 가장 최근 회사를 잠근다(돌고 있든 끝났든). 결산(234번)·옛 회사 되살리기(236번)·망한 회사 다시 차리기(247번)가 쓴다. */
  Optional<Row> lockLatest(UUID sessionId) {
    return jdbc.sql(
            """
            SELECT id, session_id, status, seed, state FROM raising_company
            WHERE session_id = :sessionId
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
            """)
        .param("sessionId", sessionId)
        .query(this::map)
        .optional();
  }

  Optional<Row> latest(UUID sessionId) {
    return jdbc.sql(
            """
            SELECT id, session_id, status, seed, state FROM raising_company
            WHERE session_id = :sessionId
            ORDER BY created_at DESC
            LIMIT 1
            """)
        .param("sessionId", sessionId)
        .query(this::map)
        .optional();
  }

  /**
   * 올해의 라이벌 후보 하나 (decisions.md 275번): 다른 세션에서 돌고 있는 회사 가운데 자본이 [low, high)인 곳을 무작위로 하나. 엔딩을 본 회사는
   * 뺀다. 연초에 한 번만 부른다.
   */
  Optional<TargetEngine.Candidate> targetCandidate(UUID sessionId, long low, long high) {
    return jdbc.sql(
            """
            SELECT id, (state->>'capital')::bigint AS capital FROM raising_company
            WHERE status = 'ACTIVE' AND session_id <> :sessionId
              AND (state->>'capital')::bigint >= :low AND (state->>'capital')::bigint < :high
              AND COALESCE((state->>'finished')::boolean, false) = false
            ORDER BY random()
            LIMIT 1
            """)
        .param("sessionId", sessionId)
        .param("low", low)
        .param("high", high)
        .query((rs, i) -> new TargetEngine.Candidate(rs.getString("id"), rs.getLong("capital")))
        .optional();
  }

  /** 올해의 라이벌로 고른 실제 회사의 지금 자본. 연말 결산 직전에 한 번 읽는다(275번). 회사가 없어졌으면 빈 값. */
  Optional<Long> capitalOf(UUID companyId) {
    return jdbc.sql(
            "SELECT (state->>'capital')::bigint AS capital FROM raising_company WHERE id = :id")
        .param("id", companyId)
        .query((rs, i) -> rs.getLong("capital"))
        .optional();
  }

  record Recent(Row row, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}

  /** 최근에 차린 회사부터 limit개. 관리자 플레이 기록용. */
  List<Recent> recent(int limit) {
    return jdbc.sql(
            """
            SELECT id, session_id, status, seed, state, created_at, updated_at FROM raising_company
            ORDER BY created_at DESC
            LIMIT :limit
            """)
        .param("limit", limit)
        .query(
            (rs, i) ->
                new Recent(
                    map(rs, i),
                    rs.getObject("created_at", OffsetDateTime.class),
                    rs.getObject("updated_at", OffsetDateTime.class)))
        .list();
  }

  void update(UUID id, CompanyState state, boolean ended) {
    jdbc.sql(
            """
            UPDATE raising_company
            SET state = CAST(:state AS jsonb), updated_at = :now,
                status = CASE WHEN :ended THEN 'ENDED' ELSE status END
            WHERE id = :id
            """)
        .param("id", id)
        .param("state", json.writeValueAsString(state))
        .param("ended", ended)
        .param("now", now())
        .update();
  }

  /** 시대가 끝나 멈췄던 옛 회사를 다시 돌린다 (decisions.md 236번: 매각을 뺐다). */
  void reopen(UUID id, CompanyState state) {
    jdbc.sql(
            """
            UPDATE raising_company
            SET state = CAST(:state AS jsonb), updated_at = :now, status = 'ACTIVE'
            WHERE id = :id
            """)
        .param("id", id)
        .param("state", json.writeValueAsString(state))
        .param("now", now())
        .update();
  }

  private Row map(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
    return new Row(
        rs.getObject("id", UUID.class),
        rs.getObject("session_id", UUID.class),
        rs.getString("status"),
        rs.getLong("seed"),
        json.readValue(rs.getString("state"), CompanyState.class));
  }

  private OffsetDateTime now() {
    return OffsetDateTime.now(clock);
  }
}
