package investorgame.raising.internal;

import investorgame.behavior.BehaviorService;
import investorgame.common.Korean;
import investorgame.common.StatCodes;
import investorgame.common.StatGrade;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.RaisingContent;
import investorgame.raising.internal.CompanyState.Employee;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.random.RandomGenerator;
import org.springframework.stereotype.Component;

/**
 * 아주 작은 회사의 규칙 (증권사 육성 설계 4·6절): 사장은 사람을 뽑아 배치만 하고 직원은 능력치대로 알아서 굴린다. 한 해 = 연초 회의 → (채용 뽑기) → 배치 →
 * 결산. DB와 시각을 모르고 상태와 난수만 받는다.
 */
@Component
class CompanyEngine {

  /** 모든 객체가 쓰는 등급표 15단계 (2.1절). */
  static final List<String> LADDER =
      List.of(
          "F", "E", "D", "C", "B", "A", "S", "SS", "SSS", "X", "XX", "XXX", "Z", "ZZ", "ZZZ", "XS",
          "XSS", "GOD");

  static final String CRASH = "crash";

  private static final String NORMAL = "normal";

  /** 폭락장인데 아무도 바닥에서 던지지 않은 해의 머리줄 (255번). */
  private static final String CRASH_HELD = "crashHeld";

  private static final String RISK_DESK = "risk";
  private static final String RESEARCH_DESK = "research";
  private static final int BP = 10_000;
  private static final int PERCENT = 100;

  /** 운용에서 맞히지 못한 판단이 버는 몫(맞혔을 때의 %, 456번). 손실은 없다. */
  static final int MISS_GAIN_PERCENT = 25;

  /** 손실이 없어진 만큼 운용 몫을 줄여 회사가 크는 빠르기를 전과 비슷하게 둔다 (456번). */
  static final int DESK_GAIN_PERCENT = 45;

  private static final int MAX_STAT = 100;

  /** SSS 위 단계(Employee.rank)별 효과가 열리는 자리 (2.4절). 효과는 쌓인다. */
  static final int RANK_CONVICTION = 1;

  static final int RANK_ALARM = 2;
  static final int RANK_CONTRARIAN = 3;
  static final int RANK_LEADER = 4;
  static final int RANK_MENTOR = 5;
  static final int RANK_FORESIGHT = 6;

  /** XS 큰손·XSS 철벽·GOD 신의 손 (decisions.md 289번): 직원 등급에만 있다. 회사 등급은 ZZZ까지다. */
  static final int RANK_BIG = 7;

  static final int RANK_WALL = 8;
  static final int RANK_GOD = 9;

  private final ContentCatalog content;
  private final BehaviorService behavior;
  private final CompanyProperties properties;

  /** 투자 회의 (decisions.md 229번). 판정 확률·판돈은 이 엔진의 것을 쓴다. */
  final InvestEngine invest;

  CompanyEngine(ContentCatalog content, BehaviorService behavior, CompanyProperties properties) {
    this.content = content;
    this.behavior = behavior;
    this.properties = properties;
    for (RaisingContent.Desk desk : desks()) {
      if (desk.trades() && !properties.desks().containsKey(desk.code())) {
        throw new IllegalStateException("돈을 굴리는 자리의 손익이 없다: raising.company.desks." + desk.code());
      }
    }
    this.invest = new InvestEngine(this, content, behavior, properties);
    this.scout = new ScoutEngine(this, invest, properties);
    this.teams = new TeamEngine(this, content);
    this.pay = new PayEngine(content, properties);
    this.history = new CompanyHistory(content);
    this.mental = new MentalEngine(content, properties);
    this.quirks = new Quirks(content);
    this.teamGrade = new TeamGrade(this, content);
  }

  /** 회의 팀 합산 등급 (decisions.md 353번). */
  final TeamGrade teamGrade;

  /** 멘탈 전투 (decisions.md 328번). */
  final MentalEngine mental;

  /** 직원 버릇 (decisions.md 349번). */
  final Quirks quirks;

  /** 회사 연표·업적·명예의 전당 (decisions.md 263번). */
  final CompanyHistory history;

  /** 종목 발굴 (decisions.md 267번). */
  final ScoutEngine scout;

  /** 팀장과 팀장 보고 (decisions.md 269번). */
  final TeamEngine teams;

  /** 사기 (decisions.md 270번). */
  final PayEngine pay;

  static final String HR_DESK = "hr";

  /** 인사팀에 앉은 직원 가운데 종합 등급이 가장 높은 직원 (6.3절). 없으면 공채를 맡길 수 없다. */
  java.util.Optional<Employee> hrOf(CompanyState company) {
    return company.employees.stream()
        .filter(e -> HR_DESK.equals(e.desk))
        .max(
            java.util.Comparator.comparingInt((Employee e) -> LADDER.indexOf(employeeGrade(e)))
                .thenComparingInt(e -> -e.id));
  }

  /** 인사팀이 있으면 연말에 더 받는 채용권 (6.3절, decisions.md 312번). */
  int hrExtraTickets() {
    return properties.hr().extraTickets();
  }

  /** 인사 직원이 끌어올리는 뽑기의 중심 등급: 인사 직원보다 두 단계 아래, 바닥 F (6.3절). */
  String hrCap(Employee hr) {
    return LADDER.get(Math.max(0, LADDER.indexOf(employeeGrade(hr)) - properties.hr().capSteps()));
  }

  int turns() {
    return properties.turns();
  }

  /** 같은 소식이 한 해에 여러 번이면 처음 자리에 한 줄만 두고 "(N번)"을 붙인다 (#338). */
  static List<String> grouped(List<String> lines) {
    Map<String, Integer> counts = new LinkedHashMap<>();
    lines.forEach(line -> counts.merge(line, 1, Integer::sum));
    List<String> out = new ArrayList<>();
    counts.forEach((line, n) -> out.add(n > 1 ? line + " (" + n + "번)" : line));
    return out;
  }

  /** 사장의 사재로 첫 회사를 차린다. 직원은 없고, 채용권으로 뽑는다 (decisions.md 228·312번). */
  CompanyState open(SeededRandom random, long capital) {
    CompanyState company = new CompanyState();
    company.capital = Math.max(0, capital);
    company.tickets = properties.gacha().startTickets();
    company.gachaReady = true;
    company.building = grade((long) company.capital);
    company.era = eras().getFirst().code();
    company.opening =
        Korean.fill(
            content.raising().company().opening(),
            Map.of("capital", money((long) company.capital)));
    mental.initWeapons(company);
    mental.initWeaponGacha(company);
    begin(company);
    history.opened(company);
    return company;
  }

  /** 이번 결산이 같은 자리 settle-years 해째 이상인가: 손이 덜 뒤집힌다 (262번). */
  boolean settled(Employee employee) {
    return employee.desk != null
        && employee.desk.equals(employee.lastDesk)
        && employee.deskYears + 1 >= properties.people().settleYears();
  }

  /** 등급 효과의 "더 버는 몫"(%, 289·387번): 종합 등급마다 두 배, SSS 위 단계(X~GOD)도 이어서 두 배. */
  long perkGainPercent(Employee employee) {
    return gainPercentOf(employeeGrade(employee));
  }

  long gainPercentOf(String grade) {
    return properties.perks().gainPercent().getOrDefault(grade, 0);
  }

  /** 등급 효과의 판단 보정 (387번): 손이 뒤집힐 확률에 곱하는 비율(%). SSS 위는 SSS 값. */
  int perkFlipPercent(Map<String, Integer> stats) {
    return properties.perks().flipPercent().getOrDefault(overallGrade(stats), PERCENT);
  }

