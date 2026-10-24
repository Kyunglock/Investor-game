package investorgame.result.internal;

import investorgame.common.Stats;
import investorgame.result.Ending;
import investorgame.result.GameResult;
import investorgame.result.ResultService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Service
class JdbcResultService implements ResultService {

  private static final String SELECT =
      """
      SELECT game_id, session_id, content_version, initial_asset, final_asset, final_age,
             ending, started_at, ended_at, stats_snapshot::text AS stats,
             summary::text AS summary
      FROM result_game
      """;

  private final JdbcClient jdbc;
  private final JsonMapper json;

  JdbcResultService(JdbcClient jdbc, JsonMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  @Override
  @Transactional
  public void save(GameResult result) {
    jdbc.sql(
            """
            INSERT INTO result_game
              (game_id, session_id, content_version, initial_asset, final_asset, final_age,
               ending, started_at, ended_at, stats_snapshot, summary)
            VALUES
              (:gameId, :sessionId, :contentVersion, :initialAsset, :finalAsset, :finalAge,
               :ending, :startedAt, :endedAt, CAST(:stats AS jsonb), CAST(:summary AS jsonb))
            ON CONFLICT (game_id) DO NOTHING
            """)
        .param("gameId", result.gameId())
        .param("sessionId", result.sessionId())
        .param("contentVersion", result.contentVersion())
        .param("initialAsset", result.initialAsset())
        .param("finalAsset", result.finalAsset())
        .param("finalAge", result.finalAge())
        .param("ending", result.ending().name())
        .param("startedAt", result.startedAt())
        .param("endedAt", result.endedAt())
        .param("stats", json.writeValueAsString(result.finalStats().toCodes()))
        .param(
            "summary", json.writeValueAsString(Map.of("deviationCounts", result.deviationCounts())))
        .update();
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<GameResult> find(UUID gameId) {
    return jdbc.sql(SELECT + "WHERE game_id = :gameId")
        .param("gameId", gameId)
        .query(this::map)
        .optional();
  }

  @Override
  @Transactional(readOnly = true)
  public List<GameResult> findAll(Collection<UUID> gameIds) {
    if (gameIds.isEmpty()) {
      return List.of();
    }
    return jdbc.sql(SELECT + "WHERE game_id IN (:gameIds)")
        .param("gameIds", gameIds)
        .query(this::map)
        .list();
  }

  private GameResult map(ResultSet rs, int rowNum) throws SQLException {
    return new GameResult(
        rs.getObject("game_id", UUID.class),
        rs.getObject("session_id", UUID.class),
        rs.getString("content_version"),
        rs.getLong("initial_asset"),
        rs.getLong("final_asset"),
        rs.getInt("final_age"),
        Ending.valueOf(rs.getString("ending")),
        Stats.fromCodes(
            json.readValue(rs.getString("stats"), new TypeReference<Map<String, Integer>>() {})),
        json.readValue(rs.getString("summary"), new TypeReference<Summary>() {}).deviationCounts(),
        rs.getObject("started_at", OffsetDateTime.class),
        rs.getObject("ended_at", OffsetDateTime.class));
  }

  private record Summary(Map<String, Integer> deviationCounts) {}
}
