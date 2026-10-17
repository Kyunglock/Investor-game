package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import investorgame.TestcontainersConfiguration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * 한 판을 25세부터 65세까지 실제 API로 끝까지 플레이한다. 클라이언트처럼 다음 이벤트 시각(nextEventDay)까지만 시간을 보내고, 대기 중인 이벤트가 있으면
 * 선택한다.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class GameFlowTest {

  private static final int REPORT_EVERY_DAYS = 90;
  private static final List<String> NEWS_CHOICES = List.of("BUY", "HOLD", "SELL", "BUY");

  @Autowired WebApplicationContext context;

  @Test
  void 성장기_성향_직업_투자_시작_뉴스를_거쳐_65세에_끝난다() throws Exception {
    MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).build();
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.start();
    String gameId = game.read("$.gameId");
    int endDay = (65 - 1) * 360;
    List<String> kindOrder = new ArrayList<>();

    Map<String, Integer> seenKinds = new HashMap<>();
    List<DocumentContext> newsOutcomes = new ArrayList<>();
    List<String> responses = new ArrayList<>();
    int newsCount = 0;

    for (int step = 0; step < 2_000 && "ACTIVE".equals(game.read("$.status")); step++) {
      Map<String, Object> pending = game.read("$.pendingEvent");
      if (pending != null) {
        String kind = (String) pending.get("kind");
        seenKinds.merge(kind, 1, Integer::sum);
        kindOrder.add(kind);
        String option =
            switch (kind) {
              case "OFFER" -> "accept";
              case "NEWS" -> NEWS_CHOICES.get(newsCount++ % NEWS_CHOICES.size());
              default -> game.read("$.pendingEvent.options[0].code");
            };
        DocumentContext result = client.choose(gameId, (String) pending.get("eventId"), option);
        responses.add(result.jsonString());
        if ("NEWS".equals(kind)) {
          newsOutcomes.add(result);
        }
        Object next = result.read("$.game");
        game = JsonPath.parse(next);
        continue;
      }
      int day = game.read("$.day", Integer.class);
      Integer nextEventDay = game.read("$.nextEventDay");
      int target =
          Math.min(
              Math.min(day + REPORT_EVERY_DAYS, endDay),
              nextEventDay == null ? endDay : nextEventDay);
      game = client.advance(gameId, target);
      responses.add(game.jsonString());
    }

    assertThat(game.read("$.status", String.class)).isEqualTo("ENDED");
    assertThat(game.read("$.phase", String.class)).isEqualTo("ENDED");
    assertThat(game.read("$.result.finalAge", Integer.class)).isEqualTo(65);
    assertThat(game.read("$.result.finalAsset", Long.class))
        .as("40년 동안 월급을 받았으므로 자산이 늘었다")
        .isGreaterThan(game.read("$.result.initialAsset", Long.class));

    assertThat(seenKinds.get("JOB")).isEqualTo(1);
    assertThat(seenKinds.get("TRAIT")).as("성장 단계 6개에서 하나씩").isEqualTo(6);
    assertThat(kindOrder.subList(0, 8))
        .as("성장기의 성향 이벤트가 모두 끝난 뒤에 직업, 그다음 투자 시작 제안")
        .containsExactly("TRAIT", "TRAIT", "TRAIT", "TRAIT", "TRAIT", "TRAIT", "JOB", "OFFER");
    assertThat(seenKinds.get("OFFER")).isEqualTo(1);
    assertThat(seenKinds.getOrDefault("NEWS", 0)).isGreaterThanOrEqualTo(20);
    assertThat(game.read("$.investmentStyle.code", String.class)).isIn("short", "long");
    assertThat(game.read("$.interestSector.code", String.class)).isNotBlank();

    for (DocumentContext outcome : newsOutcomes) {
      assertThat(outcome.read("$.outcome.price.direction", String.class)).isIn("UP", "DOWN");
      assertThat(outcome.read("$.outcome.trade.status", String.class)).isNotBlank();
    }
    long deviations =
        newsOutcomes.stream()
            .mapToLong(o -> o.read("$.outcome.deviations.length()", Integer.class))
            .sum();
    assertThat(deviations).as("능력치 15~85에서 수십 번 선택하면 이탈이 생긴다").isPositive();

    // 진행 중 응답 어디에도 숨은 값이 나가지 않는다 (해결된 뉴스의 주가 방향은 결과로 보여 준다).
    for (String response : responses) {
      assertThat(response)
          .doesNotContain("seed")
          .doesNotContain("hidden")
          .doesNotContain("magnitude");
    }

    DocumentContext reloaded = client.current();
    assertThat(reloaded.read("$.status", String.class))
        .as("끝난 판은 새로고침해도 결과를 보여 준다")
        .isEqualTo("ENDED");
  }
}
