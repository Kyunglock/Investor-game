package investorgame.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import investorgame.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** 관리자 플레이 기록 (decisions.md 46번). */
@SpringBootTest(properties = "admin.token=test-admin-token")
@Import(TestcontainersConfiguration.class)
class AdminApiTest {

  @Autowired WebApplicationContext context;

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
}