  /** 등급 효과의 판단 보정 (387번): 종목 회의에서 기사를 읽을 때 안목에 더하는 점수. SSS 위는 SSS 값. */
  int perkReadBonus(Employee employee) {
    return properties.perks().readBonus().getOrDefault(overallGrade(employee.stats), 0);
  }

  /** 이름 붙은 등급 효과(A 손절·S 끌어주기·SS 방패·SSS 전설의 촉, 387번)를 가졌나: 능력치로 매긴 종합 등급이 그 등급 이상이다. 쌓인다. */
  static boolean reaches(Employee employee, String grade) {
    return LADDER.indexOf(overallGrade(employee.stats)) >= LADDER.indexOf(grade);
  }

  static final String STOP_LOSS = "A";
  static final String PULL = "S";
  static final String SHIELD = "SS";
  static final String LEGEND = "SSS";

  /** S 끌어주기 (387번): 같은 데스크에 S 이상 동료가 있다. 여럿이어도 한 번만 붙는다. */
  boolean pulled(CompanyState company, Employee employee) {
    return company.employees.stream()
        .anyMatch(e -> e != employee && employee.desk.equals(e.desk) && reaches(e, PULL));
  }

  /** 맞히면 버는 배수(1 + 더 버는 몫): "13.8". */
  private static String times(long gainPercent) {
    return String.format(
        java.util.Locale.ROOT, "%,.1f", (PERCENT + gainPercent) / (double) PERCENT);
  }

  /** 그 등급까지 쌓인 등급 효과 가운데 가장 높은 것 (387번). A 아래면 없다. */
  private java.util.Optional<RaisingContent.Effect> topEffect(String grade) {
    int at = LADDER.indexOf(grade);
    return content.raising().company().effects().list().stream()
        .filter(effect -> LADDER.indexOf(effect.grade()) <= at)
        .reduce((first, second) -> second);
  }

  /**
   * 등급 효과 한 줄 (289·387번): "스타 · 맞히면 13.8배 번다(+1,280%) · 손 뒤집힘 −50% · 방패: 한 분기에 잃으면 손실의 3할을 막는다".
   * SSS 위는 이름 대신 등급. 등급은 뽑은 그대로라(421번) 자라는 확률은 없다.
   */
  String perkLine(Map<String, Integer> stats, int rank) {
    RaisingContent.Perks texts = content.raising().company().perks();
    String grade = overallGrade(stats);
    String full = gradeOf(stats, rank);
    long gain = gainPercentOf(full);
    int steady = PERCENT - perkFlipPercent(stats);
    List<String> parts = new ArrayList<>();
    parts.add(rank > 0 ? full : texts.names().get(grade));
    parts.add(
        Korean.fill(
            texts.gain(),
            Map.of(
                "times", times(gain), "gain", String.format(java.util.Locale.ROOT, "%,d", gain))));
    if (steady > 0) {
      parts.add(Korean.fill(texts.steady(), Map.of("percent", String.valueOf(steady))));
    }
    topEffect(grade)
        .ifPresent(
            effect ->
                parts.add(
                    Korean.fill(
                        texts.named(),
                        Map.of("name", effect.name(), "description", effect.description()))));
    return String.join(" · ", parts);
  }

  /** 뽑기 카드의 짧은 등급 효과 (387번): "맞히면 13.8배 · 방패". 등급만으로 정해 지난 뽑기에도 보인다. */
  String drawnPerk(String grade) {
    String line =
        Korean.fill(
            content.raising().company().perks().drawn(),
            Map.of("times", times(gainPercentOf(grade))));
    return topEffect(grade).map(effect -> line + " · " + effect.name()).orElse(line);
  }

  /** 첫 회사의 시작 자본(사장의 사재). */
  long openingCapital() {
    return properties.baseCapital();
  }

  RaisingContent.Invest investTexts() {
    return content.raising().company().invest();
  }

  String stockName(String code) {
    return content.stock(code).name();
  }

  String stockSector(String code) {
    return content.sectorName(content.stock(code).sector());
  }

  List<RaisingContent.Era> eras() {
    return content.raising().company().eras();
  }

  RaisingContent.Era era(CompanyState company) {
    return era(company.era);
  }

  private RaisingContent.Era era(String code) {
    return eras().stream().filter(e -> e.code().equals(code)).findFirst().orElseThrow();
  }

  /** 한 시대의 길이(해). 시대마다 이만큼 지나면 다른 시대가 온다 (decisions.md 250번). */
  int eraYears() {
    return properties.turns();
  }

  /** 그 해가 이 회사의 몇 번째 시대인가(0부터). */
  private int eraIndex(int year) {
    return (year - 1) / eraYears();
  }

  /** 지금 해가 지금 시대의 마지막 해인가. */
  boolean lastYearOfEra(CompanyState company) {
    return eraIndex(company.year + 1) != eraIndex(company.year);
  }

  /** 지난 시대와 다른 시대를 하나 뽑는다. */
  private String pickEra(String previous, RandomGenerator rng) {
    List<RaisingContent.Era> others =
        eras().stream().filter(e -> !e.code().equals(previous)).toList();
    return others.get(rng.nextInt(others.size())).code();
  }

  /**
   * 그 해의 시대 (250번). 지금 시대 안이면 지금 시대, 다음 시대의 첫해면 다음 시대를 (회사 시드와 시대 번호로만) 정해 돌려준다. 그래서 다음 해 시장을 미리
   * 봐도(경보·선견) 그해가 오면 같은 시대·같은 시장이다.
   */
  private String eraOf(CompanyState company, int year, SeededRandom random) {
    if (eraIndex(year) == eraIndex(company.year)) {
      return company.era;
    }
    return pickEra(company.era, random.forKey("era-turn", eraIndex(year)));
  }

  /** 마지막 해의 연초 회의 한 줄: "올해가 ○○ 시대의 마지막 해다". 아니면 null. */
  String eraEndingLine(CompanyState company) {
    if (!lastYearOfEra(company)) {
      return null;
    }
    return Korean.fill(
        content.raising().company().eraTurn().ending(), Map.of("era", era(company).name()));
  }

  /**
   * 시대가 끝났다: 세 해를 다 돌았다 (9.4절). 매각을 뺀 뒤(236번)로는 회사가 멈추지 않는다. 매각 규칙(canSell·fameFor·refound)은 다시 붙일
   * 때를 위해 남겨 두었고 지금은 API가 부르지 않는다.
   */
  boolean eraOver(CompanyState company) {
    return company.year > properties.turns();
  }

  /** 지금 팔 수 있는가. 시대가 끝났거나, 그 전이라도 등급이 매각 조건(SSS) 이상이면 (9.1절). */
  boolean canSell(CompanyState company) {
    return !company.sold
        && (eraOver(company)
            || LADDER.indexOf(grade((long) company.capital))
                >= LADDER.indexOf(properties.sale().minGrade()));
  }

  /** 사장 명성 등급 (9.2절). 모든 객체가 쓰는 등급표를 쓴다. */
  String fameGrade(int points) {
    return LADDER.get(Math.min(LADDER.size() - 1, points / properties.sale().famePerStep()));
  }

  /** 다음 회사에 데려갈 수 있는 공동창업자 수 (9.3절). 명성이 오르면 는다. */
  int cofounderSlots(int points) {
    CompanyProperties.Sale sale = properties.sale();
    int steps = points / sale.famePerStep();
    return Math.min(sale.cofounderMax(), sale.cofounderBase() + steps / sale.cofounderFameSteps());
  }

