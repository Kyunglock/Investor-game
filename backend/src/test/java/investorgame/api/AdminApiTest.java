package investorgame.api;

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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** 관리자 플레이 기록 (decisions.md 46번). 토큰이 맞아야 보이고, 육성 판이 멈춘 카드와 함께 보인다 (219번). */
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

  /** 숨은 값(시드·판 상태 JSON)은 없다. */
  @Test
  void 시작한_육성_판이_멈춘_카드와_세션과_함께_기록에_보인다() throws Exception {
    Cookie cookie =
        mvc.perform(post("/api/sessions")).andReturn().getResponse().getCookie(SessionCookies.NAME);
    Cookie session = new Cookie(cookie.getName(), cookie.getValue());
    String runId =
        JsonPath.read(
            mvc.perform(post("/api/runs").cookie(session))
                .andReturn()
                .getResponse()
                .getContentAsString(),
            "$.runId");

    mvc.perform(get("/api/admin/plays").header(AdminController.TOKEN_HEADER, "test-admin-token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.runs[?(@.runId == '%s')].status", runId).value("ACTIVE"))
        .andExpect(jsonPath("$.runs[?(@.runId == '%s')].card", runId).value(0))
        .andExpect(jsonPath("$.runs[?(@.runId == '%s')].kind", runId).value("TRAIT"))
        .andExpect(jsonPath("$.runs[?(@.runId == '%s')].scripted", runId).value(true))
        .andExpect(jsonPath("$.runs[?(@.runId == '%s')].seed", runId).doesNotExist())
        .andExpect(jsonPath("$.runs[?(@.runId == '%s')].state", runId).doesNotExist())
        .andExpect(jsonPath("$.sessions[0].runs").isNumber())
        .andExpect(jsonPath("$.sessions[?(@.firstIp == '127.0.0.1')]").isNotEmpty())
        .andExpect(jsonPath("$.plays").doesNotExist());
  }
}
