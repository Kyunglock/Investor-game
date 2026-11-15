package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/** 아주 작은 회사의 규칙 (증권사 육성 설계 4·6절). 실제 콘텐츠와 application.yml 수치로 돌린다. */
class CompanyEngineTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final CompanyEngine ENGINE =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);

  private static Map<String, Integer> stats(
      int insight, int patience, int courage, int conviction) {
    return Map.of(
        "insight",
        insight,
        "patience",
        patience,
        "courage",
        courage,
        "conviction",
        conviction,
        "luck",
        50);
  }

  /** 운까지 다섯 능력치가 모두 value. */
  private static Map<String, Integer> all(int value) {
    return Map.of(
        "insight", value, "patience", value, "courage", value, "conviction", value, "luck", value);
  }

  /** 회사를 차리고 그 직원을 바로 들인다. 지원자는 그대로 둔다. */
  private static CompanyState open(long seed, Map<String, Integer> stats, long capital) {
    CompanyState company = ENGINE.open(new HashSeededRandom(seed), capital);
    ENGINE.hire(company, stats);
    return company;
  }

  @Test
  void 자리_수를_넘게_앉힐_수_없다() {
    // F 회사는 자리 넷 (287번): 다섯을 앉히면 400, 넷이면 다섯째는 쉰다.
    CompanyState company = open(1, stats(50, 50, 50, 50), 100_000_000);
    for (int i = 0; i < 4; i++) {
      ENGINE.hire(company, stats(50, 50, 50, 50));
    }
    assertThatThrownBy(
            () ->
                ENGINE.place(company, Map.of(1, "bio", 2, "day", 3, "risk", 4, "game", 5, "food")))
        .isInstanceOf(InvalidRequestException.class);
    ENGINE.place(company, Map.of(1, "bio", 2, "day", 3, "risk", 4, "game"));
    assertThat(company.employees.get(4).desk).as("빠진 직원은 쉰다").isNull();
  }

  @Test
  void 한_자리에는_여덟_명까지_앉힐_수_있다() {
    // 440번: 자리 수가 넉넉해도 한 데스크에는 DESK_CAP(8)명까지.
    CompanyState company = open(1, stats(50, 50, 50, 50), 1_000_000_000_000L);
    assertThat(ENGINE.seats(company)).isGreaterThan(CompanyEngine.DESK_CAP);
    Map<Integer, String> nine = new HashMap<>();
    for (int i = 0; i < CompanyEngine.DESK_CAP; i++) {
      ENGINE.hire(company, stats(50, 50, 50, 50));
    }
    for (CompanyState.Employee e : company.employees) {
      nine.put(e.id, "day");
    }
    assertThat(nine).hasSize(CompanyEngine.DESK_CAP + 1);
    assertThatThrownBy(() -> ENGINE.place(company, nine))
        .isInstanceOf(InvalidRequestException.class)
        .hasMessageContaining("8명까지");
    nine.put(company.employees.getLast().id, "bio");
    ENGINE.place(company, nine);
    assertThat(company.employees.stream().filter(e -> "day".equals(e.desk)).count())
        .isEqualTo(CompanyEngine.DESK_CAP);
  }

  /** 매각과 재창업 (9절): 시대가 끝나기 전에는 SSS 이상이어야 팔 수 있고, 팔면 명성이 오르고 공동창업자와 다른 시대의 새 회사를 F에서 차린다. */
  @Test
  void 회사를_팔면_공동창업자와_새_시대의_F_회사를_차린다() {
    CompanyState company = open(4, stats(80, 80, 80, 80), 100_000_000);
    ENGINE.hire(company, stats(30, 30, 30, 30));
    assertThat(company.era).isEqualTo("plain");
    assertThat(ENGINE.canSell(company)).as("F는 시대가 끝나기 전에 못 판다").isFalse();
    company.capital = 1_000_000_000_000L;
    assertThat(ENGINE.grade(company.capital)).isEqualTo("SSS");
    assertThat(ENGINE.canSell(company)).as("SSS면 스스로 판다").isTrue();
    assertThat(ENGINE.fameFor(company)).as("SSS 9점 + 스스로 판 보너스").isEqualTo(10);

    int fame = ENGINE.fameFor(company);
    assertThat(ENGINE.fameGrade(fame)).as("10점 ÷ 2 = 5단계").isEqualTo("A");
    int slots = ENGINE.cofounderSlots(fame);
    assertThat(slots).isEqualTo(2);
    assertThatThrownBy(
            () -> ENGINE.refound(company, List.of(1, 2, 3), fame, new HashSeededRandom(4)))
        .isInstanceOf(InvalidRequestException.class);

    CompanyState next = ENGINE.refound(company, List.of(1), fame, new HashSeededRandom(4));
    assertThat(next.number).isEqualTo(2);
    assertThat(next.era).isNotEqualTo("plain");
    assertThat(next.capital).as("명성 A(5단계)면 시작 자본 +50%").isEqualTo(150_000_000L);
    assertThat(next.employees)
        .singleElement()
        .satisfies(e -> assertThat(e.stats.get("insight")).as("등급 그대로").isEqualTo(80));
    String cofounder = next.employees.getFirst().name;
    assertThat(next.opening).contains(cofounder);
    assertThat(next.met).as("만난 사람 수(이름)를 이어 센다").isEqualTo(company.met);
  }

  /** 등급 효과 수치만 바꾼 엔진 (387번). 같은 시드로 효과를 켜고 끈 결과를 견준다. */
  static CompanyEngine withPerks(java.util.function.UnaryOperator<CompanyProperties.Perks> change) {
    try {
      var components = CompanyProperties.class.getRecordComponents();
      Object[] values = new Object[components.length];
      Class<?>[] types = new Class<?>[components.length];
      for (int i = 0; i < components.length; i++) {
        types[i] = components[i].getType();
        Object value = components[i].getAccessor().invoke(PROPERTIES);
        values[i] = value instanceof CompanyProperties.Perks perks ? change.apply(perks) : value;
      }
      CompanyProperties changed =
          CompanyProperties.class.getDeclaredConstructor(types).newInstance(values);
      return new CompanyEngine(TestContent.load(), TestBehavior.create(), changed);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException(e);
    }
  }

  /** 뽑기 하나. 채용권이 없으면 한 장 쥐여 준다. */
  private static CompanyState.Employee drawOne(CompanyState company) {
    company.tickets = Math.max(company.tickets, 1);
    int id = ENGINE.draw(company, 1, new HashSeededRandom(77)).getFirst().employeeId;
    return company.employees.stream().filter(e -> e.id == id).findFirst().orElseThrow();
  }

  /**
   * 확률표 (decisions.md 312번): 회사 등급을 중심으로 한 단계 아래 30% · 같은 등급 44% · 위 18% · 두 단계 위 6% · 특급(네 단계 위)
   * 2%.
   */
  @Test
  void 뽑기는_회사_등급을_중심으로_확률표대로_나온다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(1), ENGINE.openingCapital());
    assertThat(ENGINE.rates())
        .extracting(CompanyProperties.Rate::percent)
        .containsExactly(30, 44, 18, 6, 2);
    assertThat(ENGINE.rates().stream().map(r -> ENGINE.rateGrade(company, r)).toList())
        .as("F 회사: 바닥은 F")
        .containsExactly("F", "F", "E", "D", "B");
    int[] counts = new int[CompanyEngine.LADDER.size()];
    int stars = 0;
    int total = 0;
    // 반지하는 자리가 넷이라(524번) 한 번에 넷씩 뽑고 비운다.
    for (int round = 0; round < 600; round++) {
      company.employees.clear();
      company.tickets = 4;
      for (CompanyState.Drawn d : ENGINE.draw(company, 4, new HashSeededRandom(round))) {
        counts[CompanyEngine.LADDER.indexOf(d.grade)]++;
        stars += d.star ? 1 : 0;
        total++;
      }
    }
    assertThat(stars / (double) total).as("특급은 2% 언저리").isBetween(0.008, 0.035);
    assertThat(counts[CompanyEngine.LADDER.indexOf("A")]).as("F 회사에 A 이상은 특급(B)뿐").isZero();
    assertThat((counts[0] + counts[1]) / (double) total).as("F·E가 대부분").isGreaterThan(0.7);

    CompanyState big = ENGINE.open(new HashSeededRandom(1), 10_000_000_000L);
    assertThat(ENGINE.rateGrade(big, ENGINE.rates().get(1))).as("B 회사의 중심은 B").isEqualTo("B");
  }

  /** 특급 (decisions.md 290·312번): 확률표의 맨 끝 칸. F 회사에 네 단계 위 B가 오고, 능력치가 모두 그 띠 안이며, 연표에 남는다. */
  @Test
  void 특급은_드물게_네_단계_위에서_오고_연표에_남는다() {
    CompanyState found = null;
    CompanyState.Drawn star = null;
    for (int round = 0; round < 400 && star == null; round++) {
      CompanyState company = ENGINE.open(new HashSeededRandom(round), ENGINE.openingCapital());
      for (CompanyState.Drawn d : ENGINE.draw(company, 4, new HashSeededRandom(round))) {
        if (d.star) {
          star = d;
          found = company;
        }
      }
    }
    assertThat(star).as("특급이 나오는 회사가 있다").isNotNull();
    assertThat(star.grade).isEqualTo("B");
    int id = star.employeeId;
    CompanyState.Employee e =
        found.employees.stream().filter(x -> x.id == id).findFirst().orElseThrow();
    assertThat(e.stats.values()).as("능력치가 모두 B 띠").allSatisfy(v -> assertThat(v).isBetween(50, 59));
    assertThat(found.timeline)
        .anyMatch(t -> t.text != null && t.text.contains("특급 인재") && t.text.contains(e.name));
  }

  @Test
  void 연초_회의에_이번_시대에_뜨는_섹터가_보이고_뽑은_사람은_관심_섹터를_안고_온다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(1), ENGINE.openingCapital());
    assertThat(ENGINE.hotLine(company)).as("평범한 시대엔 뜨는 섹터가 없다").isNull();
    company.era = "long-winter";
    assertThat(ENGINE.hotDesks(company)).containsExactly("food", "finance");
    assertThat(ENGINE.hotLine(company)).isEqualTo("이번 시대에 뜨는 섹터: 식품 데스크·금융 데스크.");

    CompanyState.Employee hired = drawOne(company);
    assertThat(hired.sector).as("뽑은 사람은 관심 섹터를 안고 온다").isNotNull();

    hired.desk = "day";
    assertThat(ENGINE.interested(hired)).as("단타 데스크는 섹터를 가리지 않는다").isFalse();
    hired.desk = hired.sector; // 섹터 데스크의 코드는 섹터 코드와 같다
    assertThat(ENGINE.interested(hired)).isTrue();
  }

  /** 판돈은 자본이 아니라 건물의 값이다 (411번): 자본을 전투 강화·이사에 다 써도 버는 양이 그대로다. */
  @Test
  void 판돈과_수수료는_자본이_아니라_건물의_값에서_나온다() {
    CompanyState rich = open(1, stats(50, 50, 50, 50), 100_000_000);
    CompanyState spent = open(1, stats(50, 50, 50, 50), 1_000);
    assertThat(ENGINE.grade(rich)).isEqualTo("F");
    assertThat(ENGINE.buildingValue(spent)).as("반지하는 사장의 사재").isEqualTo(ENGINE.openingCapital());
    assertThat(ENGINE.stakeOf(spent, 2)).isEqualTo(ENGINE.stakeOf(rich, 2)).isPositive();
    spent.building = "C";
    assertThat(ENGINE.buildingValue(spent)).as("C 건물은 그 띠의 값").isEqualTo(1_000_000_000L);
    assertThat(ENGINE.stakeOf(spent, 1))
        .isEqualTo(1_000_000_000L * PROPERTIES.stakePercent() / 100);
  }

  /** 잃을 자본이 모자라면 잃은 몫들을 같은 비율로 줄여 장부가 맞는다 (411번). */
  @Test
  void 잃을_자본이_모자라면_손실을_가진_만큼으로_줄인다() {
    assertThat(CompanyEngine.capLosses(1_000, new long[] {300, -200})).containsExactly(300, -200);
    assertThat(CompanyEngine.capLosses(100, new long[] {50, -400, -200}))
        .as("합이 −100이 되게 손실만 깎는다")
        .containsExactly(50, -100, -50);
    assertThat(CompanyEngine.capLosses(0, new long[] {-7, -3})).containsExactly(0, 0);
  }

  @Test
  /** 게임 금액 (decisions.md 313번): 1,000마다 a·b·c·d로 올라가고 앞자리는 세 자리까지. 화면의 money()와 같다. */
  void 돈은_게임_금액_단위로_쓴다() {
    assertThat(CompanyEngine.money(950)).isEqualTo("950");
    assertThat(CompanyEngine.money(3_500)).isEqualTo("3.5a");
    assertThat(CompanyEngine.money(100_000_000)).isEqualTo("100b");
    assertThat(CompanyEngine.money(248_580_000)).isEqualTo("249b");
    assertThat(CompanyEngine.money(41_250_000)).isEqualTo("41.3b");
    assertThat(CompanyEngine.money(56_361_512_345_678L)).isEqualTo("56.4d");
    assertThat(CompanyEngine.money(1_000_000_000_000_000L)).isEqualTo("1e");
    assertThat(CompanyEngine.money(999_960_000)).isEqualTo("1c");
    assertThat(CompanyEngine.money(-5_200_000)).isEqualTo("−5.2b");
  }

  /** SSS 회사의 뽑기는 위 칸에서 X 이상 경력직이 나온다(312번). 계약금(258번)은 연봉·이적료와 함께 뺐다(383·385번). */
  @Test
  void SSS_회사의_뽑기에는_경력직이_나온다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(3), 1_200_000_000_000L);
    assertThat(ENGINE.grade(company)).isEqualTo("SSS");
    assertThat(ENGINE.rateGrade(company, ENGINE.rates().get(2))).isEqualTo("X");
    company.tickets = 60;
    List<CompanyState.Drawn> drawn = new java.util.ArrayList<>();
    List<CompanyState.Employee> hired = new java.util.ArrayList<>();
    for (int i = 0; i < 6; i++) {
      drawn.addAll(ENGINE.draw(company, 10, new HashSeededRandom(3)));
      // 자리(34)를 넘기지 않게 비운다 (524번).
      hired.addAll(company.employees);
      company.employees.clear();
    }
    CompanyState.Drawn veteran =
        drawn.stream().filter(d -> d.grade.equals("X")).findFirst().orElseThrow();
    CompanyState.Employee e =
        hired.stream().filter(x -> x.id == veteran.employeeId).findFirst().orElseThrow();
    assertThat(e.rank).isEqualTo(1);
    assertThat(e.stats.values())
        .as("능력치가 모두 SSS 띠")
        .allSatisfy(v -> assertThat(v).isGreaterThanOrEqualTo(90));
  }

  /** 채용 뽑기 전에 차린 회사 (decisions.md 312번): 처음 불러올 때 채용권을 받고 지금 직원이 도감에 오른다. 한 번만. */
  @Test
  void 뽑기_전에_차린_회사는_채용권을_받고_직원이_도감에_오른다() {
    CompanyState old = open(1, stats(50, 50, 50, 50), 100_000_000);
    old.gachaReady = false;
    old.tickets = 0;
    old.collection.clear();
    assertThat(ENGINE.adoptGacha(old)).isTrue();
    assertThat(old.tickets).isEqualTo(PROPERTIES.gacha().startTickets());
    assertThat(old.collection).containsEntry("B", 1);
    assertThat(ENGINE.adoptGacha(old)).as("한 번만").isFalse();
    assertThat(old.tickets).isEqualTo(PROPERTIES.gacha().startTickets());
    assertThat(ENGINE.open(new HashSeededRandom(1), 100_000_000).gachaReady).isTrue();
  }

  /** #392: 최근에 쓴 문구와 이번에 이미 쓴 문구는 건너뛰고, 다 썼으면 굴린 것을 쓴다. 기억은 60개까지. */
  @Test
  void 같은_문구는_이어_나오지_않게_고른다() {
    CompanyState c = new CompanyState();
    List<String> lines = List.of("가", "나", "다");
    java.util.Set<String> now = new java.util.HashSet<>();
    ENGINE.remember(c, List.of("가"));
    assertThat(ENGINE.fresh(c, lines, 0, now)).as("최근에 쓴 가는 건너뛴다").isEqualTo("나");
    assertThat(ENGINE.fresh(c, lines, 0, now)).as("이번에 쓴 나도 건너뛴다").isEqualTo("다");
    assertThat(ENGINE.fresh(c, lines, 0, now)).as("다 썼으면 굴린 것").isEqualTo("가");
    for (int i = 0; i < 100; i++) {
      ENGINE.remember(c, List.of("x" + i));
    }
    assertThat(c.recentLines).hasSize(CompanyEngine.RECENT_LINES).doesNotContain("가");
  }

  /** 옛 저장 상태에 직원 합성 기록(합성 횟수·방금 한 합성·합성으로 처음 만든 등급)이 남아 있어도 읽힌다 (384번). */
  @Test
  void 옛_저장_상태의_합성_기록은_무시하고_읽는다() {
    String old =
        """
        {"year": 2, "capital": 5000000000, "merges": 3,
         "lastMerge": {"baseId": 1, "name": "김촉", "before": "C", "after": "A", "jackpot": true,
                       "farewells": ["잘 부탁해요"], "firstOfGrade": true, "inheritedQuirk": "촉파"},
         "mergedFirst": ["A"],
         "collection": {"C": 2, "A": 1},
         "employees": [{"id": 1, "name": "김촉", "quirk": "gut"}]}
        """;
    CompanyState c = JsonMapper.builder().build().readValue(old, CompanyState.class);
    assertThat(c.year).isEqualTo(2);
    assertThat(c.collection).containsEntry("A", 1);
    assertThat(c.employees).singleElement().satisfies(e -> assertThat(e.quirk).isEqualTo("gut"));
  }

  @Test
  void 사장의_사재로_직원_없이_F등급_자리_네_개로_열리고_채용권을_받는다() {
    CompanyState company = ENGINE.open(new HashSeededRandom(1), ENGINE.openingCapital());
    assertThat(company.capital).isEqualTo(100_000_000);
    assertThat(company.employees).isEmpty();
    assertThat(company.opening).contains("100b로");
    assertThat(company.tickets).isEqualTo(PROPERTIES.gacha().startTickets());
    assertThat(ENGINE.draw(company, 1, new HashSeededRandom(1)).getFirst().name).isEqualTo("박한결");
    assertThat(ENGINE.grade(company.capital)).isEqualTo("F");
    assertThat(ENGINE.seats(company.capital)).isEqualTo(4);
    assertThat(ENGINE.grade(120_000_000)).as("E는 1.2억부터 (#344)").isEqualTo("E");
    assertThat(ENGINE.grade(119_999_999)).isEqualTo("F");
    assertThat(ENGINE.grade(300_000_000)).isEqualTo("D");
    assertThat(ENGINE.grade(200_000_000)).isEqualTo("E");
    assertThat(ENGINE.seats(200_000_000)).isEqualTo(6);
  }

  /** 인사 직원 (6.3절, decisions.md 312번): 뽑기의 중심이 인사 직원보다 두 단계 아래까지 오르고, 연말에 채용권을 한 장 더 받는다. */
  @Test
  void 인사팀이_뽑기를_돕는다() {
    Map<String, Integer> sharp = stats(92, 92, 92, 92);
    CompanyState company = open(3, sharp, 100_000_000);
    ENGINE.place(company, Map.of(1, "hr"));
    assertThat(ENGINE.hrCap(company.employees.getFirst())).as("평균 84(SS)의 두 단계 아래").isEqualTo("A");
    assertThat(ENGINE.rateGrade(company, ENGINE.rates().get(1))).as("중심이 A로 오른다").isEqualTo("A");
    int sum = 0;
    int count = 0;
    for (int round = 0; round < 100; round++) {
      company.tickets = 3;
      for (CompanyState.Drawn d : ENGINE.draw(company, 3, new HashSeededRandom(round))) {
        sum += CompanyEngine.LADDER.indexOf(d.grade);
        count++;
      }
      company.employees.removeIf(e -> e.id != 1);
    }
    assertThat(sum / (double) count).as("중심이 A 언저리로 오른다").isGreaterThan(4.3);
  }

  /**
   * 옛 저장 상태에 이직 제안(걸린 제안·증권사마다 손을 뻗은 횟수·떠난 사람의 데려간 증권사와 소식)이 남아 있어도 읽히고, 연표에 남은 옛 이직 줄은 그대로다
   * (385번). 아무도 떠나지 않는다.
   */
  @Test
  void 옛_저장_상태의_이직_제안은_무시하고_읽는다() {
    CompanyState c = ENGINE.open(new HashSeededRandom(6), ENGINE.openingCapital());
    ENGINE.hire(c, stats(60, 60, 60, 60));
    ENGINE.hire(c, stats(70, 70, 70, 70));
    JsonMapper json = JsonMapper.builder().build();
    ObjectNode node = json.valueToTree(c);
    int target = c.employees.getLast().id;
    node.set(
        "poach",
        json.readTree(
            "{\"employeeId\": "
                + target
                + ", \"transferFee\": 1350000000, \"rival\": \"존버캐피탈\", \"count\": 2}"));
    node.set("poachCounts", json.readTree("{\"존버캐피탈\": 2}"));
    node.set(
        "alumni",
        json.readTree(
            "[{\"name\": \"류소울\", \"from\": 1, \"to\": 2, \"grade\": \"S\","
                + " \"rival\": \"존버캐피탈\", \"reported\": false}]"));
    node.set(
        "timeline",
        json.readTree("[{\"year\": 2, \"kind\": \"left\", \"text\": \"류소울이(가) 존버캐피탈(으)로 떠났다.\"}]"));
    CompanyState old = json.treeToValue(node, CompanyState.class);
    assertThat(old.employees).hasSize(2);
    assertThat(old.alumni).singleElement().satisfies(a -> assertThat(a.name).isEqualTo("류소울"));
    assertThat(old.timeline).anyMatch(e -> e.text.contains("존버캐피탈"));
    // 옮긴 뒤에도 그대로다: 아무도 떠나지 않는다.
    ENGINE.adoptRealtime(old);
    assertThat(old.employees).as("아무도 떠나지 않는다").hasSize(2);
  }

  /**
   * 채용 뽑기 (decisions.md 312번): 채용권 한 장에 한 명이 쉬는 채로 온다. 돈은 들지 않는다. 데리고 있을 수 있는 사람은 100명이고, 넘으면 내보내야
   * 더 뽑는다.
   */
  @Test
  void 채용권으로_뽑으면_바로_자리에_앉고_자리가_차면_회사를_넓혀야_더_뽑는다() {
    // 인력 관리를 없앴다 (decisions.md 524번): 뽑은 직원은 사장이 배치하지 않아도 빈 자리에 앉는다.
    CompanyState company = ENGINE.open(new HashSeededRandom(5), ENGINE.openingCapital());
    long capital = (long) company.capital;
    List<CompanyState.Drawn> drawn = ENGINE.draw(company, 2, new HashSeededRandom(5));
    assertThat(drawn).hasSize(2);
    assertThat(company.employees).hasSize(2).allSatisfy(e -> assertThat(e.desk).isNotNull());
    assertThat(company.employees.getFirst().desk)
        .as("첫 직원은 돈을 굴리는 자리에 앉아 종목회의를 열 수 있다")
        .isEqualTo("semiconductor");
    assertThat(company.employees.get(1).desk).as("팀을 차례대로 채운다").isEqualTo("bio");
    assertThat(ENGINE.traders(company)).hasSize(2);
    assertThat(drawn)
        .extracting(d -> d.name)
        .containsExactlyElementsOf(company.employees.stream().map(e -> e.name).toList());
    assertThat(company.tickets).isEqualTo(PROPERTIES.gacha().startTickets() - 2);
    assertThat(company.capital).as("뽑기는 돈이 들지 않는다").isEqualTo(capital);
    assertThat(company.draws).isEqualTo(2);
    assertThat(company.collection.values().stream().mapToInt(Integer::intValue).sum()).isEqualTo(2);
    assertThatThrownBy(
            () -> ENGINE.draw(company, PROPERTIES.gacha().maxDraws() + 1, new HashSeededRandom(5)))
        .isInstanceOf(InvalidRequestException.class);

    // 반지하(F)는 자리가 넷이다: 둘 더 뽑으면 꽉 차고, 그 뒤로는 채용권이 있어도 못 뽑는다.
    assertThat(ENGINE.seats(company)).isEqualTo(4);
    company.tickets = 10;
    assertThatThrownBy(() -> ENGINE.draw(company, 3, new HashSeededRandom(5)))
        .as("자리를 넘겨 뽑을 수 없다")
        .isInstanceOf(InvalidRequestException.class)
        .hasMessageContaining("회사를 넓히면");
    assertThat(company.tickets).as("거절되면 채용권을 쓰지 않는다").isEqualTo(10);
    ENGINE.draw(company, 2, new HashSeededRandom(5));
    assertThat(company.employees).hasSize(4).allSatisfy(e -> assertThat(e.desk).isNotNull());
    assertThatThrownBy(() -> ENGINE.draw(company, 1, new HashSeededRandom(5)))
        .isInstanceOf(InvalidRequestException.class)
        .hasMessageContaining("회사를 넓히면");

    // 회사를 넓히면 자리가 늘어 다시 뽑는다.
    company.capital = 10_000_000_000L;
    ENGINE.upgrade(company);
    assertThat(ENGINE.seats(company)).isEqualTo(6);
    ENGINE.draw(company, 2, new HashSeededRandom(5));
    assertThat(company.employees).hasSize(6).allSatisfy(e -> assertThat(e.desk).isNotNull());
    assertThat(company.employees.stream().map(e -> e.desk).distinct().count())
        .as("사람이 적은 팀부터 채워 여섯이 저마다 다른 팀이다")
        .isEqualTo(6);
  }

  @Test
  void 쉬던_직원은_불러올_때_모두_앉히고_자리가_모자라도_잃지_않는다() {
    // 인력 관리가 있던 때의 저장 (524번): 쉬는 사람과 자리 수를 넘는 사람이 있을 수 있다.
    CompanyState company = ENGINE.open(new HashSeededRandom(8), ENGINE.openingCapital());
    for (int i = 0; i < 7; i++) {
      ENGINE.hire(company, all(50));
    }
    ENGINE.place(company, Map.of(1, "day", 2, "day"));
    assertThat(company.employees).filteredOn(e -> e.desk == null).hasSize(5);
    assertThat(ENGINE.seats(company)).as("자리는 넷뿐이다").isEqualTo(4);
    assertThat(ENGINE.seatAll(company)).isTrue();
    assertThat(company.employees).hasSize(7).allSatisfy(e -> assertThat(e.desk).isNotNull());
    assertThat(company.employees.get(0).desk).as("앉아 있던 사람은 그대로다").isEqualTo("day");
    assertThat(ENGINE.seatAll(company)).as("다 앉았으면 그대로").isFalse();
    // 모두 번다: 자리와 상관없다.
    assertThat(ENGINE.staffIncome(company))
        .isEqualTo(7 * ENGINE.incomeOf(company.employees.getFirst()));
  }

  /** 뽑은 사람 이름은 성 × 이름 조합을 겹치지 않게 돌리고 직함을 붙이지 않는다 (#319, decisions.md 256번). */
  @Test
  void 뽑은_사람_이름은_겹치지_않고_직함이_없다() {
    var texts = TestContent.load().raising().company();
    int total = texts.surnames().size() * texts.names().size();
    CompanyState company = ENGINE.open(new HashSeededRandom(1), ENGINE.openingCapital());
    java.util.Set<String> names = new java.util.HashSet<>();
    String previous = null;
    while (names.size() < total) {
      company.tickets = PROPERTIES.gacha().maxDraws();
      company.employees.clear();
      for (CompanyState.Drawn d :
          ENGINE.draw(
              company,
              Math.min(PROPERTIES.gacha().maxDraws(), ENGINE.seats(company)),
              new HashSeededRandom(1))) {
        assertThat(names.add(d.name)).as("겹친 이름: %s", d.name).isTrue();
        assertThat(d.name).doesNotContain("대리").doesNotContain("수습").doesNotContain("주임");
        if (previous != null) {
          assertThat(d.name.charAt(0)).as("이웃한 사람의 성이 다르다").isNotEqualTo(previous.charAt(0));
        }
        previous = d.name;
        if (names.size() == total) {
          break;
        }
      }
    }
    assertThat(names).hasSize(total);
  }
}
