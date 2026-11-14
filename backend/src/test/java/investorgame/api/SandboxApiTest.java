package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.DocumentContext;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** 테스트판 (decisions.md 499번): 코드로 들어가고, 본 게임과 따로 놀고, 지갑이 떨어지지 않는다. */
@SpringBootTest(properties = "sandbox.code=cat-test")
@Import(TestcontainersConfiguration.class)
class SandboxApiTest {

  @Autowired WebApplicationContext context;

  MockMvc mvc;
  Cookie session;

  @BeforeEach
  void setUp() throws Exception {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
    session = newSession();
  }

  private Cookie newSession() throws Exception {
    Cookie cookie =
        mvc.perform(post("/api/sessions")).andReturn().getResponse().getCookie(SessionCookies.NAME);
    return new Cookie(cookie.getName(), cookie.getValue());
  }

  private static DocumentContext json(MvcResult result) throws Exception {
    return JsonPath.parse(result.getResponse().getContentAsString());
  }

  private MockHttpServletRequestBuilder enter(String code) {
    return post("/api/sandbox")
        .cookie(session)
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"code\":\"" + code + "\"}");
  }

  @Test
  void 틀린_코드로는_들어갈_수_없다() throws Exception {
    MvcResult refused = mvc.perform(enter("nope")).andExpect(status().isBadRequest()).andReturn();
    assertThat(refused.getResponse().getCookie(Sandbox.COOKIE)).isNull();
  }

  @Test
  void 테스트판은_본_게임과_따로이고_지갑이_떨어지지_않는다() throws Exception {
    DocumentContext main = json(mvc.perform(post("/api/company").cookie(session)).andReturn());
    String mainId = main.read("$.companyId");
    long mainCapital = main.read("$.capital", Long.class);
    assertThat(main.read("$.sandbox", Boolean.class)).isFalse();

    MvcResult entered = mvc.perform(enter("cat-test")).andExpect(status().isOk()).andReturn();
    Cookie sandbox = entered.getResponse().getCookie(Sandbox.COOKIE);
    assertThat(sandbox).isNotNull();
    assertThat(sandbox.isHttpOnly()).isTrue();
    DocumentContext trial = json(entered);
    String trialId = trial.read("$.companyId");
    long trialCapital = trial.read("$.capital", Long.class);
    assertThat(trialId).isNotEqualTo(mainId);
    assertThat(trial.read("$.sandbox", Boolean.class)).isTrue();
    assertThat(trialCapital).isGreaterThan(mainCapital);

    // 테스트판 쿠키가 있는 동안 회사 요청은 테스트판 회사로 간다. 뽑고 강화해도 다음 요청에 다시 채워진다.
    Cookie in = new Cookie(sandbox.getName(), sandbox.getValue());
    for (int i = 0; i < 3; i++) {
      mvc.perform(post("/api/company/cat/draw").cookie(session, in)).andExpect(status().isOk());
    }
    DocumentContext upgraded =
        json(
            mvc.perform(
                    post("/api/company/battle-upgrade")
                        .cookie(session, in)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"damage\",\"levels\":100}"))
                .andExpect(status().isOk())
                .andReturn());
    assertThat(upgraded.read("$.companyId", String.class)).isEqualTo(trialId);
    DocumentContext again = json(mvc.perform(enter("cat-test").cookie(session, in)).andReturn());
    assertThat(again.read("$.companyId", String.class)).isEqualTo(trialId);
    assertThat(again.read("$.capital", Long.class)).isEqualTo(trialCapital);
    assertThat(again.read("$.battleUpgrades[?(@.kind=='damage')].level").toString())
        .isEqualTo("[100]");

    // 쿠키 없이는 본 게임 그대로다.
    DocumentContext untouched = json(mvc.perform(get("/api/company").cookie(session)).andReturn());
    assertThat(untouched.read("$.companyId", String.class)).isEqualTo(mainId);
    assertThat(untouched.read("$.capital", Long.class)).isEqualTo(mainCapital);

    // 나가면 쿠키가 지워진다.
    Cookie left =
        mvc.perform(delete("/api/sandbox").cookie(session, in))
            .andExpect(status().isNoContent())
            .andReturn()
            .getResponse()
            .getCookie(Sandbox.COOKIE);
    assertThat(left.getMaxAge()).isZero();
  }

  @Test
  void 테스트판에서는_벽을_건너뛰고_처음부터_다시_할_수_있다() throws Exception {
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated());
    // 본 게임의 회사는 건너뛸 수 없다.
    mvc.perform(wall(200)).andExpect(status().isBadRequest());
    mvc.perform(post("/api/sandbox/reset").cookie(session)).andExpect(status().isBadRequest());

    MvcResult entered = mvc.perform(enter("cat-test")).andExpect(status().isOk()).andReturn();
    Cookie sandbox = entered.getResponse().getCookie(Sandbox.COOKIE);
    Cookie in = new Cookie(sandbox.getName(), sandbox.getValue());
    String first = json(entered).read("$.companyId");

    DocumentContext jumped =
        json(mvc.perform(wall(200).cookie(session, in)).andExpect(status().isOk()).andReturn());
    assertThat(jumped.read("$.idle.wall", Long.class)).isEqualTo(200);
    assertThat(jumped.read("$.idle.boss", Boolean.class)).isTrue();
    assertThat(jumped.read("$.idle.hp", Double.class))
        .isEqualTo(jumped.read("$.idle.maxHp", Double.class));
    mvc.perform(wall(0).cookie(session, in)).andExpect(status().isBadRequest());

    mvc.perform(
            post("/api/company/battle-upgrade")
                .cookie(session, in)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"kind\":\"damage\",\"levels\":10}"))
        .andExpect(status().isOk());
    DocumentContext fresh =
        json(
            mvc.perform(post("/api/sandbox/reset").cookie(session, in))
                .andExpect(status().isOk())
                .andReturn());
    assertThat(fresh.read("$.companyId", String.class)).isNotEqualTo(first);
    assertThat(fresh.read("$.sandbox", Boolean.class)).isTrue();
    assertThat(fresh.read("$.idle.wall", Long.class)).isEqualTo(1);
    assertThat(fresh.read("$.battleUpgrades[?(@.kind=='damage')].level").toString())
        .isEqualTo("[0]");
    // 고양이 여섯을 그 레벨로 받고 넷이 출전한다. 무기를 받으면 사장냥이 든다.
    DocumentContext cats =
        json(
            mvc.perform(tool("cats", "{\"level\":10}", in)).andExpect(status().isOk()).andReturn());
    assertThat(cats.read("$.idle.cats[*].level").toString()).isEqualTo("[10,10,10,10,10,10]");
    assertThat(cats.read("$.idle.cats[?(@.fielded)].code").toString())
        .isEqualTo("[\"sky\",\"mint\",\"lilac\",\"sunset\"]");
    DocumentContext armed =
        json(
            mvc.perform(tool("weapon", "{\"grade\":\"S\"}", in))
                .andExpect(status().isOk())
                .andReturn());
    assertThat(armed.read("$.weapons[?(@.equipped)].grade").toString()).isEqualTo("[\"S\"]");
    assertThat(armed.read("$.weapons[?(@.equipped)].count").toString()).isEqualTo("[6]");
    mvc.perform(tool("weapon", "{\"grade\":\"ZZ\"}", in)).andExpect(status().isBadRequest());

    // 무한 지갑을 끄면 처음 돈과 뽑기권 0에서 시작해 다시 채워지지 않고, 켜면 다시 채워진다.
    DocumentContext finite =
        json(
            mvc.perform(tool("wallet", "{\"infinite\":false}", in))
                .andExpect(status().isOk())
                .andReturn());
    assertThat(finite.read("$.sandbox", Boolean.class)).isTrue();
    assertThat(finite.read("$.sandboxInfinite", Boolean.class)).isFalse();
    assertThat(finite.read("$.armory.tickets", Integer.class)).isZero();
    long pocket = finite.read("$.capital", Long.class);
    mvc.perform(post("/api/company/cat/draw").cookie(session, in))
        .andExpect(status().isBadRequest());
    assertThat(
            json(mvc.perform(get("/api/company").cookie(session, in)).andReturn())
                .read("$.capital", Long.class))
        .isEqualTo(pocket);
    DocumentContext refilled =
        json(
            mvc.perform(tool("wallet", "{\"infinite\":true}", in))
                .andExpect(status().isOk())
                .andReturn());
    assertThat(refilled.read("$.sandboxInfinite", Boolean.class)).isTrue();
    assertThat(refilled.read("$.capital", Long.class)).isGreaterThan(pocket);

    // 본 게임의 회사는 그대로다.
    DocumentContext main = json(mvc.perform(get("/api/company").cookie(session)).andReturn());
    assertThat(main.read("$.sandbox", Boolean.class)).isFalse();
    assertThat(main.read("$.idle.wall", Long.class)).isEqualTo(1);
  }

  private MockHttpServletRequestBuilder tool(String name, String body, Cookie in) {
    return post("/api/sandbox/" + name)
        .cookie(session, in)
        .contentType(MediaType.APPLICATION_JSON)
        .content(body);
  }

  private MockHttpServletRequestBuilder wall(long wall) {
    return post("/api/sandbox/wall")
        .cookie(session)
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"wall\":" + wall + "}");
  }

  @Test
  void 남의_테스트판_쿠키는_통하지_않는다() throws Exception {
    Cookie stolen =
        mvc.perform(enter("cat-test")).andReturn().getResponse().getCookie(Sandbox.COOKIE);
    session = newSession();
    String mine =
        json(mvc.perform(post("/api/company").cookie(session)).andReturn()).read("$.companyId");
    DocumentContext seen =
        json(
            mvc.perform(
                    get("/api/company")
                        .cookie(session, new Cookie(stolen.getName(), stolen.getValue())))
                .andReturn());
    assertThat(seen.read("$.companyId", String.class)).isEqualTo(mine);
    assertThat(seen.read("$.sandbox", Boolean.class)).isFalse();
  }
}