  /** 판 회사의 등급만큼 명성이 오른다. 시대가 끝나기 전에 스스로 팔면 조금 더. */
  int fameFor(CompanyState company) {
    int points = LADDER.indexOf(grade((long) company.capital)) + 1;
    return eraOver(company) ? points : points + properties.sale().voluntaryBonus();
  }

  /**
   * 회사를 팔고 다음 회사를 F에서 차린다 (9.1·9.3절). 매각가는 자본 그대로다. 공동창업자는 등급 그대로 데려가고, 새 회사의 시작 자본은 명성만큼 커진다. 시대는
   * 지난 회사와 다른 것으로 뽑는다. memory의 명성은 부르는 쪽이 먼저 올려 둔다.
   */
  CompanyState refound(
      CompanyState sold, List<Integer> cofounders, int famePoints, SeededRandom random) {
    if (cofounders.size() > cofounderSlots(famePoints)) {
      throw new InvalidRequestException("공동창업자가 너무 많다");
    }
    CompanyState next = new CompanyState();
    next.number = sold.number + 1;
    next.hired = sold.hired;
    next.met = sold.met;
    CompanyProperties.Sale sale = properties.sale();
    int steps = Math.min(LADDER.size() - 1, famePoints / sale.famePerStep());
    next.capital =
        properties.baseCapital() * (PERCENT + steps * sale.fameCapitalPercent()) / PERCENT;
    for (Integer id : cofounders) {
      Employee from =
          sold.employees.stream()
              .filter(e -> e.id == id)
              .findFirst()
              .orElseThrow(() -> new InvalidRequestException("없는 직원"));
      from.desk = null;
      next.employees.add(from);
    }
    List<RaisingContent.Era> others =
        eras().stream().filter(e -> !e.code().equals(sold.era)).toList();
    next.era = others.get(random.forKey("era", next.number).nextInt(others.size())).code();
    RaisingContent.Sale texts = content.raising().company().sale();
    Map<String, String> values =
        Map.of(
            "era",
            era(next).name(),
            "capital",
            money((long) next.capital),
            "names",
            String.join("·", next.employees.stream().map(e -> e.name).toList()));
    next.opening =
        Korean.fill(next.employees.isEmpty() ? texts.openingAlone() : texts.opening(), values);
    begin(next);
    return next;
  }

  /** 능력치만 주고 직원을 들인다. 이름은 다음 지원자 이름이다. 공동창업자·시험용. */
  Employee hire(CompanyState company, Map<String, Integer> stats) {
    return add(company, nextName(company), stats);
  }

  private Employee add(CompanyState company, String name, Map<String, Integer> stats) {
    Employee employee = new Employee();
    employee.id = ++company.hired;
    employee.name = name;
    employee.joinedYear = company.year;
    employee.stats.putAll(stats);
    company.employees.add(employee);
    return employee;
  }

  /**
   * 다음 지원자 이름 (decisions.md 256번): 성 × 이름 조합을 겹치지 않게 돌려 쓴다. 만난 순서에 서로소인 보폭을 곱해 섞어서 이웃한 지원자의 성이 다르다.
   * 조합을 다 쓰면 처음부터 번호를 붙인다. 지난 회사에서 만난 사람 수를 이어 센다. 전에는 이름 열둘("김대리"·"이수습")에 직함이 붙어 있어 금세 "김대리5"가 되고,
   * SSS 에이스도 "수습"이었다.
   */
  private String nextName(CompanyState company) {
    List<String> surnames = content.raising().company().surnames();
    List<String> names = content.raising().company().names();
    int total = surnames.size() * names.size();
    int at = company.met++;
    int round = at / total;
    int k = (int) ((long) (at % total) * nameStride(total) % total);
    String name = surnames.get(k % surnames.size()) + names.get(k / surnames.size());
    return round == 0 ? name : name + (round + 1);
  }

  /** 조합 수와 서로소인 보폭: 0..total-1을 한 번씩 돈다. */
  private static int nameStride(int total) {
    int stride = Math.max(1, total * 2 / 5 + 1);
    while (gcd(stride, total) != 1) {
      stride++;
    }
    return stride;
  }

  private static int gcd(int a, int b) {
    return b == 0 ? a : gcd(b, a % b);
  }

  /** 데리고 있을 수 있는 사람 수: 상한이 없다(354번, roster-max를 아주 크게). 전에는 100명(337번). */
  int rosterMax(CompanyState company) {
    return properties.gacha().rosterMax();
  }

  /** 지금 회사의 뽑기 중심 등급(LADDER 자리): 회사 등급 + level-steps, 인사팀이 있으면 인사 직원보다 cap-steps 아래까지 (6.3절). */
  int drawLevel(CompanyState company) {
    int level = LADDER.indexOf(grade(company)) + properties.market().levelSteps();
    java.util.Optional<Employee> hr = hrOf(company);
    if (hr.isPresent()) {
      level = Math.max(level, LADDER.indexOf(hrCap(hr.get())));
    }
    return level;
  }

  /** 확률표의 한 칸이 이 회사에서 나오는 종합 등급. 바닥은 F, 맨 위는 GOD. */
  String rateGrade(CompanyState company, CompanyProperties.Rate rate) {
    return LADDER.get(Math.clamp(drawLevel(company) + rate.steps(), 0, LADDER.size() - 1));
  }

  /** 한 번에 뽑을 수 있는 최대 수. */
  int maxDraws() {
    return properties.gacha().maxDraws();
  }

  /** 확률표 (decisions.md 312번): 회사 등급(인사팀이면 더 높게)을 중심으로 칸마다 등급과 확률. */
  List<CompanyProperties.Rate> rates() {
    return properties.gacha().rates();
  }

