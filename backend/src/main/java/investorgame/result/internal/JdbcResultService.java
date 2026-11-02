package investorgame.result.internal;

import investorgame.common.Stats;
import investorgame.result.Ending;
import investorgame.result.GameResult;
import investorgame.result.PlayProfile;
import investorgame.result.RankingEntry;
import investorgame.result.ResultService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
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
    insert(result);
  }

  @Override
  @Transactional
  public void save(GameResult result, PlayProfile profile) {
    if (!insert(result)) {
      return;
    }
    jdbc.sql(
            """
            INSERT INTO result_profile
              (content_version, ended_on, final_age, ending, bot_persona, habits,
               invested, invest_pnl, invest_return_bp)
            VALUES
              (:contentVersion, :endedOn, :finalAge, :ending, :botPersona, CAST(:habits AS vector),
               :invested, :investPnl, :investReturnBp)
            """)
        .param("contentVersion", profile.contentVersion())
        .param("endedOn", profile.endedOn())
        .param("finalAge", profile.finalAge())
        .param("ending", profile.ending().name())
        .param("botPersona", profile.botPersona())
        .param("habits", vectorLiteral(profile.habits().toVector()))
        .param("invested", profile.invested())
        .param("investPnl", profile.investPnl())
        .param("investReturnBp", profile.investReturnBp())
        .update();
  }

  /** 새로 쌓았으면 true. 같은 판이 이미 있으면 false. */
  private boolean insert(GameResult result) {
    return jdbc.sql(
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
                "summary",
                json.writeValueAsString(Map.of("deviationCounts", result.deviationCounts())))
            .update()
        == 1;
  }

  /** pgvector의 입력 형식 "[0.5,0.25,...]". */
  private static String vectorLiteral(double[] values) {
    return Arrays.stream(values)
        .mapToObj(Double::toString)
        .collect(Collectors.joining(",", "[", "]"));
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

  @Override
  @Transactional
  public boolean enterRanking(RankingEntry entry) {
    return jdbc.sql(
                """
            INSERT INTO result_ranking
              (game_id, name, final_asset, final_age, ending, job_title, entered_at)
            VALUES
              (:gameId, :name, :finalAsset, :finalAge, :ending, :jobTitle, :enteredAt)
            ON CONFLICT (game_id) DO NOTHING
            """)
            .param("gameId", entry.gameId())
            .param("name", entry.name())
            .param("finalAsset", entry.finalAsset())
            .param("finalAge", entry.finalAge())
            .param("ending", entry.ending().name())
            .param("jobTitle", entry.jobTitle())
            .param("enteredAt", entry.enteredAt())
            .update()
        == 1;
  }

  @Override
  @Transactional(readOnly = true)
  public List<RankingEntry> ranking(int limit) {
    return jdbc.sql(
            """
            SELECT game_id, name, final_asset, final_age, ending, job_title, entered_at
            FROM result_ranking
            ORDER BY final_asset DESC, entered_at
            LIMIT :limit
            """)
        .param("limit", limit)
        .query(JdbcResultService::mapRanking)
        .list();
  }

  @Override
  @Transactional(readOnly = true)
  public int rankingSize() {
    return jdbc.sql("SELECT count(*) FROM result_ranking").query(Integer.class).single();
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<Integer> rankOf(UUID gameId) {
    // 나보다 자산이 많은 사람 수 + 자산이 같은데 먼저 올린 사람 수 + 1 = 순위표에서 내 줄의 위치.
    return jdbc.sql(
            """
            SELECT 1 + count(*)
            FROM result_ranking r, result_ranking me
            WHERE me.game_id = :gameId
              AND (r.final_asset > me.final_asset
                   OR (r.final_asset = me.final_asset AND r.entered_at < me.entered_at))
            GROUP BY me.game_id
            """)
        .param("gameId", gameId)
        .query(Integer.class)
        .optional();
  }

  private static RankingEntry mapRanking(ResultSet rs, int rowNum) throws SQLException {
    return new RankingEntry(
        rs.getObject("game_id", UUID.class),
        rs.getString("name"),
        rs.getLong("final_asset"),
        rs.getInt("final_age"),
        Ending.valueOf(rs.getString("ending")),
        rs.getString("job_title"),
        rs.getObject("entered_at", OffsetDateTime.class));
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
