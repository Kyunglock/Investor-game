package investorgame.content.internal;

import investorgame.content.ContentCatalog;
import java.util.List;
import tools.jackson.databind.json.JsonMapper;

/** 다른 도메인의 단위 테스트가 저장소의 실제 콘텐츠를 쓰게 한다. */
public final class TestContent {

  private static ContentCatalog catalog;

  private TestContent() {}

  public static synchronized ContentCatalog load() {
    if (catalog == null) {
      catalog =
          new JsonContentCatalog(
              JsonMapper.builder().build(), new ContentProperties(8, List.of("../content")));
    }
    return catalog;
  }
}
