package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.util.Map;
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

  ResultActions tradeRaw(String gameId, String stockCode, String side, long quantity)
      throws Exception {
    return mvc.perform(
        post("/api/games/{gameId}/trades", gameId)
            .cookie(session)
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                "{\"stockCode\":\"%s\",\"side\":\"%s\",\"quantity\":%d}"
                    .formatted(stockCode, side, quantity)));
  }

  DocumentContext trade(String gameId, String stockCode, String side, long quantity)
      throws Exception {
    MvcResult result = tradeRaw(gameId, stockCode, side, quantity).andReturn();
    assertThat(result.getResponse().getStatus())
        .as("trade %s %s: %s", side, stockCode, result.getResponse().getContentAsString())
        .isEqualTo(200);
    return json(result);
  }

  ResultActions historyRaw(String gameId, String stockCode) throws Exception {
    return mvc.perform(
        get("/api/games/{gameId}/stocks/{stockCode}/history", gameId, stockCode).cookie(session));
  }

  DocumentContext history(String gameId, String stockCode) throws Exception {
    MvcResult result = historyRaw(gameId, stockCode).andReturn();
    assertThat(result.getResponse().getStatus()).isEqualTo(200);
    return json(result);
  }

  /** 직업을 고르고 투자 시작 제안을 수락한 뒤, 대기 중인 이벤트가 없는 투자 단계의 판을 돌려준다. */
  DocumentContext startInvesting() throws Exception {
    DocumentContext game = chooseFirstJob(startUntilJob());
    Object started = game.read("$.game");
    game = JsonPath.parse(started);
    String gameId = game.read("$.gameId");
    for (int step = 0; step < 100; step++) {
      Map<String, Object> pending = game.read("$.pendingEvent");
      if (pending != null) {
        String kind = (String) pending.get("kind");
        String option =
            "OFFER".equals(kind) ? "accept" : game.read("$.pendingEvent.options[0].code");
        Object next = choose(gameId, (String) pending.get("eventId"), option).read("$.game");
        game = JsonPath.parse(next);
        if ("OFFER".equals(kind) && "INVESTING".equals(game.read("$.phase"))) {
          return game;
        }
        continue;
      }
      int day = game.read("$.day", Integer.class);
      Integer next = game.read("$.nextEventDay");
      game =
          advance(gameId, Math.min(day + MAX_STEP_DAYS, next == null ? day + MAX_STEP_DAYS : next));
    }
    throw new AssertionError("투자 시작 제안이 오지 않았다");
  }

  DocumentContext choose(String gameId, String eventId, String option) throws Exception {
    MvcResult result = chooseRaw(gameId, eventId, option).andReturn();
    assertThat(result.getResponse().getStatus())
        .as("choose %s: %s", option, result.getResponse().getContentAsString())
        .isEqualTo(200);
    return json(result);
  }

  /**
   * 성장기의 성향 이벤트에 첫 번째 선택지로 답하며 직업 선택이 올 때까지 진행한다. 직업 선택이 대기 중인 판을 돌려준다. 클라이언트처럼 다음 이벤트 시각까지만 시간을
   * 보낸다.
   */
  DocumentContext startUntilJob() throws Exception {
    DocumentContext game = start();
    String gameId = game.read("$.gameId");
    for (int step = 0; step < 200; step++) {
      Map<String, Object> pending = game.read("$.pendingEvent");
      String kind = pending == null ? null : (String) pending.get("kind");
      if ("JOB".equals(kind)) {
        return game;
      }
      if (kind != null) {
        Object next =
            choose(
                    gameId,
                    game.read("$.pendingEvent.eventId"),
                    game.read("$.pendingEvent.options[0].code"))
                .read("$.game");
        game = JsonPath.parse(next);
        continue;
      }
      int day = game.read("$.day", Integer.class);
      game =
          advance(
              gameId, Math.min(day + MAX_STEP_DAYS, game.read("$.nextEventDay", Integer.class)));
    }
    throw new AssertionError("직업 선택이 오지 않았다");
  }

  /** 서버의 한 번에 건너뛸 수 있는 상한(360일) 안에서 진행한다. */
  static final int MAX_STEP_DAYS = 360;

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
