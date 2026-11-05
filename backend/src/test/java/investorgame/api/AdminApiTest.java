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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** 관리자 플레이 기록 (decisions.md 46번). 토큰이 맞아야 보이고, 회사가 몇 해까지 갔는지와 함께 보인다 (219·228번). */
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

  /** 숨은 값(시드·회사 상태 JSON)은 없다. */
  @Test
  void 차린_회사가_어디까지_갔는지_세션과_함께_기록에_보인다() throws Exception {
    Cookie cookie =
        mvc.perform(post("/api/sessions")).andReturn().getResponse().getCookie(SessionCookies.NAME);
    Cookie session = new Cookie(cookie.getName(), cookie.getValue());
    String companyId =
        JsonPath.read(
            mvc.perform(post("/api/company").cookie(session))
                .andReturn()
                .getResponse()
                .getContentAsString(),
            "$.companyId");
    mvc.perform(
            post("/api/company/settle")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"year\":1}"))
        .andExpect(status().isOk());

    String at = "$.companies[?(@.companyId == '%s')]";
    mvc.perform(get("/api/admin/plays").header(AdminController.TOKEN_HEADER, "test-admin-token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath(at + ".status", companyId).value("ACTIVE"))
        .andExpect(jsonPath(at + ".number", companyId).value(1))
        .andExpect(jsonPath(at + ".year", companyId).value(2))
        .andExpect(jsonPath(at + ".settled", companyId).value(1))
        .andExpect(jsonPath(at + ".grade", companyId).value("F"))
        .andExpect(jsonPath(at + ".seed", companyId).doesNotExist())
        .andExpect(jsonPath(at + ".state", companyId).doesNotExist())
        .andExpect(jsonPath("$.sessions[0].companies").isNumber())
        .andExpect(jsonPath("$.sessions[?(@.firstIp == '127.0.0.1')]").isNotEmpty())
        .andExpect(jsonPath("$.runs").doesNotExist());
  }
}
