package investorgame.raising.internal;

import investorgame.common.Korean;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.RaisingContent;
import investorgame.raising.CompanyService;
import investorgame.raising.CompanySummary;
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
  private final MemoryRepository memories;
  private final CompanyEngine engine;
  private final SecureRandom seeds = new SecureRandom();

  DefaultCompanyService(
      CompanyRepository companies, MemoryRepository memories, CompanyEngine engine) {
    this.companies = companies;
    this.memories = memories;
    this.engine = engine;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<CompanyView> current(UUID sessionId) {
    RaisingMemory memory = memories.find(sessionId);
    return companies.latest(sessionId).map(row -> view(row, memory));
  }

  @Override
  @Transactional
  public CompanyView open(UUID sessionId) {
    // 같은 세션의 동시 요청을 기억 줄로 줄 세운다. 회사가 하나라도 있으면 다음 회사는 매각으로 차린다.
    RaisingMemory memory = memories.lock(sessionId);
    if (companies.latest(sessionId).isPresent()) {
      throw new InvalidRequestException("이미 회사가 있다");
    }
    long seed = seeds.nextLong();
    CompanyState company = engine.open(new HashSeededRandom(seed), engine.openingCapital());
    CompanyRepository.Row row =
        new CompanyRepository.Row(UUID.randomUUID(), sessionId, "ACTIVE", seed, company);
    companies.insert(row);
    memories.save(sessionId, memory);
    return view(row, memory);
  }

  @Override
  @Transactional
  public CompanyView hire(UUID sessionId, int applicantId, Integer replace) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.hireApplicant(row.state(), applicantId, replace);
    companies.update(row.id(), row.state(), false);
    return view(row, memories.find(sessionId));
  }

  @Override
  @Transactional
  public CompanyView refreshApplicants(UUID sessionId) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.refresh(row.state(), new HashSeededRandom(row.seed()));
    companies.update(row.id(), row.state(), false);
    return view(row, memories.find(sessionId));
  }

  @Override
  @Transactional
  public CompanyView invest(UUID sessionId, String choice) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.invest.decide(row.state(), choice, new HashSeededRandom(row.seed()));
    companies.update(row.id(), row.state(), false);
    return view(row, memories.find(sessionId));
  }

  @Override
  @Transactional
  public CompanyView place(UUID sessionId, Map<Integer, String> placements) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.place(row.state(), placements);
    companies.update(row.id(), row.state(), false);
    return view(row, memories.find(sessionId));
  }

  @Override
  @Transactional
  public CompanyView settle(UUID sessionId, int year) {
    // 끝난 회사도 잠근다: 마지막 해의 결산이 두 번 오면 두 번째는 끝난 회사를 그대로 돌려준다.
    CompanyRepository.Row row =
        companies.lockLatest(sessionId).orElseThrow(() -> new NotFoundException("회사가 없다"));
    if (year < row.state().year) {
      return view(row, memories.find(sessionId));
    }
    if (year > row.state().year || !"ACTIVE".equals(row.status())) {
      throw new InvalidRequestException("아직 오지 않은 해다: " + year);
    }
    engine.settle(row.state(), new HashSeededRandom(row.seed()));
    boolean ended = engine.eraOver(row.state());
    companies.update(row.id(), row.state(), ended);
    return view(
        new CompanyRepository.Row(
            row.id(), row.sessionId(), ended ? "ENDED" : "ACTIVE", row.seed(), row.state()),
        memories.find(sessionId));
  }

  @Override
  @Transactional
  public CompanyView sell(UUID sessionId, List<Integer> cofounders) {
    RaisingMemory memory = memories.lock(sessionId);
    CompanyRepository.Row row =
        companies.lockLatest(sessionId).orElseThrow(() -> new NotFoundException("회사가 없다"));
    CompanyState old = row.state();
    if (!engine.canSell(old)) {
      throw new InvalidRequestException("아직 팔 수 없다");
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
    memories.save(sessionId, memory);
    return view(created, memory);
  }

  @Override
  @Transactional(readOnly = true)
  public List<CompanySummary> recent(int limit) {
    return companies.recent(limit).stream()
        .map(
            r -> {
              CompanyState c = r.row().state();
              return new CompanySummary(
                  r.row().id(),
                  r.row().sessionId(),
                  r.row().status(),
                  c.number,
                  c.era,
                  c.year,
                  c.settlements.size(),
                  c.capital,
                  engine.grade(c.capital),
                  c.employees.size(),
                  c.sold,
                  r.createdAt(),
                  r.updatedAt());
            })
        .toList();
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
    List<CompanyView.Applicant> applicants =
        ended
            ? List.of()
            : c.applicants.stream()
                .map(
                    a ->
                        new CompanyView.Applicant(
                            a.id,
                            a.name,
                            CompanyEngine.overallGrade(a.stats),
                            CompanyEngine.grades(a.stats),
                            a.fee,
                            a.line,
                            a.sector,
                            a.sector == null ? null : engine.sectorName(a.sector)))
                .toList();
    String hrCap = engine.hrOf(c).map(engine::hrCap).orElse(null);
    CompanyView.Meeting meeting =
        ended
            ? null
            : new CompanyView.Meeting(
                hrCap,
                c.omen,
                engine.earlyOmen(c),
                engine.forecast(c),
                engine.wantedLine(c),
                engine.hotLine(c));
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
        applicants,
        engine.refreshCost(),
        ended ? null : investView(c, new HashSeededRandom(row.seed())),
        last == null ? null : settlementView(last));
  }

  private CompanyView.Invest investView(CompanyState c, HashSeededRandom random) {
    CompanyState.Invest invest = c.invest;
    if (invest == null) {
      return null;
    }
    InvestEngine meetings = engine.invest;
    int highlighted = meetings.highlight(c, random).map(InvestEngine.Highlight::index).orElse(-1);
    String highlightBy = meetings.highlight(c, random).map(InvestEngine.Highlight::by).orElse(null);
    List<CompanyView.InvestSentence> sentences = new java.util.ArrayList<>();
    int decisive = -1;
    for (int i = 0; i < invest.sentences.size(); i++) {
      CompanyState.Sentence s = invest.sentences.get(i);
      sentences.add(new CompanyView.InvestSentence(s.text, i == highlighted));
      if (s.decisive) {
        decisive = i;
      }
    }
    RaisingContent.Invest texts = engine.investTexts();
    List<CompanyView.Remark> remarks =
        meetings.remarks(c, random).stream()
            .map(
                r ->
                    new CompanyView.Remark(
                        r.employee().id,
                        r.employee().name,
                        r.employee().desk,
                        r.read(),
                        r.text(),
                        r.stubbornBp() == null ? null : meetings.stubbornLevel(r.stubbornBp())))
            .toList();
    List<CompanyView.Option> options =
        List.of(InvestEngine.BUY, InvestEngine.SELL, InvestEngine.HOLD).stream()
            .map(code -> new CompanyView.Option(code, texts.options().get(code)))
            .toList();
    CompanyView.InvestOutcome outcome =
        invest.choice == null
            ? null
            : new CompanyView.InvestOutcome(
                invest.choice,
                invest.up,
                meetings.reveal(c),
                decisive,
                invest.total,
                invest.results.stream()
                    .map(
                        r ->
                            new CompanyView.InvestResult(
                                r.employeeId,
                                r.name,
                                r.desk,
                                r.action,
                                r.follow,
                                r.pnl,
                                r.line,
                                r.rival == null
                                    ? null
                                    : new CompanyView.Rival(r.rivalKind, r.rival, r.guard)))
                    .toList());
    return new CompanyView.Invest(
        invest.title,
        engine.stockName(invest.stock),
        engine.stockSector(invest.stock),
        sentences,
        highlightBy,
        new CompanyView.Sway(meetings.tempterName(invest.tempter), invest.sway),
        remarks,
        options,
        meetings.open(c),
        outcome);
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