  /**
   * 채용 뽑기 (decisions.md 312번): 채용권 count장으로 count명을 뽑는다. 확률표에서 칸을 고르고 그 등급의 사람이 온다(능력치는 그 띠 둘레로
   * 흩어진다). SSS를 넘는 칸이면 능력치가 모두 SSS 띠이고 실전 경험으로 오른 단계(X…)를 안고 온다. ZZ 사수가 있으면 사수의 가장 높은 능력치가 한 띠 높다.
   * 뽑은 사람은 쉬는 채로 들어온다. 채용권이 모자라거나, 데리고 있을 자리가 모자라거나, 한 번에 max-draws를 넘으면 400.
   */
  List<CompanyState.Drawn> draw(CompanyState company, int count, SeededRandom random) {
    requireOpen(company);
    CompanyProperties.Gacha gacha = properties.gacha();
    if (count < 1 || count > gacha.maxDraws()) {
      throw new InvalidRequestException("한 번에 1~" + gacha.maxDraws() + "명까지 뽑는다");
    }
    if (company.tickets < count) {
      throw new InvalidRequestException("채용권이 모자란다");
    }
    if (company.employees.size() + count > rosterMax(company)) {
      throw new InvalidRequestException("데리고 있을 자리가 모자란다. 내보내야 더 뽑는다");
    }
    int total = rates().stream().mapToInt(CompanyProperties.Rate::percent).sum();
    int sssAt = LADDER.indexOf(StatGrade.SSS.name());
    java.util.Optional<Employee> mentor = bestRanked(company, RANK_MENTOR);
    List<String> sectors = content.sectors().stream().map(s -> s.code()).toList();
    company.tickets -= count;
    company.lastDraw.clear();
    for (int i = 0; i < count; i++) {
      RandomGenerator rng = random.forKey("draw", company.draws++);
      int roll = rng.nextInt(total);
      CompanyProperties.Rate rate = rates().getLast();
      for (CompanyProperties.Rate r : rates()) {
        if (roll < r.percent()) {
          rate = r;
          break;
        }
        roll -= r.percent();
      }
      int at = Math.clamp(drawLevel(company) + rate.steps(), 0, LADDER.size() - 1);
      StatGrade band = StatGrade.valueOf(LADDER.get(Math.min(at, sssAt)));
      Map<String, Integer> stats = new LinkedHashMap<>();
      int middle = (band.min() + band.max()) / 2;
      int spread = properties.market().spread();
      for (String code : StatCodes.ALL) {
        // 특급·SSS 위는 능력치가 모두 그 띠 안에 고르다. 보통은 띠 가운데에서 흩어져 성격이 뾰족하다.
        int value =
            rate.star() || at >= sssAt
                ? band.min() + rng.nextInt(band.max() - band.min() + 1)
                : middle + rng.nextInt(2 * spread + 1) - spread;
        stats.put(code, Math.clamp(value, 1, MAX_STAT));
      }
      if (mentor.isPresent()) {
        Employee e = mentor.get();
        String stat =
            StatCodes.ALL.stream()
                .max(java.util.Comparator.comparingInt((String code) -> e.stats.get(code)))
                .orElseThrow();
        stats.merge(stat, properties.experience().band(), (v, d) -> Math.min(MAX_STAT, v + d));
      }
      Employee employee = add(company, nextName(company), stats);
      employee.sector = sectors.get(rng.nextInt(sectors.size()));
      employee.rank = at > sssAt ? Math.min(RANK_GOD, at - sssAt) : 0;
      String grade = employeeGrade(employee);
      CompanyState.Drawn drawn = new CompanyState.Drawn();
      drawn.employeeId = employee.id;
      drawn.name = employee.name;
      drawn.grade = grade;
      drawn.star = rate.star();
      drawn.fresh = collect(company, grade);
      drawn.hello = Korean.fill(quirks.hello(employee), Map.of("name", employee.name));
      company.lastDraw.add(drawn);
      if (drawn.star) {
        history.add(
            company,
            company.year,
            "rise",
            Korean.fill(
                content.raising().company().market().drawStar(),
                Map.of("name", employee.name, "grade", grade)),
            null);
      }
    }
    fitSeats(company);
    return company.lastDraw;
  }

  /**
   * 채용 뽑기 전에 차린 회사를 옮긴다 (decisions.md 312번): 처음 채용권을 주고 지금 직원을 도감에 올린다. 이미 옮겼으면 아무것도 하지 않는다. 옮겼으면
   * true.
   */
  boolean adoptGacha(CompanyState company) {
    if (company.gachaReady) {
      return false;
    }
    company.gachaReady = true;
    company.tickets += properties.gacha().startTickets();
    for (Employee e : company.employees) {
      collect(company, employeeGrade(e));
    }
    return true;
  }

  /** 도감에 한 사람을 올린다. 그 등급이 처음이면 true. */
  private static boolean collect(CompanyState company, String grade) {
    int before = company.collection.getOrDefault(grade, 0);
    company.collection.put(grade, before + 1);
    return before == 0;
  }

  /** 직원을 내보낸다 (decisions.md 312번): 데리고 있을 자리를 비운다. 명예의 전당과 연표에 남는다. */
  void release(CompanyState company, int employeeId) {
    requireOpen(company);
    Employee e = employee(company, employeeId);
    history.retire(company, e);
    company.employees.remove(e);
    teams.tidy(company);
  }

  private static Employee employee(CompanyState company, int id) {
    return company.employees.stream()
        .filter(e -> e.id == id)
        .findFirst()
        .orElseThrow(() -> new InvalidRequestException("없는 직원"));
  }

  /** 채용권을 받는다. 받은 까닭을 lines(분기 실적·결산 소식)에 한 줄 남긴다. */
  void giveTickets(CompanyState company, int count, String reason, List<String> lines) {
    if (count <= 0) {
      return;
    }
    company.tickets += count;
    RaisingContent.Market texts = content.raising().company().market();
    if (lines != null) {
      lines.add(
          Korean.fill(
              texts.tickets(),
              Map.of(
                  "count",
                  String.valueOf(count),
                  "reason",
                  texts.ticketReasons().getOrDefault(reason, ""))));
    }
  }

  /** 자리가 줄었을 때 먼저 일어나는 자리: 인사팀 → 종목 발굴팀 → 리서치 팀 → 리스크 관리 팀 → 돈을 굴리는 자리 (decisions.md 248·267번). */
  private static final List<String> STAND_UP_ORDER =
      List.of(HR_DESK, ScoutEngine.SCOUT_DESK, RESEARCH_DESK, RISK_DESK);

  /**
   * 앉은 사람이 자리 수보다 많으면 넘친 사람을 쉬게 한다 (248번). 결산·계약금·새로 받기로 자본이 줄어 회사 등급과 자리 수가 내려갔을 때다. 돈을 굴리는 자리를
   * 지키려고 돕는 자리(인사팀 → 리서치 팀 → 리스크 관리 팀)부터, 그다음 돈을 굴리는 자리에서 나중에 들어온 사람부터 일어난다. 쉬게 된 사람을 들어온 순서로 돌려준다.
   */
  List<Employee> fitSeats(CompanyState company) {
    List<Employee> seated =
        new java.util.ArrayList<>(company.employees.stream().filter(e -> e.desk != null).toList());
    int over = seated.size() - seats(company);
    if (over <= 0) {
      return List.of();
    }
    seated.sort(
        java.util.Comparator.comparingInt(
                (Employee e) -> {
                  int at = STAND_UP_ORDER.indexOf(e.desk);
                  return at < 0 ? STAND_UP_ORDER.size() : at;
                })
            .thenComparingInt(e -> -e.id));
    List<Employee> stood = seated.subList(0, over);
    stood.forEach(e -> e.desk = null);
    teams.tidy(company);
    return stood.stream().sorted(java.util.Comparator.comparingInt(e -> e.id)).toList();
  }

  private void requireOpen(CompanyState company) {
    if (company.sold) {
      throw new InvalidRequestException("팔린 회사다");
    }
  }

  /**
   * 게임 금액 (decisions.md 313번): 1,000마다 a·b·c·d… 로 올라간다(1a 1천 · 1b 100만 · 1c 10억 · 1d 1조 · 1e 1천조).
   * 앞자리는 세 자리까지. 원화(억·조)를 쓰지 않는다. 화면의 labels.ts money()와 같은 꼴이다. 예: 950 · 3.5a · 100b · 41.3b ·
   * −5.2b.
   */
  static String money(long amount) {
    String sign = amount < 0 ? "−" : "";
    double abs = Math.abs((double) amount);
    if (abs < 1000) {
      return sign + (long) abs;
    }
    int unit = 0;
    while (abs >= 1000 && unit < MONEY_UNITS.length()) {
      abs /= 1000;
      unit++;
    }
    int digits = abs < 10 ? 2 : abs < 100 ? 1 : 0;
    java.math.BigDecimal value =
        java.math.BigDecimal.valueOf(abs).setScale(digits, java.math.RoundingMode.HALF_UP);
    if (value.compareTo(java.math.BigDecimal.valueOf(1000)) >= 0 && unit < MONEY_UNITS.length()) {
      unit++;
      value =
          value
              .divide(java.math.BigDecimal.valueOf(1000))
              .setScale(2, java.math.RoundingMode.HALF_UP);
    }
    String text = value.stripTrailingZeros().toPlainString();
    return sign + text + MONEY_UNITS.charAt(unit - 1);
  }

