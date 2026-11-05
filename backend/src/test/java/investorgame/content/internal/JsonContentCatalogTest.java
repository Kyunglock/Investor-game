package investorgame.content.internal;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.content.NewsClues;
import investorgame.content.NewsDefinition;
import investorgame.content.RaisingContent;
import investorgame.content.StockDefinition;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

/** 저장소의 실제 콘텐츠(content/*.json)가 규칙을 지키는지 서버 없이 확인한다. 어긋나면 서버가 시작 단계에서 실패해야 한다. */
class JsonContentCatalogTest {

  private static final ContentProperties PROPERTIES =
      new ContentProperties(8, List.of("no-such-dir"));

  private static JsonContentCatalog load() {
    return new JsonContentCatalog(JsonMapper.builder().build(), PROPERTIES);
  }

  /**
   * IDE에서 바로 실행하면 Gradle의 processResources가 돌지 않아 클래스 경로에 content/가 없다. 그때는 content.dir의 파일을 읽는다.
   */
  @Test
  void 콘텐츠_디렉터리가_있으면_클래스_경로보다_먼저_읽는다(@TempDir Path dir) throws IOException {
    Path source = Path.of("..", "content");
    for (String file : JsonContentCatalog.FILES) {
      Files.copy(source.resolve(file), dir.resolve(file));
    }
    String meta = Files.readString(dir.resolve("meta.json"), StandardCharsets.UTF_8);
    Files.writeString(
        dir.resolve("meta.json"),
        meta.replace("\"version\": \"0.1.0\"", "\"version\": \"dir-9.9.9\""),
        StandardCharsets.UTF_8);

    JsonContentCatalog fromDir =
        new JsonContentCatalog(
            JsonMapper.builder().build(),
            new ContentProperties(8, List.of("no-such-dir", dir.toString())));

    assertThat(fromDir.version()).isEqualTo("dir-9.9.9");
    assertThat(load().version()).as("디렉터리가 없으면 클래스 경로").isEqualTo("0.1.0");
  }

  @Test
  void 저장소의_콘텐츠가_규칙을_지킨다() {
    JsonContentCatalog catalog = load();
    assertThat(catalog.news()).isNotEmpty();
    assertThat(catalog.stocks())
        .isSortedAccordingTo(java.util.Comparator.comparing(StockDefinition::code));
    for (NewsDefinition news : catalog.news()) {
      NewsClues clues = catalog.clues(news.code());
      assertThat(clues.up()).as(news.code()).hasSizeGreaterThanOrEqualTo(3);
      assertThat(clues.down()).as(news.code()).hasSizeGreaterThanOrEqualTo(3);
    }
    RaisingContent raising = catalog.raising();
    assertThat(raising.traits())
        .extracting(RaisingContent.Card::slot)
        .contains(RaisingContent.SLOT_STYLE, RaisingContent.SLOT_SECTOR);
    assertThat(raising.company().desks())
        .extracting(RaisingContent.Desk::code)
        .contains("bio", "day", "research", "risk", "hr");
    assertThat(raising.company().eras()).isNotEmpty();
    assertThat(catalog.crises()).isNotEmpty();
    assertThat(catalog.swayPhrases("POS")).isNotEmpty();
    assertThat(catalog.hintPhrases("low", "UP", "MILD")).isNotEmpty();
  }

  @Test
  void 알_수_없는_섹터와_스타일은_코드를_그대로_돌려준다() {
    JsonContentCatalog catalog = load();
    assertThat(catalog.sectorName("bio")).isEqualTo("바이오");
    assertThat(catalog.sectorName("nope")).isEqualTo("nope");
    assertThat(catalog.styleName("long")).isEqualTo("장기 투자자");
  }
}
