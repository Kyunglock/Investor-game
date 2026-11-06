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
import investorgame.raising.internal.CompanyState.Result;
import investorgame.raising.internal.CompanyState.Settlement;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.random.RandomGenerator;
import org.springframework.stereotype.Component;

/**
 * 아주 작은 회사의 규칙 (증권사 육성 설계 4·6절): 사장은 사람을 뽑아 배치만 하고 직원은 능력치대로 알아서 굴린다. 한 해 = 연초 회의(공채 시장) → 배치 → 결산.
 * DB와 시각을 모르고 상태와 난수만 받는다.
 */
@Component
class CompanyEngine {

  /** 모든 객체가 쓰는 등급표 15단계 (2.1절). */
  static final List<String> LADDER =
      List.of("F", "E", "D", "C", "B", "A", "S", "SS", "SSS", "X", "XX", "XXX", "Z", "ZZ", "ZZZ");

  static final String CRASH = "crash";
  private static final String NORMAL = "normal";

  /** 폭락장인데 아무도 바닥에서 던지지 않은 해의 머리줄 (254번). */
  private static final String CRASH_HELD = "crashHeld";

  /** 큰 손실 때 같은 횟수로 뒤집힌 능력치를 탓하는 순서. 결산 말풍선(224번)과 같다. */
  private static final List<String> FLIP_BLAME_ORDER =
      List.of(StatCodes.CONVICTION, StatCodes.PATIENCE, StatCodes.COURAGE);

  private static final String RISK_DESK = "risk";
  private static final String RESEARCH_DESK = "research";
  private static final int BP = 10_000;
  private static final int PERCENT = 100;
  private static final int MAX_STAT = 100;

  /** SSS 위 단계(Employee.rank)별 효과가 열리는 자리 (2.4절). 효과는 쌓인다. */
  static final int RANK_CONVICTION = 1;