  /** 게임 금액 단위. 등급 글자(F~S)와 헷갈리지 않게 소문자다. */
  static final String MONEY_UNITS = "abcdefghijklmnopqrstuvwxyz";

  String grade(double capital) {
    return grade((long) capital);
  }

  String grade(long capital) {
    int at = 0;
    for (int i = 0; i < properties.gradeCapital().size(); i++) {
      if (capital >= properties.gradeCapital().get(i)) {
        at = i;
      }
    }
    return LADDER.get(at);
  }

  /** 회사 등급을 정하는 자본: 연초 자본. 분기 결산으로 자본이 바뀌어도 등급·건물·자리 수는 연말에만 바뀐다 (268번). */
  long gradedCapital(CompanyState company) {
    return company.gradedCapital != null ? company.gradedCapital : (long) company.capital;
  }

  /** 회사 등급 = 산 건물 (decisions.md 296번). 이 칸이 없던 회사는 연초 자본으로 정한다(296번 전처럼). */
  String grade(CompanyState company) {
    return company.building != null ? company.building : grade(gradedCapital(company));
  }

  int seats(CompanyState company) {
    return seatsOf(grade(company));
  }

  int seats(double capital) {
    return seats((long) capital);
  }

  int seats(long capital) {
    return seatsOf(grade(capital));
  }

  /** 자리 수 (281·287·359번): 등급마다 다르고 목록 끝 위로는 둘씩 는다. 목록이 하나면 모든 등급이 그 수(354번에서 셋으로 묶었던 방식). */
  int seatsOf(String grade) {
    int at = LADDER.indexOf(grade);
    List<Integer> seats = properties.seats();
    if (seats.size() == 1) {
      return seats.getFirst();
    }
    return at < seats.size() ? seats.get(at) : seats.getLast() + 2 * (at - seats.size() + 1);
  }

  /** 다음 건물 (296번): 지금 등급의 다음 띠. 끝 등급이면 null. */
  String nextGrade(CompanyState company) {
    int at = LADDER.indexOf(grade(company)) + 1;
    return at < properties.gradeCapital().size() ? LADDER.get(at) : null;
  }

  /** 최근에 쓴 문구 틀을 몇 개까지 기억하나 (#392). */
  static final int RECENT_LINES = 60;

  /**
   * 같은 문구가 이어 나오지 않게 고른다 (#392): 굴린 자리에서부터 최근에 쓴 것과 이번에 이미 쓴 것을 건너뛴다. 다 썼으면 굴린 것. 고른 틀은 now에 담는다.
   * 굴린 값만으로 정하므로 같은 상태면 같은 줄이 나온다.
   */
  String fresh(CompanyState company, List<String> lines, int roll, java.util.Set<String> now) {
    int start = Math.floorMod(roll, lines.size());
    for (int i = 0; i < lines.size(); i++) {
      String line = lines.get((start + i) % lines.size());
      if (!company.recentLines.contains(line) && !now.contains(line)) {
        now.add(line);
        return line;
      }
    }
    String line = lines.get(start);
    now.add(line);
    return line;
  }

  /** 쓴 문구 틀을 기억한다 (#392). */
  void remember(CompanyState company, java.util.Collection<String> used) {
    company.recentLines.addAll(used);
    while (company.recentLines.size() > RECENT_LINES) {
      company.recentLines.removeFirst();
    }
  }

  /** 업계 순위 소식 문구 (#351). */
  RaisingContent.Industry industryTexts() {
    return content.raising().company().industry();
  }

  /** 다음 건물로 가는 이사 비용 (296번): 다음 띠 자본의 upgrade.percent%. 끝 등급이면 0. */
  long upgradeCost(CompanyState company) {
    String next = nextGrade(company);
    if (next == null) {
      return 0;
    }
    long floor = properties.gradeCapital().get(LADDER.indexOf(next));
    return floor * properties.upgrade().percent() / PERCENT;
  }

  /** 이사하려면 있어야 하는 자본 (296번): 다음 띠 + 이사 비용. 비용을 내고도 그 띠에 남게. 끝 등급이면 null. */
  Long upgradeNeeded(CompanyState company) {
    String next = nextGrade(company);
    if (next == null) {
      return null;
    }
    return properties.gradeCapital().get(LADDER.indexOf(next)) + upgradeCost(company);
  }

  boolean canUpgrade(CompanyState company) {
    Long needed = upgradeNeeded(company);
    return needed != null
        && !company.closed
        && company.buildingTo == null
        && company.capital >= needed;
  }

  /** 그 자리가 열리는 회사 등급 (#393). 처음부터 열려 있으면 null. */
  String unlockGrade(String desk) {
    Map<String, String> unlock = properties.upgrade().deskUnlock();
    return unlock == null ? null : unlock.get(desk);
  }

  /** 그 자리가 지금 회사에 열려 있나 (#393). */
  boolean deskOpen(CompanyState company, String desk) {
    String at = unlockGrade(desk);
    return at == null || LADDER.indexOf(grade(company)) >= LADDER.indexOf(at);
  }

  /**
   * 건물 이사 (decisions.md 296·405번): 이사 비용을 내고 곧바로 다음 건물로 올라간다(공사 기간 없음). 자리 수·규모의 벽은 바로 새 건물로 바뀐다.
   * 랜드마크 타워에 올라도 엔딩 없이 이어진다(374번). 돈이 모자라거나 끝 등급이면 400.
   */
  void upgrade(CompanyState company) {
    String next = nextGrade(company);
    if (next == null) {
      throw new InvalidRequestException("더 올라갈 건물이 없다");
    }
    if (company.closed) {
      throw new InvalidRequestException("끝난 회사다");
    }
    if (!canUpgrade(company)) {
      throw new InvalidRequestException("이사하려면 자본이 " + money(upgradeNeeded(company)) + " 있어야 한다");
    }
    long cost = upgradeCost(company);
    company.capital -= cost;
    company.gradedCapital = (long) company.capital;
    // 공사 기간 없이 바로 옮긴다 (405번): 322번(#347)의 몇 해에 걸친 공사를 뺐다.
    company.building = next;
    history.add(company, company.year, "grow", null, next);
    giveTickets(company, properties.gacha().moveTickets(), "move", new ArrayList<>());
    landmark(company, next, new ArrayList<>());
  }

  /** 랜드마크 타워에 올랐다 (276·374번): 엔딩 없이 축하 한 줄과 연표만 남기고 회사는 이어진다. 그 밖의 건물이면 아무것도 안 한다. */
  private void landmark(CompanyState company, String to, List<String> lines) {
    if (!to.equals(properties.endingGrade())) {
      return;
    }
    lines.add(
        Korean.fill(
            content.raising().company().ending().line(),
            Map.of("years", String.valueOf(company.year))));
    history.add(
        company,
        company.year,
        "ending",
        content.raising().company().history().events().get("ending"),
        to);
  }

  /** 규모의 벽 (decisions.md 244번): 등급 단계만큼 거듭제곱한 비율을 곱한다. F는 그대로. */
  private int scaled(CompanyState company, int bp, int percent) {
    double factor = Math.pow(percent / (double) PERCENT, scaleStep(company));
    return (int) Math.round(bp * factor);
  }

