package investorgame.asset.internal;

import investorgame.asset.AccountView;
import investorgame.asset.AssetService;
import investorgame.common.error.NotFoundException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import java.util.random.RandomGenerator;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class JdbcAssetService implements AssetService {

  private final JdbcClient jdbc;
  private final Clock clock;
  private final AssetProperties properties;

  JdbcAssetService(JdbcClient jdbc, Clock clock, AssetProperties properties) {
    this.jdbc = jdbc;
    this.clock = clock;
    this.properties = properties;
  }

  @Override
  @Transactional
  public AccountView create(UUID gameId, RandomGenerator rng) {
    AssetProperties.InitialCash range = properties.initialCash();
    long initialCash = rng.nextInt(range.minUnit(), range.maxUnit() + 1) * range.unit();
    jdbc.sql(
            """
            INSERT INTO asset_account (game_id, cash, initial_cash, updated_at)
            VALUES (:gameId, :cash, :cash, :now)
            ON CONFLICT (game_id) DO NOTHING
            """)
        .param("gameId", gameId)
        .param("cash", initialCash)
        .param("now", OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC))
        .update();
    return get(gameId);
  }

  @Override
  @Transactional(readOnly = true)
  public AccountView get(UUID gameId) {
    return jdbc.sql("SELECT cash, initial_cash FROM asset_account WHERE game_id = :gameId")
        .param("gameId", gameId)
        .query(
            (rs, rowNum) ->
                new AccountView(gameId, rs.getLong("cash"), rs.getLong("initial_cash"), Map.of()))
        .optional()
        .orElseThrow(() -> new NotFoundException("자산 계정이 없다"));
  }
}
