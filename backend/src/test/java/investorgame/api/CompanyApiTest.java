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

/** 아주 작은 회사의 API (증권사 육성 설계 4·6절). 규칙 자체는 CompanyEngineTest에서 본다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CompanyApiTest {

  @Autowired WebApplicationContext context;

  MockMvc mvc;
  Cookie session;

  @BeforeEach
  void setUp() throws Exception {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
    Cookie cookie =
        mvc.perform(post("/api/sessions")).andReturn().getResponse().getCookie(SessionCookies.NAME);
    session = new Cookie(cookie.getName(), cookie.getValue());
  }

  private static DocumentContext json(ResultActions result) throws Exception {
    return JsonPath.parse(result.andReturn().getResponse().getContentAsString());
  }

  private ResultActions postJson(String path, String body) throws Exception {
    return mvc.perform(
        post(path).cookie(session).contentType(MediaType.APPLICATION_JSON).content(body));
  }

  /** 판을 시작해 매 카드의 마지막 선택지(뉴스면 지켜본다)로 끝까지 간다. 끝난 판을 돌려준다. */
  private DocumentContext playRun() throws Exception {
    DocumentContext run =
        json(mvc.perform(post("/api/runs").cookie(session)).andExpect(status().isCreated()));
    String runId = run.read("$.runId");
    while ("ACTIVE".equals(run.read("$.status"))) {
      List<String> options = run.read("$.current.options[*].code");
      String body =
          "{\"card\":" + run.read("$.card") + ",\"option\":\"" + options.getLast() + "\"}";
      DocumentContext choice =
          json(postJson("/api/runs/" + runId + "/choose", body).andExpect(status().isOk()));
      run = JsonPath.parse(choice.read("$.run", Map.class));
    }
    return run;
  }

  private DocumentContext hire(String runId, boolean register, Integer replace) throws Exception {
    return json(
        postJson(
                "/api/company/hires",
                "{\"runId\":\"%s\",\"register\":%s,\"replace\":%s}"
                    .formatted(runId, register, replace))
            .andExpect(status().isOk()));
  }

  @Test
  void 첫_사람을_등록하면_회사가_열리고_공채_육성은_회사_돈으로_한다() throws Exception {
    mvc.perform(get("/api/company").cookie(session)).andExpect(status().isNotFound());

    DocumentContext first = playRun();
    long money = first.read("$.totalAsset", Long.class);
    String firstId = first.read("$.runId");
    postJson("/api/company/hires", "{\"runId\":\"" + firstId + "\",\"register\":false}")
        .andExpect(status().isBadRequest());
    DocumentContext company = hire(firstId, true, null);
    assertThat(company.read("$.capital", Long.class)).isEqualTo(money);
    assertThat(company.read("$.grade", String.class)).isEqualTo("F");
    assertThat(company.read("$.seats", Integer.class)).isEqualTo(2);
    assertThat(company.read("$.employees.length()", Integer.class)).isEqualTo(1);
    assertThat(company.read("$.meeting.recruitOpen", Boolean.class)).isTrue();
    postJson("/api/company/hires", "{\"runId\":\"" + firstId + "\",\"register\":true}")
        .andExpect(status().isBadRequest());

    postJson("/api/company/placement", "{\"seats\":[{\"employeeId\":1,\"desk\":\"bio\"}]}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.employees[0].desk").value("bio"));

    long fund = company.read("$.meeting.recruitFund", Long.class);
    DocumentContext recruit = playRun();
    assertThat(recruit.read("$.recruit", Boolean.class)).isTrue();
    assertThat(recruit.read("$.fund", Long.class)).isEqualTo(fund);
    assertThat(
            json(mvc.perform(get("/api/company").cookie(session)))
                .read("$.meeting.pendingRunId", String.class))
        .isEqualTo(recruit.read("$.runId"));
    mvc.perform(post("/api/runs").cookie(session)).andExpect(status().isBadRequest());

    DocumentContext after = hire(recruit.read("$.runId"), true, null);
    assertThat(after.read("$.employees.length()", Integer.class)).isEqualTo(2);
    assertThat(after.read("$.capital", Long.class))
        .isEqualTo(money - fund + recruit.read("$.totalAsset", Long.class));
    assertThat(after.read("$.meeting.recruitOpen", Boolean.class)).isFalse();
    mvc.perform(post("/api/runs").cookie(session)).andExpect(status().isBadRequest());

    for (int year = 1; year <= 3; year++) {
      DocumentContext settled = json(mvc.perform(post("/api/company/settle").cookie(session)));
      assertThat(settled.read("$.lastSettlement.year", Integer.class)).isEqualTo(year);
    }
    mvc.perform(get("/api/company").cookie(session))
        .andExpect(jsonPath("$.status").value("ENDED"))
        .andExpect(jsonPath("$.meeting").doesNotExist())
        .andExpect(jsonPath("$.sale.forced").value(true))
        .andExpect(jsonPath("$.owner.fameGrade").value("F"));
    // 시대가 끝난 회사는 팔아야 다음 회사가 열린다.
    mvc.perform(post("/api/runs").cookie(session)).andExpect(status().isBadRequest());

    DocumentContext next =
        json(postJson("/api/company/sale", "{\"cofounders\":[1]}").andExpect(status().isOk()));
    assertThat(next.read("$.status", String.class)).isEqualTo("ACTIVE");
    assertThat(next.read("$.number", Integer.class)).isEqualTo(2);
    assertThat(next.read("$.grade", String.class)).isEqualTo("F");
    assertThat(next.read("$.employees.length()", Integer.class)).as("공동창업자").isEqualTo(1);
    assertThat(next.read("$.owner.sales", Integer.class)).isEqualTo(1);
    assertThat(next.read("$.era.code", String.class)).isNotEqualTo("plain");
    postJson("/api/company/sale", "{\"cofounders\":[]}").andExpect(status().isBadRequest());

    DocumentContext nextRecruit =
        json(mvc.perform(post("/api/runs").cookie(session)).andExpect(status().isCreated()));
    assertThat(nextRecruit.read("$.recruit", Boolean.class)).as("새 회사의 공채").isTrue();
  }

  /** 인사 직원 (6.3절): 인사팀에 앉히면 3분 육성 없이 신입이 들어온다. 등록하면 연봉을 받는다. */
  @Test
  void 인사팀이_공채를_맡으면_육성_없이_신입이_들어온다() throws Exception {
    DocumentContext first = playRun();
    hire(first.read("$.runId"), true, null);
    postJson("/api/company/hr-recruit", "").andExpect(status().isBadRequest());

    DocumentContext placed =
        json(
            postJson("/api/company/placement", "{\"seats\":[{\"employeeId\":1,\"desk\":\"hr\"}]}")
                .andExpect(status().isOk()));
    assertThat(placed.read("$.meeting.hrCap", String.class)).isNotBlank();

    DocumentContext recruited =
        json(
            mvc.perform(post("/api/company/hr-recruit").cookie(session))
                .andExpect(status().isOk()));
    assertThat(recruited.read("$.candidate.overallGrade", String.class)).isNotBlank();
    assertThat(recruited.read("$.meeting.recruitOpen", Boolean.class)).isFalse();
    mvc.perform(post("/api/runs").cookie(session)).andExpect(status().isBadRequest());
    mvc.perform(post("/api/company/settle").cookie(session)).andExpect(status().isBadRequest());

    DocumentContext after =
        json(postJson("/api/company/candidate", "{\"register\":true}").andExpect(status().isOk()));
    assertThat(after.read("$.employees.length()", Integer.class)).isEqualTo(2);
    assertThat(after.read("$.employees[1].salary", Long.class)).isPositive();
    assertThat(after.read("$.candidate", Object.class)).isNull();
    mvc.perform(post("/api/company/settle").cookie(session)).andExpect(status().isOk());
  }
}
