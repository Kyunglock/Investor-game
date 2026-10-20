package investorgame.architecture;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/** db.md 6절의 마이그레이션 규칙을 검사한다. 에이전트가 병렬로 마이그레이션을 추가해도 규칙이 지켜지게 한다. */
class MigrationRulesTest {

  private static final Path DIR = Path.of("src/main/resources/db/migration");

  private static final Set<String> DOMAINS =
      Set.of(
          "character",
          "asset",
          "market",
          "household",
          "housing",
          "event",
          "progress",
          "session",
          "content",
          "result");

  private static final Pattern FILE_NAME = Pattern.compile("V(\\d{12})__([a-z]+)_[a-z0-9_]+\\.sql");

  private static final Pattern CREATE_TABLE =
      Pattern.compile(
          "CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?([a-z_][a-z0-9_]*)",
          Pattern.CASE_INSENSITIVE);

  @Test
  void 파일_이름은_시각_기반_버전과_도메인을_가진다() throws IOException {
    for (Path file : migrations()) {
      Matcher m = FILE_NAME.matcher(file.getFileName().toString());
      assertThat(m.matches())
          .as("%s: V<yyyyMMddHHmm>__<도메인>_<설명>.sql 형식이어야 한다", file.getFileName())
          .isTrue();
      assertThat(DOMAINS).as("%s: 알 수 없는 도메인", file.getFileName()).contains(m.group(2));
    }
  }

  @Test
  void 버전_번호가_겹치지_않는다() throws IOException {
    List<String> versions =
        migrations().stream()
            .map(f -> f.getFileName().toString().substring(1, 13))
            .collect(Collectors.toList());
    assertThat(versions).doesNotHaveDuplicates();
  }

  @Test
  void 외래_키를_쓰지_않는다() throws IOException {
    for (Path file : migrations()) {
      String sql = Files.readString(file).toUpperCase(Locale.ROOT);
      assertThat(sql)
          .as("%s: FK는 쓰지 않는다 (확정)", file.getFileName())
          .doesNotContain("REFERENCES")
          .doesNotContain("FOREIGN KEY");
    }
  }

  @Test
  void 테이블_이름은_파일의_도메인_접두사로_시작한다() throws IOException {
    int checked = 0;
    for (Path file : migrations()) {
      Matcher name = FILE_NAME.matcher(file.getFileName().toString());
      assertThat(name.matches()).isTrue();
      String domain = name.group(2);
      Matcher table = CREATE_TABLE.matcher(Files.readString(file));
      while (table.find()) {
        checked++;
        assertThat(table.group(1).toLowerCase(Locale.ROOT))
            .as("%s: 이 파일은 %s_ 테이블만 만든다", file.getFileName(), domain)
            .startsWith(domain + "_");
      }
    }
    // 정규식이 테이블을 하나도 찾지 못하면 이 검사는 아무것도 지키지 않는다.
    assertThat(checked).as("검사한 CREATE TABLE 수").isPositive();
  }

  private static List<Path> migrations() throws IOException {
    try (Stream<Path> files = Files.list(DIR)) {
      return files.filter(f -> f.toString().endsWith(".sql")).sorted().toList();
    }
  }
}