  static final int RANK_ALARM = 2;
  static final int RANK_CONTRARIAN = 3;
  static final int RANK_LEADER = 4;
  static final int RANK_MENTOR = 5;
  static final int RANK_FORESIGHT = 6;

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
  }

  static final String HR_DESK = "hr";

  /** 인사팀에 앉은 직원 가운데 종합 등급이 가장 높은 직원 (6.3절). 없으면 공채를 맡길 수 없다. */
  java.util.Optional<Employee> hrOf(CompanyState company) {
    return company.employees.stream()
        .filter(e -> HR_DESK.equals(e.desk))
        .max(
            java.util.Comparator.comparingInt((Employee e) -> LADDER.indexOf(employeeGrade(e)))
                .thenComparingInt(e -> -e.id));
  }

  /** 인사 직원이 데려오는 지원자의 중심 등급: 인사 직원보다 두 단계 아래, 바닥 F (6.3절). */
  String hrCap(Employee hr) {
    return LADDER.get(Math.max(0, LADDER.indexOf(employeeGrade(hr)) - properties.hr().capSteps()));
  }

  int turns() {
    return properties.turns();
  }

  /** 사장의 사재로 첫 회사를 차린다. 직원은 없고, 첫 해 공채 시장에서 뽑는다 (decisions.md 228번). */
  CompanyState open(SeededRandom random, long capital) {
    CompanyState company = new CompanyState();
    company.capital = Math.max(0, capital);
    company.era = eras().getFirst().code();
    company.opening =
        Korean.fill(content.raising().company().opening(), Map.of("capital", won(company.capital)));
    startYear(company, random);
    return company;
  }

  /**
   * 회사가 망했다 (decisions.md 246번): 자본이 0이거나, 직원이 없는데 가장 싼 계약금도 낼 수 없다. 수수료도 판돈도 자본에 비례해서 이대로는 다시 일어설
   * 수 없다. 매각이 빠진 뒤(236번)로는 이것이 회사를 닫고 새로 차리는 유일한 길이다.
   */
  boolean broke(CompanyState company) {
    if (company.closed || company.capital <= 0) {
      return true;
    }
    long cheapest = properties.market().fees().getFirst();
    return company.employees.isEmpty() && company.capital < cheapest;
  }

  /**
   * 망한 회사를 닫고 사장의 사재로 다음 회사를 차린다 (246번). 직원은 따라오지 않는다. 회사 번호와 만난 지원자 수(이름)는 이어 센다. 망하지 않은 회사면 400.
   */
  CompanyState restart(CompanyState broke, SeededRandom random, long capital) {
    if (!broke(broke)) {
      throw new InvalidRequestException("아직 망하지 않은 회사다");
    }
    broke.closed = true;
    CompanyState next = new CompanyState();
    next.number = broke.number + 1;
    next.hired = broke.hired;
    next.met = broke.met;
    next.capital = Math.max(0, capital);
    next.era = pickEra(broke.era, random.forKey("era-restart", next.number));
    next.opening =
        Korean.fill(
            content.raising().company().bankrupt().opening(),
            Map.of(
                "number",
                String.valueOf(broke.number),
                "next",
                String.valueOf(next.number),
                "capital",
                won(next.capital)));
    startYear(next, random);
    return next;
  }

  /** 망한 회사의 한 줄. 망하지 않았으면 null. */
  String brokeNotice(CompanyState company) {
    return broke(company) ? content.raising().company().bankrupt().notice() : null;
  }

  /** 첫 회사의 시작 자본(사장의 사재). */
  long openingCapital() {
    return properties.sale().baseCapital();
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

  RaisingContent.Sale saleTexts() {
    return content.raising().company().sale();
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

  /** 한 시대의 길이(해). 시대마다 이만큼 지나면 다른 시대가 온다 (decisions.md 249번). */
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
   * 그 해의 시대 (249번). 지금 시대 안이면 지금 시대, 다음 시대의 첫해면 다음 시대를 (회사 시드와 시대 번호로만) 정해 돌려준다. 그래서 다음 해 시장을 미리
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
            || LADDER.indexOf(grade(company.capital))
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
    int points = LADDER.indexOf(grade(company.capital)) + 1;
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
    next.capital = sale.baseCapital() * (PERCENT + steps * sale.fameCapitalPercent()) / PERCENT;
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
            won(next.capital),
            "names",
            String.join("·", next.employees.stream().map(e -> e.name).toList()));
    next.opening =
        Korean.fill(next.employees.isEmpty() ? texts.openingAlone() : texts.opening(), values);
    startYear(next, random);
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
    employee.stats.putAll(stats);
    company.employees.add(employee);
    return employee;
  }

  /**
   * 다음 지원자 이름 (decisions.md 255번): 성 × 이름 조합을 겹치지 않게 돌려 쓴다. 만난 순서에 서로소인 보폭을 곱해 섞어서 이웃한 지원자의 성이 다르다.
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

  /**
   * 올해 공채 시장의 지원자를 받는다 (decisions.md 228번). 종합 등급의 중심은 회사 등급보다 두 단계 위이고(인사팀이 있으면 인사 직원보다 두 단계 아래까지
   * 오른다), 지원자마다 한 단계 아래·위로 흩어진다. 첫 지원자는 올해 필요한 자리에 맞는 사람이라 그 능력치가 뾰족하다. ZZ 사수가 있으면 한 지원자에게 붙어 사수의
   * 가장 높은 능력치가 한 띠 높다. 인사팀이 있으면 한 명 더 온다.
   */
  void deal(CompanyState company, SeededRandom random) {
    CompanyProperties.Market market = properties.market();
    RandomGenerator rng = random.forKey("applicants", company.year, company.refreshes);
    int level = LADDER.indexOf(grade(company.capital)) + market.levelSteps();
    java.util.Optional<Employee> hr = hrOf(company);
    if (hr.isPresent()) {
      level = Math.max(level, LADDER.indexOf(hrCap(hr.get())));
    }
    int top = LADDER.indexOf(StatGrade.SSS.name());
    int count = market.applicants() + (hr.isPresent() ? properties.hr().extraApplicants() : 0);
    String wantedStat = desk(company.wantedDesk).statCode();
    java.util.Optional<Employee> mentor = bestRanked(company, RANK_MENTOR);
    RaisingContent.Company texts = content.raising().company();
    company.applicants.clear();
    // 관심 섹터는 따로 굴려 능력치 난수를 흔들지 않는다. 첫 지원자는 올해 필요한 자리가 섹터 데스크면 그 섹터에 관심이 있다.
    RandomGenerator sectorRng = random.forKey("applicant-sectors", company.year, company.refreshes);
    List<String> sectors = content.sectors().stream().map(s -> s.code()).toList();
    for (int i = 0; i < count; i++) {
      String sector = sectors.get(sectorRng.nextInt(sectors.size()));
      if (i == 0 && desk(company.wantedDesk).sector() != null) {
        sector = desk(company.wantedDesk).sector();
      }
      int at = Math.clamp(level + rng.nextInt(3) - 1, 0, top);
      StatGrade center = StatGrade.valueOf(LADDER.get(at));
      int middle = (center.min() + center.max()) / 2;
      Map<String, Integer> stats = new java.util.LinkedHashMap<>();
      for (String code : StatCodes.ALL) {
        int spread = market.spread();
        stats.put(code, Math.clamp(middle + rng.nextInt(2 * spread + 1) - spread, 1, MAX_STAT));
      }
      String line = null;
      if (i == 0) {
        // 연초 회의가 말한 "올해 필요한 인재"가 꼭 한 명은 온다.
        int spike = Math.min(MAX_STAT, middle + market.spread() + properties.experience().band());
        stats.merge(wantedStat, spike, Math::max);
        line =
            Korean.fill(
                texts.market().wanted(),
                Map.of(
                    "desk", desk(company.wantedDesk).name(),
                    "stat", texts.statNames().get(wantedStat)));
      } else if (i == 1 && mentor.isPresent()) {
        Employee e = mentor.get();
        String stat =
            StatCodes.ALL.stream()
                .max(java.util.Comparator.comparingInt((String code) -> e.stats.get(code)))
                .orElseThrow();
        stats.merge(stat, properties.experience().band(), (v, d) -> Math.min(MAX_STAT, v + d));
        line =
            Korean.fill(
                texts.effects().mentorTip(),
                Map.of("name", e.name, "stat", texts.statNames().get(stat)));
      } else if (i == count - 1 && hr.isPresent()) {
        line = Korean.fill(texts.market().hr(), Map.of("name", hr.get().name));
      }
      CompanyState.Applicant applicant = new CompanyState.Applicant();
      applicant.id = company.met + 1;
      applicant.name = nextName(company);
      applicant.stats.putAll(stats);
      applicant.fee = fee(stats);
      applicant.line = line;
      applicant.sector = sector;
      company.applicants.add(applicant);
    }
  }

  /** 종합 등급으로 정하는 계약금. */
  long fee(Map<String, Integer> stats) {
    List<Long> fees = properties.market().fees();
    return fees.get(Math.min(fees.size() - 1, LADDER.indexOf(overallGrade(stats))));
  }

  long refreshCost() {
    return properties.market().refreshCost();
  }

  /** 값을 내고 올해 지원자를 새로 받는다. 돈이 모자라면 400. */
  void refresh(CompanyState company, SeededRandom random) {
    requireOpen(company);
    long cost = refreshCost();
    if (company.capital < cost) {
      throw new InvalidRequestException("지원자를 새로 받을 돈이 모자란다");
    }
    company.capital -= cost;
    company.yearHiring += cost;
    company.refreshes++;
    fitSeats(company);
    deal(company, random);
  }

  /**
   * 계약금을 내고 지원자를 뽑는다. 자리가 꽉 찼으면 replace의 직원을 내보낸다. 뽑은 직원은 쉬는 채로 들어오고, 사장이 자리에 앉힌다. 돈이 모자라거나 없는 지원자면
   * 400.
   */
  Employee hireApplicant(CompanyState company, int applicantId, Integer replace) {
    requireOpen(company);
    CompanyState.Applicant applicant =
        company.applicants.stream()
            .filter(a -> a.id == applicantId)
            .findFirst()
            .orElseThrow(() -> new InvalidRequestException("없는 지원자"));
    if (company.capital < applicant.fee) {
      throw new InvalidRequestException("계약금이 모자란다");
    }
    if (company.employees.size() >= seats(company.capital - applicant.fee)) {
      if (replace == null || company.employees.stream().noneMatch(e -> e.id == replace)) {
        throw new InvalidRequestException("자리가 꽉 찼다. 내보낼 직원을 고른다");
      }
      company.employees.removeIf(e -> e.id == replace);
    }
    company.capital -= applicant.fee;
    company.yearHiring += applicant.fee;
    company.applicants.remove(applicant);
    fitSeats(company);
    Employee employee = add(company, applicant.name, applicant.stats);
    employee.sector = applicant.sector;
    return employee;
  }

  /** 자리가 줄었을 때 먼저 일어나는 자리: 인사팀 → 리서치 팀 → 리스크 관리 팀 → 돈을 굴리는 자리 (decisions.md 247번). */
  private static final List<String> STAND_UP_ORDER = List.of(HR_DESK, RESEARCH_DESK, RISK_DESK);

  /**
   * 앉은 사람이 자리 수보다 많으면 넘친 사람을 쉬게 한다 (247번). 결산·계약금·새로 받기로 자본이 줄어 회사 등급과 자리 수가 내려갔을 때다. 돈을 굴리는 자리를
   * 지키려고 돕는 자리(인사팀 → 리서치 팀 → 리스크 관리 팀)부터, 그다음 돈을 굴리는 자리에서 나중에 들어온 사람부터 일어난다. 쉬게 된 사람을 들어온 순서로 돌려준다.
   */
  List<Employee> fitSeats(CompanyState company) {
    List<Employee> seated =
        new java.util.ArrayList<>(company.employees.stream().filter(e -> e.desk != null).toList());
    int over = seated.size() - seats(company.capital);
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
    return stood.stream().sorted(java.util.Comparator.comparingInt(e -> e.id)).toList();
  }

  private void requireOpen(CompanyState company) {
    if (company.sold) {
      throw new InvalidRequestException("팔린 회사다");
    }
  }

  /** 매각을 빼기 전에 시대가 끝나 멈췄던 회사를 지금 해(turns + 1)의 연초 회의부터 다시 돌린다 (236번). */
  void resume(CompanyState company, SeededRandom random) {
    startYear(company, random);
  }

  /** 소식 줄·한 줄의 금액. 1조가 넘으면 조와 억까지만 쓴다 (decisions.md 252번): 56조 3,615억 원, 1억 원, 312만 원. */
  static String won(long amount) {
    long abs = Math.abs(amount);
    String sign = amount < 0 ? "−" : "";
    if (abs >= 1_000_000_000_000L) {
      long jo = abs / 1_000_000_000_000L;
      long eok = abs % 1_000_000_000_000L / 100_000_000L;
      return sign + (eok == 0 ? "%,d조 원".formatted(jo) : "%,d조 %,d억 원".formatted(jo, eok));
    }
    if (abs >= 100_000_000L) {
      long eok = abs / 100_000_000L;
      long man = abs % 100_000_000L / 10_000L;
      return sign + (man == 0 ? "%,d억 원".formatted(eok) : "%,d억 %,d만 원".formatted(eok, man));
    }
    return sign + "%,d만 원".formatted(abs / 10_000L);
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

  int seats(long capital) {
    int at = LADDER.indexOf(grade(capital));
    List<Integer> seats = properties.seats();
    return at < seats.size() ? seats.get(at) : seats.getLast() + (at - seats.size() + 1);
  }

  /** 등급이 오를수록 고객이 돈을 더 맡겨 수수료와 판돈이 커진다 (4.5절). */
  /** 규모의 벽 (decisions.md 244번): 등급 단계만큼 거듭제곱한 비율을 곱한다. F는 그대로. */
  private int scaled(CompanyState company, int bp, int percent) {
    double factor = Math.pow(percent / (double) PERCENT, LADDER.indexOf(grade(company.capital)));
    return (int) Math.round(bp * factor);
  }

  /** 맞혔을 때 버는 몫. 큰 회사일수록 줄어든다. */
  int scaledGain(CompanyState company, int bp) {
    return scaled(company, bp, properties.scale().gainPercent());
  }

  /** 틀리거나 손이 뒤집혀 잃는 몫. 큰 회사일수록 커진다. */
  int scaledMiss(CompanyState company, int bp) {
    return scaled(company, bp, properties.scale().missPercent());
  }

  /** 올해 시장을 정하고 연초 회의를 준비한다. 조짐은 폭락장 앞에 보이고, 아무 일 없는 해에도 헛조짐이 섞인다 (4.3절). */
  /** 한 해의 시장: 갈래(숨은 값), 연초 회의의 조짐, 올해 필요한 자리. */
  record Market(String phase, String omen, String wantedDesk) {}

  /**
   * 그해 시장. (회사 시드, 해)로만 정해서, 미리 들여다봐도(경보·선견) 그해가 오면 같은 시장이 온다. 조짐은 폭락장 앞에 보이고, 아무 일 없는 해에도 헛조짐이 섞인다
   * (4.3절).
   */
  Market marketOf(CompanyState company, int year, SeededRandom random) {
    RandomGenerator rng = random.forKey("company-year", year);
    int phaseRoll = rng.nextInt(BP);
    int omenRoll = rng.nextInt(PERCENT);
    int textRoll = rng.nextInt(BP);
    int wantedRoll = rng.nextInt(BP);
    Map<String, Integer> weights = era(eraOf(company, year, random)).phaseWeights();
    int total = weights.values().stream().mapToInt(Integer::intValue).sum();
    int pick = (int) ((long) phaseRoll * total / BP);
    String phase = null;
    for (String key : weights.keySet().stream().sorted().toList()) {
      pick -= weights.get(key);
      if (pick < 0) {
        phase = key;
        break;
      }
    }
    // 첫 회사의 첫해는 폭락장이 아니다 (decisions.md 256번): 1억으로 차려 두 사람을 뽑자마자 깎이면 시작부터 지친다.
    if (company.number == 1 && year == 1 && CRASH.equals(phase)) {
      phase = NORMAL;
    }
    String omen = null;
    if (CRASH.equals(phase) && omenRoll < properties.omenPercent()) {
      List<String> omens = content.crises().stream().flatMap(c -> c.omens().stream()).toList();
      omen = omens.get(textRoll % omens.size());
    } else if (!CRASH.equals(phase) && omenRoll < properties.falseOmenPercent()) {
      List<String> omens = content.commonOmens();
      omen = omens.get(textRoll % omens.size());
    }
    List<RaisingContent.Desk> trading =
        desks().stream().filter(RaisingContent.Desk::trades).toList();
    String wanted = omen != null ? RISK_DESK : trading.get(wantedRoll % trading.size()).code();
    return new Market(phase, omen, wanted);
  }

  /** 올해 시장을 정하고 연초 회의를 준비한다. 다음 해 시장도 미리 정해 둔다: XX(경보)·ZZZ(선견) 직원이 들여다본다 (2.4절). */
  void startYear(CompanyState company, SeededRandom random) {
    Market market = marketOf(company, company.year, random);
    company.phase = market.phase();
    company.omen = market.omen();
    company.wantedDesk = market.wantedDesk();
    Market next = marketOf(company, company.year + 1, random);
    company.nextPhase = next.phase();
    company.nextOmen = next.omen();
    company.refreshes = 0;
    company.yearStartCapital = company.capital;
    company.yearHiring = 0;
    deal(company, random);
    company.invest = invest.create(company, random);
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

  String wantedLine(CompanyState company) {
    return content.raising().company().wanted().get(company.wantedDesk);
  }

  List<RaisingContent.Desk> desks() {
    return content.raising().company().desks();
  }

  private RaisingContent.Desk desk(String code) {
    return desks().stream()
        .filter(d -> d.code().equals(code))
        .findFirst()
        .orElseThrow(() -> new InvalidRequestException("없는 자리: " + code));
  }

  /** 직원을 자리에 앉힌다. 자리 수를 넘게 앉힐 수 없다. 빠진 직원은 쉬고, 같은 자리에 여럿 앉아도 된다. */
  void place(CompanyState company, Map<Integer, String> placements) {
    int placed = (int) placements.values().stream().filter(d -> d != null).count();
    if (placed > seats(company.capital)) {
      throw new InvalidRequestException("자리가 모자란다");
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
    boolean led =
        company.employees.stream()
            .anyMatch(e -> e != employee && employee.desk.equals(e.desk) && e.rank >= RANK_LEADER);
    if (led) {
      swayBp = swayBp * properties.effects().leaderFlipPercent() / PERCENT;
      flipBp = flipBp * properties.effects().leaderFlipPercent() / PERCENT;
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

  /** 돈을 굴리는 직원 한 명이 맡는 판돈 = 자본 × 비율 × 배율 ÷ 사람 수 (자본을 넘지 않는다). */
  long stakeOf(CompanyState company, int traders) {
    if (traders == 0) {
      return 0;
    }
    long pot =
        Math.min(
            company.capital,
            (long) (company.capital * properties.stakePercent() / (double) PERCENT));
    return pot / traders;
  }

  CompanyProperties.DeskReturn returnsOf(String desk) {
    return properties.desks().get(desk);
  }

  /**
   * 직원들이 배치대로 한 해를 굴린 결과 (6.1절 5번). 판단마다 꼬드김(리스크 관리 팀이 막는다) → 손 뒤집힘(자리가 원하는 능력치, 폭락장이면 모두 인내심) →
   * 맞힘(안목, 리서치 팀이 형광펜을 빌려준다) 순으로 굴린다. 수수료 매출은 시장과 상관없이 들어온다.
   */
  Settlement settle(CompanyState company, SeededRandom random) {
    requireOpen(company);
    if (invest.open(company)) {
      throw new InvalidRequestException("투자 회의를 먼저 한다");
    }
    RandomGenerator rng = random.forKey("company-settle", company.year);
    Settlement settlement = new Settlement();
    settlement.year = company.year;
    settlement.phase = company.phase;
    settlement.omen = company.omen;
    // 연초 자본은 연초 회의 때의 자본이다(250번): 그 뒤에 낸 계약금·새로 받기 값은 채용비 줄로, 회의 손익은 회의 줄로 보인다.
    // 이 칸을 더하기 전의 해면 지금 자본에서 회의 손익을 뺀다(예전 방식).
    settlement.hiring = company.yearHiring;
    settlement.capitalBefore =
        company.yearStartCapital != null
            ? company.yearStartCapital
            : company.capital
                - (company.invest != null && company.invest.choice != null
                    ? company.invest.total
                    : 0);
    settlement.gradeBefore = grade(company.capital);

    int research = researchInsight(company);
    List<Employee> traders = traders(company);
    long stake = stakeOf(company, traders.size());
    boolean crash = CRASH.equals(company.phase);
    long totalPnl = 0;
    for (Employee employee : traders) {
      Result result = new Result();
      result.employeeId = employee.id;
      result.name = employee.name;
      result.desk = employee.desk;
      result.stake = stake;
      CompanyProperties.DeskReturn returns = properties.desks().get(employee.desk);
      String flipStat = flipStat(company, employee);
      int insight = Math.max(employee.stats.get(StatCodes.INSIGHT), research);
      Odds odds = odds(company, employee);
      int swayBp = odds.swayBp();
      int flipBp = odds.flipBp();
      CompanyProperties.Effects effects = properties.effects();
      boolean conviction = employee.rank >= RANK_CONVICTION;
      boolean contrarian = crash && employee.rank >= RANK_CONTRARIAN;
      int hitBp = behavior.hintAccuracyPercent(insight) * PERCENT;
      // 규모의 벽(244번): 결산을 시작할 때의 등급으로 정한다.
      int gainBp =
          scaledGain(
              company, gainBp(company, employee) + (conviction ? effects.convictionGainBp() : 0));
      int missBp = scaledMiss(company, returns.missBp());
      int flipLossBp = scaledMiss(company, returns.flipBp());
      // 한 해 시장 손익. 폭락장에는 섹터마다 빠지는 폭이 다르다(식품·금융은 덜, 반도체는 더).
      int phaseBp = properties.phaseBp().getOrDefault(company.phase, 0);
      if (crash) {
        phaseBp =
            scaled(
                company,
                phaseBp * returns.crashPercent() / PERCENT,
                properties.scale().crashPercent());
      }
      long bp = 0;
      for (int i = 0; i < properties.decisions(); i++) {
        int swayRoll = rng.nextInt(BP);
        int flipRoll = rng.nextInt(BP);
        int hitRoll = rng.nextInt(BP);
        // XXX 역발상: 폭락장에 빠지는 동안 사서 회복 구간에서 번다.
        bp += contrarian ? effects.contrarianCrashBp() : phaseBp;
        if (swayRoll < swayBp) {
          result.flips.merge(StatCodes.CONVICTION, 1, Integer::sum);
          bp -= missBp;
        } else if (flipRoll < flipBp) {
          result.flips.merge(flipStat, 1, Integer::sum);
          bp -= crash ? flipLossBp * properties.crashFlipPercent() / PERCENT : flipLossBp;
        } else {
          // X 확신: 형광펜이 맞으면 알아서 크게 산다. 맞히면 더 벌고 틀려도 덜 잃어 편차가 준다.
          bp +=
              hitRoll < hitBp
                  ? gainBp
                  : -missBp * (conviction ? effects.convictionMissPercent() : PERCENT) / PERCENT;
        }
      }
      result.pnl = stake * bp / BP;
      totalPnl += result.pnl;
      settlement.results.add(result);
      CompanyProperties.Experience rules = properties.experience();
      if (stake > 0 && result.pnl * PERCENT <= -stake * rules.dropLossPercent()) {
        drop(employee, result, settlement);
      } else if (crash && stake > 0 && result.pnl >= 0) {
        // 판돈이 없었으면 버틴 것이 아니다 (251번).
        survive(employee, settlement);
      }
      result.flips.forEach(
          (stat, count) ->
              settlement.lines.add(
                  Korean.fill(
                          content.raising().company().flipLines().get(stat),
                          Map.of("name", employee.name))
                      + (count > 1 ? " (" + count + "번)" : "")));
    }
    long fee = (long) (company.capital * properties.feeBp() / (double) BP);
    settlement.fee = fee;
    company.capital = Math.max(0, company.capital + fee + totalPnl);
    settlement.capitalAfter = company.capital;
    if (company.capital == 0) {
      settlement.lines.add(content.raising().company().bankrupt().emptied());
    }
    List<Employee> stood = fitSeats(company);
    if (!stood.isEmpty()) {
      settlement.lines.add(
          Korean.fill(
              content.raising().company().seatsCut(),
              Map.of("names", String.join("·", stood.stream().map(e -> e.name).toList()))));
    }
    settlement.gradeAfter = grade(company.capital);
    // 폭락장에 아무도 바닥에서 던지지 않았으면 "못 참고 판 사람이 가장 크게 잃었다"를 쓰지 않는다 (decisions.md 254번).
    boolean anyPanic =
        settlement.results.stream().anyMatch(r -> r.flips.containsKey(StatCodes.PATIENCE));
    Map<String, String> phases = content.raising().company().phases();
    String phaseLine =
        crash && !anyPanic && phases.containsKey(CRASH_HELD)
            ? phases.get(CRASH_HELD)
            : phases.get(company.phase);
    settlement.lines.addFirst(phaseLine);
    if (!crash && company.omen != null) {
      settlement.lines.add(1, content.raising().company().falseOmenNote());
    }
    if (company.invest != null && company.invest.choice != null) {
      // 연말 결산서(240번)가 회의 몫과 직원들이 한 해 굴린 몫을 나눠 보인다. 전에는 소식 줄 한 줄이었다.
      settlement.investTitle = company.invest.title;
      settlement.investTotal = company.invest.total;
    }
    company.settlements.add(settlement);
    String eraBefore = company.era;
    String eraAfter = eraOf(company, company.year + 1, random);
    company.year++;
    if (!eraAfter.equals(eraBefore)) {
      company.era = eraAfter;
      RaisingContent.Era from = era(eraBefore);
      RaisingContent.Era to = era(eraAfter);
      settlement.lines.add(
          Korean.fill(
              content.raising().company().eraTurn().changed(),
              Map.of("from", from.name(), "to", to.name(), "description", to.description())));
    }
    // 회사는 끝나지 않고 해마다 이어진다 (decisions.md 236번: 매각을 뺐다).
    startYear(company, random);
    return settlement;
  }

  /**
   * 큰 손실을 낸 직원은 종합 등급이 한 단계 떨어진다 (6.4절). 떠나지 않는다. X 이상이면 종합 등급이, 그 아래면 그해 손을 가장 많이 뒤집은 능력치(뒤집힘이
   * 없었으면 자리가 원하는 능력치)가 한 띠 내려간다. 종합 등급만 내리면 실제 성적이 그대로라 판정에 쓰는 능력치를 내린다.
   */
  void drop(Employee employee, Result result, Settlement settlement) {
    RaisingContent.GradeLines lines = content.raising().company().gradeLines();
    String before = employeeGrade(employee);
    if (employee.rank > 0) {
      employee.rank--;
      employee.experience = 0;
      settlement.lines.add(
          gradeLine(lines.drop(), employee, before, employeeGrade(employee), null));
      return;
    }
    // 같은 횟수면 결산 말풍선(224번)과 같은 순서로 탓한다: 줏대 → 인내심 → 용기 (251번).
    String stat =
        result.flips.entrySet().stream()
            .max(
                Map.Entry.<String, Integer>comparingByValue()
                    .thenComparing(e -> -FLIP_BLAME_ORDER.indexOf(e.getKey())))
            .map(Map.Entry::getKey)
            .orElse(desk(employee.desk).statCode());
    int value = employee.stats.get(stat);
    StatGrade from = StatGrade.of(value);
    if (from == StatGrade.F) {
      // 이미 바닥 띠면 더 내려갈 등급이 없다: 글자가 그대로인 하락 소식을 띄우지 않는다.
      return;
    }
    // 한 띠(10점)를 내리되 적어도 한 등급은 내려가게 띠 경계 아래까지 (251번). 전에는 SSS 100이 90이 되어 "SSS → SSS"가 떴다.
    int lowered = Math.max(1, Math.min(value - properties.experience().band(), from.min() - 1));
    employee.stats.put(stat, lowered);
    employee.dropped.add(stat);
    employee.droppedBy.add(value - lowered);
    settlement.lines.add(
        gradeLine(
            lines.statDrop(),
            employee,
            StatGrade.of(value).name(),
            StatGrade.of(lowered).name(),
            stat));
  }

  /**
   * 폭락장을 손실 없이 버티면 실전 경험이 쌓인다 (2.3·6.4절). 큰 손실로 내려갔던 능력치가 있으면 그것부터 되찾고, SSS에서는 경험이 쌓여 X·XX…로 오른다.
   */
  void survive(Employee employee, Settlement settlement) {
    RaisingContent.GradeLines lines = content.raising().company().gradeLines();
    if (!employee.dropped.isEmpty()) {
      String stat = employee.dropped.removeLast();
      // 내려간 만큼만 되찾는다 (251번). 옛 하락은 늘 새 하락보다 앞에 있으니, droppedBy가 남아 있으면 맨 뒤끼리 짝이다. 이 칸을 더하기 전에
      // 내려간 것은 한 띠로 본다.
      int by =
          employee.droppedBy.isEmpty()
              ? properties.experience().band()
              : employee.droppedBy.removeLast();
      int value = employee.stats.get(stat);
      int raised = Math.min(MAX_STAT, value + by);
      employee.stats.put(stat, raised);
      settlement.lines.add(
          gradeLine(
              lines.recover(),
              employee,
              StatGrade.of(value).name(),
              StatGrade.of(raised).name(),
              stat));
      return;
    }
    if (!StatGrade.SSS.name().equals(overallGrade(employee.stats))
        || employee.rank >= LADDER.size() - 1 - LADDER.indexOf(StatGrade.SSS.name())) {
      return;
    }
    String before = employeeGrade(employee);
    employee.experience++;
    if (employee.experience >= experienceNeeded(employee)) {
      employee.rank++;
      employee.experience = 0;
      settlement.lines.add(
          gradeLine(lines.rise(), employee, before, employeeGrade(employee), null));
    } else {
      settlement.lines.add(gradeLine(lines.experience(), employee, before, before, null));
    }
  }

  /** 다음 단계로 오르는 데 드는 실전 경험. 단계마다 하나씩 더 든다 (2.3절). */
  int experienceNeeded(Employee employee) {
    return properties.experience().needBase() + employee.rank;
  }

  private String gradeLine(
      String template, Employee employee, String before, String after, String stat) {
    Map<String, String> values = new HashMap<>();
    values.put("name", employee.name);
    values.put("before", before);
    values.put("after", after);
    if (stat != null) {
      values.put("stat", content.raising().company().statNames().get(stat));
    }
    return Korean.fill(template, values);
  }

  /** 직원의 종합 등급: 다섯 능력치 평균의 F~SSS, SSS면 실전 경험으로 오른 X~ZZZ (2.2·2.3절). */
  static String employeeGrade(Employee employee) {
    String base = overallGrade(employee.stats);
    if (employee.rank == 0 || !StatGrade.SSS.name().equals(base)) {
      return base;
    }
    return LADDER.get(LADDER.indexOf(StatGrade.SSS.name()) + employee.rank);
  }

  /** 그 단계 이상의 직원 가운데 가장 높은 직원. 정보를 주는 효과는 한 명만 있어도 되고 여럿이어도 겹치지 않는다 (2.4절). */
  static java.util.Optional<Employee> bestRanked(CompanyState company, int rank) {
    return company.employees.stream()
        .filter(e -> e.rank >= rank)
        .max(
            java.util.Comparator.comparingInt((Employee e) -> e.rank).thenComparingInt(e -> -e.id));
  }

  /** 직원이 가진 효과 이름. 쌓인다. */
  List<String> effectsOf(Employee employee) {
    return content.raising().company().effects().list().stream()
        .limit(employee.rank)
        .map(RaisingContent.Effect::name)
        .toList();
  }

  /** 연초 회의의 경보(XX): 내년 폭락 조짐을 한 해 일찍. 조짐이 없으면 null. */
  String earlyOmen(CompanyState company) {
    if (company.nextOmen == null) {
      return null;
    }
    return bestRanked(company, RANK_ALARM)
        .map(
            e ->
                Korean.fill(
                    content.raising().company().effects().earlyOmen(),
                    Map.of("name", e.name, "omen", company.nextOmen)))
        .orElse(null);
  }

  /** 연초 회의의 선견(ZZZ): 내년 시장 갈래. 조짐 없는 위기도 보인다. */
  String forecast(CompanyState company) {
    return bestRanked(company, RANK_FORESIGHT)
        .map(
            e ->
                Korean.fill(
                    content.raising().company().effects().forecast().get(company.nextPhase),
                    Map.of("name", e.name)))
        .orElse(null);
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
