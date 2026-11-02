package investorgame.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.DocumentContext;
import investorgame.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** 최종 자산 순위표 (decisions.md 141번). */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class RankingApiTest {

  @Autowired WebApplicationContext context;

  MockMvc mvc;

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
  }

  /** 첫 성향 선택을 넘기고 그만둬 끝난 판을 만든다. 결과는 15세, QUIT. */
  private static String endedGame(GameClient client) throws Exception {
    DocumentContext game = client.start();
    String gameId = game.read("$.gameId");
    client.advance(gameId, game.read("$.nextEventDay", Integer.class));
    DocumentContext pending = client.current();
    client.choose(gameId, pending.read("$.pendingEvent.eventId"), GameClient.firstOpen(pending));
    client.quitRaw(gameId).andExpect(status().isOk());
    return gameId;
  }

  private ResultActions enter(GameClient client, String gameId, String name) throws Exception {
    return mvc.perform(
        post("/api/games/{gameId}/ranking", gameId)
            .cookie(client.session())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"" + name + "\"}"));
  }

  @Test
  void 끝난_판을_이름과_함께_올리면_순위표에_보이고_내_순위가_실린다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    String gameId = endedGame(client);

    enter(client, gameId, "워런")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ENDED"))
        .andExpect(jsonPath("$.result.rank").isNumber());

    mvc.perform(get("/api/ranking"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").isNumber())
        .andExpect(jsonPath("$.entries[?(@.name == '워런')].finalAge").value(15))
        .andExpect(jsonPath("$.entries[?(@.name == '워런')].ending").value("QUIT"))
        .andExpect(jsonPath("$.entries[?(@.name == '워런')].gameId").doesNotExist())
        .andExpect(jsonPath("$.entries[?(@.name == '워런')].sessionId").doesNotExist());

    // 다시 불러도 순위가 남아 있다.
    client.currentRaw().andExpect(jsonPath("$.result.rank").isNumber());
  }

  @Test
  void 같은_판은_한_번만_올릴_수_있다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    String gameId = endedGame(client);

    enter(client, gameId, "첫째").andExpect(status().isOk());
    enter(client, gameId, "둘째")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  void 진행_중인_판과_빈_이름은_거절한다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    String active = client.start().read("$.gameId");
    enter(client, active, "성급한").andExpect(status().isNotFound());

    String gameId = endedGame(client);
    enter(client, gameId, "   ").andExpect(status().isBadRequest());
    enter(client, gameId, "아홉글자나되는이름").andExpect(status().isBadRequest());
    client.currentRaw().andExpect(jsonPath("$.result.rank").value((Object) null));
  }

  @Test
  void 순위표는_세션_없이도_본다() throws Exception {
    mvc.perform(get("/api/ranking"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.entries").isArray());
  }
}
