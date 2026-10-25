package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import investorgame.TestcontainersConfiguration;
import investorgame.asset.AssetService;
import investorgame.content.CareerDefinition;
import investorgame.content.ContentCatalog;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * 한 판을 15세부터 70세까지 실제 API로 끝까지 플레이한다. 클라이언트처럼 다음 이벤트 시각(nextEventDay)까지만 시간을 보내고, 대기 중인 이벤트가 있으면
 * 선택한다.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class GameFlowTest {

  private static final int REPORT_EVERY_DAYS = 90;
  private static final List<String> NEWS_CHOICES = List.of("BUY", "HOLD", "SELL", "BUY");

  @Autowired WebApplicationContext context;
  @Autowired AssetService assets;
  @Autowired ContentCatalog content;

  @Test
  void 성장기_성향_직업_투자_시작_뉴스를_거쳐_70세에_끝난다() throws Exception {
    MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).build();
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.start();
    String gameId = game.read("$.gameId");
    int endDay = (70 - 15) * 360;
    List<String> kindOrder = new ArrayList<>();

    Map<String, Integer> seenKinds = new HashMap<>();
    List<DocumentContext> newsOutcomes = new ArrayList<>();
    List<String> responses = new ArrayList<>();
    DocumentContext afterJob = null;
    int newsCount = 0;

    for (int step = 0; step < 2_000 && "ACTIVE".equals(game.read("$.status")); step++) {
      Map<String, Object> pending = game.read("$.pendingEvent");
      if (pending != null) {
        String kind = (String) pending.get("kind");
        seenKinds.merge(kind, 1, Integer::sum);
        kindOrder.add(kind);
        // 자동 플레이어는 70세까지 살아남아야 전체 흐름을 검사할 수 있다. 저소득 직업에 자녀 셋이면 생활비가 월급을 넘어
        // 빚이 불어나 40대에 파산(decisions.md 27번)할 수 있으므로 월급이 가장 높은 직업을 고르고 자녀는 하나까지만 둔다.
        String option =
            switch (kind) {
              case "OFFER" -> "accept";
              case "NEWS" -> NEWS_CHOICES.get(newsCount++ % NEWS_CHOICES.size());
              case "JOB" -> richestJob(game);
              // 빚투를 매번 받으면 떨어지는 종목에 계속 빚을 얹다가 파산한다(그게 정상이다). 이 검사는 70세까지의 흐름이 목적이라 거절한다.
              case "LEVERAGE" -> "PASS";
              // 자녀 결혼(선택지 full·half·none, decisions.md 68번)은 절반만 보탠다. 결혼·자녀는 하나까지만.
              // 가족 여행(선택지 luxury·normal·cheap·none, decisions.md 71번)은 당일치기로.
              case "LIFE" ->
                  ((List<?>) pending.get("options")).toString().contains("luxury")
                      ? "cheap"
                      : ((List<?>) pending.get("options")).toString().contains("half")
                          ? "half"
                          : game.read("$.household.children.length()", Integer.class) >= 1
                                  && game.read("$.household.married", Boolean.class)
                              ? "decline"
                              : "accept";
              default -> GameClient.firstOpen(game);
            };
        DocumentContext result = client.choose(gameId, (String) pending.get("eventId"), option);
        responses.add(result.jsonString());
        if ("NEWS".equals(kind)) {
          newsOutcomes.add(result);
        }
        Object next = result.read("$.game");
        game = JsonPath.parse(next);
        continue;
      }
      int day = game.read("$.day", Integer.class);
      Integer nextEventDay = game.read("$.nextEventDay");
      int target =
          Math.min(
              Math.min(day + REPORT_EVERY_DAYS, endDay),
              nextEventDay == null ? endDay : nextEventDay);
      game = client.advance(gameId, target);
      responses.add(game.jsonString());
      if (afterJob == null && game.read("$.job") != null && day > 0) {
        afterJob = game;
      }
    }

    assertThat(game.read("$.status", String.class)).isEqualTo("ENDED");
    assertThat(game.read("$.phase", String.class)).isEqualTo("ENDED");
    // 파산으로 끝났다면 왜 그랬는지 보이게 한다(직업·직장 기록, 연간 자산, 빚).
    assertThat(game.read("$.result.finalAge", Integer.class))
        .as(
            "ending=%s debt=%s jobs=%s yearly=%s",
            game.read("$.result.ending"),
            game.read("$.debt"),
            game.read(
                "$.log[?(@.kind in ['JOB','JOB_WAIT','CAREER','RETIRE','LEVERAGE','CRISIS'])].payload"),
            game.read("$.yearly"))
        .isEqualTo(70);
    assertThat(game.read("$.result.ending", String.class)).isEqualTo("NORMAL");
    assertThat(game.read("$.result.finalAsset", Long.class))
        .as("35년 동안 월급을 받았으므로 자산이 늘었다")
        .isGreaterThan(game.read("$.result.initialAsset", Long.class));
    // 은퇴(60세) 뒤에는 연금이 들어온다 (decisions.md 27번).
    assertThat(game.read("$.household.pension", Long.class)).isPositive();
    assertThat(game.read("$.household.monthlyIncome", Long.class)).isZero();
    Map<String, Object> endPayload = game.read("$.log[-1].payload");
    assertThat(endPayload).containsEntry("ending", "NORMAL").containsKeys("debt", "finalAge");

    // 첫 직업은 반드시 하나. 구조조정·번아웃으로 실직하면 재취업 선택이 더 올 수 있다 (decisions.md 26번).
    assertThat(seenKinds.get("JOB")).isGreaterThanOrEqualTo(1);
    assertThat(seenKinds.getOrDefault("CAREER", 0))
        .as("35년 동안 직장 장면이 여러 번")
        .isGreaterThanOrEqualTo(3);
    // 성장 단계 10개에서 하나씩, 취업 뒤 일상 장면(adult) 풀 13개(양가 부모 장면 6개 포함, 결혼하므로 다 나온다)를 40년 동안 다 쓴다.
    assertThat(seenKinds.get("TRAIT")).as("성장기 10 + 취업 뒤 일상 13").isEqualTo(23);
    assertThat(kindOrder.subList(0, 13))
        .as("성장기의 성향 이벤트가 모두 끝난 뒤에 직업, 독립(주거), 그다음 투자 시작 제안")
        .containsExactly(
            "TRAIT", "TRAIT", "TRAIT", "TRAIT", "TRAIT", "TRAIT", "TRAIT", "TRAIT", "TRAIT",
            "TRAIT", "JOB", "HOUSING", "OFFER");
    assertThat(seenKinds.get("OFFER")).isEqualTo(1);
    assertThat(seenKinds.getOrDefault("NEWS", 0)).isGreaterThanOrEqualTo(20);
    assertThat(game.read("$.investmentStyle.code", String.class)).isIn("short", "long");
    assertThat(game.read("$.interestSector.code", String.class)).isNotBlank();

    for (DocumentContext outcome : newsOutcomes) {
      assertThat(outcome.read("$.outcome.price.direction", String.class)).isIn("UP", "DOWN");
      assertThat(outcome.read("$.outcome.trade.status", String.class)).isNotBlank();
      // 뉴스 결과 뒤에는 안목 한마디가 붙는다 (decisions.md 73번).
      assertThat(outcome.read("$.outcome.review", String.class)).isNotBlank();
    }
    long deviations =
        newsOutcomes.stream()
            .mapToLong(o -> o.read("$.outcome.deviations.length()", Integer.class))
            .sum();
    assertThat(deviations).as("능력치 15~85에서 수십 번 선택하면 이탈이 생긴다").isPositive();

    // 진행 중 응답 어디에도 숨은 값이 나가지 않는다 (해결된 뉴스의 주가 방향은 결과로 보여 준다).
    for (String response : responses) {
      assertThat(response)
          .doesNotContain("seed")
          .doesNotContain("hidden")
          .doesNotContain("magnitude")
          .doesNotContain("drift");
    }

    // 시장·가계: 종목 18개가 매달 움직이고, 월급은 전부 자산이 되지 않으며 결혼·자녀·은퇴가 삶에 들어온다 (경제 개편 설계).
    assertThat(game.read("$.market.stocks.length()", Integer.class)).isEqualTo(18);
    assertThat(game.read("$.market.month", Integer.class)).isEqualTo((70 - 15) * 12);
    List<Map<String, Object>> holdings = game.read("$.holdings");
    for (Map<String, Object> h : holdings) {
      assertThat(h)
          .containsKeys(
              "stockCode", "stockName", "quantity", "avgCost", "price", "value", "pnl", "pnlBp");
    }
    assertThat(game.read("$.household.married", Boolean.class)).isTrue();
    assertThat(game.read("$.household.retired", Boolean.class)).isTrue();
    assertThat(game.read("$.household.children.length()", Integer.class)).isEqualTo(1);
    assertThat(game.read("$.debt", Long.class)).isGreaterThanOrEqualTo(0);
    assertThat(afterJob).isNotNull();
    assertThat(afterJob.read("$.household.monthlyExpense", Long.class)).isPositive();
    assertThat(afterJob.read("$.household.monthlyIncome", Long.class))
        .isEqualTo(afterJob.read("$.job.monthlySalary", Long.class));
    for (DocumentContext outcome : newsOutcomes) {
      assertThat(outcome.read("$.outcome.price.stockCode", String.class)).isNotBlank();
      assertThat(outcome.read("$.outcome.trade.quantity", Integer.class)).isNotNull();
    }

    DocumentContext reloaded = client.current();
    assertThat(reloaded.read("$.status", String.class))
        .as("끝난 판은 새로고침해도 결과를 보여 준다")
        .isEqualTo("ENDED");

    // 투자자 유형: 네 축 조합 코드와 이름이 응답에 있고, 재접속해도 남는다 (경제 개편 설계 4.2절).
    assertThat(game.read("$.investorType.code", String.class))
        .matches("(short|long)-(bold|safe)-(own|crowd)");
    assertThat(game.read("$.investorType.name", String.class)).isNotBlank();
    assertThat(game.read("$.investorType.description", String.class)).isNotBlank();
    assertThat(game.read("$.riskProfile.code", String.class)).isIn("bold", "safe");
    assertThat(game.read("$.mindProfile.code", String.class)).isIn("own", "crowd");
    assertThat(reloaded.read("$.investorType.code", String.class)).isNotNull();
    List<Map<String, Object>> styles = game.read("$.log[?(@.kind=='STYLE')].payload");
    assertThat(styles).hasSize(1);
    assertThat(styles.get(0))
        .containsKeys("investorTypeCode", "investorTypeName", "riskCode", "mindCode");
    List<Map<String, Object>> growthPayloads = game.read("$.log[?(@.kind=='GROWTH')].payload");
    assertThat(growthPayloads)
        .allSatisfy(p -> assertThat(p.get("reason")).isIn("DEVIATION", "TRAIT", "CAREER"));
    for (String response : responses) {
      List<String> reasons = JsonPath.parse(response).read("$..growth[*].reason");
      assertThat(reasons).allMatch(r -> List.of("DEVIATION", "TRAIT", "CAREER").contains(r));
    }

    // 인생 기록: 진행이 사건마다 기록한 것이 탄생부터 종료까지 순서대로 남는다.
    List<String> kinds = game.read("$.log[*].kind");
    assertThat(kinds).startsWith("BIRTH").endsWith("END");
    assertThat(kinds).containsOnlyOnce("STYLE", "OFFER", "MARRIAGE", "RETIRE");
    // 행복도는 0~100 (decisions.md 82번).
    assertThat(game.read("$.happiness", Integer.class)).isBetween(0, 100);
    assertThat(game.read("$.family", Integer.class)).isBetween(0, 100);
    // 결혼 상대 소개가 가계에 남는다 (decisions.md 77번). 이름은 없다 (90번).
    assertThat(game.read("$.household.spouse", Object.class).toString()).doesNotContain("name=");
    assertThat(game.read("$.household.spouse.job", String.class)).isNotBlank();
    assertThat(game.read("$.household.spouse.intro", String.class)).startsWith("성격은");
    assertThat(kinds).contains("JOB", "CAREER");
    assertThat(kinds).contains("CHILD", "LIFE");
    // 성별은 나와 아이 모두 M/F 가운데 하나다 (decisions.md 69번).
    assertThat(game.<String>read("$.sex")).isIn("M", "F");
    List<String> childSexes = game.read("$.household.children[*].sex");
    assertThat(childSexes).isNotEmpty().allMatch(s -> List.of("M", "F").contains(s));
    assertThat(kinds.stream().filter("TRAIT"::equals).count()).isEqualTo(23);
    assertThat(kinds.stream().filter("NEWS"::equals).count())
        .isEqualTo((long) seenKinds.get("NEWS"));
    // 흔들림(SHAKE)도 선택 뒤 주가가 움직여 PRICE를 남긴다 (decisions.md 33번).
    assertThat(kinds.stream().filter("PRICE"::equals).count())
        .isEqualTo((long) seenKinds.get("NEWS") + seenKinds.getOrDefault("SHAKE", 0));
    assertThat(seenKinds.getOrDefault("SHAKE", 0)).as("종목을 들고 있으면 흔들림이 온다").isPositive();
    assertThat(kinds.stream().filter("SHAKE"::equals).count())
        .isEqualTo((long) seenKinds.get("SHAKE"));
    assertThat(game.read("$.log[0].payload.initialAsset", Long.class))
        .isEqualTo(game.read("$.initialAsset", Long.class));
    for (String response : responses) {
      assertThat(response).as("기록에도 숨은 값이 없다").doesNotContain("truth");
    }
    DocumentContext lastNews = newsOutcomes.get(newsOutcomes.size() - 1);
    List<Map<String, Object>> newsPayloads = lastNews.read("$.game.log[?(@.kind=='NEWS')].payload");
    Map<String, Object> newsPayload = newsPayloads.get(newsPayloads.size() - 1);
    assertThat(newsPayload.get("chosen")).isEqualTo(lastNews.read("$.outcome.chosen"));
    assertThat(newsPayload.get("actual")).isEqualTo(lastNews.read("$.outcome.actual"));
    assertThat(newsPayload)
        .containsKeys("eventTitle", "sectorName", "stockName", "deviations", "trade");
    List<String> lastKinds = lastNews.read("$.game.log[*].kind");
    assertThat(lastKinds.get(lastKinds.size() - 1)).isIn("PRICE", "GROWTH");

    // 연간 자산: 15세부터 70세까지 해마다 한 줄, 마지막 줄은 최종 자산과 같다.
    List<Integer> ages = game.read("$.yearly[*].age");
    assertThat(ages).startsWith(15).endsWith(70).doesNotHaveDuplicates().hasSize(56);
    List<Map<String, Object>> yearly = game.read("$.yearly");
    assertThat(((Number) yearly.get(yearly.size() - 1).get("totalAsset")).longValue())
        .isEqualTo(game.read("$.result.finalAsset", Long.class));
  }

  /** 직업 선택지 문구 "직업 · 월 N만 원"에서 월급이 가장 높은 것. "기다린다"(WAIT)는 뺀다. */
  private static String richestJob(DocumentContext game) {
    List<Map<String, Object>> options = game.read("$.pendingEvent.options");
    String best = null;
    long bestSalary = -1;
    for (Map<String, Object> option : options) {
      String code = (String) option.get("code");
      java.util.regex.Matcher m =
          java.util.regex.Pattern.compile("월 ([\\d,]+)만 원").matcher((String) option.get("label"));
      if (!m.find()) {
        continue;
      }
      long salary = Long.parseLong(m.group(1).replace(",", ""));
      if (salary > bestSalary) {
        bestSalary = salary;
        best = code;
      }
    }
    return best != null ? best : (String) options.get(0).get("code");
  }

  /** 전업투자자 (decisions.md 35번): 직업 대신 고르면 투자 시작 제안 없이 바로 투자기이고, 월급도 구직 제안도 없다. */
  @Test
  void 직업_대신_전업투자자를_고르면_월급_없이_바로_투자를_시작한다() throws Exception {
    MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).build();
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.start();
    String gameId = game.read("$.gameId");
    for (int step = 0; step < 100; step++) {
      Map<String, Object> pending = game.read("$.pendingEvent");
      if (pending != null && "JOB".equals(pending.get("kind"))) {
        break;
      }
      if (pending != null) {
        String option = GameClient.firstOpen(game);
        game =
            JsonPath.parse(
                client
                    .choose(gameId, (String) pending.get("eventId"), option)
                    .<Object>read("$.game"));
        continue;
      }
      int day = game.read("$.day", Integer.class);
      game = client.advance(gameId, game.read("$.nextEventDay", Integer.class));
      assertThat(game.read("$.day", Integer.class)).isGreaterThan(day);
    }
    assertThat(game.read("$.pendingEvent.kind", String.class)).isEqualTo("JOB");
    game =
        JsonPath.parse(
            client
                .choose(gameId, game.read("$.pendingEvent.eventId"), "INVEST")
                .<Object>read("$.game"));

    assertThat(game.read("$.phase", String.class)).isEqualTo("INVESTING");
    assertThat(game.read("$.fullTimeInvestor", Boolean.class)).isTrue();
    assertThat(game.read("$.job", Object.class)).isNull();
    List<Map<String, Object>> jobLogs = game.read("$.log[?(@.kind=='JOB')].payload");
    assertThat(jobLogs).hasSize(1);
    assertThat(jobLogs.get(0))
        .containsEntry("fullTimeInvestor", true)
        .containsEntry("jobTitle", "전업투자자");

    // 10년을 보내도 월급·구직 제안·투자 시작 제안이 없고, 생활비는 나간다. 직장 장면 대신 투자자의 장면이 온다 (decisions.md 52번).
    int until = game.read("$.day", Integer.class) + 10 * 360;
    List<String> kinds = new ArrayList<>();
    for (int step = 0; step < 500 && game.read("$.day", Integer.class) < until; step++) {
      Map<String, Object> pending = game.read("$.pendingEvent");
      if (pending != null) {
        kinds.add((String) pending.get("kind"));
        String option = GameClient.firstOpen(game);
        game =
            JsonPath.parse(
                client
                    .choose(gameId, (String) pending.get("eventId"), option)
                    .<Object>read("$.game"));
        continue;
      }
      if (!"ACTIVE".equals(game.read("$.status"))) {
        break;
      }
      int day = game.read("$.day", Integer.class);
      Integer next = game.read("$.nextEventDay");
      game = client.advance(gameId, Math.min(day + REPORT_EVERY_DAYS, next == null ? until : next));
    }
    assertThat(kinds)
        .as(
            "status=%s day=%s until=%d cash=%s debt=%s",
            game.read("$.status"),
            game.read("$.day"),
            until,
            game.read("$.cash"),
            game.read("$.debt"))
        .doesNotContain("JOB", "OFFER");
    List<String> sceneTitles = game.read("$.log[?(@.kind=='CAREER')].payload.eventTitle");
    List<String> investorTitles =
        content.careers().stream()
            .filter(c -> c.jobs().contains("INVEST"))
            .map(CareerDefinition::title)
            .toList();
    assertThat(investorTitles).containsAll(sceneTitles);
    assertThat(game.read("$.fullTimeInvestor", Boolean.class)).isTrue();
    // 시작 현금이 적은 판은 월급 없이 생활비만 나가다 뉴스가 오기 전에 파산할 수 있다(전업투자자의 페널티). 살아 있으면 뉴스가 왔다.
    if ("ACTIVE".equals(game.read("$.status"))) {
      assertThat(kinds).contains("NEWS");
    } else {
      assertThat(game.read("$.result.ending", String.class)).isEqualTo("BANKRUPT");
    }
    assertThat(game.read("$.household.monthlyIncome", Long.class)).isZero();
    assertThat(game.read("$.household.monthlyExpense", Long.class)).isPositive();
  }

  @Test
  void 다_팔아도_빚을_못_갚으면_그_달에_파산으로_끝난다() throws Exception {
    MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).build();
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.startInvesting();
    String gameId = game.read("$.gameId");
    UUID id = UUID.fromString(gameId);
    int day = game.read("$.day", Integer.class);
    int startAge = game.read("$.startAge", Integer.class);

    // 갚을 수 없는 큰 빚을 지운다 (생활 사건의 지출로). 다음 달 정산에서 총자산이 0 아래가 된다.
    assets.spend(id, "LIFE_COST", 100_000_000_000L, day, UUID.randomUUID());

    for (int step = 0; step < 20 && "ACTIVE".equals(game.read("$.status")); step++) {
      Map<String, Object> pending = game.read("$.pendingEvent");
      if (pending != null) {
        String option = "OFFER".equals(pending.get("kind")) ? "accept" : GameClient.firstOpen(game);
        Object next = client.choose(gameId, (String) pending.get("eventId"), option).read("$.game");
        game = JsonPath.parse(next);
        continue;
      }
      int now = game.read("$.day", Integer.class);
      Integer next = game.read("$.nextEventDay");
      game = client.advance(gameId, Math.min(now + 90, next == null ? now + 90 : next));
    }

    assertThat(game.read("$.status", String.class)).isEqualTo("ENDED");
    assertThat(game.read("$.result.ending", String.class)).isEqualTo("BANKRUPT");
    int finalAge = game.read("$.result.finalAge", Integer.class);
    int endedDay = game.read("$.day", Integer.class);
    assertThat(endedDay % 30).as("매월 1일 정산에서 끝난다").isZero();
    assertThat(endedDay).isLessThan((70 - 15) * 360);
    assertThat(finalAge).isEqualTo(startAge + endedDay / 360).isLessThan(70);
    assertThat(game.read("$.totalAsset", Long.class)).isNegative();
    assertThat(game.read("$.result.finalAsset", Long.class)).isNegative();
    assertThat(game.read("$.pendingEvent", Object.class)).as("파산 뒤에는 선택이 없다").isNull();
    List<String> kinds = game.read("$.log[*].kind");
    assertThat(kinds).endsWith("END");
    Map<String, Object> endPayload = game.read("$.log[-1].payload");
    assertThat(endPayload).containsEntry("ending", "BANKRUPT");
    assertThat(((Number) endPayload.get("debt")).longValue()).isPositive();
    List<Integer> ages = game.read("$.yearly[*].age");
    assertThat(ages).as("자산 곡선이 파산한 나이에서 끝난다").endsWith(finalAge);
    assertThat(client.current().read("$.result.ending", String.class)).isEqualTo("BANKRUPT");
  }

  @Test
  void 같은_달을_두_번_보고해도_가격_월급_지출은_한_번씩이다() throws Exception {
    MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).build();
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.startInvesting();
    String gameId = game.read("$.gameId");
    int day = game.read("$.day", Integer.class);
    Integer next = game.read("$.nextEventDay");
    int target = Math.min(day + 60, next == null ? day + 60 : next);

    DocumentContext first = client.advance(gameId, target);
    DocumentContext second = client.advance(gameId, target);

    assertThat(second.read("$.cash", Long.class)).isEqualTo(first.read("$.cash", Long.class));
    assertThat(second.read("$.debt", Long.class)).isEqualTo(first.read("$.debt", Long.class));
    assertThat(second.read("$.market.month", Integer.class))
        .isEqualTo(first.read("$.market.month", Integer.class));
    assertThat(second.read("$.market.stocks[0].price", Long.class))
        .isEqualTo(first.read("$.market.stocks[0].price", Long.class));
    assertThat(second.read("$.market.month", Integer.class)).isEqualTo(target / 30);
  }

  @Test
  void 한_번에_열두_달을_뛰어도_가격_월급_지출은_달마다_한_번씩이다() throws Exception {
    MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).build();
    GameClient client = GameClient.newSession(mvc);
    // 직업만 고르고 투자 제안은 거절해, 1년 동안 뉴스 없이 월급·생활비만 흐르게 한다.
    Object started = client.chooseFirstJob(client.startUntilJob()).read("$.game");
    DocumentContext game = JsonPath.parse(started);
    String gameId = game.read("$.gameId");
    int day = game.read("$.day", Integer.class);
    game = client.advance(gameId, game.read("$.nextEventDay", Integer.class));
    assertThat(game.read("$.pendingEvent.kind", String.class)).isEqualTo("OFFER");
    Object declined =
        client.choose(gameId, game.read("$.pendingEvent.eventId"), "decline").read("$.game");
    game = JsonPath.parse(declined);
    int from = game.read("$.day", Integer.class);
    long cash = game.read("$.cash", Long.class);
    long salary = game.read("$.job.monthlySalary", Long.class);
    // 생활비와 주거비(독립할 때 고른 월세)가 따로 나간다 (주거 설계 2절).
    long expense =
        game.read("$.household.monthlyExpense", Long.class)
            + game.read("$.housing.monthlyCost", Long.class);
    int monthBefore = game.read("$.market.month", Integer.class);
    Integer next = game.read("$.nextEventDay");
    int target = from + 360;
    // 1년 안에 결혼 제안이나 알림이 있으면 그 전까지만 본다 (그 사이는 월급·생활비만 움직인다).
    int stop = next == null ? target : Math.min(target, next);
    int months = stop / 30 - from / 30;
    assertThat(months).as("최소 몇 달은 이벤트 없이 흐른다").isPositive();

    DocumentContext after = client.advance(gameId, stop);

    assertThat(after.read("$.market.month", Integer.class)).isEqualTo(monthBefore + months);
    // 그 사이 알림(경조사비 등, LIFE 기록)으로 한 번에 오간 돈은 달마다의 흐름이 아니므로 빼고 본다.
    List<Number> lifeAmounts =
        after.read("$.log[?(@.day > " + from + " && @.kind == 'LIFE')].payload.amount");
    long life = lifeAmounts.stream().mapToLong(Number::longValue).sum();
    long saved = after.read("$.cash", Long.class) - cash + after.read("$.debt", Long.class) - life;
    List<String> kindsInRange = after.read("$.log[?(@.day > " + from + ")].kind");
    assertThat(saved)
        .as(
            "from=%d stop=%d afterDay=%d months=%d salary=%d expense=%d cashBefore=%d cashAfter=%d debt=%d income=%d expenseAfter=%d kinds=%s",
            from,
            stop,
            after.read("$.day", Integer.class),
            months,
            salary,
            expense,
            cash,
            after.read("$.cash", Long.class),
            after.read("$.debt", Long.class),
            after.read("$.household.monthlyIncome", Long.class),
            after.read("$.household.monthlyExpense", Long.class),
            kindsInRange)
        // 25세부터 물가(연 2%)가 생활비를 올리고 연차가 바뀌면 월급이 오르므로 ±20% 안에서 "달 수 × (월급 − 생활비 − 주거비)"다.
        .isBetween((salary - expense) * months * 8 / 10, (salary - expense) * months * 12 / 10);
    assertThat(day).isLessThan(from);
  }

  @Test
  void 투자_중_자유_매매는_용기_판정을_거쳐_포트폴리오에_반영된다() throws Exception {
    MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).build();
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.startInvesting();
    String gameId = game.read("$.gameId");
    String stock = game.read("$.market.stocks[0].code");
    boolean affordable =
        game.read("$.cash", Long.class) >= game.read("$.market.stocks[0].price", Long.class);

    DocumentContext result = client.trade(gameId, stock, "BUY", 1);

    assertThat(result.read("$.outcome.kind", String.class)).isEqualTo("TRADE");
    assertThat(result.read("$.outcome.chosen", String.class)).isEqualTo("BUY");
    String actual = result.read("$.outcome.actual");
    if ("BUY".equals(actual) && !affordable) {
      // 시드에 따라 투자 시작 직후 현금이 한 주 값에 못 미칠 수 있다.
      assertThat(result.read("$.outcome.trade.status", String.class))
          .isEqualTo("INSUFFICIENT_CASH");
    } else if ("BUY".equals(actual)) {
      assertThat(result.read("$.game.holdings[0].stockCode", String.class)).isEqualTo(stock);
      assertThat(result.read("$.game.holdings[0].quantity", Integer.class)).isEqualTo(1);
      assertThat(result.read("$.outcome.trade.status", String.class)).isEqualTo("EXECUTED");
    } else {
      assertThat(actual).isEqualTo("HOLD");
      assertThat(result.read("$.outcome.deviations[0].statCode", String.class))
          .isEqualTo("courage");
    }
    List<String> kinds = result.read("$.game.log[*].kind");
    assertThat(kinds).contains("TRADE");
    assertThat(result.jsonString()).doesNotContain("seed").doesNotContain("hidden");
  }

  @Test
  void 뉴스_선택에_수량을_보내면_그_수량으로_산다() throws Exception {
    MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).build();
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.untilNews(client.startInvesting());
    String gameId = game.read("$.gameId");
    String eventId = game.read("$.pendingEvent.eventId");
    String stock = game.read("$.pendingEvent.stockCode");
    long cash = game.read("$.cash", Long.class);
    List<Number> prices = game.read("$.market.stocks[?(@.code=='" + stock + "')].price");
    long price = prices.get(0).longValue();
    // 시드에 따라 현금이 모자랄 수 있으니 살 수 있는 만큼만 보낸다. 서버 기본(현금의 30%)과 다른 수량이어야 뜻이 있다.
    long quantity = Math.max(1, Math.min(2, cash / price));

    MvcResult raw = client.chooseRaw(gameId, eventId, "BUY", quantity).andReturn();
    assertThat(raw.getResponse().getStatus())
        .as(raw.getResponse().getContentAsString())
        .isEqualTo(200);
    DocumentContext result = GameClient.json(raw);

    if (!"BUY".equals(result.read("$.outcome.actual"))) {
      assertThat(result.read("$.outcome.trade.quantity", Integer.class)).isEqualTo(0);
    } else if (cash < price) {
      assertThat(result.read("$.outcome.trade.status", String.class))
          .isEqualTo("INSUFFICIENT_CASH");
    } else {
      assertThat(result.read("$.outcome.trade.status", String.class)).isEqualTo("EXECUTED");
      assertThat(result.read("$.outcome.trade.quantity", Long.class)).isEqualTo(quantity);
      List<Number> held = result.read("$.game.holdings[?(@.stockCode=='" + stock + "')].quantity");
      assertThat(held.stream().map(Number::longValue)).containsExactly(quantity);
    }
  }

  @Test
  void 뉴스_선택의_수량이_0이면_400이다() throws Exception {
    MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).build();
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.untilNews(client.startInvesting());
    String gameId = game.read("$.gameId");
    String eventId = game.read("$.pendingEvent.eventId");

    client.chooseRaw(gameId, eventId, "BUY", 0).andExpect(status().isBadRequest());
    assertThat(client.current().read("$.pendingEvent.eventId", String.class)).isEqualTo(eventId);
  }

  /** 매매창 설계 2절: 창을 연 순간 도착한 이벤트가 매매를 막지 않는다. 대기 중인 선택은 그대로 남는다. */
  @Test
  void 대기_중_이벤트가_있어도_매매할_수_있다() throws Exception {
    MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).build();
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.startInvesting();
    String gameId = game.read("$.gameId");
    String stock = game.read("$.market.stocks[0].code");
    int next = game.read("$.nextEventDay", Integer.class);
    int day = game.read("$.day", Integer.class);
    while (game.read("$.pendingEvent") == null) {
      day = Math.min(day + 360, next);
      game = client.advance(gameId, day);
      next = game.read("$.nextEventDay") == null ? day : game.read("$.nextEventDay", Integer.class);
    }
    String eventId = game.read("$.pendingEvent.eventId");

    client
        .tradeRaw(gameId, stock, "BUY", 1)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.outcome.kind").value("TRADE"));
    assertThat(client.current().read("$.pendingEvent.eventId", String.class)).isEqualTo(eventId);
  }

  @Test
  void 종목_이력은_달마다_한_점이다() throws Exception {
    MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).build();
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.startInvesting();
    String gameId = game.read("$.gameId");
    String stock = game.read("$.market.stocks[0].code");

    DocumentContext history = client.history(gameId, stock);

    assertThat(history.read("$.stockCode", String.class)).isEqualTo(stock);
    assertThat(history.read("$.points.length()", Integer.class))
        .isEqualTo(game.read("$.market.month", Integer.class) + 1);
    assertThat(history.read("$.points[0].month", Integer.class)).isZero();
  }

  @Test
  void 같은_시각을_두_번_보고해도_연간_자산은_한_줄이다() throws Exception {
    MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).build();
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.start();
    String gameId = game.read("$.gameId");

    // 첫 성향 이벤트가 바로(0일) 올 수 있다. 그러면 0일을 두 번 보고하고, 아니면 첫 해 끝까지 보고한다.
    Integer nextEventDay = game.read("$.nextEventDay");
    int target = Math.min(360, nextEventDay == null ? 360 : nextEventDay);
    client.advance(gameId, target);
    game = client.advance(gameId, target);

    List<Integer> ages = game.read("$.yearly[*].age");
    assertThat(ages).hasSize(target == 360 ? 1 : 0);
  }
}
