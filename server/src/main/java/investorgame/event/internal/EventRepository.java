package investorgame.event.internal;

import investorgame.common.Deviation;
import investorgame.event.EventKind;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Repository
class EventRepository {

  private static final String COLUMNS =
      """
      id, seq, kind, definition_code, sector_code, stock_code, sector_wide, occurs_day, status,
      hidden_direction, hidden_magnitude_bp, hint_code, sway_sentiment, sway_code,
      options::text AS options
      """;

  private final JdbcClient jdbc;
  private final JsonMapper json;
  private final Clock clock;

  EventRepository(JdbcClient jdbc, JsonMapper json, Clock clock) {
    this.jdbc = jdbc;
    this.json = json;
    this.clock = clock;
  }

  /** 한 판의 이벤트는 많아야 수십~백여 개라 전부 읽어 규칙을 계산한다. */
  List<EventRow> findAll(UUID gameId) {
    return jdbc.sql(
            "SELECT " + COLUMNS + " FROM event_instance WHERE game_id = :gameId ORDER BY seq")
        .param("gameId", gameId)
        .query((rs, rowNum) -> map(rs))
        .list();
  }

  Optional<EventRow> find(UUID gameId, UUID eventId) {
    return jdbc.sql(
            "SELECT " + COLUMNS + " FROM event_instance WHERE game_id = :gameId AND id = :eventId")
        .param("gameId", gameId)
        .param("eventId", eventId)
        .query((rs, rowNum) -> map(rs))
        .optional();
  }

  /** (game_id, seq)가 유니크라서 같은 이벤트를 두 번 만들지 않는다. */
  void insert(UUID gameId, EventRow row) {
    jdbc.sql(
            """
            INSERT INTO event_instance
              (id, game_id, seq, kind, definition_code, sector_code, stock_code, sector_wide,
               occurs_day, skippable, status, hidden_direction, hidden_magnitude_bp, hint_code,
               sway_sentiment, sway_code, options, depth, created_at, resolved_at)
            VALUES
              (:id, :gameId, :seq, :kind, :definitionCode, :sectorCode, :stockCode, :sectorWide,
               :occursDay, :skippable, :status, :hiddenDirection, :hiddenMagnitudeBp, :hintCode,
               :swaySentiment, :swayCode, CAST(:options AS jsonb), 0, :now, :resolvedAt)
            ON CONFLICT (game_id, seq) DO NOTHING
            """)
        .param("id", row.id())
        .param("gameId", gameId)
        .param("seq", row.seq())
        .param("kind", row.kind().name())
        .param("definitionCode", row.definitionCode())
        .param("sectorCode", row.sectorCode())
        .param("stockCode", row.stockCode())
        .param("sectorWide", row.sectorWide())
        .param("occursDay", row.occursDay())
        .param("skippable", row.kind() == EventKind.NOTICE)
        .param("status", row.status())
        .param("resolvedAt", row.resolved() ? now() : null)
        .param("hiddenDirection", row.hiddenDirection())
        .param("hiddenMagnitudeBp", row.hiddenMagnitudeBp())
        .param("hintCode", row.hintCode())
        .param("swaySentiment", row.swaySentiment())
        .param("swayCode", row.swayCode())
        .param("options", json.writeValueAsString(row.options()))
        .param("now", now())
        .update();
  }

  /** 처음 해결되었으면 true. 이미 해결된 이벤트면 아무것도 하지 않고 false. */
  boolean resolve(
      UUID gameId, UUID eventId, String choice, String actual, List<Deviation> deviations) {
    int inserted =
        jdbc.sql(
                """
                INSERT INTO event_resolution (event_id, game_id, choice, actual_action, created_at)
                VALUES (:eventId, :gameId, :choice, :actual, :now)
                ON CONFLICT (event_id) DO NOTHING
                """)
            .param("eventId", eventId)
            .param("gameId", gameId)
            .param("choice", choice)
            .param("actual", actual)
            .param("now", now())
            .update();
    if (inserted == 0) {
      return false;
    }
    for (int step = 0; step < deviations.size(); step++) {
      Deviation deviation = deviations.get(step);
      jdbc.sql(
              """
              INSERT INTO event_deviation (event_id, step, stat_code, from_action, to_action)
              VALUES (:eventId, :step, :statCode, :from, :to)
              """)
          .param("eventId", eventId)
          .param("step", step)
          .param("statCode", deviation.statCode())
          .param("from", deviation.from().name())
          .param("to", deviation.to().name())
          .update();
    }
    jdbc.sql(
            "UPDATE event_instance SET status = 'RESOLVED', resolved_at = :now WHERE id = :eventId")
        .param("now", now())
        .param("eventId", eventId)
        .update();
    return true;
  }

  Map<String, Integer> deviationCounts(UUID gameId) {
    Map<String, Integer> counts = new HashMap<>();
    jdbc.sql(
            """
            SELECT d.stat_code, COUNT(*) AS count
            FROM event_deviation d JOIN event_instance i ON i.id = d.event_id
            WHERE i.game_id = :gameId
            GROUP BY d.stat_code
            """)
        .param("gameId", gameId)
        .query((rs, rowNum) -> Map.entry(rs.getString("stat_code"), rs.getInt("count")))
        .list()
        .forEach(e -> counts.put(e.getKey(), e.getValue()));
    return counts;
  }

  private EventRow map(ResultSet rs) throws SQLException {
    return new EventRow(
        rs.getObject("id", UUID.class),
        rs.getInt("seq"),
        EventKind.valueOf(rs.getString("kind")),
        rs.getString("definition_code"),
        rs.getString("sector_code"),
        rs.getString("stock_code"),
        rs.getBoolean("sector_wide"),
        rs.getInt("occurs_day"),
        rs.getString("status"),
        rs.getString("hidden_direction"),
        rs.getObject("hidden_magnitude_bp", Integer.class),
        rs.getString("hint_code"),
        rs.getString("sway_sentiment"),
        rs.getString("sway_code"),
        json.readValue(rs.getString("options"), new TypeReference<List<String>>() {}));
  }

  private OffsetDateTime now() {
    return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
  }
}
