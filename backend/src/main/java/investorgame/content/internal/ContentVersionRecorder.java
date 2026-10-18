package investorgame.content.internal;

import investorgame.content.ContentCatalog;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** 어떤 버전의 콘텐츠가 로드되었는지 DB에 남긴다. 정의 자체는 DB에 넣지 않는다 (db.md 3.12절). */
@Component
class ContentVersionRecorder implements ApplicationRunner {

  private final ContentCatalog catalog;
  private final JdbcClient jdbc;
  private final Clock clock;

  ContentVersionRecorder(ContentCatalog catalog, JdbcClient jdbc, Clock clock) {
    this.catalog = catalog;
    this.jdbc = jdbc;
    this.clock = clock;
  }

  @Override
  public void run(ApplicationArguments args) {
    jdbc.sql(
            """
            INSERT INTO content_version (version, checksum, loaded_at, summary)
            VALUES (:version, :checksum, :loadedAt, CAST(:summary AS jsonb))
            ON CONFLICT (version) DO UPDATE
              SET checksum = EXCLUDED.checksum, loaded_at = EXCLUDED.loaded_at,
                  summary = EXCLUDED.summary
            """)
        .param("version", catalog.version())
        .param("checksum", checksum())
        .param("loadedAt", OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC))
        .param(
            "summary",
            "{\"jobs\":%d,\"traits\":%d,\"news\":%d}"
                .formatted(catalog.jobs().size(), catalog.traits().size(), catalog.news().size()))
        .update();
  }

  private static String checksum() {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      for (String file : JsonContentCatalog.FILES) {
        try (InputStream in = new ClassPathResource("content/" + file).getInputStream()) {
          digest.update(in.readAllBytes());
        }
      }
      return HexFormat.of().formatHex(digest.digest());
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("모든 JVM은 SHA-256을 제공해야 한다", e);
    }
  }
}
