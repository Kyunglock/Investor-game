package investorgame.raising.internal;

import investorgame.common.Korean;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.RaisingContent;
import investorgame.raising.CompanyService;
import investorgame.raising.CompanyView;
import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class DefaultCompanyService implements CompanyService {

  private final CompanyRepository companies;
  private final RunRepository runs;
  private final CompanyEngine engine;
  private final SecureRandom seeds = new SecureRandom();

  DefaultCompanyService(CompanyRepository companies, RunRepository runs, CompanyEngine engine) {
    this.companies = companies;
    this.runs = runs;
    this.engine = engine;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<CompanyView> current(UUID sessionId) {
    RaisingMemory memory = runs.memory(sessionId);
    return companies.latest(sessionId).map(row -> view(row, memory));
  }

  @Override
  @Transactional
  public CompanyView hire(UUID sessionId, UUID runId, boolean register, Integer replace) {
    Optional<CompanyRepository.Row> active = companies.lockActive(sessionId);
    RunRepository.Row run =
        runs.lockEnded(sessionId, runId).orElseThrow(() -> new NotFoundException("끝난 판이 없다"));
    RunState person = run.state();
    if (person.decided) {
      throw new InvalidRequestException("이미 정한 판이다");
    }
    person.decided = true;
    runs.update(runId, person, true);
    long money = person.totalAsset();
    if (active.isEmpty()) {
      // 처음에는 회사가 없다. 이 사람이 1호 직원이 되며 회사가 열리고, 판에서 번 돈이 시작 자본이다 (6.0절).
      if (!register) {
        throw new InvalidRequestException("첫 사람은 1호 직원으로 등록해야 회사가 열린다");
      }
      long seed = seeds.nextLong();
      CompanyState company = engine.open(new HashSeededRandom(seed), person.stats, money);
      company.employees.getFirst().experience = survivedCrisis(person) ? 1 : 0;
      company.employees.getFirst().sector = RunEngine.topTrait(person, "sector.");
      CompanyRepository.Row row =
          new CompanyRepository.Row(UUID.randomUUID(), sessionId, "ACTIVE", seed, company);
      companies.insert(row);
      return view(row, runs.memory(sessionId));
    }
    CompanyRepository.Row row = active.get();
    CompanyState company = row.state();
    if (!runId.equals(company.pendingRun)) {
      throw new InvalidRequestException("이 회사의 공채 판이 아니다");
    }
    company.pendingRun = null;
    company.recruitFund = 0;
    // 돌려보내도 육성에서 번 돈(운용금과 손익)은 회사로 돌아온다 (6.3·6.5절).
    company.capital += money;
    if (register) {
      makeRoom(company, replace);
      // 연초 회의가 말한 인재에 맞춰 키웠으면 그 능력치가 한 띠 올라 입사한다 (5절 3번).
      Map<String, Integer> stats =
          engine.withWantedBonus(person.stats, person.wantedStat, person.wantedMin);
      CompanyState.Employee employee = engine.hire(company, stats);
      employee.experience = survivedCrisis(person) ? 1 : 0;
      employee.sector = RunEngine.topTrait(person, "sector.");
    }
    companies.update(row.id(), company, false);
    return view(row, runs.memory(sessionId));
  }

  /** 자리가 꽉 찼으면 replace의 직원을 내보낸다 (6.3절). 바꿀 직원이 없으면 400. */
  private void makeRoom(CompanyState company, Integer replace) {
    if (company.employees.size() < engine.seats(company.capital)) {
      return;
    }
    if (replace == null || company.employees.stream().noneMatch(e -> e.id == replace)) {
      throw new InvalidRequestException("자리가 꽉 찼다. 바꿀 직원을 고른다");
    }
    company.employees.removeIf(e -> e.id == replace);
  }

  @Override
  @Transactional
  public CompanyView hrRecruit(UUID sessionId) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.hrRecruit(row.state(), new HashSeededRandom(row.seed()));
    companies.update(row.id(), row.state(), false);
    return view(row, runs.memory(sessionId));
  }

  @Override
  @Transactional
  public CompanyView decideCandidate(UUID sessionId, boolean register, Integer replace) {
    CompanyRepository.Row row = lockActive(sessionId);
    CompanyState company = row.state();
    if (company.candidate == null) {
      throw new InvalidRequestException("인사팀이 데려온 신입이 없다");
    }
    if (register) {
      makeRoom(company, replace);
      engine.hireCandidate(company);
    } else {
      company.candidate = null;
    }
    companies.update(row.id(), company, false);
    return view(row, runs.memory(sessionId));
  }

  /** 육성 중에 위기를 겪고도 원금을 지킨 신입은 실전 경험을 조금 안고 입사한다 (6.2절). */
  private static boolean survivedCrisis(RunState person) {
    return person.crisis != null && person.crisis.hits && person.totalAsset() >= person.fund;
  }

  @Override
  @Transactional
  public CompanyView place(UUID sessionId, Map<Integer, String> placements) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.place(row.state(), placements);
    companies.update(row.id(), row.state(), false);
    return view(row, runs.memory(sessionId));
  }

  @Override
  @Transactional
  public CompanyView settle(UUID sessionId) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.settle(row.state(), new HashSeededRandom(row.seed()));
    boolean ended = engine.eraOver(row.state());
    companies.update(row.id(), row.state(), ended);
    return view(
        new CompanyRepository.Row(
            row.id(), row.sessionId(), ended ? "ENDED" : "ACTIVE", row.seed(), row.state()),
        runs.memory(sessionId));
  }

  @Override
  @Transactional
  public CompanyView sell(UUID sessionId, List<Integer> cofounders) {
    RaisingMemory memory = runs.lockMemory(sessionId);
    CompanyRepository.Row row =
        companies.lockLatest(sessionId).orElseThrow(() -> new NotFoundException("회사가 없다"));
    CompanyState old = row.state();
    if (!engine.canSell(old)) {
      throw new InvalidRequestException("아직 팔 수 없다");
    }
    if (old.recruitRun != null || old.pendingRun != null || old.candidate != null) {
      throw new InvalidRequestException("공채 육성을 먼저 마친다");
    }
    if (cofounders.stream().distinct().count() != cofounders.size()) {
      throw new InvalidRequestException("같은 직원을 두 번 골랐다");
    }
    // 매각할 때마다 명성이 오르고, 판 회사의 등급이 높을수록 많이 오른다 (9.2절).
    memory.famePoints += engine.fameFor(old);
    memory.sales++;
    long seed = seeds.nextLong();
    CompanyState next =
        engine.refound(old, cofounders, memory.famePoints, new HashSeededRandom(seed));
    old.sold = true;
    companies.update(row.id(), old, true);
    CompanyRepository.Row created =
        new CompanyRepository.Row(UUID.randomUUID(), sessionId, "ACTIVE", seed, next);
    companies.insert(created);
    runs.saveMemory(sessionId, memory);
    return view(created, memory);
  }

  private CompanyRepository.Row lockActive(UUID sessionId) {
    return companies.lockActive(sessionId).orElseThrow(() -> new NotFoundException("회사가 없다"));
  }

  private CompanyView view(CompanyRepository.Row row, RaisingMemory memory) {
    CompanyState c = row.state();
    RaisingContent.Era era = engine.era(c);
    CompanyView.Sale sale = null;
    if (engine.canSell(c)) {
      int after = memory.famePoints + engine.fameFor(c);
      RaisingContent.Sale texts = engine.saleTexts();
      String note =
          engine.eraOver(c)
              ? Korean.fill(texts.eraEnd(), Map.of("era", era.name()))
              : Korean.fill(texts.voluntary(), Map.of("grade", engine.grade(c.capital)));
      sale =
          new CompanyView.Sale(
              engine.eraOver(c),
              note,
              c.capital,
              engine.fameGrade(after),
              engine.cofounderSlots(after));
    }
    boolean ended = "ENDED".equals(row.status());
    String grade = engine.grade(c.capital);
    int at = CompanyEngine.LADDER.indexOf(grade);
    List<Long> bands = engine.gradeCapital();
    Long next = at + 1 < bands.size() ? bands.get(at + 1) : null;
    List<CompanyView.Employee> employees =
        c.employees.stream()
            .map(
                e ->
                    new CompanyView.Employee(
                        e.id,
                        e.name,
                        CompanyEngine.employeeGrade(e),
                        CompanyEngine.grades(e.stats),
                        e.desk,
                        e.experience,
                        CompanyEngine.overallGrade(e.stats).equals("SSS")
                            ? engine.experienceNeeded(e)
                            : null,
                        engine.effectsOf(e),
                        e.salary,
                        e.sector,
                        e.sector == null ? null : engine.sectorName(e.sector)))
            .toList();
    List<String> hot = engine.hotDesks(c);
    List<CompanyView.Desk> desks =
        engine.desks().stream()
            .map(
                d ->
                    new CompanyView.Desk(
                        d.code(),
                        d.name(),
                        d.statCode(),
                        d.trades(),
                        d.sector(),
                        hot.contains(d.code()),
                        d.description()))
            .toList();
    CompanyView.Candidate candidate =
        c.candidate == null
            ? null
            : new CompanyView.Candidate(
                CompanyEngine.overallGrade(c.candidate),
                CompanyEngine.grades(c.candidate),
                engine.hrOf(c).map(engine::hrLine).orElse(null));
    String hrCap = engine.hrOf(c).map(engine::hrCap).orElse(null);
    CompanyView.Meeting meeting =
        ended
            ? null
            : new CompanyView.Meeting(
                hrCap,
                c.omen,
                engine.hotLine(c),
                engine.earlyOmen(c),
                engine.forecast(c),
                engine.wantedLine(c),
                engine.wantedBonusLine(c),
                engine.recruitFund(c),
                !c.recruited,
                c.pendingRun);
    CompanyState.Settlement last = c.settlements.isEmpty() ? null : c.settlements.getLast();
    return new CompanyView(
        row.id(),
        ended ? CompanyView.Status.ENDED : CompanyView.Status.ACTIVE,
        c.number,
        new CompanyView.Era(era.code(), era.name(), era.description()),
        c.opening,
        new CompanyView.Owner(
            engine.fameGrade(memory.famePoints),
            memory.famePoints,
            memory.sales,
            engine.cofounderSlots(memory.famePoints)),
        sale,
        c.year,
        engine.turns(),
        c.capital,
        grade,
        next,
        engine.seats(c.capital),
        employees,
        desks,
        meeting,
        candidate,
        last == null ? null : settlementView(last));
  }

  private static CompanyView.Settlement settlementView(CompanyState.Settlement s) {
    return new CompanyView.Settlement(
        s.year,
        s.phase,
        s.omen,
        s.capitalBefore,
        s.capitalAfter,
        s.fee,
        s.gradeBefore,
        s.gradeAfter,
        s.results.stream()
            .map(
                r ->
                    new CompanyView.Result(
                        r.employeeId, r.name, r.desk, r.stake, r.pnl, Map.copyOf(r.flips)))
            .toList(),
        List.copyOf(s.lines));
  }
}
