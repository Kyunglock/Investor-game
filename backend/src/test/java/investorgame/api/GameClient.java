package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.util.List;
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

  /** 관리자 토큰으로 봇 세션을 받는다 (행동 프로필·봇 설계 4절). */
  static GameClient newBotSession(MockMvc mvc, String adminToken, String persona) throws Exception {
    Cookie cookie =
        mvc.perform(
                post("/api/admin/bot-sessions")
                    .header(AdminController.TOKEN_HEADER, adminToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"persona\":\"" + persona + "\"}"))
            .andReturn()
            .getResponse()
            .getCookie(SessionCookies.NAME);
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

  ResultActions quitRaw(String gameId) throws Exception {
    return mvc.perform(post("/api/games/{gameId}/quit", gameId).cookie(session));
  }

  ResultActions chooseRaw(String gameId, String eventId, String option) throws Exception {
    return chooseBody(gameId, eventId, "{\"option\":\"" + option + "\"}");
  }

  /** 뉴스에 수량을 같이 보낸다. */
  ResultActions chooseRaw(String gameId, String eventId, String option, long quantity)
      throws Exception {
    return chooseBody(
        gameId, eventId, "{\"option\":\"%s\",\"quantity\":%d}".formatted(option, quantity));
  }

  private ResultActions chooseBody(String gameId, String eventId, String body) throws Exception {
    return mvc.perform(
        post("/api/games/{gameId}/events/{eventId}/choose", gameId, eventId)
            .cookie(session)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  /** 투자 단계의 판을 다음 뉴스가 대기 중일 때까지 진행한다. 그 사이의 다른 선택은 첫 번째 선택지로 답한다. */
  DocumentContext untilNews(DocumentContext game) throws Exception {
    String gameId = game.read("$.gameId");
    for (int step = 0; step < 100; step++) {
      Map<String, Object> pending = game.read("$.pendingEvent");
      if (pending != null) {
        if ("NEWS".equals(pending.get("kind"))) {
          return game;
        }
        Object next =
            choose(gameId, (String) pending.get("eventId"), GameClient.firstOpen(game))
                .read("$.game");
        game = JsonPath.parse(next);
        continue;
      }
      int day = game.read("$.day", Integer.class);
      Integer next = game.read("$.nextEventDay");
      game =
          advance(gameId, Math.min(day + MAX_STEP_DAYS, next == null ? day + MAX_STEP_DAYS : next));
    }
    throw new AssertionError("뉴스가 오지 않았다");
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
        String option = "OFFER".equals(kind) ? "accept" : GameClient.firstOpen(game);
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
            choose(gameId, game.read("$.pendingEvent.eventId"), GameClient.firstOpen(game))
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
  /**
   * 첫 직업을 고르고, 바로 이어지는 독립(주거 move-out)은 월세로 정한다. 돌려주는 문서의 outcome은 직업 선택의 결과, game은 월세까지 정한 뒤의 판이다.
   */
  DocumentContext chooseFirstJob(DocumentContext game) throws Exception {
    assertThat(game.read("$.pendingEvent.kind", String.class)).isEqualTo("JOB");
    DocumentContext chosen =
        choose(
            game.read("$.gameId"), game.read("$.pendingEvent.eventId"), GameClient.firstOpen(game));
    Object afterJob = chosen.read("$.game");
    DocumentContext after = JsonPath.parse(afterJob);
    if ("HOUSING".equals(after.read("$.pendingEvent.kind"))) {
      DocumentContext moved =
          choose(after.read("$.gameId"), after.read("$.pendingEvent.eventId"), "MONTHLY");
      chosen.set("$.game", moved.read("$.game"));
    }
    return chosen;
  }

  static DocumentContext json(MvcResult result) throws Exception {
    return JsonPath.parse(result.getResponse().getContentAsString());
  }

  /** 고를 수 있는 첫 선택지. 주거 선택지는 돈이 모자라면 막혀 있다(blocked). 주거 이벤트는 안전한 쪽을 먼저 고른다. */
  static String firstOpen(DocumentContext game) {
    List<String> open = game.read("$.pendingEvent.options[?(@.blocked == null)].code");
    if ("HOUSING".equals(game.read("$.pendingEvent.kind"))) {
      // 자동 플레이어는 보증보험 없는 빌라 전세(전세사기로 보증금을 잃을 수 있다)나 큰 빚보다 머물기·월세·미루기를 먼저 고른다.
      // 그래야 판 시드에 따라 파산해 70세 흐름 검사가 깨지는 일이 줄어든다.
      for (String safe : SAFE_HOUSING) {
        if (open.contains(safe)) {
          return safe;
        }
      }
    }
    return open.getFirst();
  }

  private static final List<String> SAFE_HOUSING =
      List.of("KEEP", "MONTHLY", "WAIT", "PASS", "ENDURE", "VILLA_INSURED", "APT_JEONSE");
}
