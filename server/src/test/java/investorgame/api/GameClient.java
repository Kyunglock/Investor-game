package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

/** 테스트에서 실제 API를 부르는 작은 클라이언트. 세션 쿠키를 들고 다닌다. */
final class GameClient {

  private final MockMvc mvc;
  private final Cookie session;

  private GameClient(MockMvc mvc, Cookie session) {
    this.mvc = mvc;
    this.session = session;
  }

  static GameClient newSession(MockMvc mvc) throws Exception {
    Cookie cookie =
        mvc.perform(post("/api/sessions")).andReturn().getResponse().getCookie(SessionCookies.NAME);
    assertThat(cookie).isNotNull();
    return new GameClient(mvc, new Cookie(cookie.getName(), cookie.getValue()));
  }

  Cookie session() {
    return session;
  }

  ResultActions startRaw() throws Exception {
    return mvc.perform(post("/api/games").cookie(session));
  }

  DocumentContext start() throws Exception {
    return json(startRaw().andReturn());
  }

  ResultActions currentRaw() throws Exception {
    return mvc.perform(get("/api/games/current").cookie(session));
  }

  DocumentContext current() throws Exception {
    return json(currentRaw().andReturn());
  }

  ResultActions advanceRaw(String gameId, int day) throws Exception {
    return mvc.perform(
        post("/api/games/{gameId}/advance", gameId)
            .cookie(session)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"day\":" + day + "}"));
  }

  DocumentContext advance(String gameId, int day) throws Exception {
    MvcResult result = advanceRaw(gameId, day).andReturn();
    assertThat(result.getResponse().getStatus())
        .as("advance %d: %s", day, result.getResponse().getContentAsString())
        .isEqualTo(200);
    return json(result);
  }

  ResultActions chooseRaw(String gameId, String eventId, String option) throws Exception {
    return mvc.perform(
        post("/api/games/{gameId}/events/{eventId}/choose", gameId, eventId)
            .cookie(session)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"option\":\"" + option + "\"}"));
  }

  DocumentContext choose(String gameId, String eventId, String option) throws Exception {
    MvcResult result = chooseRaw(gameId, eventId, option).andReturn();
    assertThat(result.getResponse().getStatus())
        .as("choose %s: %s", option, result.getResponse().getContentAsString())
        .isEqualTo(200);
    return json(result);
  }

  /** 직업 선택은 구직 기간(설정 event.job.day = 60일) 뒤에 뜬다. 거기까지 시간을 보내고 직업 선택이 대기 중인 판을 돌려준다. */
  DocumentContext startUntilJob() throws Exception {
    DocumentContext game = start();
    int jobDay = game.read("$.nextEventDay", Integer.class);
    return advance(game.read("$.gameId"), jobDay);
  }

  /** 대기 중인 직업 선택에서 첫 번째 직업을 고른다. */
  DocumentContext chooseFirstJob(DocumentContext game) throws Exception {
    assertThat(game.read("$.pendingEvent.kind", String.class)).isEqualTo("JOB");
    return choose(
        game.read("$.gameId"),
        game.read("$.pendingEvent.eventId"),
        game.read("$.pendingEvent.options[0].code"));
  }

  static DocumentContext json(MvcResult result) throws Exception {
    return JsonPath.parse(result.getResponse().getContentAsString());
  }
}
