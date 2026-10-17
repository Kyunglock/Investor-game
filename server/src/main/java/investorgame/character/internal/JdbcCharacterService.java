package investorgame.character.internal;

import investorgame.character.CharacterService;
import investorgame.character.CharacterView;
import investorgame.common.StatCodes;
import investorgame.common.Stats;
import investorgame.common.error.NotFoundException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.random.RandomGenerator;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class JdbcCharacterService implements CharacterService {

  private final JdbcClient jdbc;
  private final Clock clock;
  private final CharacterProperties properties;

  JdbcCharacterService(JdbcClient jdbc, Clock clock, CharacterProperties properties) {
    this.jdbc = jdbc;
    this.clock = clock;
    this.properties = properties;
  }

  @Override
  @Transactional
  public CharacterView create(UUID gameId, RandomGenerator rng) {
    if (exists(gameId)) {
      return get(gameId);
    }
    OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    jdbc.sql(
            """
            INSERT INTO character_profile (game_id, created_at, updated_at)
            VALUES (:gameId, :now, :now)
            """)
        .param("gameId", gameId)
        .param("now", now)
        .update();

    CharacterProperties.InitialStat range = properties.initialStat();
    for (String code : StatCodes.ALL) {
      int value = rng.nextInt(range.min(), range.max() + 1);
      jdbc.sql(
              """
              INSERT INTO character_stat (game_id, stat_code, initial_value, value, exp)
              VALUES (:gameId, :code, :value, :value, 0)
              """)
          .param("gameId", gameId)
          .param("code", code)
          .param("value", value)
          .update();
    }
    return get(gameId);
  }

  @Override
  @Transactional(readOnly = true)
  public CharacterView get(UUID gameId) {
    Profile profile =
        jdbc.sql(
                """
                SELECT job_code, job_start_day, investment_style, interest_sector
                FROM character_profile
                WHERE game_id = :gameId
                """)
            .param("gameId", gameId)
            .query(Profile.class)
            .optional()
            .orElseThrow(() -> new NotFoundException("캐릭터가 없다"));

    List<StatRow> rows =
        jdbc.sql(
                "SELECT stat_code, initial_value, value FROM character_stat WHERE game_id = :gameId")
            .param("gameId", gameId)
            .query(StatRow.class)
            .list();
    Map<String, Integer> current = new HashMap<>();
    Map<String, Integer> initial = new HashMap<>();
    for (StatRow row : rows) {
      current.put(row.statCode(), row.value());
      initial.put(row.statCode(), row.initialValue());
    }

    return new CharacterView(
        gameId,
        Stats.fromCodes(current),
        Stats.fromCodes(initial),
        profile.jobCode(),
        profile.jobStartDay(),
        profile.investmentStyle(),
        profile.interestSector());
  }

  private boolean exists(UUID gameId) {
    return jdbc.sql("SELECT EXISTS (SELECT 1 FROM character_profile WHERE game_id = :gameId)")
        .param("gameId", gameId)
        .query(Boolean.class)
        .single();
  }

  private record Profile(
      String jobCode, Integer jobStartDay, String investmentStyle, String interestSector) {}

  private record StatRow(String statCode, int initialValue, int value) {}
}