  /**
   * 규모의 벽을 정하는 회사 등급 단계(F = 0). 건물이 아니라 자본의 띠로 정한다 (#344): 건물로 정하면 이사를 안 하고 반지하에 머물러 벽을 피할 수 있었다.
   */
  private int scaleStep(CompanyState company) {
    // 판돈이 건물의 값이 된 뒤(411번)로는 벽도 건물로 정한다: 자본으로 정하면 자본을 강화에 써 띠를 낮춰 벽을 피할 수 있다. 반지하에 머무르면 판돈이 작아
    // #344의 틈은
    // 없다.
    return LADDER.indexOf(grade(company));
  }

  /**
   * 분기 데스크에서 맞혔을 때 버는 몫(만분율, 387번) = 자리의 몫 × 데스크 규모의 벽 × (1 + 등급 효과). 등급 효과가 등급마다 두 배라 벽도 회사 등급마다
   * 거의 절반씩 높아진다: 회사 등급과 같은 등급의 직원은 전과 비슷하게 벌고, 같은 회사에서 한 등급 높은 직원은 두 배 가까이 번다.
   */
  long tradeGainBp(CompanyState company, Employee employee, int bp) {
    List<Double> wall = properties.scale().deskGainPercent();
    double factor = wall.get(Math.min(scaleStep(company), wall.size() - 1)) / PERCENT;
    return Math.round(bp * factor * (PERCENT + perkGainPercent(employee)) / PERCENT);
  }

  /** 종목 회의 판돈의 규모의 벽 (decisions.md 388번). 큰 회사일수록 줄어든다. 회의 수익률의 폭은 그대로다. */
  long scaledMeetingStake(CompanyState company, long stake) {
    double factor =
        Math.pow(properties.scale().meetingPercent() / (double) PERCENT, scaleStep(company));
    return Math.round(stake * factor);
  }

  /** 틀리거나 손이 뒤집혀 잃는 몫. 큰 회사일수록 커진다. */
  int scaledMiss(CompanyState company, int bp) {
    return scaled(company, bp, properties.scale().missPercent());
  }

  /**
   * 회사의 처음 상태를 놓는다 (decisions.md 523번). 분기·결산이 없어 해마다 다시 정하던 시장 갈래·폭락·조짐은 없다: 시장은 늘 보통이다. 종목회의는 기회가
   * 있을 때 사장이 열면 그때 준비한다.
   */
  void begin(CompanyState company) {
    company.phase = NORMAL;
    company.gradedCapital = null;
    company.realtime = true;
  }

  /**
   * 분기·결산이 있던 때의 회사를 실시간 구조로 옮긴다 (523번). 자본·직원·건물·진행도는 그대로 두고, 시장 갈래·폭락·조짐을 지우고, 짓던 건물은 바로 다 짓는다.
   * 분기·결산 기록은 저장에서 읽지 않으므로 다음 저장 때 사라진다. 옮겼으면 true.
   */
  boolean adoptRealtime(CompanyState company) {
    if (company.realtime) {
      return false;
    }
    if (company.buildingTo != null) {
      company.building = company.buildingTo;
      company.buildingTo = null;
    }
    begin(company);
    return true;
  }

  /** 끝났던 회사(파산·엔딩·시대의 끝·매각)를 되살려 이어서 한다 (523번). */
  void revive(CompanyState company) {
    company.closed = false;
    company.sold = false;
    company.finished = false;
    adoptRealtime(company);
  }

  /**
   * 직원 한 명의 초당 수입 (523번): 종합 등급의 기본값 × (1 + 능력치 합 ÷ 100). 게임 1초에 버는 돈이고 그 벽의 물가와 멘탈 보호 보너스는 여기 없다
   * (IdleEngine.incomeRate가 곱한다). 자리·팀·사기는 보지 않는다: 뽑은 직원은 어디에 있든 번다.
   */
  double incomeOf(Employee employee) {
    Map<String, Long> base = properties.income().gradePerSecond();
    String grade = employeeGrade(employee);
    long perSecond = base.getOrDefault(grade, base.getOrDefault(LADDER.getFirst(), 0L));
    int stats = employee.stats.values().stream().mapToInt(Integer::intValue).sum();
    return perSecond * (1 + stats / (double) PERCENT);
  }

  /** 모든 직원의 초당 수입의 합 (523번). */
  double staffIncome(CompanyState company) {
    return company.employees.stream().mapToDouble(this::incomeOf).sum();
  }

  /** 자리를 비운 동안 수입이 쌓이는 시간의 상한(초, 523번). */
  long offlineSeconds() {
    return properties.income().offlineHours() * 3600L;
  }

  /**
   * 종목회의의 기회를 지금 시각까지 센다 (523번): interval-minutes마다 하나, max까지. 처음 세는 회사는 시작 기회를 받는다. 상한에 찬 동안 흐른 시간은
   * 버린다(상한에서 하나를 쓰면 그때부터 다시 센다).
   */
  void accrueMeetings(CompanyState company, long now) {
    CompanyProperties.Meetings rule = properties.meetings();
    if (company.meetingAt <= 0) {
      company.meetingChances = Math.min(rule.max(), Math.max(company.meetingChances, rule.startChances()));
      company.meetingAt = now;
      return;
    }
    long interval = rule.intervalMinutes() * 60_000L;
    if (company.meetingChances >= rule.max()) {
      company.meetingChances = rule.max();
      company.meetingAt = now;
      return;
    }
    long gained = Math.max(0, now - company.meetingAt) / interval;
    if (gained <= 0) {
      return;
    }
    company.meetingChances = (int) Math.min(rule.max(), company.meetingChances + gained);
    company.meetingAt =
        company.meetingChances >= rule.max() ? now : company.meetingAt + gained * interval;
  }

  /**
   * 종목회의를 연다 (523번). 정하지 않은 회의가 있으면 그 회의로 돌아간다(기회를 다시 쓰지 않는다). 없으면 기회 하나를 써서 새 회의를 준비하고, 직원이 종목을 물어
   * 오고, 지금 배치로 한마디를 굳힌다. 기회가 없거나 돈을 굴리는 직원이 없으면 400(기회는 쓰지 않는다).
   */
  void openMeeting(CompanyState company, SeededRandom random, long now) {
    if (invest.open(company)) {
      invest.convene(company, random);
      return;
    }
    accrueMeetings(company, now);
    if (traders(company).isEmpty()) {
      throw new InvalidRequestException("돈을 굴리는 자리에 직원이 있어야 종목회의를 열 수 있다");
    }
    if (company.meetingChances <= 0) {
      throw new InvalidRequestException("아직 종목회의를 열 기회가 없다");
    }
    company.meetingChances--;
    company.meetings++;
    company.invest = invest.create(company, random);
    scout.discover(company, random);
    invest.convene(company, random);
  }

  int meetingMax() {
    return properties.meetings().max();
  }

  /** 다음 기회까지 남은 시간(초). 상한에 찼으면 0. */
  long meetingWaitSeconds(CompanyState company, long now) {
    CompanyProperties.Meetings rule = properties.meetings();
    if (company.meetingChances >= rule.max() || company.meetingAt <= 0) {
      return 0;
    }
    long interval = rule.intervalMinutes() * 60_000L;
    return Math.max(0, company.meetingAt + interval - now + 999) / 1000;
  }

  List<Long> gradeCapital() {
    return properties.gradeCapital();
  }

  /** 이 시대에 뜨는 자리: 시대 보너스가 붙은 돈 굴리는 자리, 자리 순서대로 (9.4절). */
  List<String> hotDesks(CompanyState company) {
    Map<String, Integer> bonus = era(company).deskBonusBp();
    return desks().stream()
        .map(RaisingContent.Desk::code)
        .filter(code -> bonus.getOrDefault(code, 0) > 0)
        .toList();
  }

