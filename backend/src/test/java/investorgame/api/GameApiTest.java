package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.DocumentContext;
import investorgame.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
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
  void 열다섯_살에_시작해_첫_성향_이벤트는_반년_뒤에_온다() throws Exception {
    GameClient client = GameClient.newSession(mvc);

    client
        .startRaw()
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("ACTIVE"))
        .andExpect(jsonPath("$.phase").value("CHILDHOOD"))
        .andExpect(jsonPath("$.day").value(0))
        .andExpect(jsonPath("$.startAge").value(15))
        .andExpect(jsonPath("$.endAge").value(70))
        .andExpect(jsonPath("$.stats.insight").isNumber())
        .andExpect(jsonPath("$.initialStats.insight").isNumber())
        .andExpect(jsonPath("$.cash").isNumber())
        .andExpect(jsonPath("$.job").doesNotExist())
        .andExpect(jsonPath("$.pendingEvent").doesNotExist())
        .andExpect(jsonPath("$.nextEventDay").value(180))
        .andExpect(jsonPath("$.seed").doesNotExist());
  }

  @Test
  void 성향_장면은_판마다_랜덤이고_같은_판은_다시_불러도_같다() throws Exception {
    Set<String> firstScenes = new HashSet<>();
    for (int i = 0; i < 15; i++) {
      GameClient client = GameClient.newSession(mvc);
      DocumentContext game = client.start();
      String gameId = game.read("$.gameId");
      int eventDay = game.read("$.nextEventDay", Integer.class);
      for (int day = 360; day < eventDay; day += 360) {
        client.advance(gameId, day);
      }
      String title = client.advance(gameId, eventDay).read("$.pendingEvent.title");
      assertThat(client.current().read("$.pendingEvent.title", String.class))
          .as("재접속해도 같은 장면")
          .isEqualTo(title);
      firstScenes.add(title);
    }
    assertThat(firstScenes).as("15판이면 첫 장면이 여러 가지로 나온다").hasSizeGreaterThan(1);
  }

  @Test
  void 수량_0인_매매와_알_수_없는_종목은_거절된다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.startInvesting();
    String gameId = game.read("$.gameId");

    client.tradeRaw(gameId, "ssj", "BUY", 0).andExpect(status().isBadRequest());
    client.tradeRaw(gameId, "ssj", "BUY", 1_000_000_001L).andExpect(status().isBadRequest());
    client.tradeRaw(gameId, "nope", "BUY", 1).andExpect(status().isNotFound());
    client.historyRaw(gameId, "nope").andExpect(status().isNotFound());
  }

  @Test
  void 투자_시작_전에는_매매할_수_없다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    String gameId = client.start().read("$.gameId");
    client.tradeRaw(gameId, "ssj", "BUY", 1).andExpect(status().isBadRequest());
  }

  @Test
  void 세션_없는_매매는_401이다() throws Exception {
    mvc.perform(
            post("/api/games/{gameId}/trades", java.util.UUID.randomUUID())
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"stockCode\":\"ssj\",\"side\":\"BUY\",\"quantity\":1}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 성향이_모두_정해진_뒤에_스물다섯_살에_직업_선택이_온다() throws Exception {
    DocumentContext job = GameClient.newSession(mvc).startUntilJob();

    assertThat(job.read("$.day", Integer.class)).isEqualTo((25 - 15) * 360);
    assertThat(job.read("$.phase", String.class)).isEqualTo("CHILDHOOD");
    assertThat(job.read("$.investmentStyle.code", String.class)).isIn("short", "long");
    assertThat(job.read("$.interestSector.code", String.class)).isNotBlank();
    // 직업 3개 + (더 나은 직업이 남아 있으면) "기다린다" (decisions.md 26번)
    assertThat(job.read("$.pendingEvent.options.length()", Integer.class)).isBetween(3, 4);
  }

  @Test
  void 능력치는_10에서_100_사이이고_초기_현금은_100만원_단위다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    for (int i = 0; i < 20; i++) {
      DocumentContext game = client.start();
      for (String stat : List.of("insight", "patience", "courage", "conviction", "luck")) {
        assertThat(game.read("$.stats." + stat, Integer.class)).isBetween(10, 100);
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
    DocumentContext game = client.start();
    String gameId = game.read("$.gameId");
    int eventDay = game.read("$.nextEventDay", Integer.class);
    // 한 번에 360일까지만 갈 수 있으므로 이벤트 하루 전까지 나눠서 간다.
    for (int day = 360; day < eventDay - 1; day += 360) {
      client.advance(gameId, day);
    }
    client.advance(gameId, eventDay - 1);

    client.advanceRaw(gameId, eventDay + 10).andExpect(status().isOk());
    assertThat(client.current().read("$.day", Integer.class))
        .as("이벤트가 생긴 날에서 판이 멈춘다")
        .isEqualTo(eventDay);
    client
        .advanceRaw(gameId, eventDay + 11)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  void 직업을_고르면_한_달마다_월급이_들어온다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    DocumentContext chosen = client.chooseFirstJob(client.startUntilJob());
    String gameId = chosen.read("$.game.gameId");
    int jobDay = chosen.read("$.game.day", Integer.class);
    long cash = chosen.read("$.game.cash", Long.class);
    long salary = chosen.read("$.game.job.monthlySalary", Long.class);
    assertThat(chosen.read("$.outcome.message", String.class)).contains("일하기 시작했다");
    assertThat(chosen.read("$.game.phase", String.class)).isEqualTo("SAVING");

    // 첫 월급은 직업을 정한 날부터 30일 뒤다. 같은 날 생활비가 나가므로 번 돈이 전부 자산이 되지는 않는다 (경제 개편 설계 7절).
    assertThat(client.advance(gameId, jobDay + 29).read("$.cash", Long.class)).isEqualTo(cash);
    DocumentContext payday = client.advance(gameId, jobDay + 30);
    long expense = payday.read("$.household.monthlyExpense", Long.class);
    assertThat(expense).isPositive().isLessThan(salary);
    assertThat(payday.read("$.cash", Long.class)).isEqualTo(cash + salary - expense);
    assertThat(client.advance(gameId, jobDay + 30).read("$.cash", Long.class))
        .as("같은 날을 다시 보고해도 월급과 생활비는 한 번만")
        .isEqualTo(cash + salary - expense);
  }

  @Test
  void 시각은_거꾸로_갈_수_없다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    DocumentContext chosen = client.chooseFirstJob(client.startUntilJob());
    String gameId = chosen.read("$.game.gameId");
    int jobDay = chosen.read("$.game.day", Integer.class);
    client.advance(gameId, jobDay + 10);

    client
        .advanceRaw(gameId, jobDay + 9)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  void 한_번에_건너뛸_수_있는_구간을_넘으면_거부한다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    String gameId = client.start().read("$.gameId");

    client.advanceRaw(gameId, 361).andExpect(status().isBadRequest());
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
