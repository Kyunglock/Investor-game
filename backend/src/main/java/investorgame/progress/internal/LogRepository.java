package investorgame.progress.internal;

import investorgame.progress.GameView;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** 인생 기록(progress_log)과 연간 자산(progress_year). 화면에 보여도 되는 값만 담는다. */
@Repository
class LogRepository {

  private static final TypeReference<Map<String, Object>> PAYLOAD = new TypeReference<>() {};

  private final JdbcClient jdbc;
  private final JsonMapper json;
  private final Clock clock;

  LogRepository(JdbcClient jdbc, JsonMapper json, Clock clock) {
    this.jdbc = jdbc;
    this.json = json;
    this.clock = clock;
  }

  void append(UUID gameId, int day, String kind, Map<String, Object> payload) {
    jdbc.sql(
            """
            INSERT INTO progress_log (game_id, game_day, kind, payload, created_at)
            VALUES (:gameId, :day, :kind, CAST(:payload AS jsonb), :now)
            """)
        .param("gameId", gameId)
        .param("day", day)
        .param("kind", kind)
        .param("payload", json.writeValueAsString(payload))
        .param("now", OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC))
        .update();
  }

  /** 한 판의 기록은 많아야 백여 줄이라 전부 읽는다. */
  List<GameView.LogEntry> findAll(UUID gameId) {
    return jdbc.sql(
            """
            SELECT id, game_day, kind, payload::text AS payload
            FROM progress_log WHERE game_id = :gameId ORDER BY id
            """)
        .param("gameId", gameId)
        .query(
            (rs, rowNum) ->
                new GameView.LogEntry(
                    rs.getLong("id"),
                    rs.getInt("game_day"),
                    rs.getString("kind"),
                    json.readValue(rs.getString("payload"), PAYLOAD)))
        .list();
  }

  /** 같은 나이를 두 번 넣어도 첫 값이 남는다. 보고가 재시도되어도 안전하다. */
  void upsertYear(UUID gameId, int age, long totalAsset, long cash) {
    jdbc.sql(
            """
            INSERT INTO progress_year (game_id, age, total_asset, cash)
            VALUES (:gameId, :age, :totalAsset, :cash)
            ON CONFLICT (game_id, age) DO NOTHING
            """)
        .param("gameId", gameId)
        .param("age", age)
        .param("totalAsset", totalAsset)
        .param("cash", cash)
        .update();
  }

  /** 달마다 마친 총자산. 포트폴리오의 "이번 달" 비교용. 같은 달은 첫 값이 남는다. */
  void upsertMonth(UUID gameId, int month, long totalAsset) {
    jdbc.sql(
            """
            INSERT INTO progress_month (game_id, month, total_asset)
            VALUES (:gameId, :month, :totalAsset)
            ON CONFLICT (game_id, month) DO NOTHING
            """)
        .param("gameId", gameId)
        .param("month", month)
        .param("totalAsset", totalAsset)
        .update();
  }

  OptionalLong findMonthTotal(UUID gameId, int month) {
    return jdbc.sql(
            "SELECT total_asset FROM progress_month WHERE game_id = :gameId AND month = :month")
        .param("gameId", gameId)
        .param("month", month)
        .query(Long.class)
        .optional()
        .map(OptionalLong::of)
        .orElse(OptionalLong.empty());
  }

  /** 종료 해처럼 같은 날의 마지막 값이 맞아야 하는 줄은 덮어쓴다. */
  void replaceYear(UUID gameId, int age, long totalAsset, long cash) {
    jdbc.sql(
            """
            INSERT INTO progress_year (game_id, age, total_asset, cash)
            VALUES (:gameId, :age, :totalAsset, :cash)
            ON CONFLICT (game_id, age)
              DO UPDATE SET total_asset = EXCLUDED.total_asset, cash = EXCLUDED.cash
            """)
        .param("gameId", gameId)
        .param("age", age)
        .param("totalAsset", totalAsset)
        .param("cash", cash)
        .update();
  }

  List<GameView.Yearly> findYears(UUID gameId) {
    return jdbc.sql(
            "SELECT age, total_asset, cash FROM progress_year WHERE game_id = :gameId ORDER BY age")
        .param("gameId", gameId)
        .query(
            (rs, rowNum) ->
                new GameView.Yearly(
                    rs.getInt("age"), rs.getLong("total_asset"), rs.getLong("cash")))
        .list();
  }
}
