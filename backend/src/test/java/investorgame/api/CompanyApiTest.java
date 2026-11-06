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

  private ResultActions refresh(int year, int refreshes) throws Exception {
    return postJson(
        "/api/company/applicants/refresh",
        "{\"year\":%d,\"refreshes\":%d}".formatted(year, refreshes));
  }

  /** 종목 회의에서 고른다. 막판 뒤집기(decisions.md 283번)가 끼어들면 원래대로 한다고 답한다: 시험이 고른 결정 그대로 굴린다. */
  private DocumentContext decide(String choice) throws Exception {
    DocumentContext decided =
        json(
            postJson("/api/company/invest", "{\"choice\":\"" + choice + "\"}")
                .andExpect(status().isOk()));
    if (decided.read("$.invest.proposal", Object.class) != null) {
      assertThat(decided.read("$.invest.outcome", Object.class)).as("답할 때까지 정해지지 않는다").isNull();
      decided =
          json(
              postJson("/api/company/invest/proposal", "{\"accept\":false}")
                  .andExpect(status().isOk()));
    }
    return decided;
  }

  private ResultActions settle(int year, int quarter) throws Exception {
    return postJson("/api/company/settle", "{\"year\":%d,\"quarter\":%d}".formatted(year, quarter));
  }

  /** 한 해의 남은 분기를 모두 넘긴다 (decisions.md 268번). 마지막 응답(연말 결산)을 돌려준다. */
  private ResultActions settleYear(int year) throws Exception {
    int quarter =
        json(mvc.perform(get("/api/company").cookie(session))).read("$.quarter", Integer.class);
    ResultActions last = null;
    for (int q = quarter; q <= 4; q++) {
      // 2~4분기에는 분기를 열 때 직원이 종목을 물어 올 수 있다 (281번): 회의가 열렸으면 지켜보고 넘긴다.
      Boolean ready =
          json(mvc.perform(get("/api/company").cookie(session)))
              .read("$.invest.ready", Boolean.class);
      if (Boolean.TRUE.equals(ready)) {
        decide("HOLD");
      }
      last = settle(year, q).andExpect(status().isOk());
    }
    return last;
  }

  /**
   * 같은 분기 결산이 두 번 와도(버튼 두 번, 끊긴 요청 다시 보내기) 한 분기만 넘어간다 (#305, decisions.md 234·268번). 돈을 굴리는 직원이 없으면
   * 회의가 결산을 막지 않아서 예전에는 두 해가 넘어갔다.
   */
  @Test
  void 같은_분기의_결산을_두_번_보내도_한_분기만_넘어간다() throws Exception {
    json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    postJson("/api/company/settle", "{}").andExpect(status().isBadRequest());
    postJson("/api/company/settle", "{\"year\":1}").andExpect(status().isBadRequest());
    settle(1, 5).andExpect(status().isBadRequest());
    settle(1, 2).andExpect(status().isBadRequest());
    settle(2, 1).andExpect(status().isBadRequest());

    DocumentContext first = json(settle(1, 1).andExpect(status().isOk()));
    assertThat(first.read("$.year", Integer.class)).isEqualTo(1);
    assertThat(first.read("$.quarter", Integer.class)).isEqualTo(2);
    assertThat(first.read("$.lastQuarter.quarter", Integer.class)).isEqualTo(1);
    assertThat(first.read("$.lastSettlement", Object.class)).isNull();

    DocumentContext again = json(settle(1, 1).andExpect(status().isOk()));
    assertThat(again.read("$.quarter", Integer.class)).as("두 번째 요청은 아무것도 하지 않는다").isEqualTo(2);
    assertThat(again.read("$.capital", Long.class)).isEqualTo(first.read("$.capital", Long.class));

    settle(1, 2).andExpect(status().isOk());
    settle(1, 3).andExpect(status().isOk());
    DocumentContext year = json(settle(1, 4).andExpect(status().isOk()));
    assertThat(year.read("$.year", Integer.class)).isEqualTo(2);
    assertThat(year.read("$.quarter", Integer.class)).isEqualTo(1);
    assertThat(year.read("$.lastQuarter", Object.class)).as("새해에는 넘긴 분기가 없다").isNull();
    assertThat(year.read("$.lastSettlement.year", Integer.class)).isEqualTo(1);
    assertThat(year.read("$.lastSettlement.quarters.length()", Integer.class)).isEqualTo(4);
    DocumentContext twice = json(settle(1, 4).andExpect(status().isOk()));
    assertThat(twice.read("$.year", Integer.class)).isEqualTo(2);
    assertThat(twice.read("$.capital", Long.class)).isEqualTo(year.read("$.capital", Long.class));
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
    assertThat(company.read("$.seats", Integer.class)).isEqualTo(4);
    assertThat(company.read("$.employees.length()", Integer.class)).isZero();
    assertThat(company.read("$.applicants.length()", Integer.class)).isEqualTo(5);
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
    assertThat(one.read("$.applicants.length()", Integer.class)).isEqualTo(4);
    postJson("/api/company/hires", "{\"applicantId\":" + firstId + "}")
        .andExpect(status().isBadRequest());

    DocumentContext refreshed = json(refresh(1, 0).andExpect(status().isOk()));
    assertThat(refreshed.read("$.applicants.length()", Integer.class)).isEqualTo(5);
    assertThat(refreshed.read("$.refreshes", Integer.class)).isEqualTo(1);
    assertThat(refreshed.read("$.capital", Long.class))
        .isEqualTo(one.read("$.capital", Long.class) - one.read("$.refreshCost", Long.class));
    // 같은 새로 받기가 두 번 와도 한 번만 낸다 (254번). 아직 오지 않은 것은 400.
    DocumentContext twice = json(refresh(1, 0).andExpect(status().isOk()));
    assertThat(twice.read("$.capital", Long.class))
        .isEqualTo(refreshed.read("$.capital", Long.class));
    assertThat(twice.read("$.applicants[0].id", Integer.class))
        .isEqualTo(refreshed.read("$.applicants[0].id", Integer.class));
    refresh(1, 5).andExpect(status().isBadRequest());
    refresh(2, 0).andExpect(status().isBadRequest());
    postJson("/api/company/applicants/refresh", "{}").andExpect(status().isBadRequest());

    int employeeId = one.read("$.employees[0].id");
    postJson(
            "/api/company/placement",
            "{\"seats\":[{\"employeeId\":" + employeeId + ",\"desk\":\"semiconductor\"}]}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.employees[0].desk").value("semiconductor"))
        .andExpect(jsonPath("$.employees[0].sector").isNotEmpty());

    // 거시경제 회의 (266번): 해마다 연다. 한마디는 회의를 연 때 굳힌다(249번과 같다). 종목 회의는 아직 아무도 물어 오지 않아 닫혀 있다(267번).
    DocumentContext meeting = json(mvc.perform(get("/api/company").cookie(session)));
    assertThat(meeting.read("$.invest.ready", Boolean.class)).isFalse();
    assertThat(meeting.read("$.macro.ready", Boolean.class)).isTrue();
    assertThat(meeting.read("$.macro.sentences.length()", Integer.class)).isGreaterThanOrEqualTo(4);
    assertThat(meeting.read("$.macro.stances.length()", Integer.class)).isEqualTo(3);
    assertThat(meeting.read("$.macro.convened", Boolean.class)).isFalse();
    assertThat(meeting.read("$.macro.remarks.length()", Integer.class)).isZero();
    assertThat(meeting.read("$.macro.outcome", Object.class)).isNull();
    postJson("/api/company/invest", "{\"choice\":\"BUY\"}").andExpect(status().isBadRequest());
    DocumentContext macroOpen =
        json(
            mvc.perform(post("/api/company/macro/open").cookie(session))
                .andExpect(status().isOk()));
    assertThat(macroOpen.read("$.macro.convened", Boolean.class)).isTrue();
    String macroSaid = macroOpen.read("$.macro.remarks[0].text");
    assertThat(
            json(mvc.perform(post("/api/company/macro/open").cookie(session))
                    .andExpect(status().isOk()))
                .read("$.macro.remarks[0].text", String.class))
        .isEqualTo(macroSaid);
    postJson("/api/company/macro", "{\"stance\":\"ALL_IN\"}").andExpect(status().isBadRequest());
    DocumentContext stance =
        json(
            postJson("/api/company/macro", "{\"stance\":\"AGGRESSIVE\"}")
                .andExpect(status().isOk()));
    assertThat(stance.read("$.macro.ready", Boolean.class)).isFalse();
    assertThat(stance.read("$.macro.outcome.stance", String.class)).isEqualTo("AGGRESSIVE");
    postJson("/api/company/macro", "{\"stance\":\"DEFENSIVE\"}").andExpect(status().isBadRequest());
    // 첫 회사의 첫해에는 돈을 굴리는 직원이 꼭 종목을 물어 온다 (267번).
    assertThat(stance.read("$.macro.outcome.finder.employeeId", Integer.class))
        .isEqualTo(employeeId);
    assertThat(stance.read("$.invest.finder.pitch", String.class)).isNotBlank();

    // 종목 회의 (229번): 물어 왔으면 정해야 결산한다. 숨은 방향은 정한 뒤에만 보인다.
    meeting = json(mvc.perform(get("/api/company").cookie(session)));
    assertThat(meeting.read("$.invest.ready", Boolean.class)).isTrue();
    assertThat(meeting.read("$.invest.sentences.length()", Integer.class)).isEqualTo(4);
    // 한마디는 회의를 연 때 굳힌다 (249번): 열기 전에는 없고, 두 번 열어도 같다.
    assertThat(meeting.read("$.invest.convened", Boolean.class)).isFalse();
    assertThat(meeting.read("$.invest.remarks.length()", Integer.class)).isZero();
    DocumentContext convened =
        json(
            mvc.perform(post("/api/company/invest/open").cookie(session))
                .andExpect(status().isOk()));
    assertThat(convened.read("$.invest.convened", Boolean.class)).isTrue();
    assertThat(convened.read("$.invest.remarks[0].stubborn", String.class)).isNotBlank();
    String said = convened.read("$.invest.remarks[0].text");
    DocumentContext again =
        json(
            mvc.perform(post("/api/company/invest/open").cookie(session))
                .andExpect(status().isOk()));
    assertThat(again.read("$.invest.remarks[0].text", String.class)).isEqualTo(said);
    // 산다·판다·지켜본다·너희가 알아서 해 (decisions.md 279번)
    assertThat(meeting.read("$.invest.options.length()", Integer.class)).isEqualTo(4);
    assertThat(meeting.read("$.invest.outcome", Object.class)).isNull();
    settle(1, 1).andExpect(status().isBadRequest());
    postJson("/api/company/invest", "{\"choice\":\"SHORT\"}").andExpect(status().isBadRequest());
    for (int year = 1; year <= 3; year++) {
      if (year > 1) {
        DocumentContext macro =
            json(
                postJson("/api/company/macro", "{\"stance\":\"NEUTRAL\"}")
                    .andExpect(status().isOk()));
        assertThat(macro.read("$.macro.outcome.stance", String.class)).isEqualTo("NEUTRAL");
      }
      long meetingTotal = 0;
      boolean held = json(mvc.perform(get("/api/company").cookie(session))).read("$.invest.ready");
      if (held) {
        DocumentContext decided = decide("BUY");
        assertThat(decided.read("$.invest.ready", Boolean.class)).isFalse();
        assertThat(decided.read("$.invest.outcome.results.length()", Integer.class)).isEqualTo(1);
        assertThat(decided.read("$.invest.outcome.reveal", String.class)).isNotBlank();
        assertThat(decided.read("$.invest.outcome.credit", String.class)).isNotBlank();
        postJson("/api/company/invest", "{\"choice\":\"BUY\"}").andExpect(status().isBadRequest());
        meetingTotal = decided.read("$.invest.outcome.total", Long.class);
      }
      DocumentContext settled = json(settleYear(year));
      assertThat(settled.read("$.lastSettlement.year", Integer.class)).isEqualTo(year);
      // 연말 결산서(240·251·266번): 거시경제 회의의 태도, 회의 몫과 채용비가 따로 실리고, 연초 자본 + 회의 + 직원들 몫 + 수수료 − 채용비 = 연말
      // 자본.
      // 거시경제 회의는 한 해에 한 번이다 (281번): 1분기에 고른 태도가 네 분기 내내 걸린다.
      assertThat(settled.read("$.lastSettlement.quarters.length()", Integer.class)).isEqualTo(4);
      assertThat(settled.read("$.lastSettlement.quarters[0].stance", String.class))
          .isEqualTo(year == 1 ? "AGGRESSIVE" : "NEUTRAL");
      assertThat(settled.read("$.lastSettlement.quarters[3].stance", String.class))
          .isEqualTo(year == 1 ? "AGGRESSIVE" : "NEUTRAL");
      if (held) {
        // 2~4분기에도 종목을 물어 올 수 있어 한 해 회의 몫은 1분기 몫과 다를 수 있다 (281번).
        assertThat(settled.read("$.lastSettlement.invest.title", String.class)).isNotBlank();
      }
      Object yearInvest = settled.read("$.lastSettlement.invest", Object.class);
      if (yearInvest != null) {
        meetingTotal = settled.read("$.lastSettlement.invest.total", Long.class);
      }
      long staff = settled.read("$.lastSettlement.results[0].pnl", Long.class);
      long before = settled.read("$.lastSettlement.capitalBefore", Long.class);
      long fee = settled.read("$.lastSettlement.fee", Long.class);
      long after = settled.read("$.lastSettlement.capitalAfter", Long.class);
      long hiring = settled.read("$.lastSettlement.hiring", Long.class);
      long salary = settled.read("$.lastSettlement.salary", Long.class);
      if (year == 1) {
        assertThat(hiring).as("첫 해에 뽑고 새로 받은 값").isPositive();
      }
      if (after > 0) {
        assertThat(before + meetingTotal + staff + fee - hiring - salary).isEqualTo(after);
      }
    }
    // 매각을 뺐다(236번): 세 해가 지나도 회사는 끝나지 않고 4년 차 연초 회의가 온다.
    DocumentContext fourth = json(mvc.perform(get("/api/company").cookie(session)));
    assertThat(fourth.read("$.status", String.class)).isEqualTo("ACTIVE");
    assertThat(fourth.read("$.year", Integer.class)).isEqualTo(4);
    assertThat(fourth.read("$.macro.ready", Boolean.class)).isTrue();
    assertThat(fourth.read("$.applicants.length()", Integer.class)).isEqualTo(5);
    assertThat(fourth.read("$.meeting", Object.class)).isNotNull();
    java.util.Map<String, Object> fields = fourth.read("$");
    assertThat(fields).doesNotContainKeys("sale", "owner", "turns");
    // 지난 해의 결산이 한 번 더 와도 아무것도 하지 않는다 (234번).
    settle(3, 4).andExpect(status().isOk()).andExpect(jsonPath("$.year").value(4));
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isBadRequest());
    postJson("/api/company/sale", "{\"cofounders\":[" + employeeId + "]}")
        .andExpect(status().is4xxClientError());
    // 거시경제 회의를 건너뛰고 결산하면 중립이다. 물어 온 종목이 있으면 그 회의는 정해야 한다.
    if (json(mvc.perform(get("/api/company").cookie(session)))
        .read("$.invest.ready", Boolean.class)) {
      decide("HOLD");
    }
    settleYear(4)
        .andExpect(jsonPath("$.lastSettlement.year").value(4))
        .andExpect(jsonPath("$.lastSettlement.quarters[0].stance").value("NEUTRAL"));
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
    assertThat(resumed.read("$.applicants.length()", Integer.class)).isEqualTo(5);
    settleYear(1).andExpect(jsonPath("$.year").value(2));
  }

  /** 자리가 꽉 차면 내보낼 직원을 골라야 뽑는다. 인사팀에 사람이 있으면 지원자가 한 명 더 온다. */
  @Test
  void 자리가_꽉_차면_내보낼_사람을_고르고_인사팀이_공채를_돕는다() throws Exception {
    DocumentContext company =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    // 계약금이 싼 지원자부터 넷을 뽑아 F 회사 자리 넷을 채운다 (287번).
    List<Integer> ids = company.read("$.applicants[*].id");
    List<Number> fees = company.read("$.applicants[*].fee");
    List<Integer> order =
        java.util.stream.IntStream.range(0, ids.size())
            .boxed()
            .sorted(java.util.Comparator.comparingLong(i -> fees.get(i).longValue()))
            .toList();
    DocumentContext full = null;
    for (int i = 0; i < 4; i++) {
      full = hire(ids.get(order.get(i)), null);
    }
    int keep = full.read("$.employees[0].id");
    int leave = full.read("$.employees[1].id");
    int last = ids.get(order.get(4));
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
    assertThat(staff).hasSize(4).contains(keep).doesNotContain(leave);

    DocumentContext refreshed = json(refresh(1, 0).andExpect(status().isOk()));
    assertThat(refreshed.read("$.applicants.length()", Integer.class))
        .as("인사팀이 한 명 더 데려온다")
        .isEqualTo(6);
  }

  /** 망한 회사는 닫고 사장의 사재로 다음 회사를 차린다 (decisions.md 247번). 망하지 않았으면 400이다. */
  @Test
  void 자본이_바닥난_회사를_닫고_사재로_다음_회사를_차린다() throws Exception {
    String id =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()))
            .read("$.companyId");
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isBadRequest());

    jdbc.sql(
            "UPDATE raising_company SET state = jsonb_set(state, '{capital}', '0') WHERE id = CAST(:id AS uuid)")
        .param("id", id)
        .update();
    DocumentContext broke = json(mvc.perform(get("/api/company").cookie(session)));
    assertThat(broke.read("$.broke", String.class)).isNotBlank();

    DocumentContext next =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    assertThat(next.read("$.companyId", String.class)).isNotEqualTo(id);
    assertThat(next.read("$.number", Integer.class)).isEqualTo(2);
    assertThat(next.read("$.capital", Long.class)).isEqualTo(100_000_000L);
    assertThat(next.read("$.opening", String.class)).contains("1호 회사는 문을 닫았다");
    assertThat(next.read("$.broke", String.class)).isNull();
    assertThat(
            jdbc.sql("SELECT status FROM raising_company WHERE id = CAST(:id AS uuid)")
                .param("id", id)
                .query(String.class)
                .single())
        .isEqualTo("ENDED");
    DocumentContext current = json(mvc.perform(get("/api/company").cookie(session)));
    assertThat(current.read("$.number", Integer.class)).as("닫은 회사는 다시 열리지 않는다").isEqualTo(2);
  }

  /** 배치에 같은 직원이 두 번 오면 400이다 (#317, decisions.md 254번). 전에는 뒤의 것이 조용히 덮었다. */
  @Test
  void 배치에_같은_직원이_두_번_오면_400이다() throws Exception {
    DocumentContext company =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    int applicant = company.read("$.applicants[2].id");
    int id = hire(applicant, null).read("$.employees[0].id");
    postJson(
            "/api/company/placement",
            "{\"seats\":[{\"employeeId\":%d,\"desk\":\"bio\"},{\"employeeId\":%d,\"desk\":null}]}"
                .formatted(id, id))
        .andExpect(status().isBadRequest());
  }

  /** 같은 세션이 동시에 회사를 두 번 차려도 하나만 생기고 500이 나지 않는다 (#317, 254번). */
  @Test
  void 동시에_두_번_차려도_회사는_하나고_500이_나지_않는다() throws Exception {
    java.util.concurrent.ExecutorService pool =
        java.util.concurrent.Executors.newFixedThreadPool(2);
    java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
    try {
      List<java.util.concurrent.Future<Integer>> calls = new java.util.ArrayList<>();
      for (int i = 0; i < 2; i++) {
        calls.add(
            pool.submit(
                () -> {
                  start.await();
                  return mvc.perform(post("/api/company").cookie(session))
                      .andReturn()
                      .getResponse()
                      .getStatus();
                }));
      }
      start.countDown();
      List<Integer> codes = new java.util.ArrayList<>();
      for (java.util.concurrent.Future<Integer> call : calls) {
        codes.add(call.get());
      }
      assertThat(codes).containsExactlyInAnyOrder(201, 400);
    } finally {
      pool.shutdownNow();
    }
    String sessionId =
        jdbc.sql("SELECT session_id FROM raising_company ORDER BY created_at DESC LIMIT 1")
            .query(String.class)
            .single();
    assertThat(
            jdbc.sql("SELECT count(*) FROM raising_company WHERE session_id = CAST(:id AS uuid)")
                .param("id", sessionId)
                .query(Integer.class)
                .single())
        .isEqualTo(1);
  }

  /**
   * 올해의 라이벌 (decisions.md 275번): 연초 회의에 쉬움·보통·어려움 후보가 오고, 띠에 실제 다른 사장의 회사가 있으면 그 회사다. 고르면 연말 결산에서 한
   * 번 견준다. 이미 골랐으면 400.
   */
  @Test
  void 연초_회의에서_실제_다른_사장의_회사를_올해의_라이벌로_고르고_연말에_견준다() throws Exception {
    // 다른 사장이 먼저 1억 원으로 회사를 차렸다: 우리(1억 원)의 쉬움 띠 [1억, 1.15억)에 든다.
    Cookie other =
        mvc.perform(post("/api/sessions")).andReturn().getResponse().getCookie(SessionCookies.NAME);
    mvc.perform(post("/api/company").cookie(new Cookie(other.getName(), other.getValue())))
        .andExpect(status().isCreated());

    DocumentContext opened =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    assertThat(opened.read("$.meeting.rivalry.options.length()", Integer.class)).isEqualTo(3);
    assertThat(opened.read("$.meeting.rivalry.options[0].difficulty", String.class))
        .isEqualTo("EASY");
    assertThat(opened.read("$.meeting.rivalry.options[0].difficultyName", String.class))
        .isEqualTo("쉬움");
    assertThat(opened.read("$.meeting.rivalry.options[0].real", Boolean.class)).isTrue();
    assertThat(opened.read("$.meeting.rivalry.chosen", Object.class)).isNull();

    postJson("/api/company/target", "{\"difficulty\":\"NOPE\"}").andExpect(status().isBadRequest());
    DocumentContext picked =
        json(
            postJson("/api/company/target", "{\"difficulty\":\"EASY\"}")
                .andExpect(status().isOk()));
    assertThat(picked.read("$.meeting.rivalry.chosen.difficulty", String.class)).isEqualTo("EASY");
    assertThat(picked.read("$.meeting.rivalry.options.length()", Integer.class)).isZero();
    postJson("/api/company/target", "{\"difficulty\":\"HARD\"}").andExpect(status().isBadRequest());

    DocumentContext year = json(settleYear(1));
    assertThat(year.read("$.lastSettlement.target.real", Boolean.class)).isTrue();
    long ours = year.read("$.lastSettlement.target.ourCapital", Long.class);
    long bonus = year.read("$.lastSettlement.target.bonus", Long.class);
    long theirs = year.read("$.lastSettlement.target.theirCapital", Long.class);
    boolean won = year.read("$.lastSettlement.target.won", Boolean.class);
    assertThat(won).isEqualTo(ours - bonus > theirs);
    assertThat(year.read("$.capital", Long.class)).isEqualTo(ours);
    // 다음 해 연초 회의에 새 후보가 온다.
    assertThat(year.read("$.meeting.rivalry.options.length()", Integer.class)).isEqualTo(3);
  }

  /**
   * 랜드마크 타워 엔딩 (decisions.md 276번): 연말 결산에서 회사 등급이 Z(자본 100조 원)에 오르면 엔딩을 보고 회사가 멈춘다. 그 뒤로는 뽑기·결산이
   * 400이고, 사장의 사재로 다음 회사를 차릴 수 있다.
   */
  @Test
  void 랜드마크_타워에_오르면_엔딩을_보고_다음_회사를_차린다() throws Exception {
    String id =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()))
            .read("$.companyId", String.class);
    jdbc.sql(
            "UPDATE raising_company SET state = jsonb_set(state, '{capital}', '100000000000000')"
                + " WHERE id = CAST(:id AS uuid)")
        .param("id", id)
        .update();
    DocumentContext end = json(settleYear(1));
    assertThat(end.read("$.lastSettlement.finished", Boolean.class)).isTrue();
    assertThat(end.read("$.ending.year", Integer.class)).isEqualTo(1);
    assertThat(end.read("$.ending.grade", String.class)).isEqualTo("Z");
    hireFails();
    settle(2, 1).andExpect(status().isBadRequest());

    DocumentContext next =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    assertThat(next.read("$.number", Integer.class)).isEqualTo(2);
    assertThat(next.read("$.capital", Long.class)).isEqualTo(100_000_000L);
    assertThat(next.read("$.ending", Object.class)).isNull();
  }

  private void hireFails() throws Exception {
    DocumentContext company = json(mvc.perform(get("/api/company").cookie(session)));
    int applicant = company.read("$.applicants[0].id", Integer.class);
    postJson("/api/company/hires", "{\"applicantId\":%d,\"replace\":null}".formatted(applicant))
        .andExpect(status().isBadRequest());
  }
}
