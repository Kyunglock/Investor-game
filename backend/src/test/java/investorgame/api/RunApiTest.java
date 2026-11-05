package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import investorgame.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Map;
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

/** 3분 육성 한 판의 API (증권사 육성 설계 3절). 규칙 자체는 RunEngineTest에서 본다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class RunApiTest {

  @Autowired WebApplicationContext context;

  MockMvc mvc;

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
  }

  private Cookie newSession() throws Exception {
    Cookie cookie =
        mvc.perform(post("/api/sessions")).andReturn().getResponse().getCookie(SessionCookies.NAME);
    assertThat(cookie).isNotNull();
    return new Cookie(cookie.getName(), cookie.getValue());
  }

  private DocumentContext start(Cookie session) throws Exception {
    String body =
        mvc.perform(post("/api/runs").cookie(session))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return JsonPath.parse(body);
  }

  private ResultActions choose(Cookie session, String runId, int card, String option)
      throws Exception {
    return mvc.perform(
        post("/api/runs/{runId}/choose", runId)
            .cookie(session)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"card\":" + card + ",\"option\":\"" + option + "\"}"));
  }

  @Test
  void 첫_판은_짜인_판이고_능력치는_등급만_보인다() throws Exception {
    Cookie session = newSession();
    mvc.perform(post("/api/runs").cookie(session))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("ACTIVE"))
        .andExpect(jsonPath("$.scripted").value(true))
        .andExpect(jsonPath("$.card").value(0))
        .andExpect(jsonPath("$.cardCount").value(12))
        .andExpect(jsonPath("$.fund").value(100_000_000))
        .andExpect(jsonPath("$.cash").value(100_000_000))
        .andExpect(jsonPath("$.grades.insight").value("E"))
        .andExpect(jsonPath("$.overallGrade").isString())
        .andExpect(jsonPath("$.current.kind").value("TRAIT"))
        .andExpect(jsonPath("$.seed").doesNotExist())
        .andExpect(jsonPath("$.stats").doesNotExist());
  }

  @Test
  void 한_판을_끝까지_하면_입사_심사_결과가_남고_두_번째_판은_무작위다() throws Exception {
    Cookie session = newSession();
    DocumentContext run = start(session);
    String runId = run.read("$.runId");
    boolean sawNews = false;
    while ("ACTIVE".equals(run.read("$.status"))) {
      int card = run.read("$.card", Integer.class);
      String kind = run.read("$.current.kind");
      if (kind.equals("NEWS")) {
        sawNews = true;
        List<String> texts = run.read("$.current.sentences[*].text");
        List<String> signs = run.read("$.current.sentences[*].sign");
        assertThat(texts).hasSize(4);
        assertThat(signs).as("숨은 값 없음").isEmpty();
      }
      List<String> options = run.read("$.current.options[*].code");
      String option = kind.equals("NEWS") ? "HOLD" : options.getFirst();
      String body =
          choose(session, runId, card, option)
              .andExpect(status().isOk())
              .andExpect(jsonPath("$.outcome.kind").value(kind))
              .andReturn()
              .getResponse()
              .getContentAsString();
      run = JsonPath.parse(JsonPath.parse(body).read("$.run", Map.class));
    }
    assertThat(sawNews).isTrue();
    assertThat(run.read("$.card", Integer.class)).isEqualTo(12);
    assertThat(run.read("$.result.overallGrade", String.class)).isNotBlank();
    assertThat(run.read("$.result.fund", Long.class)).isEqualTo(100_000_000L);

    mvc.perform(get("/api/runs/current").cookie(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ENDED"))
        .andExpect(jsonPath("$.current").doesNotExist());

    assertThat(start(session).read("$.scripted", Boolean.class)).isFalse();
  }

  @Test
  void 지난_카드나_없는_선택은_400이고_남의_판은_404다() throws Exception {
    Cookie session = newSession();
    DocumentContext run = start(session);
    String runId = run.read("$.runId");

    choose(session, runId, 1, run.read("$.current.options[0].code"))
        .andExpect(status().isBadRequest());
    choose(session, runId, 0, "NOPE").andExpect(status().isBadRequest());
    choose(newSession(), runId, 0, run.read("$.current.options[0].code"))
        .andExpect(status().isNotFound());
  }

  @Test
  void 세션이_없으면_401이고_판이_없으면_404다() throws Exception {
    mvc.perform(post("/api/runs")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/runs/current").cookie(newSession())).andExpect(status().isNotFound());
  }
}
