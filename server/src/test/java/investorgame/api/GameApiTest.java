package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.DocumentContext;
import investorgame.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** API의 계약과 경계 조건. 한 판 전체의 흐름은 GameFlowTest에서 본다. */
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
  void 판을_시작하면_능력치와_현금이_생기고_구직_기간_뒤에_직업_선택이_온다() throws Exception {
    GameClient client = GameClient.newSession(mvc);

    client
        .startRaw()
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("ACTIVE"))
        .andExpect(jsonPath("$.phase").value("SAVING"))
        .andExpect(jsonPath("$.day").value(0))
        .andExpect(jsonPath("$.startAge").value(25))
        .andExpect(jsonPath("$.endAge").value(65))
        .andExpect(jsonPath("$.stats.insight").isNumber())
        .andExpect(jsonPath("$.initialStats.insight").isNumber())
        .andExpect(jsonPath("$.cash").isNumber())
        .andExpect(jsonPath("$.job").doesNotExist())
        .andExpect(jsonPath("$.pendingEvent").doesNotExist())
        .andExpect(jsonPath("$.nextEventDay").value(60))
        .andExpect(jsonPath("$.seed").doesNotExist());

    DocumentContext job = client.startUntilJob();
    assertThat(job.read("$.pendingEvent.kind", String.class)).isEqualTo("JOB");
    assertThat(job.read("$.pendingEvent.options.length()", Integer.class)).isEqualTo(3);
  }

  @Test
  void 능력치는_15에서_85_사이이고_초기_현금은_100만원_단위다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    for (int i = 0; i < 20; i++) {
      DocumentContext game = client.start();
      for (String stat : List.of("insight", "patience", "courage", "conviction", "luck")) {
        assertThat(game.read("$.stats." + stat, Integer.class)).isBetween(15, 85);
      }
      long cash = game.read("$.cash", Long.class);
      assertThat(cash).isBetween(1_000_000L, 50_000_000L);
      assertThat(cash % 1_000_000L).isZero();
    }
  }

  @Test
  void 같은_세션으로_다시_조회하면_진행_중인_판을_이어한다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    String gameId = client.start().read("$.gameId");

    client.currentRaw().andExpect(status().isOk()).andExpect(jsonPath("$.gameId").value(gameId));
  }

  @Test
  void 진행_중인_판이_없으면_404() throws Exception {
    GameClient.newSession(mvc).currentRaw().andExpect(status().isNotFound());
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
    Cookie session = GameClient.newSession(mvc).session();
    String setCookie =
        mvc.perform(post("/api/sessions").cookie(session))
            .andExpect(status().isNoContent())
            .andReturn()
            .getResponse()
            .getHeader("Set-Cookie");
    assertThat(setCookie).isNull();
  }

  @Test
  void 다음_이벤트_시각을_넘어서_시간을_보낼_수_없다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    String gameId = client.start().read("$.gameId");

    client.advanceRaw(gameId, 70).andExpect(status().isOk());
    assertThat(client.current().read("$.day", Integer.class))
        .as("이벤트가 생긴 60일째에서 판이 멈춘다")
        .isEqualTo(60);
    client
        .advanceRaw(gameId, 71)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  void 직업을_고르면_한_달마다_월급이_들어온다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    DocumentContext chosen = client.chooseFirstJob(client.startUntilJob());
    String gameId = chosen.read("$.game.gameId");
    long cash = chosen.read("$.game.cash", Long.class);
    long salary = chosen.read("$.game.job.monthlySalary", Long.class);
    assertThat(chosen.read("$.outcome.message", String.class)).contains("일하기 시작했다");

    // 직업은 60일째에 정해졌으므로 첫 월급은 90일째다.
    assertThat(client.advance(gameId, 89).read("$.cash", Long.class)).isEqualTo(cash);
    assertThat(client.advance(gameId, 90).read("$.cash", Long.class)).isEqualTo(cash + salary);
    assertThat(client.advance(gameId, 90).read("$.cash", Long.class))
        .as("같은 날을 다시 보고해도 월급은 한 번만")
        .isEqualTo(cash + salary);
    assertThat(client.advance(gameId, 119).read("$.cash", Long.class)).isEqualTo(cash + salary);
  }

  @Test
  void 시각은_거꾸로_갈_수_없다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    String gameId = client.chooseFirstJob(client.startUntilJob()).read("$.game.gameId");
    client.advance(gameId, 100);

    client
        .advanceRaw(gameId, 99)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  void 한_번에_건너뛸_수_있는_구간을_넘으면_거부한다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    String gameId = client.chooseFirstJob(client.startUntilJob()).read("$.game.gameId");

    client.advanceRaw(gameId, 60 + 361).andExpect(status().isBadRequest());
  }

  @Test
  void 음수_시각은_거부한다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    String gameId = client.start().read("$.gameId");

    client.advanceRaw(gameId, -1).andExpect(status().isBadRequest());
  }

  @Test
  void 다른_세션의_판은_진행할_수_없다() throws Exception {
    String gameId = GameClient.newSession(mvc).start().read("$.gameId");

    GameClient.newSession(mvc).advanceRaw(gameId, 0).andExpect(status().isNotFound());
  }

  @Test
  void 없는_선택지와_이미_해결된_이벤트는_거부한다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.startUntilJob();
    String gameId = game.read("$.gameId");
    String eventId = game.read("$.pendingEvent.eventId");

    client.chooseRaw(gameId, eventId, "astronaut").andExpect(status().isBadRequest());
    client.chooseFirstJob(game);
    client
        .chooseRaw(gameId, eventId, game.read("$.pendingEvent.options[0].code"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void 다시_시작하면_새_판이_생기고_이전_판은_진행할_수_없다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    String first = client.start().read("$.gameId");
    String second = client.start().read("$.gameId");

    assertThat(second).isNotEqualTo(first);
    assertThat(client.current().read("$.gameId", String.class)).isEqualTo(second);
    client.advanceRaw(first, 0).andExpect(status().isNotFound());
  }
}
