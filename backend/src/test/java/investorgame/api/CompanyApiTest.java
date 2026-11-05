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

/** 증권사의 API (증권사 육성 설계 4·6·9절, decisions.md 228번). 규칙 자체는 CompanyEngineTest에서 본다. */
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

  private DocumentContext hire(int applicantId, Integer replace) throws Exception {
    return json(
        postJson(
                "/api/company/hires",
                "{\"applicantId\":%d,\"replace\":%s}".formatted(applicantId, replace))
            .andExpect(status().isOk()));
  }

  @Test
  void 사재로_회사를_차리고_공채_시장에서_뽑아_세_해를_돌면_팔고_다시_차린다() throws Exception {
    mvc.perform(get("/api/company").cookie(session)).andExpect(status().isNotFound());

    DocumentContext company =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isBadRequest());
    long capital = company.read("$.capital", Long.class);
    assertThat(capital).isEqualTo(100_000_000L);
    assertThat(company.read("$.grade", String.class)).isEqualTo("F");
    assertThat(company.read("$.seats", Integer.class)).isEqualTo(2);
    assertThat(company.read("$.employees.length()", Integer.class)).isZero();
    assertThat(company.read("$.applicants.length()", Integer.class)).isEqualTo(3);
    assertThat(company.read("$.applicants[0].line", String.class)).isNotBlank();
    assertThat(company.read("$.refreshCost", Long.class)).isPositive();

    int firstId = company.read("$.applicants[0].id");
    long firstFee = company.read("$.applicants[0].fee", Long.class);
    DocumentContext one = hire(firstId, null);
    assertThat(one.read("$.employees.length()", Integer.class)).isEqualTo(1);
    assertThat(one.read("$.capital", Long.class)).isEqualTo(capital - firstFee);
    assertThat(one.read("$.applicants.length()", Integer.class)).isEqualTo(2);
    postJson("/api/company/hires", "{\"applicantId\":" + firstId + "}")
        .andExpect(status().isBadRequest());

    DocumentContext refreshed =
        json(
            mvc.perform(post("/api/company/applicants/refresh").cookie(session))
                .andExpect(status().isOk()));
    assertThat(refreshed.read("$.applicants.length()", Integer.class)).isEqualTo(3);
    assertThat(refreshed.read("$.capital", Long.class))
        .isEqualTo(one.read("$.capital", Long.class) - one.read("$.refreshCost", Long.class));

    int employeeId = one.read("$.employees[0].id");
    postJson(
            "/api/company/placement",
            "{\"seats\":[{\"employeeId\":" + employeeId + ",\"desk\":\"bio\"}]}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.employees[0].desk").value("bio"));

    for (int year = 1; year <= 3; year++) {
      DocumentContext settled = json(mvc.perform(post("/api/company/settle").cookie(session)));
      assertThat(settled.read("$.lastSettlement.year", Integer.class)).isEqualTo(year);
    }
    mvc.perform(get("/api/company").cookie(session))
        .andExpect(jsonPath("$.status").value("ENDED"))
        .andExpect(jsonPath("$.meeting").doesNotExist())
        .andExpect(jsonPath("$.applicants.length()").value(0))
        .andExpect(jsonPath("$.sale.forced").value(true))
        .andExpect(jsonPath("$.owner.fameGrade").value("F"));
    // 시대가 끝난 회사는 팔아야 다음 회사가 열린다.
    mvc.perform(post("/api/company/applicants/refresh").cookie(session))
        .andExpect(status().isNotFound());
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isBadRequest());

    DocumentContext next =
        json(
            postJson("/api/company/sale", "{\"cofounders\":[" + employeeId + "]}")
                .andExpect(status().isOk()));
    assertThat(next.read("$.status", String.class)).isEqualTo("ACTIVE");
    assertThat(next.read("$.number", Integer.class)).isEqualTo(2);
    assertThat(next.read("$.grade", String.class)).isEqualTo("F");
    assertThat(next.read("$.employees.length()", Integer.class)).as("공동창업자").isEqualTo(1);
    assertThat(next.read("$.applicants.length()", Integer.class)).as("새 회사의 공채").isEqualTo(3);
    assertThat(next.read("$.owner.sales", Integer.class)).isEqualTo(1);
    assertThat(next.read("$.era.code", String.class)).isNotEqualTo("plain");
    postJson("/api/company/sale", "{\"cofounders\":[]}").andExpect(status().isBadRequest());
  }

  /** 자리가 꽉 차면 내보낼 직원을 골라야 뽑는다. 인사팀에 사람이 있으면 지원자가 한 명 더 온다. */
  @Test
  void 자리가_꽉_차면_내보낼_사람을_고르고_인사팀이_공채를_돕는다() throws Exception {
    DocumentContext company =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    // 계약금이 싼 지원자부터 둘을 뽑는다.
    List<Integer> ids = company.read("$.applicants[*].id");
    List<Number> fees = company.read("$.applicants[*].fee");
    List<Integer> order =
        java.util.stream.IntStream.range(0, ids.size())
            .boxed()
            .sorted(java.util.Comparator.comparingLong(i -> fees.get(i).longValue()))
            .toList();
    hire(ids.get(order.get(0)), null);
    DocumentContext two = hire(ids.get(order.get(1)), null);
    int keep = two.read("$.employees[0].id");
    int leave = two.read("$.employees[1].id");
    int last = ids.get(order.get(2));
    postJson("/api/company/hires", "{\"applicantId\":" + last + "}")
        .andExpect(status().isBadRequest());

    DocumentContext placed =
        json(
            postJson(
                    "/api/company/placement",
                    "{\"seats\":[{\"employeeId\":" + keep + ",\"desk\":\"hr\"}]}")
                .andExpect(status().isOk()));
    assertThat(placed.read("$.meeting.hrCap", String.class)).isNotBlank();

    DocumentContext swapped = hire(last, leave);
    List<Integer> staff = swapped.read("$.employees[*].id");
    assertThat(staff).hasSize(2).contains(keep).doesNotContain(leave);

    DocumentContext refreshed =
        json(
            mvc.perform(post("/api/company/applicants/refresh").cookie(session))
                .andExpect(status().isOk()));
    assertThat(refreshed.read("$.applicants.length()", Integer.class))
        .as("인사팀이 한 명 더 데려온다")
        .isEqualTo(4);
  }
}
