package investorgame.session.internal;

import investorgame.session.IssuedSession;
import investorgame.session.SessionProperties;
import investorgame.session.SessionService;
import investorgame.session.SessionSummary;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class JdbcSessionService implements SessionService {

  private static final int TOKEN_BYTES = 32;

  private final JdbcClient jdbc;
  private final Clock clock;
  private final SessionProperties properties;
  private final SecureRandom secureRandom = new SecureRandom();

  JdbcSessionService(JdbcClient jdbc, Clock clock, SessionProperties properties) {
    this.jdbc = jdbc;
    this.clock = clock;
    this.properties = properties;
  }

  @Override
  @Transactional
  public IssuedSession issue() {
    UUID id = UUID.randomUUID();
    String token = newToken();
    OffsetDateTime now = now();
    jdbc.sql(
            """
            INSERT INTO session_info (id, token_hash, created_at, last_seen_at)
            VALUES (:id, :tokenHash, :now, :now)
            """)
        .param("id", id)
        .param("tokenHash", hash(token))
        .param("now", now)
        .update();
    return new IssuedSession(id, token);
  }

  @Override
  @Transactional
  public Optional<UUID> resolve(String token) {
    OffsetDateTime now = now();
    return jdbc.sql(
            """
            UPDATE session_info
            SET last_seen_at = :now
            WHERE token_hash = :tokenHash AND last_seen_at > :expiredBefore
            RETURNING id
            """)
        .param("now", now)
        .param("tokenHash", hash(token))
        .param("expiredBefore", now.minus(properties.ttl()))
        .query(UUID.class)
        .optional();
  }

  @Override
  @Transactional(readOnly = true)
  public List<SessionSummary> recent(int limit) {
    return jdbc.sql(
            """
            SELECT id, created_at, last_seen_at FROM session_info
            ORDER BY last_seen_at DESC
            LIMIT :limit
            """)
        .param("limit", limit)
        .query(SessionSummary.class)
        .list();
  }

  private OffsetDateTime now() {
    return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
  }

  private String newToken() {
    byte[] bytes = new byte[TOKEN_BYTES];
    secureRandom.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private static String hash(String token) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("모든 JVM은 SHA-256을 제공해야 한다", e);
    }
  }
}
