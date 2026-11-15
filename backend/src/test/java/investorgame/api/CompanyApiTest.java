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

  /** 채용권으로 count명을 뽑는다 (decisions.md 312번). 지금까지 뽑은 횟수를 실어 보낸다. */
  private ResultActions drawRequest(int count, int draws) throws Exception {
    return postJson("/api/company/draws", "{\"count\":%d,\"draws\":%d}".formatted(count, draws));
  }

  private DocumentContext draw(int count) throws Exception {
    int draws = json(mvc.perform(get("/api/company").cookie(session))).read("$.gacha.draws");
    return json(drawRequest(count, draws).andExpect(status().isOk()));
  }

  /** 종목 회의에서 고른다. */
  private DocumentContext decide(String choice) throws Exception {
    return json(
        postJson("/api/company/invest", "{\"choice\":\"" + choice + "\"}")
            .andExpect(status().isOk()));
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
      // 분기 넘기기를 누르면 직원이 종목을 물어 올 수 있다 (267·382번): 회의가 열렸으면 지켜보고 넘긴다.
      Boolean ready =
          json(mvc.perform(post("/api/company/scout").cookie(session)).andExpect(status().isOk()))
              .read("$.invest.ready", Boolean.class);
      if (Boolean.TRUE.equals(ready)) {
        decide("BUY");
      }
      last = settle(year, q).andExpect(status().isOk());
    }
    return last;
  }

  /** 무기는 무기 뽑기권으로 뽑는다. 다 쓰면 400, 모자란 합성도 400 (decisions.md 366번). */
  @Test
  void 옛_무기는_진행중이거나_끝난_회사에서도_한번만_초기화한다() throws Exception {
    String id =
        json(mvc.perform(post("/api/company").cookie(session))).read("$.companyId", String.class);
    for (String state : List.of("ACTIVE", "ENDED")) {
      jdbc.sql(
              """
          UPDATE raising_company SET status = :status,
            state = state || CAST(:old AS jsonb)
          WHERE id = CAST(:id AS uuid)
          """)
          .param("status", state)
          .param("id", id)
          .param(
              "old",
              """
              {"weapons":[{"kind":"rifle","grade":"OBSOLETE","count":8}],
               "weapon":{"kind":"rifle","grade":"OBSOLETE","count":8},
               "weaponTickets":99,"weaponGachaReady":true,"closed":true}
              """)
          .update();
      for (int repeat = 0; repeat < 2; repeat++) {
        mvc.perform(get("/api/company").cookie(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.weapons.length()").value(1))
            .andExpect(jsonPath("$.weapons[0].grade").value("F"))
            .andExpect(jsonPath("$.weapons[0].kind").value("pistol"))
            .andExpect(jsonPath("$.armory.tickets").value(3));
      }
      assertThat(
              jdbc.sql(
                      "SELECT state->'weapon'->>'grade' FROM raising_company WHERE id = CAST(:id AS uuid)")
                  .param("id", id)
                  .query(String.class)
                  .single())
          .isEqualTo("F");
    }
  }

  @Test
  void 무기_뽑기권으로_무기를_뽑고_다_쓰면_400이다() throws Exception {
    DocumentContext opened =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    int tickets = opened.read("$.armory.tickets", Integer.class);
    assertThat(tickets).as("처음 무기 뽑기권").isPositive();
    assertThat(opened.read("$.armory.lastDraw", Object.class)).isNull();
    // 10연속 (517번): 열 장이 없으면 하나도 뽑지 않고, 열한 개는 받지 않는다.
    if (tickets < 10) {
      postJson("/api/company/weapon/draw", "{\"count\":10}").andExpect(status().isBadRequest());
      postJson("/api/company/cat/draw", "{\"count\":10}").andExpect(status().isBadRequest());
    }
    postJson("/api/company/weapon/draw", "{\"count\":11}").andExpect(status().isBadRequest());
    postJson("/api/company/weapon/draw", "{\"count\":0}").andExpect(status().isBadRequest());
    assertThat(opened.read("$.weapons[0].count", Integer.class)).isEqualTo(1);
    DocumentContext drawn = opened;
    for (int i = 0; i < tickets; i++) {
      drawn = json(postJson("/api/company/weapon/draw", "").andExpect(status().isOk()));
    }
    assertThat(drawn.read("$.armory.tickets", Integer.class)).isZero();
    assertThat(drawn.read("$.armory.lastDraw.grade", String.class))
        .isIn("F", "E", "D", "C", "B", "A", "S");
    List<Integer> counts = drawn.read("$.weapons[*].count");
    assertThat(counts.stream().mapToInt(Integer::intValue).sum())
        .as("처음 권총 하나 + 뽑은 수")
        .isEqualTo(1 + tickets);
    postJson("/api/company/weapon/draw", "").andExpect(status().isBadRequest());
    // 모자란 합성: 뽑기 운에 따라 같은 무기 둘이 나올 수 있으니(그러면 합성이 된다) 하나도 없는 종류·등급을 고른다.
    List<java.util.Map<String, Object>> weapons = drawn.read("$.weapons[*]");
    List<String> have = weapons.stream().map(w -> w.get("kind") + "/" + w.get("grade")).toList();
    String missing =
        java.util.stream.Stream.of("pistol", "revolver", "smg", "shotgun", "rifle")
            .flatMap(
                k -> java.util.stream.Stream.of("F", "E", "D", "C", "B", "A").map(g -> k + "/" + g))
            .filter(kg -> !have.contains(kg))
            .findFirst()
            .orElseThrow();
    String[] kg = missing.split("/");
    postJson(
            "/api/company/weapon/merge",
            "{\"kind\":\"%s\",\"grade\":\"%s\"}".formatted(kg[0], kg[1]))
        .andExpect(status().isBadRequest());
  }

  /**
   * 자본으로 사는 전투 강화 (decisions.md 367·394번): 공격력·연사·체력(410번) 셋, 최대 단계 없이 한 단계에 1%. 꾹 눌러 모은 단계는
   * levels로 묶어 사고, 자본이 닿는 데까지만 산다. 고양이 속도는 없다. 쓴 돈은 분기 실적의 전투 강화 비용 줄에 나온다.
   */
  @Test
  void 고양이는_뽑기권으로_뽑아_출전시키고_가진_무기를_들린다() throws Exception {
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated());
    DocumentContext opened = json(mvc.perform(get("/api/company").cookie(session)));
    List<Integer> levels = opened.read("$.idle.cats[*].level");
    assertThat(levels).as("고양이는 벽을 돌파해도 저절로 오지 않는다 (488번)").containsOnly(0).hasSize(6);
    int tickets = opened.read("$.armory.tickets", Integer.class);
    long capital = opened.read("$.capital", Long.class);
    postJson("/api/company/cat/field", "{\"code\":\"sky\",\"fielded\":true}")
        .andExpect(status().isBadRequest());

    DocumentContext drawn = json(postJson("/api/company/cat/draw", "").andExpect(status().isOk()));
    assertThat(drawn.read("$.armory.tickets", Integer.class))
        .as("무기와 같은 뽑기권 한 장 (493번)")
        .isEqualTo(tickets - 1);
    assertThat(drawn.read("$.capital", Long.class)).isEqualTo(capital);
    List<Map<String, Object>> cats = drawn.read("$.idle.cats[?(@.level == 1)]");
    assertThat(cats).as("새 고양이는 바로 출전한다").hasSize(1);
    assertThat(cats.getFirst()).containsEntry("fielded", true);
    String code = (String) cats.getFirst().get("code");

    DocumentContext rested =
        json(
            postJson(
                    "/api/company/cat/field", "{\"code\":\"%s\",\"fielded\":false}".formatted(code))
                .andExpect(status().isOk()));
    List<Boolean> fielded = rested.read("$.idle.cats[*].fielded");
    assertThat(fielded).containsOnly(false);

    // 사장냥이 든 하나뿐인 권총은 못 가져간다. 종류만 보내거나 없는 고양이도 400.
    postJson(
            "/api/company/cat/weapon",
            "{\"code\":\"%s\",\"kind\":\"pistol\",\"grade\":\"F\"}".formatted(code))
        .andExpect(status().isBadRequest());
    postJson("/api/company/cat/weapon", "{\"code\":\"%s\",\"kind\":\"pistol\"}".formatted(code))
        .andExpect(status().isBadRequest());
    postJson("/api/company/cat/weapon", "{\"code\":\"dog\"}").andExpect(status().isBadRequest());
    DocumentContext bare =
        json(
            postJson("/api/company/cat/weapon", "{\"code\":\"%s\"}".formatted(code))
                .andExpect(status().isOk()));
    List<Object> weapons = bare.read("$.idle.cats[*].weapon");
    assertThat(weapons).containsOnlyNulls();
  }

  /** 데리고 있을 자리가 차면 내보내야 뽑는다. 인사팀이 뽑기를 돕는다 (decisions.md 312번, 6.3절). 직원 합성은 384번에서 뺐다. */
  @Test
  void 내보내고_인사팀이_뽑기를_돕는다() throws Exception {
    json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    DocumentContext five = draw(5);
    List<Integer> ids = five.read("$.employees[*].id");
    assertThat(ids).hasSize(5);
    assertThat(five.read("$.gacha.roster", Integer.class)).isEqualTo(5);
    assertThat(five.read("$.gacha.tickets", Integer.class)).isEqualTo(5);

    DocumentContext released =
        json(
            postJson("/api/company/release", "{\"employeeId\":%d}".formatted(ids.get(4)))
                .andExpect(status().isOk()));
    assertThat(released.read("$.gacha.roster", Integer.class)).isEqualTo(4);
    List<String> kinds = released.read("$.history.timeline[*].kind");
    assertThat(kinds).contains("left");
    postJson("/api/company/release", "{\"employeeId\":%d}".formatted(ids.get(4)))
        .andExpect(status().isBadRequest());

    DocumentContext placed =
        json(
            postJson(
                    "/api/company/placement",
                    "{\"seats\":[{\"employeeId\":" + ids.get(0) + ",\"desk\":\"hr\"}]}")
                .andExpect(status().isOk()));
    assertThat(placed.read("$.meeting.hrCap", String.class)).isNotBlank();
  }

  /** 배치에 같은 직원이 두 번 오면 400이다 (#317, decisions.md 254번). 전에는 뒤의 것이 조용히 덮었다. */
  @Test
  void 배치에_같은_직원이_두_번_오면_400이다() throws Exception {
    DocumentContext company =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    assertThat(company.read("$.gacha.tickets", Integer.class)).isPositive();
    int id = draw(1).read("$.employees[0].id");
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

  /** 돕는 자리는 회사가 커 가며 열린다 (#393): 반지하(F)에는 돈을 굴리는 자리만 있고, 닫힌 자리는 열리는 등급과 함께 따로 보인다. */
  @Test
  void 돕는_자리는_회사가_커_가며_열린다() throws Exception {
    DocumentContext opened =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    List<String> desks = opened.read("$.desks[*].code");
    assertThat(desks).contains("bio", "day").doesNotContain("research", "scout", "risk", "hr");
    List<String> locked = opened.read("$.lockedDesks[*].code");
    assertThat(locked).containsExactlyInAnyOrder("research", "scout", "risk", "hr");
    List<String> researchAt = opened.read("$.lockedDesks[?(@.code == 'research')].unlockGrade");
    assertThat(researchAt).containsExactly("E");
  }

  /** 접속할 때마다 같은 토큰의 쿠키를 새 만료(30일)로 다시 내린다: 마지막 접속부터 30일이 흐른다 (decisions.md 311번). */
  @Test
  void 접속할_때마다_세션_쿠키를_30일로_다시_내린다() throws Exception {
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated());

    Cookie renewed =
        mvc.perform(get("/api/company").cookie(session))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getCookie(SessionCookies.NAME);
    assertThat(renewed).as("이어 하기 요청도 쿠키를 다시 내린다").isNotNull();
    assertThat(renewed.getValue()).as("같은 세션").isEqualTo(session.getValue());
    assertThat(renewed.getMaxAge()).isEqualTo(30 * 24 * 60 * 60);
    assertThat(renewed.isHttpOnly()).isTrue();

    Cookie ensured =
        mvc.perform(post("/api/sessions").cookie(session))
            .andExpect(status().isNoContent())
            .andReturn()
            .getResponse()
            .getCookie(SessionCookies.NAME);
    assertThat(ensured).as("유효한 세션이면 새로 발급하지 않고 만료만 늘린다").isNotNull();
    assertThat(ensured.getValue()).isEqualTo(session.getValue());
  }
}