  /** 연초 회의의 "이번 시대에 뜨는 섹터" 한 줄. 뜨는 자리가 없는 시대면 null. */
  String hotLine(CompanyState company) {
    List<String> hot = hotDesks(company);
    if (hot.isEmpty()) {
      return null;
    }
    return Korean.fill(
        content.raising().company().hotLine(),
        Map.of("desks", String.join("·", hot.stream().map(code -> desk(code).name()).toList())));
  }

  String sectorName(String code) {
    return content.sectorName(code);
  }

  /** 직원이 자기 관심 섹터의 섹터 데스크에 앉았는가 (4.2절). */
  boolean interested(Employee employee) {
    return employee.sector != null
        && employee.desk != null
        && employee.sector.equals(desk(employee.desk).sector());
  }

  /**
   * 맞혔을 때 버는 몫(만분율): 자리의 몫 + 이 시대에 뜨는 섹터의 보너스(9.4절) + 관심 섹터 보너스. 결산과 투자 회의가 같이 쓴다. X 확신은 결산에서만 더한다.
   */
  int gainBp(CompanyState company, Employee employee) {
    return returnsOf(employee.desk).gainBp()
        + era(company).deskBonusBp().getOrDefault(employee.desk, 0)
        + (interested(employee) ? properties.interestBonusBp() : 0);
  }

  /** 그 자리에서 맞혔을 때 버는 몫(만분율): 자리의 몫 + 시대 보너스. 화면의 예상 효과용 (259번). */
  int deskGainBp(CompanyState company, String desk) {
    return returnsOf(desk).gainBp() + era(company).deskBonusBp().getOrDefault(desk, 0);
  }

  List<RaisingContent.Desk> desks() {
    return content.raising().company().desks();
  }

  /** 섹터 데스크면 그 섹터 코드, 아니면 null. */
  String deskSector(String code) {
    return code == null ? null : desk(code).sector();
  }

  /** 그 자리에 앉은 사람의 직함(종합 등급 C 아래·S 아래·S 이상). 직함이 없는 자리면 null (decisions.md 267번). */
  List<String> deskRoles(String code) {
    return desk(code).roles();
  }

  RaisingContent.Desk desk(String code) {
    return desks().stream()
        .filter(d -> d.code().equals(code))
        .findFirst()
        .orElseThrow(() -> new InvalidRequestException("없는 자리: " + code));
  }

  /** 한 자리(데스크·팀)에 앉힐 수 있는 최대 인원 (decisions.md 440번, 사용자 결정). 앱의 `placement.ts` DESK_CAP과 같다. */
  static final int DESK_CAP = 8;

  /** 직원을 자리에 앉힌다. 자리 수를 넘게 앉힐 수 없다. 빠진 직원은 쉬고, 같은 자리에는 DESK_CAP명까지 앉는다. */
  void place(CompanyState company, Map<Integer, String> placements) {
    int placed = (int) placements.values().stream().filter(d -> d != null).count();
    if (placed > seats(company)) {
      throw new InvalidRequestException("자리가 모자란다");
    }
    Map<String, Integer> perDesk = new HashMap<>();
    for (String code : placements.values()) {
      if (code != null && perDesk.merge(code, 1, Integer::sum) > DESK_CAP) {
        throw new InvalidRequestException("한 자리에는 " + DESK_CAP + "명까지 앉힐 수 있다");
      }
    }
    Set<Integer> ids = new HashSet<>();
    for (Employee employee : company.employees) {
      ids.add(employee.id);
    }
    if (!ids.containsAll(placements.keySet())) {
      throw new InvalidRequestException("없는 직원");
    }
    for (String code : placements.values()) {
      if (code != null) {
        desk(code);
      }
    }
    for (Employee employee : company.employees) {
      employee.desk = placements.get(employee.id);
    }
    teams.tidy(company);
  }

  /** 꼬드김에 넘어갈 확률과 손이 뒤집힐 확률(만분율). */
  record Odds(int swayBp, int flipBp) {}

  /**
   * 돈을 굴리는 직원의 판정 확률. 꼬드김은 줏대로(리스크 관리 팀이 막는다), 손 뒤집힘은 자리가 원하는 능력치로(폭락장이면 인내심) 굴린다. Z 리더가 같은 자리에 있으면
   * 둘 다 줄어든다 (2.4절). 결산과 투자 회의가 같이 쓴다.
   */
  Odds odds(CompanyState company, Employee employee) {
    int risk = bestOf(company, RISK_DESK, StatCodes.CONVICTION);
    int swayBp =
        behavior.flipChanceBp(employee.stats.get(StatCodes.CONVICTION))
            * properties.swayPercent()
            / PERCENT
            * (PERCENT - risk)
            / PERCENT;
    int flipBp = behavior.flipChanceBp(employee.stats.get(flipStat(company, employee)));
    if (settled(employee)) {
      // 같은 자리 세 해째부터 손에 익는다 (262번).
      flipBp = flipBp * properties.people().settledFlipPercent() / PERCENT;
    }
    // 등급 효과 (387번): 높은 등급일수록 판단이 흔들리지 않는다.
    flipBp = flipBp * perkFlipPercent(employee.stats) / PERCENT;
    // 사기 (270번): 낮으면 손이 더 뒤집히고 높으면 덜 뒤집힌다.
    flipBp = flipBp * pay.moralePercent(employee) / PERCENT;
    swayBp = swayBp * pay.moralePercent(employee) / PERCENT;
    boolean led =
        company.employees.stream()
            .anyMatch(e -> e != employee && employee.desk.equals(e.desk) && e.rank >= RANK_LEADER);
    if (led) {
      swayBp = swayBp * properties.effects().leaderFlipPercent() / PERCENT;
      flipBp = flipBp * properties.effects().leaderFlipPercent() / PERCENT;
    }
    // GOD 신의 손 (289번): 회사에 한 명만 있어도 모든 직원이 덜 흔들린다.
    if (company.employees.stream().anyMatch(e -> e.rank >= RANK_GOD)) {
      swayBp = swayBp * properties.effects().godFlipPercent() / PERCENT;
      flipBp = flipBp * properties.effects().godFlipPercent() / PERCENT;
    }
    return new Odds(swayBp, flipBp);
  }

  String flipStat(CompanyState company, Employee employee) {
    return CRASH.equals(company.phase) ? StatCodes.PATIENCE : desk(employee.desk).statCode();
  }

  /** 리서치 팀의 가장 높은 안목. 아무도 없으면 0. 돈을 굴리는 직원에게 형광펜을 빌려준다 (4.2절). */
  int researchInsight(CompanyState company) {
    return bestOf(company, RESEARCH_DESK, StatCodes.INSIGHT);
  }

  /** 리서치 팀에서 안목이 가장 높은 직원. */
  java.util.Optional<Employee> researcher(CompanyState company) {
    return company.employees.stream()
        .filter(e -> RESEARCH_DESK.equals(e.desk))
        .max(
            java.util.Comparator.comparingInt((Employee e) -> e.stats.get(StatCodes.INSIGHT))
                .thenComparingInt(e -> -e.id));
  }

  /** 돈을 굴리는 자리에 앉은 직원들. */
  List<Employee> traders(CompanyState company) {
    return company.employees.stream().filter(e -> e.desk != null && desk(e.desk).trades()).toList();
  }

