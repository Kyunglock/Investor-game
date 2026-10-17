package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import investorgame.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
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

/** 워킹 스켈레톤의 흐름: 세션 발급 → 판 시작 → 이어하기 → 시각 보고 → 다시 시작하기. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class GameApiTest {

  @Autowired WebApplicationContext context;

  MockMvc mvc;

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
  }

  @Test
  void 세션을_받아_판을_시작하면_능력치와_초기_자산이_생긴다() throws Exception {
    Cookie session = newSession();

    mvc.perform(post("/api/games").cookie(session))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.phase").value("SAVING"))
        .andExpect(jsonPath("$.lastReportedDay").value(0))
        .andExpect(jsonPath("$.startAge").value(25))
        .andExpect(jsonPath("$.endAge").value(65))
        .andExpect(jsonPath("$.daysPerYear").value(360))
        .andExpect(jsonPath("$.stats.insight").isNumber())
        .andExpect(jsonPath("$.stats.luck").isNumber())
        .andExpect(jsonPath("$.cash").isNumber())
        .andExpect(jsonPath("$.seed").doesNotExist());
  }

  @Test
  void 능력치는_15에서_85_사이이고_초기_현금은_100만원_단위다() throws Exception {
    Cookie session = newSession();
    for (int i = 0; i < 20; i++) {
      String body =
          mvc.perform(post("/api/games").cookie(session))
              .andReturn()
              .getResponse()
              .getContentAsString();
      for (String stat : new String[] {"insight", "patience", "courage", "conviction", "luck"}) {
        int value = JsonPath.read(body, "$.stats." + stat);
        assertThat(value).isBetween(15, 85);
      }
      long cash = ((Number) JsonPath.read(body, "$.cash")).longValue();
      assertThat(cash).isBetween(1_000_000L, 50_000_000L);
      assertThat(cash % 1_000_000L).isZero();
    }
  }

  @Test
  void 같은_세션으로_다시_조회하면_진행_중인_판을_이어한다() throws Exception {
    Cookie session = newSession();
    String gameId = startGame(session);

    mvc.perform(get("/api/games/current").cookie(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.gameId").value(gameId));
  }

  @Test
  void 진행_중인_판이_없으면_404() throws Exception {
    mvc.perform(get("/api/games/current").cookie(newSession())).andExpect(status().isNotFound());
  }

  @Test
  void 세션이_없으면_401() throws Exception {
    mvc.perform(post("/api/games"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("SESSION_REQUIRED"));
    mvc.perform(post("/api/games").cookie(new Cookie(SessionCookies.NAME, "가짜토큰")))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 세션_쿠키는_HttpOnly이고_SameSite가_Lax다() throws Exception {
    String setCookie =
        mvc.perform(post("/api/sessions")).andReturn().getResponse().getHeader("Set-Cookie");
    assertThat(setCookie).contains("HttpOnly").contains("SameSite=Lax").contains("Secure");
  }

  @Test
  void 유효한_세션이_있으면_새로_발급하지_않는다() throws Exception {
    Cookie session = newSession();
    String setCookie =
        mvc.perform(post("/api/sessions").cookie(session))
            .andExpect(status().isNoContent())
            .andReturn()
            .getResponse()
            .getHeader("Set-Cookie");
    assertThat(setCookie).isNull();
  }

  @Test
  void 시각을_보고하면_판이_그_시각으로_진행된다() throws Exception {
    Cookie session = newSession();
    String gameId = startGame(session);

    advance(session, gameId, 100)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lastReportedDay").value(100));
    mvc.perform(get("/api/games/current").cookie(session))
        .andExpect(jsonPath("$.lastReportedDay").value(100));
  }

  @Test
  void 시각은_거꾸로_갈_수_없다() throws Exception {
    Cookie session = newSession();
    String gameId = startGame(session);
    advance(session, gameId, 100);

    advance(session, gameId, 99)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  void 한_번에_건너뛸_수_있는_구간을_넘으면_거부한다() throws Exception {
    Cookie session = newSession();
    String gameId = startGame(session);

    advance(session, gameId, 360).andExpect(status().isOk());
    advance(session, gameId, 721).andExpect(status().isBadRequest());
  }

  @Test
  void 음수_시각은_거부한다() throws Exception {
    Cookie session = newSession();
    String gameId = startGame(session);

    advance(session, gameId, -1).andExpect(status().isBadRequest());
  }

  @Test
  void 다른_세션의_판은_진행할_수_없다() throws Exception {
    String gameId = startGame(newSession());

    advance(newSession(), gameId, 10).andExpect(status().isNotFound());
  }

  @Test
  void 다시_시작하면_새_판이_생기고_이전_판은_진행할_수_없다() throws Exception {
    Cookie session = newSession();
    String first = startGame(session);
    String second = startGame(session);

    assertThat(second).isNotEqualTo(first);
    mvc.perform(get("/api/games/current").cookie(session))
        .andExpect(jsonPath("$.gameId").value(second));
    advance(session, first, 10).andExpect(status().isNotFound());
  }

  private Cookie newSession() throws Exception {
    Cookie cookie =
        mvc.perform(post("/api/sessions"))
            .andExpect(status().isNoContent())
            .andReturn()
            .getResponse()
            .getCookie(SessionCookies.NAME);
    assertThat(cookie).isNotNull();
    return new Cookie(cookie.getName(), cookie.getValue());
  }

  private String startGame(Cookie session) throws Exception {
    String body =
        mvc.perform(post("/api/games").cookie(session))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return JsonPath.read(body, "$.gameId");
  }

  private ResultActions advance(Cookie session, String gameId, int day) throws Exception {
    return mvc.perform(
        post("/api/games/{gameId}/advance", gameId)
            .cookie(session)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"day\":" + day + "}"));
  }
}
