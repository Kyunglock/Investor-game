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
    this.macro = new MacroEngine(this, invest, content, behavior, properties);
    this.teams = new TeamEngine(this, content);
    this.pay = new PayEngine(this, content, properties);
    this.history = new CompanyHistory(content);
  }

  /** 회사 연표·업적·명예의 전당 (decisions.md 263번). */
  final CompanyHistory history;

  /** 거시경제 회의와 종목 발굴 (decisions.md 266·267번). */
  final MacroEngine macro;

  /** 팀장과 팀장 보고 (decisions.md 269번). */
  final TeamEngine teams;

  /** 연봉과 사기 (decisions.md 270번). */
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

  /** 사장의 사재로 첫 회사를 차린다. 직원은 없고, 채용권으로 뽑는다 (decisions.md 228·312번). */
  CompanyState open(SeededRandom random, long capital) {
    CompanyState company = new CompanyState();
    company.capital = Math.max(0, capital);
    company.tickets = properties.gacha().startTickets();
    company.gachaReady = true;
    company.building = grade(company.capital);
    company.era = eras().getFirst().code();
    company.opening =
        Korean.fill(content.raising().company().opening(), Map.of("capital", won(company.capital)));
    startYear(company, random);
    history.opened(company);
    return company;
  }

  /**
   * 회사가 망했다 (decisions.md 247번): 자본이 0이거나, 직원이 없는데 가장 싼 계약금도 낼 수 없다. 수수료도 판돈도 자본에 비례해서 이대로는 다시 일어설
   * 수 없다. 매각이 빠진 뒤(236번)로는 이것이 회사를 닫고 새로 차리는 유일한 길이다.
   */
  /** 다음 회사를 차릴 수 있는가: 망했거나(247번) 랜드마크 타워에 올라 엔딩을 봤다(276번). */
  boolean canRestart(CompanyState company) {
    return company.finished || broke(company);
  }

  /** 망했는가: 문을 닫았거나 자본이 바닥났다. 사람은 채용권으로 뽑으므로(312번) 돈이 적어도 사람이 없어도 망하지 않는다. */
  boolean broke(CompanyState company) {
    return company.closed || company.capital <= 0;
  }

  /**
   * 망한 회사를 닫고 사장의 사재로 다음 회사를 차린다 (247번). 직원은 모두 쉬는 채로 따라온다: 회사가 망해도 키운 사람은 잃지 않는다 (decisions.md
   * 265번). 회사 번호와 만난 지원자 수(이름)는 이어 센다. 망하지 않은 회사면 400.
   */
  CompanyState restart(CompanyState broke, SeededRandom random, long capital) {
    if (!canRestart(broke)) {
      throw new InvalidRequestException("아직 망하지 않은 회사다");
    }
    broke.closed = true;
    CompanyState next = new CompanyState();
    next.number = broke.number + 1;
    next.hired = broke.hired;
    next.met = broke.met;
    // 채용권·뽑은 횟수·도감은 사장의 것이라 다음 회사로 이어진다 (312번). 새 회사에는 처음 채용권을 더 준다.
    next.draws = broke.draws;
    next.collection.putAll(broke.collection);
    next.tickets = broke.tickets + properties.gacha().startTickets();
    next.gachaReady = true;
    next.capital = Math.max(0, capital);
    for (Employee e : broke.employees) {
      e.desk = null;
      e.lastDesk = null;
      e.deskYears = 0;
      next.employees.add(e);
    }
    broke.employees.clear();
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
    history.opened(next);
    return next;
  }

  /** 이번 결산이 같은 자리 settle-years 해째 이상인가: 손이 덜 뒤집힌다 (262번). */
  boolean settled(Employee employee) {
    return employee.desk != null
        && employee.desk.equals(employee.lastDesk)
        && employee.deskYears + 1 >= properties.people().settleYears();
  }

  /** 등급 효과의 "더 버는 몫"(%, 289번). SSS 위는 SSS 값. */
  int perkGainPercent(Employee employee) {
    return properties.perks().gainPercent().getOrDefault(overallGrade(employee.stats), 0);
  }

  /**
   * 등급 효과 한 줄 (289·300번): "새내기 · 맞히면 2% 더 번다 · 한 해 일하면 50% 확률로 자란다". S부터는 "잠깐만요, 사장님!! 60%"가 붙는다.
   */
  String perkLine(Map<String, Integer> stats, int rank) {
    RaisingContent.Perks texts = content.raising().company().perks();
    String grade = overallGrade(stats);
    int gain = properties.perks().gainPercent().getOrDefault(grade, 0);
    int growth = properties.perks().growthPercent().getOrDefault(grade, 0);
    String full = gradeOf(stats, rank);
    String name = rank > 0 ? full : texts.names().get(grade);
    String line =
        growth > 0
            ? Korean.fill(
                texts.line(),
                Map.of("gain", String.valueOf(gain), "growth", String.valueOf(growth)))
            : Korean.fill(texts.lineTop(), Map.of("gain", String.valueOf(gain)));
    int proposal = invest.proposalPercent(full);
    if (proposal > 0) {
      line += " · " + Korean.fill(texts.proposal(), Map.of("percent", String.valueOf(proposal)));
    }
    return name + " · " + line;
  }

  /** 등급 효과의 성장 확률(%, 289번). SSS와 그 위는 0: 실전 경험으로 오른다. */
  int perkGrowthPercent(Employee employee) {
    return properties.perks().growthPercent().getOrDefault(overallGrade(employee.stats), 0);
  }

  /**
   * 한 해 자리에서 일한 직원이 자란다 (decisions.md 289번): 종합 등급마다 정한 확률로 가장 낮은 능력치(운 빼고, 같으면 앞의 것)가 한 띠 오른다. 낮은
   * 등급일수록 잘 크고 높을수록 더디다. 쉬는 사람은 자라지 않는다.
   */
  private void grow(CompanyState company, Settlement settlement, SeededRandom random) {
    for (Employee e : company.employees) {
      int chance = perkGrowthPercent(e);
      if (e.desk == null || chance <= 0) {
        continue;
      }
      if (random.forKey("grow", company.year, e.id).nextInt(PERCENT) >= chance) {
        continue;
      }
      String stat =
          StatCodes.ALL.stream()
              .filter(code -> !StatCodes.LUCK.equals(code))
              .min(java.util.Comparator.comparingInt((String code) -> e.stats.get(code)))
              .orElseThrow();
      int before = e.stats.get(stat);
      if (before >= MAX_STAT) {
        continue;
      }
      int after = Math.min(MAX_STAT, before + properties.experience().band());
      e.stats.put(stat, after);
      settlement.lines.add(
          gradeLine(
              content.raising().company().perks().grown(),
              e,
              StatGrade.of(before).name(),
              StatGrade.of(after).name(),
              stat));
    }
  }

  /** 결산마다 같은 자리 해 수를 센다. 막 손에 익은 해면 소식 줄을 남긴다 (262번). */
  private void countTenure(CompanyState company, Settlement settlement) {
    for (Employee e : company.employees) {
      if (e.desk == null) {
        e.deskYears = 0;
        e.lastDesk = null;
        continue;
      }
      e.deskYears = e.desk.equals(e.lastDesk) ? e.deskYears + 1 : 1;
      e.lastDesk = e.desk;
      if (e.deskYears == properties.people().settleYears()) {
        settlement.lines.add(
            Korean.fill(
                content.raising().company().people().settled(),
                Map.of("name", e.name, "desk", desk(e.desk).name())));
      }
    }
  }

  /**
   * 올해의 이직 제안 (decisions.md 262번): poach-from-year 해부터 해마다 poach-percent 확률로, 다른 증권사가 우리의 가장 높은
   * 직원(같으면 오래 앉은 사람)에게 손을 뻗는다. 직원이 둘 이상이어야 온다. 붙잡는 값과 이적료는 그 직원 계약금의 비율이다. 라이벌 증권사를 걷어낸 뒤(288번)에는
   * 이름 없는 "다른 증권사"다.
   */
  CompanyState.Poach poachOf(CompanyState company, SeededRandom random) {
    CompanyProperties.People rules = properties.people();
    if (company.year < rules.poachFromYear() || company.employees.size() < 2) {
      return null;
    }
    if (random.forKey("poach", company.year).nextInt(PERCENT) >= rules.poachPercent()) {
      return null;
    }
    Employee target =
        company.employees.stream()
            .max(
                java.util.Comparator.comparingInt((Employee e) -> LADDER.indexOf(employeeGrade(e)))
                    .thenComparingInt(e -> e.deskYears)
                    .thenComparingInt(e -> -e.id))
            .orElseThrow();
    long fee = fee(company.capital, target.stats, target.rank);
    CompanyState.Poach poach = new CompanyState.Poach();
    poach.employeeId = target.id;
    poach.transferFee = fee * rules.transferPercent() / PERCENT;
    return poach;
  }

  /** 이직 제안에 답한다 (262·265번): 남기면 그대로 남고, 보내면 이적료를 받고 떠난다. 직원은 사장이 보낸다고 고를 때만 떠난다. 제안이 없으면 400. */
  void answerPoach(CompanyState company, boolean keep) {
    CompanyState.Poach poach = company.poach;
    if (poach == null) {
      throw new InvalidRequestException("올해 이직 제안이 없다");
    }
    RaisingContent.People texts = content.raising().company().people();
    if (!keep) {
      letGo(company, texts.left());
      return;
    }
    company.yearLines.add(
        Korean.fill(texts.kept(), Map.of("name", poachedName(company), "rival", poacher())));
    company.poach = null;
  }

  /** 연초 회의의 이직 제안 한 줄. */
  String poachLine(CompanyState company) {
    return Korean.fill(
        content.raising().company().people().poach(),
        Map.of("rival", poacher(), "name", poachedName(company)));
  }

  private String poachedName(CompanyState company) {
    return company.employees.stream()
        .filter(e -> e.id == company.poach.employeeId)
        .findFirst()
        .map(e -> e.name)
        .orElse("");
  }

  /** 이직 제안의 직원을 보낸다: 이적료를 받는다. 받은 이적료는 그해 인사 비용에서 뺀다 (262번). */
  private void letGo(CompanyState company, String template) {
    CompanyState.Poach poach = company.poach;
    String name = poachedName(company);
    company.employees.stream()
        .filter(e -> e.id == poach.employeeId)
        .findFirst()
        .ifPresent(e -> history.retire(company, e));
    company.employees.removeIf(e -> e.id == poach.employeeId);
    teams.tidy(company);
    company.capital += poach.transferFee;
    company.yearHiring -= poach.transferFee;
    company.yearLines.add(Korean.fill(template, Map.of("name", name, "rival", poacher())));
    company.poach = null;
  }

  /** 이직 제안을 한 곳 (262·288번): 이름 없는 다른 증권사. */
  String poacher() {
    return content.raising().company().people().poacher();
  }

  /** 망한 회사의 한 줄. 망하지 않았으면 null. */
  String brokeNotice(CompanyState company) {
    return broke(company) ? content.raising().company().bankrupt().notice() : null;
  }

  /** 첫 회사의 시작 자본(사장의 사재). */
  long openingCapital() {
    return properties.baseCapital();
  }

  RaisingContent.Invest investTexts() {
    return content.raising().company().invest();
  }

  /**
   * 돕는 자리가 이 분기에 한 일 (decisions.md 278번). 리서치 팀: 거시경제 회의·종목 회의에서 형광펜을 그을 수 있었던 회의 수, 그은 수, 결정적 문장을
   * 짚은 수. 종목 발굴팀: 그 팀 사람이 가져와 회의한 종목과 오르내림.
   */
  private void recordSupport(CompanyState company, CompanyState.Quarter q) {
    if (company.macro != null && company.macro.remarks != null) {
      countHighlight(q, company.macro.highlightIndex, company.macro.sentences);
    }
    CompanyState.Invest i = company.invest;
    if (i != null && i.choice != null) {
      if (i.remarks != null) {
        countHighlight(q, i.highlightIndex, i.sentences);
      }
      if (MacroEngine.SCOUT_DESK.equals(i.finderDesk)) {
        q.scoutStock = stockName(i.stock);
        q.scoutUp = i.up;
        q.scoutPercent = Math.round(i.magnitudeBp / (float) PERCENT);
      }
    }
  }

  private static void countHighlight(
      CompanyState.Quarter q, Integer index, List<CompanyState.Sentence> sentences) {
    q.highlightChances++;
    if (index == null || index < 0 || index >= sentences.size()) {
      return;
    }
    q.highlights++;
    if (sentences.get(index).decisive) {
      q.highlightHits++;
    }
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

  /**
   * 계약금 (decisions.md 258번): 종합 등급으로 정한 값과 자본 × 등급별 비율 가운데 큰 쪽. 초반(1억 회사)은 정해진 값 그대로이고, 회사가 커지면 자본에
   * 비례해 무거워진다. 경력직(rank > 0)은 자본 비율이 더 크다. 전에는 정해진 값뿐이라 SSS 회사에 SSS 계약금 1.2억이 자본의 0.01%였다.
   */
  long fee(long capital, Map<String, Integer> stats, int rank) {
    CompanyProperties.Market market = properties.market();
    int at = Math.min(market.fees().size() - 1, LADDER.indexOf(overallGrade(stats)));
    long fixed = market.fees().get(at);
    int bp =
        rank > 0
            ? market.veteranFeeBp() + (rank - 1) * market.veteranFeeStepBp()
            : market.feeBp().get(Math.min(market.feeBp().size() - 1, at));
    return Math.max(fixed, (long) (capital * (bp / (double) BP)));
  }

  /** 계약금의 자본 비율 몫(정해진 값을 뺀 것). 연봉이 쓴다 (decisions.md 270번): 작은 회사에는 가볍고 큰 회사에는 무겁다. */
  long feeShare(long capital, Map<String, Integer> stats, int rank) {
    CompanyProperties.Market market = properties.market();
    int at = Math.min(market.fees().size() - 1, LADDER.indexOf(overallGrade(stats)));
    int bp =
        rank > 0
            ? market.veteranFeeBp() + (rank - 1) * market.veteranFeeStepBp()
            : market.feeBp().get(Math.min(market.feeBp().size() - 1, at));
    return (long) (capital * (bp / (double) BP));
  }

  /** 데리고 있을 수 있는 사람 수: 자리 수 × roster-percent (decisions.md 312번). 넘으면 합치거나 내보내야 더 뽑는다. */
  int rosterMax(CompanyState company) {
    return seats(company) * properties.gacha().rosterPercent() / PERCENT;
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

  /** 합성에 드는 같은 등급 사람 수(바탕 포함). */
  int mergeCount() {
    return properties.gacha().mergeCount();
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
      throw new InvalidRequestException("데리고 있을 자리가 모자란다. 합치거나 내보내야 한다");
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
      Map<String, Integer> stats = new java.util.LinkedHashMap<>();
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

  /**
   * 합성 (decisions.md 312번): 같은 종합 등급의 직원 merge-count명을 합쳐 바탕(baseId) 한 명을 한 단계 올린다. 재료는 회사를 떠나고(연표에
   * 남지 않는다), 번 돈은 바탕에게 얹힌다. F~SS면 다섯 능력치를 모두 한 띠 올려 종합 등급을 한 단계 올리고, SSS 위면 단계(X…)가 오른다. 맨
   * 위(GOD)거나, 등급이 다르거나, 수가 맞지 않거나, 이직 제안·연봉 협상·사표가 걸린 사람이면 400.
   */
  Employee merge(CompanyState company, int baseId, List<Integer> materialIds) {
    requireOpen(company);
    int need = properties.gacha().mergeCount() - 1;
    Employee base = employee(company, baseId);
    List<Employee> materials =
        materialIds.stream()
            .distinct()
            .filter(id -> id != baseId)
            .map(id -> employee(company, id))
            .toList();
    if (materials.size() != need || materialIds.size() != need) {
      throw new InvalidRequestException("같은 등급 " + (need + 1) + "명을 합친다");
    }
    String grade = employeeGrade(base);
    if (materials.stream().anyMatch(m -> !employeeGrade(m).equals(grade))) {
      throw new InvalidRequestException("같은 등급끼리만 합친다");
    }
    if (LADDER.indexOf(grade) >= LADDER.size() - 1) {
      throw new InvalidRequestException("더 오를 데가 없다");
    }
    for (Employee e : materials) {
      requireFree(company, e);
    }
    requireFree(company, base);
    int sssAt = LADDER.indexOf(StatGrade.SSS.name());
    if (LADDER.indexOf(grade) >= sssAt) {
      base.rank++;
      base.experience = 0;
    } else {
      StatGrade next = StatGrade.valueOf(LADDER.get(LADDER.indexOf(grade) + 1));
      int band = properties.experience().band();
      for (String code : StatCodes.ALL) {
        base.stats.merge(code, band, (v, d) -> Math.min(MAX_STAT, v + d));
      }
      // 평균이 아직 다음 띠에 못 미치면(능력치가 100에 걸려) 낮은 능력치부터 채운다.
      while (LADDER.indexOf(overallGrade(base.stats)) <= LADDER.indexOf(grade)) {
        String low =
            StatCodes.ALL.stream()
                .min(java.util.Comparator.comparingInt((String code) -> base.stats.get(code)))
                .orElseThrow();
        base.stats.put(low, Math.min(MAX_STAT, Math.max(base.stats.get(low) + 1, next.min())));
      }
    }
    for (Employee m : materials) {
      base.totalPnl += m.totalPnl;
    }
    company.employees.removeAll(materials);
    teams.tidy(company);
    String after = employeeGrade(base);
    collect(company, after);
    history.add(
        company,
        company.year,
        "rise",
        Korean.fill(
            content.raising().company().market().merged(),
            Map.of(
                "names",
                String.join("·", materials.stream().map(m -> m.name).toList()),
                "name",
                base.name,
                "grade",
                after)),
        null);
    return base;
  }

  /** 직원을 내보낸다 (decisions.md 312번): 데리고 있을 자리를 비운다. 명예의 전당과 연표에 남는다. 이직 제안·연봉 협상·사표가 걸린 사람이면 400. */
  void release(CompanyState company, int employeeId) {
    requireOpen(company);
    Employee e = employee(company, employeeId);
    requireFree(company, e);
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

  /** 이직 제안·연봉 협상·사표가 걸린 사람은 합치거나 내보낼 수 없다: 먼저 답한다. */
  private static void requireFree(CompanyState company, Employee e) {
    boolean busy =
        (company.poach != null && company.poach.employeeId == e.id)
            || (company.raise != null && company.raise.employeeId == e.id)
            || (company.resign != null && company.resign.employeeId == e.id);
    if (busy) {
      throw new InvalidRequestException(e.name + "에게 걸린 일(이직 제안·연봉·사표)에 먼저 답해야 한다");
    }
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
      List.of(HR_DESK, MacroEngine.SCOUT_DESK, RESEARCH_DESK, RISK_DESK);

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
    if (company.finished) {
      throw new InvalidRequestException("엔딩을 본 회사다. 새 회사를 차려야 한다");
    }
  }

  /** 매각을 빼기 전에 시대가 끝나 멈췄던 회사를 지금 해(turns + 1)의 연초 회의부터 다시 돌린다 (236번). */
  void resume(CompanyState company, SeededRandom random) {
    startYear(company, random);
  }

  /** 소식 줄·한 줄의 금액. 1조가 넘으면 조와 억까지만 쓴다 (decisions.md 253번): 56조 3,615억 원, 1억 원, 312만 원. */
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

  /** 회사 등급을 정하는 자본: 연초 자본. 분기 결산으로 자본이 바뀌어도 등급·건물·자리 수는 연말에만 바뀐다 (268번). */
  long gradedCapital(CompanyState company) {
    return company.gradedCapital != null ? company.gradedCapital : company.capital;
  }

  /** 회사 등급 = 산 건물 (decisions.md 296번). 이 칸이 없던 회사는 연초 자본으로 정한다(296번 전처럼). */
  String grade(CompanyState company) {
    return company.building != null ? company.building : grade(gradedCapital(company));
  }

  int seats(CompanyState company) {
    return seatsOf(grade(company));
  }

  int seats(long capital) {
    return seatsOf(grade(capital));
  }

  int seatsOf(String grade) {
    int at = LADDER.indexOf(grade);
    List<Integer> seats = properties.seats();
    return at < seats.size() ? seats.get(at) : seats.getLast() + 2 * (at - seats.size() + 1);
  }

  /** 다음 건물 (296번): 지금 등급의 다음 띠. 끝 등급이면 null. */
  String nextGrade(CompanyState company) {
    int at = LADDER.indexOf(grade(company)) + 1;
    return at < properties.gradeCapital().size() ? LADDER.get(at) : null;
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
    return needed != null && !company.finished && !company.closed && company.capital >= needed;
  }

  /**
   * 건물 이사 (decisions.md 296번): 이사 비용을 내고 다음 건물로 올라간다. 자리 수·규모의 벽은 바로 새 건물로 바뀐다. 랜드마크 타워에 오르면 엔딩이다
   * (276번). 돈이 모자라거나 끝 등급이면 400.
   */
  void upgrade(CompanyState company) {
    String next = nextGrade(company);
    if (next == null) {
      throw new InvalidRequestException("더 올라갈 건물이 없다");
    }
    if (company.finished || company.closed) {
      throw new InvalidRequestException("끝난 회사다");
    }
    if (!canUpgrade(company)) {
      throw new InvalidRequestException("이사하려면 자본이 " + won(upgradeNeeded(company)) + " 있어야 한다");
    }
    long cost = upgradeCost(company);
    company.capital -= cost;
    company.yearMoving += cost;
    company.building = next;
    company.gradedCapital = company.capital;
    history.add(company, company.year, "grow", null, next);
    giveTickets(company, properties.gacha().moveTickets(), "move", company.yearLines);
    if (LADDER.indexOf(next) >= LADDER.indexOf(properties.endingGrade())) {
      company.finished = true;
      company.finishedYear = company.year;
      String line =
          Korean.fill(
              content.raising().company().ending().line(),
              Map.of("years", String.valueOf(company.year)));
      company.yearLines.add(line);
      history.add(
          company,
          company.year,
          "ending",
          content.raising().company().history().events().get("ending"),
          next);
    }
  }

  /** 규모의 벽 (decisions.md 244번): 등급 단계만큼 거듭제곱한 비율을 곱한다. F는 그대로. */
  private int scaled(CompanyState company, int bp, int percent) {
    double factor = Math.pow(percent / (double) PERCENT, LADDER.indexOf(grade(company)));
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
    // 첫 회사의 첫해는 폭락장이 아니다 (decisions.md 257번): 1억으로 차려 두 사람을 뽑자마자 깎이면 시작부터 지친다.
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
    company.yearStartCapital = company.capital;
    company.gradedCapital = company.capital;
    company.yearHiring = 0;
    company.yearMoving = 0;
    company.quarter = 1;
    company.yearStake = null;
    company.quarters.clear();
    // 폭락은 2~4분기 가운데 한 분기에 터지고, 조짐은 그 바로 앞 분기의 거시경제 기사에 실린다 (268번). 헛조짐은 1~3분기 가운데 하나.
    RandomGenerator when = random.forKey("crash-quarter", company.year);
    int burst = 2 + when.nextInt(QUARTERS - 1);
    company.crashQuarter = CRASH.equals(company.phase) ? burst : null;
    company.omenQuarter = company.omen == null ? null : burst - 1;
    company.yearLines.clear();
    company.poach = poachOf(company, random);
    company.raise = pay.raiseOf(company, random);
    startQuarter(company, random);
  }

  /**
   * 분기를 연다: 직원이 물어 오면 열릴 종목 회의를 준비한다 (268번). 거시경제 회의는 한 해에 한 번, 1분기에만 연다(decisions.md 281번): 고른 태도는
   * 한 해 내내 판돈에 걸린다. 2~4분기에는 분기를 열 때 직원이 종목을 물어 온다(1분기에는 거시경제 회의가 끝나고 물어 온다, 267번).
   */
  void startQuarter(CompanyState company, SeededRandom random) {
    company.quarterStartCapital = company.capital;
    company.invest = invest.create(company, random);
    if (company.quarter == 1 || company.macro == null) {
      company.macro = macro.create(company, random);
    }
    if (company.macro.stance != null) {
      macro.discover(company, random);
    }
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

  /**
   * 연초 회의의 "올해 필요한 인재". 폭락 조짐이 있어도 자리가 둘뿐이면 리스크 관리 팀에 한 사람을 빼면 돈을 굴리는 사람이 하나뿐이라, 폭락장에 덜 빠지는 자리를 권한다
   * (decisions.md 259번).
   */
  String wantedLine(CompanyState company) {
    Map<String, String> wanted = content.raising().company().wanted();
    if (RISK_DESK.equals(company.wantedDesk)
        && seats(company) <= FEW_SEATS
        && wanted.containsKey(RISK_FEW)) {
      return wanted.get(RISK_FEW);
    }
    return wanted.get(company.wantedDesk);
  }

  /** 자리가 이만큼 이하면 돕는 자리에 사람을 뺄 여유가 없다. */
  static final int FEW_SEATS = 2;

  private static final String RISK_FEW = "riskFew";

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

  /** 그 자리가 원하는 능력치 코드. */
  String deskStat(String code) {
    return desk(code).statCode();
  }

  /** 능력치 한 띠(점수). */
  int band() {
    return properties.experience().band();
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
    if (placed > seats(company)) {
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

  /** 돈을 굴리는 직원 한 명이 맡는 판돈 = 자본 × 비율 ÷ 사람 수 (자본을 넘지 않는다). 규모의 벽(244번)은 판돈이 아니라 손익 비율에 붙는다. */
  long stakeOf(CompanyState company, int traders) {
    if (traders == 0) {
      return 0;
    }
    long base = stakeBase(company);
    long pot = Math.min(base, (long) (base * properties.stakePercent() / (double) PERCENT));
    return pot / traders;
  }

  /** 판돈과 수수료를 정하는 자본 (268번): 올해 1분기를 넘길 때의 자본, 자본이 그 아래로 줄었으면 지금 자본. */
  long stakeBase(CompanyState company) {
    return company.yearStake == null
        ? company.capital
        : Math.min(company.capital, company.yearStake);
  }

  CompanyProperties.DeskReturn returnsOf(String desk) {
    return properties.desks().get(desk);
  }

  /** 한 해의 분기 수 (decisions.md 268번). */
  static final int QUARTERS = 4;

  /**
   * 남은 분기를 모두 넘겨 올해를 결산한다. 분기마다 회의를 정하지 않은 채로 넘기므로(거시경제 회의는 중립, 아무도 종목을 물어 오지 않는다) 결산 규칙만 볼 때와 옛
   * 화면이 쓴다. 이번 분기에 열 수 있는 종목 회의가 있으면 400.
   */
  Settlement settle(CompanyState company, SeededRandom random) {
    int year = company.year;
    while (company.year == year) {
      settleQuarter(company, random);
    }
    return company.settlements.getLast();
  }

  /**
   * 한 분기를 넘긴다 (decisions.md 268번, #330). 돈을 굴리는 직원마다 판단 하나: 꼬드김(리스크 관리 팀이 막는다) → 손 뒤집힘(자리가 원하는 능력치,
   * 폭락장인 해면 모두 인내심) → 맞힘(안목, 리서치 팀이 형광펜을 빌려준다). 수수료 매출은 한 해 몫의 4분의 1이 시장과 상관없이 들어온다. 폭락장인 해에는 폭락이
   * 정해진 분기에 한꺼번에 터진다. 자본은 분기마다 바뀌지만 회사 등급·건물·자리 수는 연말에만 바뀐다. 4분기를 넘기면 연말 결산을 하고 다음 해 연초 회의로 간다.
   */
  CompanyState.Quarter settleQuarter(CompanyState company, SeededRandom random) {
    requireOpen(company);
    if (invest.open(company)) {
      throw new InvalidRequestException("종목 회의를 먼저 해야 한다");
    }
    RandomGenerator rng = random.forKey("company-settle", company.year, company.quarter);
    if (company.quarter == 1 || company.yearStake == null) {
      company.yearStake = company.capital;
    }
    CompanyState.Quarter q = new CompanyState.Quarter();
    q.year = company.year;
    q.quarter = company.quarter;
    q.capitalBefore =
        company.quarterStartCapital != null ? company.quarterStartCapital : company.capital;
    int research = researchInsight(company);
    List<Employee> traders = traders(company);
    // 거시경제 회의의 태도가 그 분기 판돈 전체에 걸린다 (decisions.md 266번).
    long stake = stakeOf(company, traders.size()) * macro.stakePercent(company) / PERCENT;
    boolean crash = CRASH.equals(company.phase);
    // 폭락은 정해진 분기에 한 해 몫이 한꺼번에 터진다. 그 칸이 없던 해면 네 분기에 고르게 빠진다.
    boolean burst =
        crash && company.crashQuarter != null && company.crashQuarter == company.quarter;
    int phaseShare =
        crash && company.crashQuarter != null ? (burst ? properties.decisions() : 0) : 1;
    int decisions = Math.max(1, properties.decisions() / QUARTERS);
    q.crash = burst;
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
      // 규모의 벽(244번): 올해 회사 등급으로 정한다. 섹터 바람(266번): 그 분기 거시경제 회의의 주제가 순풍 자리는 더, 역풍 자리는 덜 벌게 한다.
      int gainBp =
          scaledGain(
              company,
              Math.max(
                  0,
                  gainBp(company, employee)
                      + (conviction ? effects.convictionGainBp() : 0)
                      + macro.windBp(company, employee.desk)));
      // 등급 효과 (289번): 종합 등급이 높을수록 맞혔을 때 더 번다. XS 큰손은 그 위에 1.5배.
      gainBp = gainBp * (PERCENT + perkGainPercent(employee)) / PERCENT;
      if (employee.rank >= RANK_BIG) {
        gainBp = gainBp * effects.bigGainPercent() / PERCENT;
      }
      int missBp = scaledMiss(company, returns.missBp());
      // XSS 철벽: 틀려도 잃는 몫이 절반이다.
      if (employee.rank >= RANK_WALL) {
        missBp = missBp * effects.wallMissPercent() / PERCENT;
      }
      int flipLossBp = scaledMiss(company, returns.flipBp());
      // 시장 손익. 폭락장에는 섹터마다 빠지는 폭이 다르다(식품·금융은 덜, 반도체는 더). 방어로 돌렸으면 덜 빠진다 (266번).
      int phaseBp = properties.phaseBp().getOrDefault(company.phase, 0);
      if (crash) {
        phaseBp =
            scaled(
                company,
                phaseBp * returns.crashPercent() / PERCENT * macro.crashPercent(company) / PERCENT,
                properties.scale().crashPercent());
      }
      long bp = 0;
      for (int i = 0; i < decisions; i++) {
        int swayRoll = rng.nextInt(BP);
        int flipRoll = rng.nextInt(BP);
        int hitRoll = rng.nextInt(BP);
        // XXX 역발상: 폭락장인 해에 빠지는 동안 사서 회복 구간에서 번다.
        bp += contrarian ? effects.contrarianCrashBp() : phaseBp * phaseShare;
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
      employee.totalPnl += result.pnl;
      // 손을 뒤집은 일은 팀장 보고(269번)가 전한다.
      q.results.add(result);
    }
    long fee = (long) (stakeBase(company) * properties.feeBp() / (double) BP / QUARTERS);
    q.fee = fee;
    q.staff = totalPnl;
    // 연봉 (270번): 분기마다 한 해 몫의 4분의 1이 나간다. 쉬는 사람도 받는다.
    q.salary = pay.quarterSalary(company);
    pay.markWorked(company);
    // 팀장 보고 (269번): 분기를 넘기면 자리마다 팀장이 보고한다. 돕는 자리는 이 분기에 한 일을 센다 (278번).
    recordSupport(company, q);
    q.reports.addAll(teams.reports(company, q.results, List.of(q), "이번 분기", company.turn()));
    company.capital = Math.max(0, company.capital + fee + totalPnl - q.salary);
    q.capitalAfter = company.capital;
    // 연봉 협상의 뒤끝 (280번): 답하지 않고 버티거나 동결하면 떠날 수 있다. 분기 실적과 연말 소식에 남긴다.
    List<String> quits = new java.util.ArrayList<>();
    pay.quarterPassed(company, random, quits);
    q.lines.addAll(quits);
    company.yearLines.addAll(quits);
    if (company.invest != null && company.invest.choice != null) {
      q.investTitle = company.invest.title;
      q.investTotal = company.invest.total;
    }
    // 분기 실적이 맞아떨어지게 이 분기에 낸 이사 비용(296번)과 인사 비용을 따로 둔다: 시작 자본 + 회의 + 직원들 + 수수료 − 인사 비용 − 인건비 − 이사 비용
    // = 끝 자본.
    q.moving = company.yearMoving - company.quarters.stream().mapToLong(x -> x.moving).sum();
    if (q.capitalAfter > 0) {
      q.hiring =
          q.capitalBefore
              + (q.investTotal == null ? 0 : q.investTotal)
              + q.staff
              + q.fee
              - q.salary
              - q.moving
              - q.capitalAfter;
    }
    RaisingContent.Quarters texts = content.raising().company().quarters();
    if (burst) {
      q.lines.addFirst(texts.crash());
    }
    if (company.macro != null) {
      q.macroTopic = macro.topic(company.macro).name();
      q.macroStance = macro.stance(company);
      q.lines.add(macro.windLine(company));
    }
    company.quarters.add(q);
    // 채용권 (decisions.md 312번): 분기를 넘길 때마다. 지난 뽑기 결과는 비운다.
    company.lastDraw.clear();
    giveTickets(company, properties.gacha().quarterTickets(), "quarter", q.lines);
    if (company.quarter < QUARTERS) {
      company.quarter++;
      startQuarter(company, random);
      return q;
    }
    yearEnd(company, random);
    return q;
  }

  /**
   * 연말 결산 (decisions.md 240·268번). 네 분기를 모아 연말 결산서를 짓는다: 직원마다 한 해 손익의 합과 분기 판돈의 평균, 손이 뒤집힌 횟수. 큰
   * 손실과 실전 경험은 한 해 합계로 정한다. 회사 등급·건물·자리 수가 여기서 바뀌고, 시대가 바뀌고, 다음 해 연초 회의로 간다.
   */
  private void yearEnd(CompanyState company, SeededRandom random) {
    // 이직 제안에 답하지 않았으면 제안은 흐지부지되고 직원은 남는다 (265번): 사장이 고르지 않으면 아무도 잃지 않는다.
    if (company.poach != null) {
      company.yearLines.add(
          Korean.fill(
              content.raising().company().people().ignored(),
              Map.of("name", poachedName(company), "rival", poacher())));
      company.poach = null;
    }
    Settlement settlement = new Settlement();
    settlement.year = company.year;
    settlement.phase = company.phase;
    settlement.omen = company.omen;
    settlement.hiring = company.yearHiring;
    settlement.moving = company.yearMoving;
    settlement.capitalBefore =
        company.yearStartCapital != null
            ? company.yearStartCapital
            : company.quarters.getFirst().capitalBefore;
    settlement.gradeBefore = grade(company);
    settlement.quarters.addAll(company.quarters);

    Map<Integer, Integer> ranksBefore = new HashMap<>();
    company.employees.forEach(e -> ranksBefore.put(e.id, e.rank));
    boolean crash = CRASH.equals(company.phase);
    // 직원마다 네 분기를 모은다: 손익은 합, 판돈은 굴린 분기의 평균, 뒤집힘은 횟수를 더한다.
    Map<Integer, Result> yearly = new java.util.LinkedHashMap<>();
    Map<Integer, Integer> traded = new HashMap<>();
    long fee = 0;
    long meetings = 0;
    List<String> titles = new java.util.ArrayList<>();
    for (CompanyState.Quarter q : company.quarters) {
      fee += q.fee;
      if (q.investTotal != null) {
        meetings += q.investTotal;
        titles.add(q.investTitle);
      }
      for (Result r : q.results) {
        Result y =
            yearly.computeIfAbsent(
                r.employeeId,
                id -> {
                  Result x = new Result();
                  x.employeeId = r.employeeId;
                  x.name = r.name;
                  return x;
                });
        y.desk = r.desk;
        y.pnl += r.pnl;
        y.stake += r.stake;
        traded.merge(r.employeeId, 1, Integer::sum);
        r.flips.forEach((stat, count) -> y.flips.merge(stat, count, Integer::sum));
      }
    }
    settlement.fee = fee;
    settlement.reports.addAll(
        teams.reports(
            company,
            new java.util.ArrayList<>(yearly.values()),
            company.quarters,
            "올해",
            company.year));
    if (!titles.isEmpty()) {
      // 연말 결산서(240번)가 종목 회의 몫과 직원들이 한 해 굴린 몫을 나눠 보인다.
      settlement.investTitle = String.join(" · ", titles);
      settlement.investTotal = meetings;
    }
    CompanyProperties.Experience rules = properties.experience();
    for (Result y : yearly.values()) {
      y.stake = y.stake / traded.get(y.employeeId);
      settlement.results.add(y);
      Employee employee =
          company.employees.stream().filter(e -> e.id == y.employeeId).findFirst().orElse(null);
      if (employee == null) {
        continue;
      }
      if (y.stake > 0 && y.pnl * PERCENT <= -y.stake * rules.dropLossPercent()) {
        drop(employee, y, settlement);
      } else if (crash && y.stake > 0 && y.pnl >= 0) {
        // 판돈이 없었으면 버틴 것이 아니다 (252번).
        survive(employee, settlement);
      }
      y.flips.forEach(
          (stat, count) ->
              settlement.lines.add(
                  Korean.fill(
                          content.raising().company().flipLines().get(stat), Map.of("name", y.name))
                      + (count > 1 ? " (" + count + "번)" : "")));
    }
    settlement.salary = company.quarters.stream().mapToLong(q -> q.salary).sum();
    pay.yearEnd(company, company.yearLines);
    settlement.capitalAfter = company.capital;
    if (company.capital == 0) {
      settlement.lines.add(content.raising().company().bankrupt().emptied());
    }
    settlement.lines.addAll(company.yearLines);
    countTenure(company, settlement);
    grow(company, settlement, random);
    // 등급·건물·자리 수는 연말에만 바뀐다 (268번). 건물은 저절로 오르지 않고(296번: 이사 비용을 내야 한다), 자본이 지금 띠 아래로 떨어지면 줄어든다.
    String kept = grade(company);
    company.gradedCapital = company.capital;
    String byCapital = grade(company.capital);
    company.building = LADDER.indexOf(byCapital) < LADDER.indexOf(kept) ? byCapital : kept;
    List<Employee> stood = fitSeats(company);
    if (!stood.isEmpty()) {
      settlement.lines.add(
          Korean.fill(
              content.raising().company().seatsCut(),
              Map.of("names", String.join("·", stood.stream().map(e -> e.name).toList()))));
    }
    settlement.gradeAfter = grade(company);
    // 랜드마크 타워에 오르면 엔딩이다 (276번). 엔딩을 본 회사는 멈추고, 사장이 다음 회사를 차린다.
    if (!company.finished
        && LADDER.indexOf(settlement.gradeAfter) >= LADDER.indexOf(properties.endingGrade())) {
      company.finished = true;
      company.finishedYear = company.year;
      settlement.finished = true;
      settlement.lines.add(
          Korean.fill(
              content.raising().company().ending().line(),
              Map.of("years", String.valueOf(company.year))));
    }
    // 폭락장에 아무도 바닥에서 던지지 않았으면 "못 참고 판 사람이 가장 크게 잃었다"를 쓰지 않는다 (decisions.md 255번).
    boolean anyPanic =
        settlement.results.stream().anyMatch(r -> r.flips.containsKey(StatCodes.PATIENCE));
    Map<String, String> phases = content.raising().company().phases();
    String phaseLine =
        crash && !anyPanic && phases.containsKey(CRASH_HELD)
            ? phases.get(CRASH_HELD)
            : phases.get(company.phase);
    settlement.lines.addFirst(phaseLine);
    if (crash && company.crashQuarter != null) {
      settlement.lines.add(
          1,
          Korean.fill(
              content.raising().company().quarters().crashAt(),
              Map.of("quarter", String.valueOf(company.crashQuarter))));
    }
    if (!crash && company.omen != null) {
      settlement.lines.add(1, content.raising().company().falseOmenNote());
    }
    company.settlements.add(settlement);
    String eraBefore = company.era;
    String eraAfter = eraOf(company, company.year + 1, random);
    company.year++;
    String eraLine = null;
    if (!eraAfter.equals(eraBefore)) {
      company.era = eraAfter;
      RaisingContent.Era from = era(eraBefore);
      RaisingContent.Era to = era(eraAfter);
      eraLine =
          Korean.fill(
              content.raising().company().eraTurn().changed(),
              Map.of("from", from.name(), "to", to.name(), "description", to.description()));
      settlement.lines.add(eraLine);
    }
    history.settled(
        company,
        settlement,
        ranksBefore,
        eraLine,
        LADDER.indexOf(settlement.gradeAfter) <= LADDER.indexOf("E"));
    // 채용권 (decisions.md 312번): 연말에 더, 인사팀이 있으면 더, 업적마다 더.
    CompanyProperties.Gacha gacha = properties.gacha();
    giveTickets(company, gacha.yearTickets(), "year", settlement.lines);
    if (hrOf(company).isPresent()) {
      giveTickets(company, hrExtraTickets(), "hr", settlement.lines);
    }
    giveTickets(
        company,
        gacha.achievementTickets() * settlement.achieved.size(),
        "achievement",
        settlement.lines);
    // 회사는 끝나지 않고 해마다 이어진다 (decisions.md 236번: 매각을 뺐다).
    startYear(company, random);
  }

  /**
   * 큰 손실을 낸 직원은 종합 등급이 한 단계 떨어진다 (6.4절). 떠나지 않는다. X 이상이면 종합 등급이, 그 아래면 그해 손을 가장 많이 뒤집은 능력치(뒤집힘이
   * 없었으면 자리가 원하는 능력치)가 한 띠 내려간다. 종합 등급만 내리면 실제 성적이 그대로라 판정에 쓰는 능력치를 내린다. 종합 등급이 F·E면 내려가지 않는다
   * (289번).
   */
  void drop(Employee employee, Result result, Settlement settlement) {
    RaisingContent.GradeLines lines = content.raising().company().gradeLines();
    String before = employeeGrade(employee);
    // 새내기·견습(F·E)은 배우는 중이라 큰 손실로 깎이지 않는다 (289번): 깎이면 자라는 만큼 도로 내려가 F를 벗어나지 못했다.
    if (employee.rank == 0 && LADDER.indexOf(before) < LADDER.indexOf(StatGrade.D.name())) {
      return;
    }
    if (employee.rank > 0) {
      employee.rank--;
      employee.experience = 0;
      settlement.lines.add(
          gradeLine(lines.drop(), employee, before, employeeGrade(employee), null));
      return;
    }
    // 같은 횟수면 결산 말풍선(224번)과 같은 순서로 탓한다: 줏대 → 인내심 → 용기 (252번).
    String stat =
        result.flips.entrySet().stream()
            .max(
                Map.Entry.<String, Integer>comparingByValue()
                    .thenComparing(e -> -FLIP_BLAME_ORDER.indexOf(e.getKey())))
            .map(Map.Entry::getKey)
            .orElse(desk(employee.desk != null ? employee.desk : result.desk).statCode());
    int value = employee.stats.get(stat);
    StatGrade from = StatGrade.of(value);
    if (from == StatGrade.F) {
      // 이미 바닥 띠면 더 내려갈 등급이 없다: 글자가 그대로인 하락 소식을 띄우지 않는다.
      return;
    }
    // 한 띠(10점)를 내리되 적어도 한 등급은 내려가게 띠 경계 아래까지 (252번). 전에는 SSS 100이 90이 되어 "SSS → SSS"가 떴다.
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
      // 내려간 만큼만 되찾는다 (252번). 옛 하락은 늘 새 하락보다 앞에 있으니, droppedBy가 남아 있으면 맨 뒤끼리 짝이다. 이 칸을 더하기 전에
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

  /** SSS 위 단계의 맨 위(ZZZ)인가. */
  boolean topRank(Employee employee) {
    return employee.rank >= LADDER.size() - 1 - LADDER.indexOf(StatGrade.SSS.name());
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
