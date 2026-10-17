package investorgame.progress.internal;

import investorgame.asset.AccountView;
import investorgame.asset.AssetService;
import investorgame.character.CharacterService;
import investorgame.character.CharacterView;
import investorgame.common.GameProperties;
import investorgame.common.Phase;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.common.random.HashSeededRandom;
import investorgame.common.random.SeededRandom;
import investorgame.progress.GameView;
import investorgame.progress.ProgressService;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class DefaultProgressService implements ProgressService {

  private final JdbcClient jdbc;
  private final Clock clock;
  private final ProgressProperties properties;
  private final GameProperties calendar;
  private final CharacterService characters;
  private final AssetService assets;
  private final SecureRandom seeds = new SecureRandom();

  DefaultProgressService(
      JdbcClient jdbc,
      Clock clock,
      ProgressProperties properties,
      GameProperties calendar,
      CharacterService characters,
      AssetService assets) {
    this.jdbc = jdbc;
    this.clock = clock;
    this.properties = properties;
    this.calendar = calendar;
    this.characters = characters;
    this.assets = assets;
  }

  @Override
  @Transactional
  public GameView start(UUID sessionId) {
    OffsetDateTime now = now();
    jdbc.sql(
            """
            UPDATE progress_game
            SET status = 'ABANDONED', ended_at = :now, updated_at = :now
            WHERE session_id = :sessionId AND status = 'ACTIVE'
            """)
        .param("sessionId", sessionId)
        .param("now", now)
        .update();

    UUID gameId = UUID.randomUUID();
    long seed = seeds.nextLong();
    jdbc.sql(
            """
            INSERT INTO progress_game
              (id, session_id, status, phase, last_reported_day, start_age, end_age, seed,
               version, created_at, updated_at)
            VALUES
              (:id, :sessionId, 'ACTIVE', :phase, 0, :startAge, :endAge, :seed, 0, :now, :now)
            """)
        .param("id", gameId)
        .param("sessionId", sessionId)
        .param("phase", Phase.SAVING.name())
        .param("startAge", properties.startAge())
        .param("endAge", properties.endAge())
        .param("seed", seed)
        .param("now", now)
        .update();

    SeededRandom random = new HashSeededRandom(seed);
    characters.create(gameId, random.forKey("character", "create"));
    assets.create(gameId, random.forKey("asset", "create"));
    return view(findActive(sessionId).orElseThrow());
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<GameView> current(UUID sessionId) {
    return findActive(sessionId).map(this::view);
  }

  @Override
  @Transactional
  public GameView advance(UUID sessionId, UUID gameId, int day) {
    GameRow game =
        jdbc.sql(
                """
                SELECT id, phase, last_reported_day, start_age, end_age
                FROM progress_game
                WHERE id = :gameId AND session_id = :sessionId AND status = 'ACTIVE'
                FOR UPDATE
                """)
            .param("gameId", gameId)
            .param("sessionId", sessionId)
            .query(GameRow.class)
            .optional()
            .orElseThrow(() -> new NotFoundException("진행 중인 판이 없다"));

    if (day < game.lastReportedDay()) {
      throw new InvalidRequestException("게임 시각은 거꾸로 갈 수 없다");
    }
    if (day - game.lastReportedDay() > properties.maxSkipDays()) {
      throw new InvalidRequestException("한 번에 건너뛸 수 있는 구간을 넘었다");
    }
    if (day > totalDays(game)) {
      throw new InvalidRequestException("종료 나이를 넘는 시각이다");
    }

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
    return view(new GameRow(game.id(), game.phase(), day, game.startAge(), game.endAge()));
  }

  private Optional<GameRow> findActive(UUID sessionId) {
    return jdbc.sql(
            """
            SELECT id, phase, last_reported_day, start_age, end_age
            FROM progress_game
            WHERE session_id = :sessionId AND status = 'ACTIVE'
            """)
        .param("sessionId", sessionId)
        .query(GameRow.class)
        .optional();
  }

  private GameView view(GameRow game) {
    CharacterView character = characters.get(game.id());
    AccountView account = assets.get(game.id());
    return new GameView(
        game.id(),
        Phase.valueOf(game.phase()),
        game.lastReportedDay(),
        game.startAge(),
        game.endAge(),
        calendar.daysPerYear(),
        character.stats(),
        account.cash());
  }

  private int totalDays(GameRow game) {
    return (game.endAge() - game.startAge()) * calendar.daysPerYear();
  }

  private OffsetDateTime now() {
    return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
  }

  private record GameRow(UUID id, String phase, int lastReportedDay, int startAge, int endAge) {}
}