  /**
   * 돈을 굴리는 직원 한 명이 맡는 판돈 = 건물의 값 × 비율 ÷ 사람 수 (411번). 자본과 상관없어 자본보다 클 수 있다. 직원마다 버는 몫은 등급 효과(387번)가
   * 정한다.
   */
  long stakeOf(CompanyState company, int traders) {
    if (traders == 0) {
      return 0;
    }
    long base = stakeBase(company);
    long pot = (long) (base * properties.stakePercent() / (double) PERCENT);
    return pot / traders;
  }

  /**
   * 판돈과 수수료를 정하는 돈 = 지금 건물의 값 (410번 뒤 411번, #567). 전에는 자본(268번)이라 전투 강화·이사에 자본을 쓰면 버는 양이 함께 줄었다.
   * 건물의 값은 그 등급의 자본 띠(`grade-capital`)이고, 띠가 0인 반지하(F)는 사장의 사재(`base-capital`)다. 자본이 줄어도 건물이 그대로면
   * 버는 양도 그대로다.
   */
  long stakeBase(CompanyState company) {
    return buildingValue(company);
  }

  /** 지금 건물의 값 (411번): 그 등급의 자본 띠. 반지하(띠 0)는 사장의 사재, 띠 표 너머 등급은 마지막 띠. */
  long buildingValue(CompanyState company) {
    List<Long> bands = properties.gradeCapital();
    int at = Math.min(LADDER.indexOf(grade(company)), bands.size() - 1);
    long band = bands.get(Math.max(0, at));
    return band > 0 ? band : properties.baseCapital();
  }

  CompanyProperties.DeskReturn returnsOf(String desk) {
    return properties.desks().get(desk);
  }

  /** 폭락장 손익이 이 비율 이하인 자리(식품·금융)는 폭락에 덜 빠진다. 웹의 자동 배치(`crashSafe`)와 같은 기준이다. */
  static final int CRASH_SAFE_PERCENT = 50;

  /** 판돈 × 만분율. 높은 등급이 버는 몫(387번)이 커서 곱이 long을 넘으면 실수로 셈한다. */
  static long ofStake(long stake, long bp) {
    long high = Math.multiplyHigh(stake, bp);
    long low = stake * bp;
    boolean fits = high == 0 && low >= 0 || high == -1 && low < 0;
    return fits ? low / BP : (long) ((double) stake * bp / BP);
  }

  /** 넘치면 long 끝에 멈추는 덧셈: 꼭대기 직원이 버는 몫(387번)이 자본을 음수로 뒤집지 않게. */
  /**
   * 잃을 자본이 모자랄 때 손실을 줄인다 (411번). 판돈이 자본이 아니라 건물의 값에서 나와 자본보다 클 수 있다: 가진 돈(available)보다 많이 잃지 않게 잃은
   * 몫들을 같은 비율로 깎는다. 번 몫은 그대로다. 합이 −available 아래로 내려가지 않는 새 손익을 돌려준다.
   */
  static long[] capLosses(long available, long[] pnls) {
    long total = 0;
    long lost = 0;
    for (long p : pnls) {
      total = plus(total, p);
      if (p < 0) {
        lost = plus(lost, p);
      }
    }
    long floor = -Math.max(0, available);
    if (total >= floor || lost == 0) {
      return pnls.clone();
    }
    // 잃은 몫의 합이 floor − 번 몫이 되게 깎는다.
    long gained = total - lost;
    long target = Math.min(0, floor - gained);
    double ratio = (double) target / lost;
    long[] out = pnls.clone();
    long sum = 0;
    int last = -1;
    for (int i = 0; i < out.length; i++) {
      if (out[i] < 0) {
        out[i] = Math.round(out[i] * ratio);
        sum += out[i];
        last = i;
      }
    }
    out[last] += target - sum;
    return out;
  }

  /**
   * 자동 전투의 물가 (decisions.md 505번): 벽 하나를 돌파할 때마다 벽 보상·시간 수입이 함께 이만큼 곱해진다. 돈의 단위가 벽을 따라 a, b, c … z로
   * 커진다. 전투 강화의 값은 물가를 따르지 않고 단계로만 정한다 (519번). 실수가 넘치지 않게 지수는 6,000벽에서 멈춘다.
   */
  static final double INFLATION = 1.1;

  static double inflation(CompanyState company) {
    long wall = company.idle == null ? 1 : company.idle.wall;
    return StrictMath.pow(INFLATION, Math.max(0, Math.min(6_000, wall - 1)));
  }

  static long plus(long a, long b) {
    long sum = a + b;
    return ((a ^ sum) & (b ^ sum)) < 0 ? (a < 0 ? Long.MIN_VALUE : Long.MAX_VALUE) : sum;
  }

  /** 직원의 종합 등급: 다섯 능력치 평균의 F~SSS, SSS면 뽑을 때 정해진 X~ZZZ (2.2·2.3절, 421번). */
  static String employeeGrade(Employee employee) {
    return gradeOf(employee.stats, employee.rank);
  }

  /** 능력치와 SSS 위의 단계로 매기는 종합 등급. 지원자(경력직)도 같이 쓴다. */
  static String gradeOf(Map<String, Integer> stats, int rank) {
    String base = overallGrade(stats);
    if (rank == 0 || !StatGrade.SSS.name().equals(base)) {
      return base;
    }
    return LADDER.get(LADDER.indexOf(StatGrade.SSS.name()) + rank);
  }

  /** 그 단계 이상의 직원 가운데 가장 높은 직원. 정보를 주는 효과는 한 명만 있어도 되고 여럿이어도 겹치지 않는다 (2.4절). */
  static java.util.Optional<Employee> bestRanked(CompanyState company, int rank) {
    return company.employees.stream()
        .filter(e -> e.rank >= rank)
        .max(
            java.util.Comparator.comparingInt((Employee e) -> e.rank).thenComparingInt(e -> -e.id));
  }

  /**
   * 직원이 가진 등급 효과 이름. 쌓인다: 능력치로 매긴 종합 등급까지의 A 손절·S 끌어주기·SS 방패·SSS 전설의 촉(387번) 위에 SSS 위 단계만큼 X 확신 …
   * GOD 신의 손(2.4절).
   */
  List<String> effectsOf(Employee employee) {
    int at = LADDER.indexOf(overallGrade(employee.stats));
    int sss = LADDER.indexOf(StatGrade.SSS.name());
    return content.raising().company().effects().list().stream()
        .filter(
            effect -> {
              int grade = LADDER.indexOf(effect.grade());
              return grade <= sss ? grade <= at : grade - sss <= employee.rank;
            })
        .map(RaisingContent.Effect::name)
        .toList();
  }

  /** 그 자리에 앉은 직원 가운데 가장 높은 능력치. 아무도 없으면 0. */
  private static int bestOf(CompanyState company, String desk, String stat) {
    return company.employees.stream()
        .filter(e -> desk.equals(e.desk))
        .mapToInt(e -> e.stats.get(stat))
        .max()
        .orElse(0);
  }

  /** 다섯 능력치 평균의 등급 (2.3절). */
  static String overallGrade(Map<String, Integer> stats) {
    int sum = stats.values().stream().mapToInt(Integer::intValue).sum();
    return StatGrade.of(Math.round(sum / (float) stats.size())).name();
  }

  static Map<String, String> grades(Map<String, Integer> stats) {
    Map<String, String> grades = new HashMap<>();
    stats.forEach((code, value) -> grades.put(code, StatGrade.of(value).name()));
    return grades;
  }
}
