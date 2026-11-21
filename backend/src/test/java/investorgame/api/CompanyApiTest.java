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
            .andExpect(jsonPath("$.diamonds.amount").value(1000));
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
  void 첫_출근은_환영부터_시작하고_건너뛰기와_즉시수령을_허용하지_않는다() throws Exception {
    mvc.perform(post("/api/company").cookie(session))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.idle.onboarding.step").value(-1));
    for (String action : List.of("skip", "claim", "draw-cat", "draw-weapon")) {
      postJson("/api/company/idle/tutorial", "{\"action\":\"" + action + "\",\"step\":-1}")
          .andExpect(status().isBadRequest());
    }
    postJson("/api/company/idle/tutorial", "{\"action\":\"next\",\"step\":-1}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.idle.onboarding.step").value(0));
    mvc.perform(get("/api/company").cookie(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.idle.onboarding.catClaimed").value(false))
        .andExpect(jsonPath("$.idle.onboarding.weaponClaimed").value(false));
  }

  /** 고유 스킬 장착 (587번)과 광고 스킬 (588번). */
  @Test
  void 고유_스킬은_장착한_것만_쓰고_광고_스킬은_광고를_본_뒤에_쓴다() throws Exception {
    mvc.perform(post("/api/company").cookie(session))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.idle.activeSlots").value(3))
        .andExpect(jsonPath("$.idle.actives.length()").value(9))
        .andExpect(jsonPath("$.idle.actives[1].code").value("rally"))
        .andExpect(jsonPath("$.idle.actives[1].equipped").value(true))
        .andExpect(jsonPath("$.idle.actives[1].ad").value(false))
        // 상한가·손절·물타기 (591번)는 장착하지 않은 채로 시작한다.
        .andExpect(jsonPath("$.idle.actives[4].code").value("stopLoss"))
        .andExpect(jsonPath("$.idle.actives[4].equipped").value(false))
        .andExpect(jsonPath("$.idle.actives[4].ad").value(false))
        .andExpect(jsonPath("$.idle.actives[6].code").value("boostFire"))
        .andExpect(jsonPath("$.idle.actives[6].equipped").value(false))
        .andExpect(jsonPath("$.idle.actives[6].ad").value(true));
    // 100벽을 아직 돌파하지 않은 계정은 서버에서도 차단한다.
    postJson("/api/company/idle/active", "{\"code\":\"rally\"}").andExpect(status().isBadRequest());
    jdbc.sql(
            "UPDATE raising_company SET state = jsonb_set(state, '{idle}', '{\"best\":100}'::jsonb) WHERE id = CAST(:id AS uuid)")
        .param(
            "id",
            json(mvc.perform(get("/api/company").cookie(session)))
                .read("$.companyId", String.class))
        .update();
    // 뺀 고유 스킬은 쓸 수 없다. 광고 스킬은 장착할 수 없다.
    postJson("/api/company/idle/active/equip", "{\"code\":\"rally\",\"equipped\":false}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.idle.actives[1].equipped").value(false));
    postJson("/api/company/idle/active", "{\"code\":\"rally\"}").andExpect(status().isBadRequest());
    postJson("/api/company/idle/active/equip", "{\"code\":\"boostFire\",\"equipped\":true}")
        .andExpect(status().isBadRequest());
    postJson("/api/company/idle/active/equip", "{\"code\":\"rally\"}")
        .andExpect(status().isBadRequest());
    postJson("/api/company/idle/active/equip", "{\"code\":\"rally\",\"equipped\":true}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.idle.actives[1].equipped").value(true));
    postJson("/api/company/idle/active", "{\"code\":\"rally\"}").andExpect(status().isOk());
    // 새 고유 스킬은 칸이 꽉 차면 장착하지 못하고, 하나를 빼고 장착하면 쓴다 (591번).
    postJson("/api/company/idle/active/equip", "{\"code\":\"stopLoss\",\"equipped\":true}")
        .andExpect(status().isBadRequest());
    postJson("/api/company/idle/active/equip", "{\"code\":\"fortify\",\"equipped\":false}")
        .andExpect(status().isOk());
    postJson("/api/company/idle/active/equip", "{\"code\":\"stopLoss\",\"equipped\":true}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.idle.actives[4].equipped").value(true));
    postJson("/api/company/idle/active", "{\"code\":\"stopLoss\"}").andExpect(status().isOk());
    // 광고 스킬은 ad가 참이어야 한다: 180초 동안 하나만 쓰고, 끝나면 다시 선택한다.
    postJson("/api/company/idle/active", "{\"code\":\"boostFire\"}")
        .andExpect(status().isBadRequest());
    postJson("/api/company/idle/active", "{\"code\":\"boostFire\",\"ad\":true}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.idle.actives[6].left").value(180.0))
        .andExpect(jsonPath("$.idle.actives[6].readyIn").value(180.0));
    postJson("/api/company/idle/active", "{\"code\":\"boostFire\",\"ad\":true}")
        .andExpect(status().isBadRequest());
    postJson("/api/company/idle/active", "{\"code\":\"boostBuy\",\"ad\":true}")
        .andExpect(status().isBadRequest());
    postJson("/api/company/idle/active", "{\"code\":\"boostDamage\",\"ad\":true}")
        .andExpect(status().isBadRequest());
  }

  @Test
  void 사장냥의_무기를_빼고_다시_든다() throws Exception {
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated());
    // kind와 grade를 함께 비우면 뺀다 (585번). 하나만 비우면 400.
    postJson("/api/company/weapon", "{}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.weapons[0].equipped").value(false))
        .andExpect(jsonPath("$.weapons[0].count").value(1));
    postJson("/api/company/weapon", "{\"kind\":\"pistol\"}").andExpect(status().isBadRequest());
    // 다시 불러와도 빈손 그대로다.
    mvc.perform(get("/api/company").cookie(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.weapons[0].equipped").value(false));
    postJson("/api/company/weapon", "{\"kind\":\"pistol\",\"grade\":\"F\"}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.weapons[0].equipped").value(true));
  }

  @Test
  void 광고_뽑기는_종류별_하루_세번이고_다이아를_쓰지_않는다() throws Exception {
    DocumentContext opened =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    String id = opened.read("$.companyId", String.class);
    assertThat(opened.read("$.adDraws.catLeft", Integer.class)).isEqualTo(3);
    for (String kind : List.of("cat", "weapon")) {
      for (int i = 0; i < 3; i++) {
        postJson("/api/company/" + kind + "/draw", "{\"ad\":true}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.diamonds.amount").value(1000))
            .andExpect(jsonPath("$.adDraws." + kind + "Left").value(2 - i));
      }
      postJson("/api/company/" + kind + "/draw", "{\"ad\":true}")
          .andExpect(status().isBadRequest());
      postJson("/api/company/" + kind + "/draw", "{\"count\":10,\"ad\":true}")
          .andExpect(status().isBadRequest());
    }
    postJson("/api/company/cat/draw", "{\"ad\":false}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.diamonds.amount").value(900))
        .andExpect(jsonPath("$.adDraws.catLeft").value(0));
    // 회사를 새로 만들어도 같은 세션의 광고 횟수는 그대로다.
    jdbc.sql("DELETE FROM raising_company WHERE id = CAST(:id AS uuid)").param("id", id).update();
    mvc.perform(post("/api/company").cookie(session))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.adDraws.catLeft").value(0));
    postJson("/api/company/cat/draw", "{\"ad\":true}").andExpect(status().isBadRequest());
  }

  @Test
  void 동시에_광고_뽑기를_요청해도_세번만_지급한다() throws Exception {
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated());
    try (var pool = java.util.concurrent.Executors.newFixedThreadPool(6)) {
      var requests =
          java.util.stream.IntStream.range(0, 6)
              .<java.util.concurrent.Callable<Integer>>mapToObj(
                  i ->
                      () ->
                          postJson("/api/company/cat/draw", "{\"ad\":true}")
                              .andReturn()
                              .getResponse()
                              .getStatus())
              .toList();
      var results = pool.invokeAll(requests);
      int success = 0;
      for (var result : results) {
        int status = result.get();
        assertThat(status).isIn(200, 400);
        if (status == 200) success++;
      }
      assertThat(success).isEqualTo(3);
    }
  }

  @Test
  void 다이아로_무기를_뽑고_다_쓰면_400이다() throws Exception {
    DocumentContext opened =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    // 새 회사는 다이아 1,000으로 시작한다.
    assertThat(opened.read("$.diamonds.amount", Long.class)).isEqualTo(1000);
    assertThat(opened.read("$.diamonds.draw", Long.class)).isEqualTo(100);
    assertThat(opened.read("$.diamonds.tenDraw", Long.class)).isEqualTo(1000);
    assertThat(opened.read("$.diamonds.tenCount", Integer.class)).isEqualTo(11);
    assertThat(opened.read("$.diamonds.hire", Long.class)).isEqualTo(100);
    assertThat(opened.read("$.armory.lastDraw", Object.class)).isNull();
    postJson("/api/company/weapon/draw", "{\"count\":11}").andExpect(status().isBadRequest());
    postJson("/api/company/weapon/draw", "{\"count\":0}").andExpect(status().isBadRequest());
    assertThat(opened.read("$.weapons[0].count", Integer.class)).isEqualTo(1);
    // 한 번에 100.
    DocumentContext one = json(postJson("/api/company/weapon/draw", "").andExpect(status().isOk()));
    assertThat(one.read("$.diamonds.amount", Long.class)).isEqualTo(900);
    // 연속 뽑기(639·640번)는 그 수만큼의 다이아가 있어야 한다: 900으로 10회는 하나도 뽑지 않고 400.
    postJson("/api/company/weapon/draw", "{\"count\":10}").andExpect(status().isBadRequest());
    postJson("/api/company/cat/draw", "{\"count\":10}").andExpect(status().isBadRequest());
    // 5회 연속: 500에 다섯 개. 덤은 10회에만 붙는다.
    DocumentContext five =
        json(postJson("/api/company/weapon/draw", "{\"count\":5}").andExpect(status().isOk()));
    assertThat(five.read("$.diamonds.amount", Long.class)).isEqualTo(400);
    List<Object> fiveDraws = five.read("$.armory.lastDraws[*]");
    assertThat(fiveDraws).hasSize(5);
    jdbc.sql(
            "UPDATE raising_company SET state = jsonb_set(state, '{diamonds}', '1000')"
                + " WHERE id = CAST(:id AS uuid)")
        .param("id", opened.read("$.companyId", String.class))
        .update();
    // 10회 연속: 1,000에 열한 개가 한꺼번에 나온다.
    DocumentContext ten =
        json(postJson("/api/company/weapon/draw", "{\"count\":10}").andExpect(status().isOk()));
    assertThat(ten.read("$.diamonds.amount", Long.class)).isZero();
    List<Object> tenDraws = ten.read("$.armory.lastDraws[*]");
    assertThat(tenDraws).hasSize(11);
    List<Integer> tenCounts = ten.read("$.weapons[*].count");
    assertThat(tenCounts.stream().mapToInt(Integer::intValue).sum()).isEqualTo(18);
    jdbc.sql(
            "UPDATE raising_company SET state = jsonb_set(state, '{diamonds}', '1000')"
                + " WHERE id = CAST(:id AS uuid)")
        .param("id", opened.read("$.companyId", String.class))
        .update();
    DocumentContext drawn = one;
    for (int i = 0; i < 10; i++) {
      drawn = json(postJson("/api/company/weapon/draw", "").andExpect(status().isOk()));
    }
    assertThat(drawn.read("$.diamonds.amount", Long.class)).isZero();
    List<Object> last = drawn.read("$.armory.lastDraws[*]");
    assertThat(last).hasSize(1);
    List<Integer> counts = drawn.read("$.weapons[*].count");
    assertThat(counts.stream().mapToInt(Integer::intValue).sum()).isEqualTo(28);
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
  void 고양이는_다이아로_뽑아_출전시키고_가진_무기를_들린다() throws Exception {
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated());
    DocumentContext opened = json(mvc.perform(get("/api/company").cookie(session)));
    List<Integer> levels = opened.read("$.idle.cats[*].level");
    assertThat(levels).as("고양이는 벽을 돌파해도 저절로 오지 않는다 (488번)").containsOnly(0).hasSize(39);
    long diamonds = opened.read("$.diamonds.amount", Long.class);
    long capital = opened.read("$.capital", Long.class);
    postJson("/api/company/cat/field", "{\"code\":\"sky\",\"fielded\":true}")
        .andExpect(status().isBadRequest());

    DocumentContext drawn = json(postJson("/api/company/cat/draw", "").andExpect(status().isOk()));
    assertThat(drawn.read("$.diamonds.amount", Long.class))
        .as("무기와 같은 값: 다이아 100 (526번)")
        .isEqualTo(diamonds - 100);
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

  /** 분기·결산 없이 직원마다 초당 돈을 번다 (decisions.md 523번). */
  @Test
  void 회사를_차리고_직원을_뽑으면_초당_수입이_보이고_분기와_결산은_없다() throws Exception {
    mvc.perform(post("/api/company").cookie(session))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.year").doesNotExist())
        .andExpect(jsonPath("$.quarter").doesNotExist())
        .andExpect(jsonPath("$.status").doesNotExist())
        .andExpect(jsonPath("$.broke").doesNotExist())
        .andExpect(jsonPath("$.lastQuarter").doesNotExist())
        .andExpect(jsonPath("$.lastSettlement").doesNotExist())
        .andExpect(jsonPath("$.meetings.chances").value(1))
        .andExpect(jsonPath("$.meetings.max").value(3))
        .andExpect(jsonPath("$.idle.income.staffPerSecond").value(0))
        .andExpect(jsonPath("$.idle.offline").doesNotExist());
    // 회사는 세션마다 하나고 끝나지 않는다: 다시 차릴 수 없다.
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isBadRequest());

    DocumentContext hired = draw(2);
    List<Number> incomes = hired.read("$.employees[*].incomePerSecond");
    assertThat(incomes).hasSize(2).allMatch(income -> income.doubleValue() > 0);
    double staff = hired.read("$.idle.income.staffPerSecond", Double.class);
    // 화면 값은 소수를 버린 수라 직원마다 버린 몫만큼(직원 수 미만) 어긋날 수 있다.
    assertThat(staff)
        .isCloseTo(
            incomes.stream().mapToDouble(Number::doubleValue).sum(),
            org.assertj.core.data.Offset.offset(2.0));
    assertThat(hired.read("$.idle.income.perSecond", Double.class)).isGreaterThan(staff);

    // 접속 신호: 시작하고 한 번 보내면 그 사이의 수입이 자본에 들어온다(줄지 않는다).
    double before = hired.read("$.capital", Double.class);
    String run = java.util.UUID.randomUUID().toString();
    postJson(
            "/api/company/idle",
            "{\"runId\":\"%s\",\"sequence\":0,\"action\":\"start\",\"hits\":[]}".formatted(run))
        .andExpect(status().isOk());
    DocumentContext beat =
        json(
            postJson(
                    "/api/company/idle",
                    "{\"runId\":\"%s\",\"sequence\":1,\"action\":\"tick\",\"hits\":[]}"
                        .formatted(run))
                .andExpect(status().isOk()));
    assertThat(beat.read("$.capital", Double.class)).isGreaterThanOrEqualTo(before);

    // 없앤 길: 분기 넘기기·종목 발굴·분기 멘탈 전투.
    postJson("/api/company/settle", "{\"year\":1,\"quarter\":1}")
        .andExpect(status().is4xxClientError());
    mvc.perform(post("/api/company/scout").cookie(session)).andExpect(status().is4xxClientError());
    postJson("/api/company/mental", "{}").andExpect(status().is4xxClientError());
  }

  /** 파산·엔딩·시대의 끝으로 멈췄던 회사도 되살려 이어서 한다 (523번). */
  @Test
  void 끝났던_옛_회사는_자본과_직원을_지킨_채_되살아난다() throws Exception {
    String id =
        json(mvc.perform(post("/api/company").cookie(session))).read("$.companyId", String.class);
    draw(2);
    jdbc.sql(
            """
        UPDATE raising_company SET status = 'ENDED',
          state = state || CAST(:old AS jsonb)
        WHERE id = CAST(:id AS uuid)
        """)
        .param("id", id)
        .param(
            "old",
            """
            {"realtime":false,"closed":true,"finished":true,"year":4,"quarter":3,"capital":777000000,
             "phase":"crash","crashQuarter":3,"quarters":[{"year":4,"quarter":1}],
             "settlements":[{"year":3}],"meetingAt":0,"meetingChances":0}
            """)
        .update();
    mvc.perform(get("/api/company").cookie(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.companyId").value(id))
        .andExpect(jsonPath("$.capital").value(777000000))
        .andExpect(jsonPath("$.employees.length()").value(2))
        .andExpect(jsonPath("$.meetings.chances").value(1))
        .andExpect(jsonPath("$.year").doesNotExist());
    assertThat(
            jdbc.sql("SELECT status FROM raising_company WHERE id = CAST(:id AS uuid)")
                .param("id", id)
                .query(String.class)
                .single())
        .isEqualTo("ACTIVE");
    assertThat(
            jdbc.sql(
                    """
                SELECT jsonb_exists(state, 'quarters') OR jsonb_exists(state, 'settlements')
                  OR jsonb_exists(state, 'quarter')
                FROM raising_company WHERE id = CAST(:id AS uuid)
                """)
                .param("id", id)
                .query(Boolean.class)
                .single())
        .as("분기·결산 기록은 저장에서 사라진다")
        .isFalse();
    // 되살아난 회사로 이어서 한다: 뽑기도 된다.
    draw(1);
  }

  @Test
  void 전투_강화를_묶어_사고_자본이_닿는_데까지만_오른다() throws Exception {
    String id =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()))
            .read("$.companyId", String.class);
    DocumentContext opened = json(mvc.perform(get("/api/company").cookie(session)));
    List<String> kinds = opened.read("$.battleUpgrades[*].kind");
    assertThat(kinds).containsExactly("damage", "fire", "hp", "buy");
    assertThat(opened.read("$.battleUpgrades[0].level", Integer.class)).isZero();
    assertThat(opened.read("$.battleUpgrades[0].price", Long.class)).isEqualTo(1_000_000L);
    assertThat(opened.read("$.battleUpgrades[0].nextBonusPercent", Integer.class)).isEqualTo(1);
    assertThat(opened.read("$.battleUpgrades[0].maxLevel", Integer.class))
        .as("공격력은 끝없이 산다")
        .isZero();
    assertThat(opened.read("$.battleUpgrades[1].maxLevel", Integer.class))
        .as("연사는 100%(100단계)에서 멈춘다 (487·640번)")
        .isEqualTo(100);
    long capital = opened.read("$.capital", Long.class);

    DocumentContext one =
        json(
            postJson("/api/company/battle-upgrade", "{\"kind\":\"damage\"}")
                .andExpect(status().isOk()));
    assertThat(one.read("$.battleUpgrades[0].level", Integer.class)).isEqualTo(1);
    assertThat(one.read("$.capital", Long.class)).isEqualTo(capital - 1_000_000L);
    DocumentContext five =
        json(
            postJson("/api/company/battle-upgrade", "{\"kind\":\"fire\",\"levels\":5}")
                .andExpect(status().isOk()));
    assertThat(five.read("$.battleUpgrades[1].level", Integer.class)).isEqualTo(5);
    assertThat(five.read("$.battleUpgrades[1].bonusPercent", Integer.class)).isEqualTo(5);
    long spent = capital - five.read("$.capital", Long.class);
    assertThat(spent).as("1b + 연사 다섯 단계").isGreaterThan(6_000_000L).isLessThan(7_000_000L);

    postJson("/api/company/battle-upgrade", "{\"kind\":\"speed\"}")
        .andExpect(status().isBadRequest());
    postJson("/api/company/battle-upgrade", "{\"kind\":\"fire\",\"levels\":0}")
        .andExpect(status().isBadRequest());
    postJson("/api/company/battle-upgrade", "{\"kind\":\"fire\",\"levels\":101}")
        .andExpect(status().isBadRequest());

    // 자본이 닿는 데까지만 산다: 한 단계 값(1b) 반 남짓이면 열 단계를 보내도 한 단계만 오르고, 바닥이면 400.
    jdbc.sql(
            "UPDATE raising_company SET state = jsonb_set(state, '{capital}', '1500000')"
                + " WHERE id = CAST(:id AS uuid)")
        .param("id", id)
        .update();
    DocumentContext partial =
        json(
            postJson("/api/company/battle-upgrade", "{\"kind\":\"damage\",\"levels\":10}")
                .andExpect(status().isOk()));
    assertThat(partial.read("$.battleUpgrades[0].level", Integer.class)).isEqualTo(2);
    assertThat(partial.read("$.capital", Long.class)).isEqualTo(1_500_000L - 1_040_000L);
    postJson("/api/company/battle-upgrade", "{\"kind\":\"damage\"}")
        .andExpect(status().isBadRequest());
  }

  /**
   * 랜드마크 타워 (decisions.md 276·296·374번): 건물은 저절로 오르지 않고 이사 비용을 내고 올라간다. Z(자본 100조 원)로 이사해도 엔딩 없이 축하
   * 한 줄과 연표만 남고, 회사는 ZZ로 이어 간다. 옛 엔딩으로 멈췄던 회사도 다시 움직인다.
   */
  @Test
  void 랜드마크_타워에_올라도_엔딩_없이_이어_간다() throws Exception {
    String id =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()))
            .read("$.companyId", String.class);
    // 돈이 모자라면 못 간다: 반지하(F)에서 상가(E)로 가려면 2억 5천만이 있어야 한다.
    postJson("/api/company/upgrade", "{}").andExpect(status().isBadRequest());
    jdbc.sql(
            "UPDATE raising_company SET state = jsonb_set(state, '{capital}', '200000000000000')"
                + " WHERE id = CAST(:id AS uuid)")
        .param("id", id)
        .update();
    // 자본이 넉넉해도 건물은 저절로 오르지 않는다 (296번).
    DocumentContext rich = json(mvc.perform(get("/api/company").cookie(session)));
    assertThat(rich.read("$.grade", String.class)).isEqualTo("F");
    assertThat(rich.read("$.upgrade.affordable", Boolean.class)).isTrue();
    assertThat(rich.read("$.upgrade.to", String.class)).isEqualTo("E");
    assertThat(rich.read("$.upgrade.cost", Long.class)).isEqualTo(18_000_000L);
    // 이사 비용을 내며 한 단계씩 Z까지 올라간다. 공사 기간 없이 누를 때마다 바로 옮긴다 (405번).
    DocumentContext moved = json(mvc.perform(get("/api/company").cookie(session)));
    for (int i = 0; i < 60 && !"Z".equals(moved.read("$.grade", String.class)); i++) {
      String to = moved.read("$.upgrade.to", String.class);
      moved = json(postJson("/api/company/upgrade", "{}").andExpect(status().isOk()));
      assertThat(moved.read("$.grade", String.class)).isEqualTo(to);
    }
    assertThat(moved.read("$.grade", String.class)).isEqualTo("Z");
    Map<String, Object> company = moved.read("$");
    assertThat(company).doesNotContainKey("ending");
    assertThat(moved.read("$.upgrade.to", String.class)).as("Z 다음 건물").isEqualTo("ZZ");
    List<?> kinds = moved.read("$.history.timeline[*].kind");
    assertThat(kinds.stream().map(String::valueOf)).contains("grow", "ending");
    // 회사는 멈추지 않는다: 계속 뽑는다.
    DocumentContext after = json(mvc.perform(get("/api/company").cookie(session)));
    drawRequest(1, after.read("$.gacha.draws", Integer.class)).andExpect(status().isOk());
  }

  /** 종목회의는 기회를 써서 연다 (523번): 새 회사는 한 번을 가지고 시작한다. */
  @Test
  void 종목회의는_기회_하나를_써서_열고_정하면_바로_자본에_들어간다() throws Exception {
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated());
    // 직원이 없으면 열 수 없고 기회도 쓰지 않는다.
    mvc.perform(post("/api/company/invest/open").cookie(session))
        .andExpect(status().isBadRequest());
    // 뽑은 직원은 바로 돈을 굴리는 자리에 앉는다 (524번): 배치하지 않아도 회의를 연다.
    DocumentContext hired = draw(1);
    assertThat(hired.read("$.employees[0].desk", String.class)).isEqualTo("semiconductor");
    assertThat(hired.read("$.meetings.chances", Integer.class)).isEqualTo(1);
    // 없앤 길: 배치·팀장·내보내기.
    postJson("/api/company/placement", "{\"seats\":[]}").andExpect(status().is4xxClientError());
    postJson("/api/company/leader", "{\"desk\":\"day\",\"employeeId\":1}")
        .andExpect(status().is4xxClientError());
    postJson("/api/company/release", "{\"employeeId\":1}").andExpect(status().is4xxClientError());

    DocumentContext opened =
        json(
            mvc.perform(post("/api/company/invest/open").cookie(session))
                .andExpect(status().isOk()));
    assertThat(opened.read("$.meetings.chances", Integer.class)).isZero();
    assertThat(opened.read("$.meetings.nextSeconds", Long.class)).isBetween(1L, 3600L);
    assertThat(opened.read("$.invest.ready", Boolean.class)).isTrue();
    assertThat(opened.read("$.invest.convened", Boolean.class)).isTrue();
    String title = opened.read("$.invest.title", String.class);
    // 정하지 않은 회의가 있으면 다시 열어도 그 회의다.
    mvc.perform(post("/api/company/invest/open").cookie(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.invest.title").value(title))
        .andExpect(jsonPath("$.meetings.chances").value(0));

    DocumentContext decided = decide("BUY");
    assertThat(decided.read("$.invest.outcome", Object.class)).isNotNull();
    assertThat(decided.read("$.capital", Double.class)).isGreaterThanOrEqualTo(0);
    // 기회가 없으면 다음 회의는 아직 못 연다.
    mvc.perform(post("/api/company/invest/open").cookie(session))
        .andExpect(status().isBadRequest());
  }

  /** 출석 보상 (decisions.md 528번): 하루에 한 번. */
  @Test
  void 출석_보상은_하루에_한_번_받는다() throws Exception {
    DocumentContext opened =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    assertThat(opened.read("$.attendance.claimable", Boolean.class)).isTrue();
    assertThat(opened.read("$.attendance.today", Integer.class)).isEqualTo(1);
    List<Integer> board = opened.read("$.attendance.board[*].diamonds");
    assertThat(board).containsExactly(50, 50, 100, 50, 100, 100, 300);
    long diamonds = opened.read("$.diamonds.amount", Long.class);
    DocumentContext claimed =
        json(
            mvc.perform(post("/api/company/attendance").cookie(session))
                .andExpect(status().isOk()));
    assertThat(claimed.read("$.diamonds.amount", Long.class)).isEqualTo(diamonds + 50);
    assertThat(claimed.read("$.attendance.claimable", Boolean.class)).isFalse();
    assertThat(claimed.read("$.attendance.board[0].claimed", Boolean.class)).isTrue();
    assertThat(claimed.read("$.attendance.lastReward.diamonds", Long.class)).isEqualTo(50);
    mvc.perform(post("/api/company/attendance").cookie(session)).andExpect(status().isBadRequest());
    // 본 게임에서는 날짜를 넘기는 길이 없다.
    mvc.perform(post("/api/sandbox/next-day").cookie(session)).andExpect(status().isBadRequest());
  }

  /** 금고 도전 (decisions.md 641번): 보스전 피해량으로 금괴를 받고, 던전은 카드를 고른 뒤 깨고, 금괴로 산다. */
  @Test
  void 금고_도전은_금괴를_주고_금고_상점에서_쓴다() throws Exception {
    DocumentContext opened =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    assertThat(opened.read("$.vault.gold", Long.class)).isZero();
    assertThat(opened.read("$.vault.boss.seconds", Integer.class)).isEqualTo(60);
    assertThat(opened.<List<String>>read("$.vault.boss.weakSkills[*].code")).hasSize(4);
    assertThat(opened.<List<String>>read("$.vault.boss.resistSkills[*].code")).hasSize(4);
    assertThat(opened.<List<String>>read("$.vault.boss.rivals[*].code")).hasSize(4);
    assertThat(opened.read("$.vault.dungeon.cleared", Integer.class)).isZero();
    List<String> offers = opened.read("$.vault.dungeon.offers[*].code");
    assertThat(offers).hasSize(3);
    // 보스전: 피해량 100은 6등급(문턱 10에서 1.5배씩, 75.9 이상 113.9 미만)이고 등급마다 금괴 3이다.
    DocumentContext boss =
        json(postJson("/api/company/vault/boss", "{\"damage\":100}").andExpect(status().isOk()));
    assertThat(boss.read("$.vault.boss.tier", Integer.class)).isEqualTo(6);
    assertThat(boss.read("$.vault.boss.tierName", String.class)).isEqualTo("브론즈 6");
    assertThat(boss.read("$.vault.gold", Long.class)).isEqualTo(18);
    postJson("/api/company/vault/boss", "{\"damage\":-1}").andExpect(status().isBadRequest());
    postJson("/api/company/vault/boss", "{}").andExpect(status().isBadRequest());
    // 던전: 카드를 고르기 전에는 깰 수 없다.
    postJson("/api/company/vault/floor", "{\"floor\":1}").andExpect(status().isBadRequest());
    postJson("/api/company/vault/card", "{\"code\":\"nothing\"}")
        .andExpect(status().isBadRequest());
    DocumentContext picked =
        json(
            postJson("/api/company/vault/card", "{\"code\":\"" + offers.getFirst() + "\"}")
                .andExpect(status().isOk()));
    assertThat(picked.<List<String>>read("$.vault.dungeon.cards[*].code"))
        .containsExactly(offers.getFirst());
    assertThat(picked.<List<String>>read("$.vault.dungeon.offers[*].code")).isEmpty();
    postJson("/api/company/vault/floor", "{\"floor\":2}").andExpect(status().isBadRequest());
    DocumentContext cleared =
        json(postJson("/api/company/vault/floor", "{\"floor\":1}").andExpect(status().isOk()));
    assertThat(cleared.read("$.vault.dungeon.cleared", Integer.class)).isEqualTo(1);
    assertThat(cleared.read("$.vault.gold", Long.class)).isEqualTo(48);
    assertThat(cleared.<List<String>>read("$.vault.dungeon.offers[*].code")).hasSize(3);
    // 금고 상점: 다이아 300개는 금괴 30.
    long diamonds = cleared.read("$.diamonds.amount", Long.class);
    DocumentContext bought =
        json(
            mvc.perform(post("/api/company/vault/shop/diamonds").cookie(session))
                .andExpect(status().isOk()));
    assertThat(bought.read("$.diamonds.amount", Long.class)).isEqualTo(diamonds + 300);
    assertThat(bought.read("$.vault.gold", Long.class)).isEqualTo(18);
    assertThat(bought.read("$.vault.shop[0].left", Integer.class)).isEqualTo(4);
    mvc.perform(post("/api/company/vault/shop/diamonds").cookie(session))
        .andExpect(status().isBadRequest());
    mvc.perform(post("/api/company/vault/shop/nothing").cookie(session))
        .andExpect(status().isBadRequest());
  }

  /** 상점 (decisions.md 541번): 게임 재화로 사고 하루 횟수가 있다. */
  @Test
  void 상점에서_무료_다이아를_받고_삭제된_교환_상품은_살_수_없다() throws Exception {
    DocumentContext opened =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    List<String> codes = opened.read("$.shop.items[*].code");
    assertThat(codes).containsExactly("free");
    assertThat(opened.read("$.idle.cats[0].grade", String.class)).as("하늘냥은 C 등급").isEqualTo("C");
    assertThat(opened.read("$.idle.power", Double.class)).isPositive();
    long diamonds = opened.read("$.diamonds.amount", Long.class);
    DocumentContext free =
        json(
            mvc.perform(post("/api/company/shop/free").cookie(session)).andExpect(status().isOk()));
    assertThat(free.read("$.diamonds.amount", Long.class)).isEqualTo(diamonds + 20);
    assertThat(free.read("$.shop.items[0].left", Integer.class)).isZero();
    assertThat(free.read("$.shop.lastReceipt.diamonds", Long.class)).isEqualTo(20);
    mvc.perform(post("/api/company/shop/free").cookie(session)).andExpect(status().isBadRequest());
    mvc.perform(post("/api/company/shop/nothing").cookie(session))
        .andExpect(status().isBadRequest());
    for (String removed : List.of("diamonds", "money-small", "money-large")) {
      mvc.perform(post("/api/company/shop/" + removed).cookie(session))
          .andExpect(status().isBadRequest());
    }
  }

  /** 시즌패스 (decisions.md 529·571번): 미션을 깨면 포인트가 들어오고, 닿지 않은 단계는 받지 못한다. */
  @Test
  void 시즌패스는_미션으로_포인트를_모으고_닿은_단계만_받는다() throws Exception {
    DocumentContext opened =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    assertThat(opened.read("$.pass.step", Integer.class)).isZero();
    assertThat(opened.read("$.pass.points", Long.class)).isZero();
    assertThat(opened.read("$.pass.pointsPerStep", Integer.class)).isEqualTo(300);
    assertThat(opened.read("$.pass.steps.length()", Integer.class)).isEqualTo(50);
    assertThat(opened.read("$.pass.secondsLeft", Long.class)).isPositive();
    List<String> missions = opened.read("$.pass.missions[*].code");
    assertThat(missions)
        .containsExactly(
            "wall", "boss", "upgrade", "draw", "merge", "attend", "fish", "forever", "feed",
            "skill");
    assertThat(opened.read("$.pass.missions[0].title", String.class)).isEqualTo("매도벽 최고 기록 50개 돌파");
    postJson("/api/company/pass/claim", "{\"step\":1}").andExpect(status().isBadRequest());
    mvc.perform(post("/api/company/pass/claim").cookie(session)).andExpect(status().isBadRequest());
    // 출석 미션: 하루에 100포인트. 한 단계에는 300이 든다.
    DocumentContext attended =
        json(
            mvc.perform(post("/api/company/attendance").cookie(session))
                .andExpect(status().isOk()));
    // 포인트는 저절로 들어오지 않는다 (572번): 받을 수 있게 되고, 눌러서 받는다.
    assertThat(attended.read("$.pass.points", Long.class)).isZero();
    assertThat(attended.read("$.pass.missions[5].count", Long.class)).isEqualTo(1);
    assertThat(attended.read("$.pass.missions[5].ready", Long.class)).isEqualTo(100);
    assertThat(attended.read("$.pass.missionsReady", Integer.class)).isEqualTo(1);
    postJson("/api/company/pass/missions/claim", "{\"code\":\"wall\"}")
        .andExpect(status().isBadRequest());
    postJson("/api/company/pass/missions/claim", "{\"code\":\"nothing\"}")
        .andExpect(status().isBadRequest());
    DocumentContext taken =
        json(
            postJson("/api/company/pass/missions/claim", "{\"code\":\"attend\"}")
                .andExpect(status().isOk()));
    assertThat(taken.read("$.pass.points", Long.class)).isEqualTo(100);
    assertThat(taken.read("$.pass.missions[5].earned", Long.class)).isEqualTo(100);
    assertThat(taken.read("$.pass.missions[5].ready", Long.class)).isZero();
    assertThat(taken.read("$.pass.missionsReady", Integer.class)).isZero();
    assertThat(taken.read("$.pass.step", Integer.class)).isZero();
    assertThat(taken.read("$.pass.claimable", Integer.class)).isZero();
    // 본문 없이 부르면 모두 받기다: 받을 것이 없으면 400.
    mvc.perform(post("/api/company/pass/missions/claim").cookie(session))
        .andExpect(status().isBadRequest());
    // 강화 미션: 산 단계만큼 센다.
    DocumentContext upgraded =
        json(
            postJson("/api/company/battle-upgrade", "{\"kind\":\"damage\",\"levels\":1}")
                .andExpect(status().isOk()));
    assertThat(upgraded.read("$.pass.missions[2].count", Long.class)).isEqualTo(1);
    postJson("/api/company/pass/claim", "{\"step\":1}").andExpect(status().isBadRequest());
    // 본 게임에서는 경험치를 채우거나 시즌을 넘길 수 없다.
    postJson("/api/sandbox/pass-exp", "{\"exp\":1000}").andExpect(status().isBadRequest());
    mvc.perform(post("/api/sandbox/next-season").cookie(session))
        .andExpect(status().isBadRequest());
  }

  /** 환생 (decisions.md 571번): 첫 보스를 깨기 전에는 못 하고, 생선이 없으면 영구 강화를 올리지 못한다 (600번). */
  @Test
  void 환생은_첫_보스를_깬_뒤에_하고_생선이_없으면_레벨을_못_올린다() throws Exception {
    DocumentContext opened =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    assertThat(opened.read("$.idle.rebirth.count", Integer.class)).isZero();
    assertThat(opened.read("$.idle.rebirth.fish", Long.class)).isZero();
    assertThat(opened.read("$.idle.rebirth.gain", Long.class)).isZero();
    assertThat(opened.read("$.idle.rebirth.fromWall", Long.class)).isEqualTo(51);
    assertThat(opened.read("$.idle.rebirth.adGain", Long.class)).isZero();
    mvc.perform(post("/api/company/rebirth").cookie(session)).andExpect(status().isBadRequest());
    // 광고를 봐도 첫 보스를 깨기 전에는 못 한다 (586번).
    postJson("/api/company/rebirth", "{\"ad\":true}").andExpect(status().isBadRequest());
    // 영구 강화 (600번): 셋이 0단계로 보이고, 생선이 없으면 올리지 못한다.
    assertThat(opened.read("$.idle.rebirth.upgrades[0].kind", String.class)).isEqualTo("damage");
    assertThat(opened.read("$.idle.rebirth.upgrades[2].kind", String.class)).isEqualTo("buy");
    assertThat(opened.read("$.idle.rebirth.upgrades[0].cost", Long.class)).isEqualTo(1);
    postJson("/api/company/rebirth/upgrade", "{\"kind\":\"damage\"}")
        .andExpect(status().isBadRequest());
    postJson("/api/company/rebirth/upgrade", "{}").andExpect(status().isBadRequest());
  }
}
