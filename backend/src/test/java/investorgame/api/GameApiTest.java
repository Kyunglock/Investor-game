package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

  /** 매매창 설계 2·4절: 시황과 종목 분석은 사실과 해석을 주고, 같은 달에는 다시 불러도 해석이 같다. 확률·정답은 내려가지 않는다. */
  @Test
  void 시황과_종목_분석은_같은_달에_같고_숨은_값이_없다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.startInvesting();
    String gameId = game.read("$.gameId");

    DocumentContext overview =
        GameClient.json(
            mvc.perform(get("/api/games/{gameId}/market/overview", gameId).cookie(client.session()))
                .andExpect(status().isOk())
                .andReturn());
    List<Object> codes = overview.read("$.indicators[*].code");
    assertThat(codes)
        .containsExactly(
            "index", "rate", "seoul", "gyeonggi", "cpi", "fx", "debt", "sentiment", "turnover");
    assertThat(overview.read("$.indicators[0].value", Integer.class)).isPositive();
    assertThat(overview.read("$.indicators[0].points.length()", Integer.class)).isBetween(1, 60);
    assertThat(overview.read("$.analysis.reading", String.class)).isIn("HOT", "STABLE", "COLD");
    assertThat(overview.read("$.analysis.text", String.class)).isNotBlank().doesNotContain("{");
    assertThat(overview.read("$.analysis.insight", Integer.class)).isBetween(10, 100);
    assertThat(overview.read("$.analysis.remark", Object.class)).as("첫 해석에는 한마디가 없다").isNull();
    assertThat(overview.jsonString()).doesNotContain("truth").doesNotContain("Bp\":4750");

    DocumentContext again =
        GameClient.json(
            mvc.perform(get("/api/games/{gameId}/market/overview", gameId).cookie(client.session()))
                .andReturn());
    assertThat(again.read("$.analysis", Object.class))
        .isEqualTo(overview.read("$.analysis", Object.class));

    DocumentContext analysis =
        GameClient.json(
            mvc.perform(
                    get("/api/games/{gameId}/stocks/{stockCode}/analysis", gameId, "ssj")
                        .cookie(client.session()))
                .andExpect(status().isOk())
                .andReturn());
    assertThat(analysis.read("$.stockCode", String.class)).isEqualTo("ssj");
    assertThat(analysis.read("$.facts.ma12", Long.class)).isPositive();
    assertThat(analysis.read("$.facts.high12", Long.class))
        .isGreaterThanOrEqualTo(analysis.read("$.facts.low12", Long.class));
    assertThat(analysis.read("$.analysis.reading", String.class)).isIn("UP", "DOWN", "FLAT");
    assertThat(analysis.read("$.analysis.text", String.class)).isNotBlank().doesNotContain("{");
    mvc.perform(
            get("/api/games/{gameId}/stocks/{stockCode}/analysis", gameId, "nope")
                .cookie(client.session()))
        .andExpect(status().isNotFound());

    // 한 달 뒤 다시 보면 지난 해석이 드러나며 한마디가 붙는다 (매매창 설계 4.5절).
    int day = game.read("$.day", Integer.class);
    Integer next = game.read("$.nextEventDay");
    int target = Math.min(day + 30, next == null ? day + 30 : next);
    if (target > day) {
      client.advance(gameId, target);
      DocumentContext later =
          GameClient.json(
              mvc.perform(
                      get("/api/games/{gameId}/stocks/{stockCode}/analysis", gameId, "ssj")
                          .cookie(client.session()))
                  .andReturn());
      if (later.read("$.analysis.month", Integer.class)
          > analysis.read("$.analysis.month", Integer.class)) {
        assertThat(later.read("$.analysis.remark.text", String.class)).isNotBlank();
        assertThat(later.read("$.analysis.remark.correct", Boolean.class)).isNotNull();
      }
    }
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
    // 직업 3개 + (더 나은 직업이 남아 있으면) "기다린다" + "전업투자자" (decisions.md 26번, 35번)
    assertThat(job.read("$.pendingEvent.options.length()", Integer.class)).isBetween(4, 5);
    assertThat(job.read("$.pendingEvent.options[-1].code", String.class)).isEqualTo("INVEST");
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
    // 독립하면서 월세를 골랐다(GameClient.chooseFirstJob). 주거비는 생활비와 따로 나간다 (주거 설계 2절).
    long rent = payday.read("$.housing.monthlyCost", Long.class);
    assertThat(rent).isPositive();
    assertThat(expense + rent).isPositive().isLessThan(salary);
    assertThat(payday.read("$.cash", Long.class)).isEqualTo(cash + salary - expense - rent);
    assertThat(client.advance(gameId, jobDay + 30).read("$.cash", Long.class))
        .as("같은 날을 다시 보고해도 월급과 생활비는 한 번만")
        .isEqualTo(cash + salary - expense - rent);
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
        .chooseRaw(gameId, eventId, GameClient.firstOpen(game))
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
