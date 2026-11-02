package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import investorgame.TestcontainersConfiguration;
import investorgame.progress.ShareCard;
import investorgame.result.Ending;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** 결과 공유 (#197). */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ShareApiTest {

  @Autowired WebApplicationContext context;

  MockMvc mvc;

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
  }

  private static String endedGame(GameClient client) throws Exception {
    DocumentContext game = client.start();
    String gameId = game.read("$.gameId");
    client.renameRaw(gameId, "버핏").andExpect(status().isOk());
    client.advance(gameId, game.read("$.nextEventDay", Integer.class));
    DocumentContext pending = client.current();
    client.choose(gameId, pending.read("$.pendingEvent.eventId"), GameClient.firstOpen(pending));
    client.quitRaw(gameId).andExpect(status().isOk());
    return gameId;
  }

  private ResultActions share(GameClient client, String gameId) throws Exception {
    return mvc.perform(post("/api/games/{gameId}/share", gameId).cookie(client.session()));
  }

  @Test
  void 끝난_판을_공유하면_추측할_수_없는_ID로_누구나_카드를_본다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    String gameId = endedGame(client);

    String body =
        share(client, gameId)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.card.name").value("버핏"))
            .andExpect(jsonPath("$.card.finalAge").value(15))
            .andExpect(jsonPath("$.card.ending").value("QUIT"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String shareId = JsonPath.read(body, "$.shareId");
    assertThat(shareId).hasSize(12).matches("[2-9a-zA-Z]+");

    // 다시 눌러도 같은 링크다.
    share(client, gameId).andExpect(jsonPath("$.shareId").value(shareId));

    // 세션 없이 본다. 판 ID·세션·IP는 없다.
    mvc.perform(get("/api/shares/{id}", shareId))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("버핏"))
        .andExpect(jsonPath("$.gameId").doesNotExist())
        .andExpect(jsonPath("$.sessionId").doesNotExist())
        .andExpect(jsonPath("$.ip").doesNotExist());

    // 링크 미리보기용 HTML은 Open Graph 메타를 담고 화면의 공유 페이지로 넘긴다.
    String html =
        mvc.perform(get("/r/{id}", shareId).header("Host", "example.com"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
    assertThat(html)
        .contains("og:title", "버핏의 인생", "og:image", "/og-card.png", "/share/" + shareId);
  }

  @Test
  void 없는_공유_ID나_남의_판이나_진행_중인_판은_404다() throws Exception {
    mvc.perform(get("/api/shares/{id}", "zzzzzzzzzzzz")).andExpect(status().isNotFound());
    mvc.perform(get("/api/shares/{id}", "<script>")).andExpect(status().isNotFound());
    mvc.perform(get("/r/{id}", "zzzzzzzzzzzz")).andExpect(status().isNotFound());

    GameClient owner = GameClient.newSession(mvc);
    String ended = endedGame(owner);
    share(GameClient.newSession(mvc), ended).andExpect(status().isNotFound());

    GameClient playing = GameClient.newSession(mvc);
    String active = playing.start().read("$.gameId");
    share(playing, active).andExpect(status().isNotFound());
  }

  @Test
  void 미리보기_문구는_이름_나이_자산과_유형을_담는다() {
    ShareCard card =
        new ShareCard(
            "버핏",
            null,
            70,
            Ending.NORMAL,
            0,
            1_234_000_000L,
            0,
            3,
            null,
            null,
            "x",
            "장기 소신형",
            "d",
            "반도체",
            "개발자",
            true,
            2,
            "OWN");
    assertThat(ShareController.previewTitle(card)).isEqualTo("버핏의 인생 — 70세까지, 최종 자산 12억 3,400만 원");
    assertThat(ShareController.previewDescription(card))
        .isEqualTo("'장기 소신형' 투자자 · 개발자 · 순위표 3위 · 나도 한 번 살아 보기");
    assertThat(ShareController.won(-5_000_000)).isEqualTo("-500만 원");
  }
}
