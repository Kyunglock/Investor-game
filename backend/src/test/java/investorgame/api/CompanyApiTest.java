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
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** 증권사의 API (증권사 육성 설계 4·6·9절, decisions.md 228번). 규칙 자체는 CompanyEngineTest에서 본다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CompanyApiTest {

  @Autowired WebApplicationContext context;
  @Autowired JdbcClient jdbc;

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

  private ResultActions settle(int year) throws Exception {
    return postJson("/api/company/settle", "{\"year\":%d}".formatted(year));
  }

  /**
   * 같은 결산이 두 번 와도(버튼 두 번, 끊긴 요청 다시 보내기) 한 해만 넘어간다 (#305, decisions.md 234번). 돈을 굴리는 직원이 없으면 투자 회의가
   * 결산을 막지 않아서 예전에는 두 해가 넘어갔다.
   */
  @Test
  void 같은_해의_결산을_두_번_보내도_한_해만_넘어간다() throws Exception {
    json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    postJson("/api/company/settle", "{}").andExpect(status().isBadRequest());
    settle(2).andExpect(status().isBadRequest());

    DocumentContext first = json(settle(1).andExpect(status().isOk()));
    assertThat(first.read("$.year", Integer.class)).isEqualTo(2);
    assertThat(first.read("$.lastSettlement.year", Integer.class)).isEqualTo(1);

    DocumentContext again = json(settle(1).andExpect(status().isOk()));
    assertThat(again.read("$.year", Integer.class)).as("두 번째 요청은 아무것도 하지 않는다").isEqualTo(2);
    assertThat(again.read("$.capital", Long.class)).isEqualTo(first.read("$.capital", Long.class));
    assertThat(again.read("$.lastSettlement.year", Integer.class)).isEqualTo(1);
  }

  @Test
  void 사재로_회사를_차리고_공채_시장에서_뽑아_세_해를_넘겨도_이어진다() throws Exception {
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
    assertThat(company.read("$.applicants[0].sectorName", String.class)).isNotBlank();
    // 섹터 데스크 (4.2·9.4절): 첫 회사는 평범한 시대라 뜨는 섹터가 없다.
    List<String> chipSector = company.read("$.desks[?(@.code == 'semiconductor')].sector");
    assertThat(chipSector).containsExactly("semiconductor");
    assertThat(company.read("$.meeting.hot", Object.class)).isNull();
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
            "{\"seats\":[{\"employeeId\":" + employeeId + ",\"desk\":\"semiconductor\"}]}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.employees[0].desk").value("semiconductor"))
        .andExpect(jsonPath("$.employees[0].sector").isNotEmpty());

    // 투자 회의 (229번): 돈을 굴리는 직원이 있으면 정해야 결산한다. 숨은 방향은 정한 뒤에만 보인다.
    DocumentContext meeting = json(mvc.perform(get("/api/company").cookie(session)));
    assertThat(meeting.read("$.invest.ready", Boolean.class)).isTrue();
    assertThat(meeting.read("$.invest.sentences.length()", Integer.class)).isEqualTo(4);
    assertThat(meeting.read("$.invest.remarks[0].stubborn", String.class)).isNotBlank();
    assertThat(meeting.read("$.invest.options.length()", Integer.class)).isEqualTo(3);
    assertThat(meeting.read("$.invest.outcome", Object.class)).isNull();
    settle(1).andExpect(status().isBadRequest());
    postJson("/api/company/invest", "{\"choice\":\"SHORT\"}").andExpect(status().isBadRequest());
    for (int year = 1; year <= 3; year++) {
      DocumentContext decided =
          json(postJson("/api/company/invest", "{\"choice\":\"BUY\"}").andExpect(status().isOk()));
      assertThat(decided.read("$.invest.ready", Boolean.class)).isFalse();
      assertThat(decided.read("$.invest.outcome.results.length()", Integer.class)).isEqualTo(1);
      assertThat(decided.read("$.invest.outcome.reveal", String.class)).isNotBlank();
      postJson("/api/company/invest", "{\"choice\":\"BUY\"}").andExpect(status().isBadRequest());
      long meetingTotal = decided.read("$.invest.outcome.total", Long.class);
      DocumentContext settled = json(settle(year).andExpect(status().isOk()));
      assertThat(settled.read("$.lastSettlement.year", Integer.class)).isEqualTo(year);
      // 연말 결산서(240번): 회의 몫이 따로 실리고, 시작 자본 + 회의 + 직원들 몫 + 수수료 = 끝 자본.
      assertThat(settled.read("$.lastSettlement.invest.total", Long.class)).isEqualTo(meetingTotal);
      assertThat(settled.read("$.lastSettlement.invest.title", String.class)).isNotBlank();
      long staff = settled.read("$.lastSettlement.results[0].pnl", Long.class);
      long before = settled.read("$.lastSettlement.capitalBefore", Long.class);
      long fee = settled.read("$.lastSettlement.fee", Long.class);
      long after = settled.read("$.lastSettlement.capitalAfter", Long.class);
      if (after > 0) {
        assertThat(before + meetingTotal + staff + fee).isEqualTo(after);
      }
    }
    // 매각을 뺐다(236번): 세 해가 지나도 회사는 끝나지 않고 4년 차 연초 회의가 온다.
    DocumentContext fourth = json(mvc.perform(get("/api/company").cookie(session)));
    assertThat(fourth.read("$.status", String.class)).isEqualTo("ACTIVE");
    assertThat(fourth.read("$.year", Integer.class)).isEqualTo(4);
    assertThat(fourth.read("$.invest.ready", Boolean.class)).isTrue();
    assertThat(fourth.read("$.applicants.length()", Integer.class)).isEqualTo(3);
    assertThat(fourth.read("$.meeting", Object.class)).isNotNull();
    java.util.Map<String, Object> fields = fourth.read("$");
    assertThat(fields).doesNotContainKeys("sale", "owner", "turns");
    // 지난 해의 결산이 한 번 더 와도 아무것도 하지 않는다 (234번).
    settle(3).andExpect(status().isOk()).andExpect(jsonPath("$.year").value(4));
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isBadRequest());
    postJson("/api/company/sale", "{\"cofounders\":[" + employeeId + "]}")
        .andExpect(status().is4xxClientError());
    json(postJson("/api/company/invest", "{\"choice\":\"HOLD\"}").andExpect(status().isOk()));
    settle(4).andExpect(status().isOk()).andExpect(jsonPath("$.lastSettlement.year").value(4));
  }

  /** 매각을 빼기 전에 시대가 끝나 멈춘 회사는 다시 열면 다음 해 연초 회의부터 이어진다 (236번). */
  @Test
  void 시대가_끝나_멈췄던_옛_회사는_다시_이어진다() throws Exception {
    String id =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()))
            .read("$.companyId");
    jdbc.sql("UPDATE raising_company SET status = 'ENDED' WHERE id = CAST(:id AS uuid)")
        .param("id", id)
        .update();
    DocumentContext resumed = json(mvc.perform(get("/api/company").cookie(session)));
    assertThat(resumed.read("$.status", String.class)).isEqualTo("ACTIVE");
    assertThat(resumed.read("$.companyId", String.class)).isEqualTo(id);
    assertThat(resumed.read("$.applicants.length()", Integer.class)).isEqualTo(3);
    settle(1).andExpect(status().isOk()).andExpect(jsonPath("$.year").value(2));
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
