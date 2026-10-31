package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import investorgame.TestcontainersConfiguration;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** 관리자 플레이 기록 (decisions.md 46번). */
@SpringBootTest(properties = "admin.token=test-admin-token")
@Import(TestcontainersConfiguration.class)
class AdminApiTest {

  private static final String TOKEN = "test-admin-token";
  private static final int MAX_SKIP_DAYS = 360;

  @Autowired WebApplicationContext context;
  @Autowired JdbcClient jdbc;

  MockMvc mvc;

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
  }

  @Test
  void 토큰이_없거나_틀리면_403() throws Exception {
    mvc.perform(get("/api/admin/plays"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("ADMIN_REQUIRED"));
    mvc.perform(get("/api/admin/plays").header(AdminController.TOKEN_HEADER, "wrong"))
        .andExpect(status().isForbidden());
  }

  @Test
  void 시작한_판과_그_세션이_기록에_보인다() throws Exception {
    GameClient client = GameClient.newSession(mvc);
    String gameId = client.start().read("$.gameId");

    mvc.perform(get("/api/admin/plays").header(AdminController.TOKEN_HEADER, "test-admin-token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.plays[?(@.gameId == '%s')].status", gameId).value("ACTIVE"))
        .andExpect(jsonPath("$.plays[?(@.gameId == '%s')].startAge", gameId).value(15))
        .andExpect(jsonPath("$.plays[?(@.gameId == '%s')].age", gameId).value(15))
        .andExpect(jsonPath("$.plays[?(@.gameId == '%s')].seed", gameId).doesNotExist())
        .andExpect(jsonPath("$.sessions[0].games").isNumber())
        .andExpect(jsonPath("$.sessions[?(@.firstIp == '127.0.0.1')]").isNotEmpty());
  }

  @Test
  void 봇_세션은_토큰과_올바른_페르소나가_있어야_발급된다() throws Exception {
    mvc.perform(
            post("/api/admin/bot-sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"persona\":\"panic\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/api/admin/bot-sessions")
                .header(AdminController.TOKEN_HEADER, TOKEN)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"persona\":\"Panic Seller!\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void 봇_세션으로_투자하다_끝낸_판은_페르소나가_붙은_익명_행동_프로필을_남긴다() throws Exception {
    String persona = "flow-" + Long.toHexString(UUID.randomUUID().getMostSignificantBits());
    GameClient client = GameClient.newBotSession(mvc, TOKEN, persona);
    DocumentContext game = client.start();
    String gameId = game.read("$.gameId");
    boolean boughtOnNews = false;
    for (int step = 0; step < 300 && !boughtOnNews; step++) {
      Map<String, Object> pending = game.read("$.pendingEvent");
      if (pending == null) {
        assertThat(game.read("$.status", String.class))
            .as("봇이 뉴스를 사기 전에 판이 끝나면(파산) 검사할 수 없다")
            .isEqualTo("ACTIVE");
        // 투자 뒤 뉴스 간격은 1년을 넘을 수 있어 한 번에 건너뛸 수 있는 만큼(progress.max-skip-days)씩 보낸다.
        int day = game.read("$.day", Integer.class);
        game =
            client.advance(
                gameId, Math.min(day + MAX_SKIP_DAYS, game.read("$.nextEventDay", Integer.class)));
        continue;
      }
      String kind = (String) pending.get("kind");
      // 전업투자자를 고르면 바로 투자를 시작해 뉴스가 빨리 온다.
      String option =
          switch (kind) {
            case "JOB" -> "INVEST";
            case "NEWS" -> "BUY";
            default -> GameClient.firstOpen(game);
          };
      game =
          JsonPath.parse(
              client
                  .choose(gameId, (String) pending.get("eventId"), option)
                  .<Object>read("$.game"));
      boughtOnNews = "NEWS".equals(kind);
    }
    assertThat(boughtOnNews).as("투자를 시작하면 뉴스가 온다").isTrue();
    // 뉴스 바로 뒤에 다른 선택이 기다릴 수 있다. 그만두기는 기다리는 선택이 없어야 한다.
    while (game.read("$.pendingEvent") != null) {
      String option =
          "NEWS".equals(game.read("$.pendingEvent.kind")) ? "BUY" : GameClient.firstOpen(game);
      game =
          JsonPath.parse(
              client
                  .choose(gameId, game.read("$.pendingEvent.eventId"), option)
                  .<Object>read("$.game"));
    }
    client.quitRaw(gameId).andExpect(status().isOk());

    Map<String, Object> profile =
        jdbc.sql(
                """
                SELECT ending, habits::text AS habits
                FROM result_profile WHERE bot_persona = :persona
                """)
            .param("persona", persona)
            .query()
            .singleRow();
    assertThat(profile).containsEntry("ending", "QUIT");
    String[] habits = ((String) profile.get("habits")).replaceAll("[\\[\\]]", "").split(",");
    assertThat(habits).hasSize(6);
    // 판정에 뒤집히거나 현금이 모자라 못 샀어도, 습관은 고른 행동으로 센다.
    assertThat(Double.parseDouble(habits[0])).as("뉴스마다 사기로 골랐다").isEqualTo(1.0);
  }

  @Test
  void 투자를_시작하기_전에_끝낸_판은_행동_프로필을_남기지_않는다() throws Exception {
    long before = jdbc.sql("SELECT COUNT(*) FROM result_profile").query(Long.class).single();
    GameClient client = GameClient.newSession(mvc);
    String gameId = client.start().read("$.gameId");

    client.quitRaw(gameId).andExpect(status().isOk());

    assertThat(jdbc.sql("SELECT COUNT(*) FROM result_profile").query(Long.class).single())
        .isEqualTo(before);
  }
}
