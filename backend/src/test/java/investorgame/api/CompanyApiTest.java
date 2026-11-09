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
  void 사재로_회사를_차리고_채용권으로_뽑아_세_해를_넘겨도_이어진다() throws Exception {
    mvc.perform(get("/api/company").cookie(session)).andExpect(status().isNotFound());
    // 세션 쿠키가 없는 첫 방문도 401이 아니라 "회사가 없다" (#346).
    mvc.perform(get("/api/company")).andExpect(status().isNotFound());

    DocumentContext company =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isBadRequest());
    long capital = company.read("$.capital", Long.class);
    assertThat(capital).isEqualTo(100_000_000L);
    assertThat(company.read("$.grade", String.class)).isEqualTo("F");
    assertThat(company.read("$.seats", Integer.class)).isEqualTo(4);
    assertThat(company.read("$.employees.length()", Integer.class)).isZero();
    // 채용 뽑기 (decisions.md 312번): 채용권 열 장으로 시작하고(#344), 확률표와 도감(F~GOD)이 보인다.
    assertThat(company.read("$.gacha.tickets", Integer.class)).isEqualTo(10);
    assertThat(company.read("$.gacha.rosterMax", Integer.class))
        .as("인원 상한 없음 (354번)")
        .isGreaterThan(100_000);
    assertThat(company.read("$.gacha.rates.length()", Integer.class)).isEqualTo(5);
    assertThat(company.read("$.gacha.collection.length()", Integer.class)).isEqualTo(18);
    // 섹터 데스크 (4.2·9.4절): 첫 회사는 평범한 시대라 뜨는 섹터가 없다.
    List<String> chipSector = company.read("$.desks[?(@.code == 'semiconductor')].sector");
    assertThat(chipSector).containsExactly("semiconductor");
    assertThat(company.read("$.meeting.hot", Object.class)).isNull();

    DocumentContext one = draw(1);
    assertThat(one.read("$.employees.length()", Integer.class)).isEqualTo(1);
    assertThat(one.read("$.capital", Long.class)).as("뽑기는 돈이 들지 않는다").isEqualTo(capital);
    assertThat(one.read("$.gacha.tickets", Integer.class)).isEqualTo(9);
    assertThat(one.read("$.gacha.drawn.length()", Integer.class)).isEqualTo(1);
    assertThat(one.read("$.gacha.drawn[0].fresh", Boolean.class)).as("처음 본 등급").isTrue();
    assertThat(one.read("$.gacha.drawn[0].perk", String.class))
        .as("뽑기 카드의 등급 효과 (387번)")
        .startsWith("맞히면 ")
        .endsWith("배");
    assertThat(one.read("$.employees[0].sectorName", String.class)).isNotBlank();
    // 같은 뽑기가 두 번 와도 한 번만 뽑는다. 아직 오지 않은 것과 모자란 채용권은 400.
    DocumentContext twice = json(drawRequest(1, 0).andExpect(status().isOk()));
    assertThat(twice.read("$.gacha.tickets", Integer.class)).isEqualTo(9);
    assertThat(twice.read("$.employees.length()", Integer.class)).isEqualTo(1);
    drawRequest(1, 5).andExpect(status().isBadRequest());
    drawRequest(10, 1).andExpect(status().isBadRequest());
    postJson("/api/company/draws", "{}").andExpect(status().isBadRequest());

    int employeeId = one.read("$.employees[0].id");
    postJson(
            "/api/company/placement",
            "{\"seats\":[{\"employeeId\":" + employeeId + ",\"desk\":\"semiconductor\"}]}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.employees[0].desk").value("semiconductor"))
        .andExpect(jsonPath("$.employees[0].sector").isNotEmpty());

    // 종목 발굴 (267·382번): 분기 넘기기를 누르기 전에는 아무도 물어 오지 않아 종목 회의가 닫혀 있다. 거시경제 회의는 뺐다.
    DocumentContext meeting = json(mvc.perform(get("/api/company").cookie(session)));
    assertThat(meeting.read("$.invest.ready", Boolean.class)).isFalse();
    java.util.Map<String, Object> top = meeting.read("$");
    assertThat(top).doesNotContainKey("macro");
    postJson("/api/company/invest", "{\"choice\":\"BUY\"}").andExpect(status().isBadRequest());
    DocumentContext scouted =
        json(mvc.perform(post("/api/company/scout").cookie(session)).andExpect(status().isOk()));
    // 첫 회사의 첫해에는 돈을 굴리는 직원이 꼭 종목을 물어 온다 (267번). 두 번 눌러도 그대로다.
    assertThat(scouted.read("$.invest.finder.employeeId", Integer.class)).isEqualTo(employeeId);
    assertThat(scouted.read("$.invest.finder.pitch", String.class)).isNotBlank();
    String title = scouted.read("$.invest.title");
    assertThat(
            json(mvc.perform(post("/api/company/scout").cookie(session)).andExpect(status().isOk()))
                .read("$.invest.title", String.class))
        .isEqualTo(title);

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
    // "너희가 알아서 해"는 352번, 지켜본다는 423번에서 뺐다: 산다·판다 둘. 지켜본다를 보내면 400이다.
    assertThat(meeting.read("$.invest.options.length()", Integer.class)).isEqualTo(2);
    postJson("/api/company/invest", "{\"choice\":\"HOLD\"}").andExpect(status().isBadRequest());
    assertThat(meeting.read("$.invest.outcome", Object.class)).isNull();
    // 종목 회의 수익률의 범위 (decisions.md 388번): −50% ~ +300%
    assertThat(meeting.read("$.invest.range.lossBp", Integer.class)).isEqualTo(-5_000);
    assertThat(meeting.read("$.invest.range.gainBp", Integer.class)).isEqualTo(30_000);
    settle(1, 1).andExpect(status().isBadRequest());
    postJson("/api/company/invest", "{\"choice\":\"SHORT\"}").andExpect(status().isBadRequest());
    for (int year = 1; year <= 3; year++) {
      long meetingTotal = 0;
      boolean held =
          json(mvc.perform(post("/api/company/scout").cookie(session))).read("$.invest.ready");
      if (held) {
        DocumentContext decided = decide("BUY");
        assertThat(decided.read("$.invest.ready", Boolean.class)).isFalse();
        assertThat(decided.read("$.invest.outcome.results.length()", Integer.class)).isEqualTo(1);
        assertThat(decided.read("$.invest.outcome.reveal", String.class)).isNotBlank();
        assertThat(decided.read("$.invest.outcome.credit", String.class)).isNotBlank();
        // 회의 수익률은 손익 ÷ 판돈이고 −50% ~ +300% 사이다 (388번).
        assertThat(decided.read("$.invest.outcome.returnBp", Integer.class))
            .isBetween(-5_000, 30_000);
        assertThat(decided.read("$.invest.outcome.gainBp", Integer.class)).isBetween(1, 30_000);
        assertThat(decided.read("$.invest.outcome.lossBp", Integer.class)).isBetween(-5_000, -1);
        postJson("/api/company/invest", "{\"choice\":\"BUY\"}").andExpect(status().isBadRequest());
        meetingTotal = decided.read("$.invest.outcome.total", Long.class);
      }
      DocumentContext settled = json(settleYear(year));
      assertThat(settled.read("$.lastSettlement.year", Integer.class)).isEqualTo(year);
      // 연말 결산서(240·251번): 회의 몫과 채용비가 따로 실리고, 연초 자본 + 회의 + 직원들 몫 + 수수료 − 채용비 = 연말 자본. 분기에 태도는 없다
      // (382번).
      assertThat(settled.read("$.lastSettlement.quarters.length()", Integer.class)).isEqualTo(4);
      java.util.Map<String, Object> firstQuarter = settled.read("$.lastSettlement.quarters[0]");
      assertThat(firstQuarter).doesNotContainKeys("stance", "topic");
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
      if (after > 0) {
        long moving = settled.read("$.lastSettlement.moving", Long.class);
        assertThat(before + meetingTotal + staff + fee - hiring - moving).isEqualTo(after);
      }
    }
    // 매각을 뺐다(236번): 세 해가 지나도 회사는 끝나지 않고 4년 차 연초 회의가 온다.
    DocumentContext fourth = json(mvc.perform(get("/api/company").cookie(session)));
    assertThat(fourth.read("$.status", String.class)).isEqualTo("ACTIVE");
    assertThat(fourth.read("$.year", Integer.class)).isEqualTo(4);
    // 채용권은 연말마다 한 장 (357번).
    assertThat(fourth.read("$.gacha.tickets", Integer.class)).isPositive();
    assertThat(fourth.read("$.meeting", Object.class)).isNotNull();
    java.util.Map<String, Object> fields = fourth.read("$");
    assertThat(fields).doesNotContainKeys("sale", "owner", "turns");
    // 지난 해의 결산이 한 번 더 와도 아무것도 하지 않는다 (234번).
    settle(3, 4).andExpect(status().isOk()).andExpect(jsonPath("$.year").value(4));
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isBadRequest());
    postJson("/api/company/sale", "{\"cofounders\":[" + employeeId + "]}")
        .andExpect(status().is4xxClientError());
    // 물어 온 종목이 있으면 그 회의는 정해야 결산한다.
    settleYear(4).andExpect(jsonPath("$.lastSettlement.year").value(4));
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
    assertThat(resumed.read("$.gacha.tickets", Integer.class)).isEqualTo(10);
    settleYear(1).andExpect(jsonPath("$.year").value(2));
  }

  /** 무기는 무기 뽑기권으로 뽑는다. 다 쓰면 400, 모자란 합성도 400 (decisions.md 366번). */
  @Test
  void 무기_뽑기권으로_무기를_뽑고_다_쓰면_400이다() throws Exception {
    DocumentContext opened =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    int tickets = opened.read("$.armory.tickets", Integer.class);
    assertThat(tickets).as("처음 무기 뽑기권").isPositive();
    assertThat(opened.read("$.armory.lastDraw", Object.class)).isNull();
    assertThat(opened.read("$.weapons[0].count", Integer.class)).isEqualTo(1);
    DocumentContext drawn = opened;
    for (int i = 0; i < tickets; i++) {
      drawn = json(postJson("/api/company/weapon/draw", "").andExpect(status().isOk()));
    }
    assertThat(drawn.read("$.armory.tickets", Integer.class)).isZero();
    assertThat(drawn.read("$.armory.lastDraw.grade", String.class)).isIn("N", "R", "SR", "UR");
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
            .flatMap(k -> java.util.stream.Stream.of("N", "R", "SR").map(g -> k + "/" + g))
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
  void 전투_강화를_묶어_사고_자본이_닿는_데까지만_오른다() throws Exception {
    String id =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()))
            .read("$.companyId", String.class);
    DocumentContext opened = json(mvc.perform(get("/api/company").cookie(session)));
    List<String> kinds = opened.read("$.battleUpgrades[*].kind");
    assertThat(kinds).containsExactly("damage", "fire", "hp");
    assertThat(opened.read("$.battleUpgrades[0].level", Integer.class)).isZero();
    assertThat(opened.read("$.battleUpgrades[0].price", Long.class)).isEqualTo(1_000_000L);
    assertThat(opened.read("$.battleUpgrades[0].nextBonusPercent", Integer.class)).isEqualTo(1);
    Map<String, Object> first = opened.read("$.battleUpgrades[0]");
    assertThat(first).doesNotContainKey("maxLevel");
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

    // 분기 실적의 전투 강화 비용 줄에 쓴 돈이 그대로 나온다.
    Boolean ready =
        json(mvc.perform(post("/api/company/scout").cookie(session)).andExpect(status().isOk()))
            .read("$.invest.ready", Boolean.class);
    if (Boolean.TRUE.equals(ready)) {
      decide("BUY");
    }
    DocumentContext quarter = json(settle(1, 1).andExpect(status().isOk()));
    assertThat(quarter.read("$.lastQuarter.upgrades", Long.class)).isEqualTo(spent);

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

  /**
   * 망한(닫힌) 회사는 사장의 사재로 다음 회사를 차린다 (decisions.md 247번). 판돈이 건물의 값에서 나와(411번) 자본 0은 망함이 아니다. 망하지 않았으면
   * 400이다.
   */
  @Test
  void 자본이_바닥나도_망하지_않고_닫힌_회사는_사재로_다음_회사를_차린다() throws Exception {
    String id =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()))
            .read("$.companyId");
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isBadRequest());

    jdbc.sql(
            "UPDATE raising_company SET state = jsonb_set(state, '{capital}', '0') WHERE id = CAST(:id AS uuid)")
        .param("id", id)
        .update();
    DocumentContext emptied = json(mvc.perform(get("/api/company").cookie(session)));
    assertThat(emptied.read("$.broke", String.class)).as("자본 0은 망함이 아니다").isNull();
    mvc.perform(post("/api/company").cookie(session)).andExpect(status().isBadRequest());

    jdbc.sql(
            "UPDATE raising_company SET state = jsonb_set(state, '{closed}', 'true') WHERE id = CAST(:id AS uuid)")
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

  /**
   * 라이벌 회사를 걷어냈다 (decisions.md 288번): 지어낸 라이벌의 올해 고르기도, 결산의 앞지른 라이벌도 없다. 업계 순위는 실제 유저 회사끼리(#351)라 한
   * 해를 마치기 전에는 비어 있다.
   */
  @Test
  void 라이벌_회사가_없다() throws Exception {
    DocumentContext opened =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    Map<String, Object> company = opened.read("$");
    assertThat(company.get("industry")).isNull();
    Map<String, Object> meeting = opened.read("$.meeting");
    assertThat(meeting).doesNotContainKey("rivalry");
    // 다른 증권사의 이직 제안도 뺐다 (385번).
    assertThat(meeting).doesNotContainKey("poach");
    DocumentContext year = json(settleYear(1));
    Map<String, Object> settlement = year.read("$.lastSettlement");
    assertThat(settlement).doesNotContainKeys("overtook", "target");
  }

  /**
   * 랜드마크 타워 (decisions.md 276·296·374번): 건물은 결산으로 오르지 않고 이사 비용을 내고 올라간다. Z(자본 100조 원)로 이사해도 엔딩 없이
   * 축하 한 줄과 연표만 남고, 회사는 ZZ로 이어 간다. 옛 엔딩으로 멈췄던 회사도 다시 움직인다.
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
    // 자본이 넉넉해도 결산으로는 건물이 오르지 않는다 (296번).
    DocumentContext rich = json(settleYear(1));
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
      assertThat(moved.read("$.upgrade.left", Integer.class)).isNull();
    }
    assertThat(moved.read("$.grade", String.class)).isEqualTo("Z");
    Map<String, Object> company = moved.read("$");
    assertThat(company).doesNotContainKey("ending");
    assertThat(moved.read("$.upgrade.to", String.class)).as("Z 다음 건물").isEqualTo("ZZ");
    List<?> kinds = moved.read("$.history.timeline[*].kind");
    assertThat(kinds.stream().map(String::valueOf)).contains("grow", "ending");
    // 회사는 멈추지 않는다: 뽑고 결산하고 계속 간다.
    DocumentContext after = json(mvc.perform(get("/api/company").cookie(session)));
    assertThat(after.read("$.gacha.tickets", Integer.class)).as("이사할 때마다 받았다").isPositive();
    drawRequest(1, after.read("$.gacha.draws", Integer.class)).andExpect(status().isOk());
    int year = moved.read("$.year", Integer.class);
    settleYear(year).andExpect(jsonPath("$.year").value(year + 1));

    // 옛 엔딩으로 멈췄던 회사도 다시 움직인다.
    jdbc.sql(
            "UPDATE raising_company SET state = jsonb_set(state, '{finished}', 'true')"
                + " WHERE id = CAST(:id AS uuid)")
        .param("id", id)
        .update();
    settleYear(year + 1).andExpect(jsonPath("$.year").value(year + 2));
  }

  /** 업계 순위 (#351): 한 해를 마치면 같은 연차 회사들 가운데 자리가 보이고 결산 소식에 남는다. 다른 회사가 같은 연차를 마치면 함께 센다. */
  @Test
  void 한_해를_마치면_같은_연차_회사들_가운데_순위가_보인다() throws Exception {
    DocumentContext opened =
        json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    assertThat(opened.read("$.industry", Object.class)).as("한 해도 안 마쳤다").isNull();
    DocumentContext first = json(settleYear(1));
    int total = first.read("$.industry.total", Integer.class);
    assertThat(first.read("$.industry.year", Integer.class)).isEqualTo(1);
    assertThat(first.read("$.industry.rank", Integer.class)).isBetween(1, total);
    List<String> lines = first.read("$.lastSettlement.lines");
    assertThat(lines).anyMatch(line -> line.contains("같은 1년 차 회사"));

    // 다른 유저가 같은 연차를 마치면 함께 센다.
    Cookie mine = session;
    setUp();
    json(mvc.perform(post("/api/company").cookie(session)).andExpect(status().isCreated()));
    DocumentContext other = json(settleYear(1));
    assertThat(other.read("$.industry.total", Integer.class)).isEqualTo(total + 1);
    DocumentContext again = json(mvc.perform(get("/api/company").cookie(mine)));
    assertThat(again.read("$.industry.total", Integer.class)).isEqualTo(total + 1);
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
