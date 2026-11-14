package investorgame.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import investorgame.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** 코드를 비운 서버(SANDBOX_CODE=)에는 테스트판이 없다 (decisions.md 499·502번). */
@SpringBootTest(properties = "sandbox.code=")
@Import(TestcontainersConfiguration.class)
class SandboxOffApiTest {

  @Autowired WebApplicationContext context;

  @Test
  void 코드를_비운_서버에는_테스트판이_없다() throws Exception {
    MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).build();
    Cookie cookie =
        mvc.perform(post("/api/sessions")).andReturn().getResponse().getCookie(SessionCookies.NAME);
    mvc.perform(
            post("/api/sandbox")
                .cookie(new Cookie(cookie.getName(), cookie.getValue()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"1111\"}"))
        .andExpect(status().isNotFound());
  }
}
