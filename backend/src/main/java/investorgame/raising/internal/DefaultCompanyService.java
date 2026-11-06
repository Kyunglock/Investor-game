package investorgame.raising.internal;

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
  @Transactional
  public Optional<CompanyView> current(UUID sessionId) {
    return companies.latest(sessionId).map(row -> view(resume(row)));
  }

  /**
   * 매각을 빼기 전(decisions.md 236번)에 시대가 끝나 멈춘 회사는 다음 해 연초 회의부터 다시 돌린다. 팔린 회사는 그대로 둔다(그 뒤에 차린 회사가 가장
   * 최근이다).
   */
  private CompanyRepository.Row resume(CompanyRepository.Row row) {
    if (!"ENDED".equals(row.status()) || row.state().sold || row.state().closed) {
      return row;
    }
    CompanyRepository.Row locked =
        companies.lockLatest(row.sessionId()).orElseThrow(() -> new NotFoundException("회사가 없다"));
    if (!"ENDED".equals(locked.status()) || locked.state().sold || locked.state().closed) {
      return locked;
    }
    engine.resume(locked.state(), new HashSeededRandom(locked.seed()));
    companies.reopen(locked.id(), locked.state());
    return new CompanyRepository.Row(
        locked.id(), locked.sessionId(), "ACTIVE", locked.seed(), locked.state());
  }

  @Override
  @Transactional
  public CompanyView open(UUID sessionId) {
    // 같은 세션의 동시 요청을 기억 줄로 줄 세운다. 회사는 세션마다 하나다(매각을 뺐다, 236번).
    RaisingMemory memory = memories.lock(sessionId);
    Optional<CompanyRepository.Row> latest = companies.lockLatest(sessionId);
    long seed = seeds.nextLong();
    CompanyState company;
    if (latest.isPresent()) {
      // 망한 회사만 닫고 사장의 사재로 다음 회사를 차릴 수 있다 (246번).
      CompanyRepository.Row old = latest.get();
      if (!"ACTIVE".equals(old.status()) || !engine.broke(old.state())) {
        throw new InvalidRequestException("이미 회사가 있다");
      }
      company = engine.restart(old.state(), new HashSeededRandom(seed), engine.openingCapital());
      companies.update(old.id(), old.state(), true);
    } else {
      company = engine.open(new HashSeededRandom(seed), engine.openingCapital());
    }
    CompanyRepository.Row row =
        new CompanyRepository.Row(UUID.randomUUID(), sessionId, "ACTIVE", seed, company);
    companies.insert(row);
    memories.save(sessionId, memory);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView hire(UUID sessionId, int applicantId, Integer replace) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.hireApplicant(row.state(), applicantId, replace);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView refreshApplicants(UUID sessionId, int year, int refreshes) {
    CompanyRepository.Row row = lockActive(sessionId);
    CompanyState c = row.state();
    // 이미 한 새로 받기면 아무것도 하지 않는다(버튼 두 번, 끊긴 요청 다시 보내기, 253번). 아직 오지 않은 것이면 400.
    if (year < c.year || (year == c.year && refreshes < c.refreshes)) {
      return view(row);
    }
    if (year > c.year || refreshes > c.refreshes) {
      throw new InvalidRequestException("아직 오지 않은 새로 받기다: " + year + "년 " + refreshes + "번");
    }
    engine.refresh(c, new HashSeededRandom(row.seed()));
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView answerPoach(UUID sessionId, boolean keep) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.answerPoach(row.state(), keep);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView convene(UUID sessionId) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.invest.convene(row.state(), new HashSeededRandom(row.seed()));
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView invest(UUID sessionId, String choice, boolean big) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.invest.decide(row.state(), choice, big, new HashSeededRandom(row.seed()));
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView place(UUID sessionId, Map<Integer, String> placements) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.place(row.state(), placements);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView settle(UUID sessionId, int year) {
    CompanyRepository.Row row =
        companies.lockLatest(sessionId).orElseThrow(() -> new NotFoundException("회사가 없다"));
    if (year < row.state().year) {
      return view(row);
    }
    if (year > row.state().year || !"ACTIVE".equals(row.status())) {
      throw new InvalidRequestException("아직 오지 않은 해다: " + year);
    }
    // 회사는 끝나지 않고 해마다 이어진다 (236번).
    engine.settle(row.state(), new HashSeededRandom(row.seed()));
    companies.update(row.id(), row.state(), false);
    return view(row);
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

  private CompanyView view(CompanyRepository.Row row) {
    CompanyState c = row.state();
    RaisingContent.Era era = engine.era(c);
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
                        e.sector == null ? null : engine.sectorName(e.sector),
                        e.desk != null && e.desk.equals(e.lastDesk) ? e.deskYears : 0,
                        engine.settled(e)))
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
                        d.description(),
                        d.trades() ? engine.deskGainBp(c, d.code()) : null,
                        d.trades() ? engine.returnsOf(d.code()).missBp() : null,
                        d.trades() ? engine.returnsOf(d.code()).crashPercent() : null))
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
                            CompanyEngine.gradeOf(a.stats, a.rank),
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
                engine.hotLine(c),
                engine.eraEndingLine(c),
                poachView(c));
    CompanyState.Settlement last = c.settlements.isEmpty() ? null : c.settlements.getLast();
    return new CompanyView(
        row.id(),
        ended ? CompanyView.Status.ENDED : CompanyView.Status.ACTIVE,
        c.number,
        new CompanyView.Era(era.code(), era.name(), era.description()),
        c.opening,
        c.year,
        c.capital,
        grade,
        next,
        engine.seats(c.capital),
        employees,
        desks,
        meeting,
        applicants,
        engine.refreshCost(c),
        c.refreshes,
        industryView(c),
        historyView(c),
        ended ? null : engine.brokeNotice(c),
        ended ? null : investView(c, new HashSeededRandom(row.seed())),
        last == null ? null : settlementView(last));
  }

  private CompanyView.Invest investView(CompanyState c, HashSeededRandom random) {
    CompanyState.Invest invest = c.invest;
    if (invest == null) {
      return null;
    }
    InvestEngine meetings = engine.invest;
    // 한마디와 형광펜은 회의를 연 때 굳힌 것만 보인다 (248번).
    int highlighted = meetings.highlight(c).map(InvestEngine.Highlight::index).orElse(-1);
    String highlightBy = meetings.highlight(c).map(InvestEngine.Highlight::by).orElse(null);
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
        meetings.remarks(c).stream()
            .map(
                r ->
                    new CompanyView.Remark(
                        r.employeeId,
                        r.name,
                        r.desk,
                        r.read,
                        r.text,
                        r.stubbornBp == null ? null : meetings.stubbornLevel(r.stubbornBp)))
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
                invest.big,
                invest.missed,
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
        meetings.convened(c),
        outcome);
  }

  private CompanyView.Poach poachView(CompanyState c) {
    CompanyState.Poach p = c.poach;
    if (p == null) {
      return null;
    }
    String name =
        c.employees.stream()
            .filter(e -> e.id == p.employeeId)
            .findFirst()
            .map(e -> e.name)
            .orElse("");
    return new CompanyView.Poach(
        p.employeeId,
        name,
        engine.rivalName(p.rival),
        p.keepCost,
        p.transferFee,
        engine.poachLine(c));
  }

  private static final int HALL_SIZE = 5;

  private CompanyView.History historyView(CompanyState c) {
    List<CompanyView.Event> timeline =
        c.timeline.stream()
            .map(e -> new CompanyView.Event(e.year, e.kind, e.text, e.grade))
            .toList();
    List<CompanyView.Achievement> achievements =
        engine.history.all().stream()
            .map(
                a ->
                    new CompanyView.Achievement(
                        a.code(), a.name(), a.description(), c.achievements.get(a.code())))
            .toList();
    List<CompanyView.Hall> hall = new java.util.ArrayList<>();
    c.employees.forEach(
        e ->
            hall.add(
                new CompanyView.Hall(
                    e.name, e.joinedYear, null, e.totalPnl, CompanyEngine.employeeGrade(e))));
    c.alumni.forEach(
        a -> hall.add(new CompanyView.Hall(a.name, a.from, a.to, a.totalPnl, a.grade)));
    hall.sort(java.util.Comparator.comparingLong(CompanyView.Hall::totalPnl).reversed());
    return new CompanyView.History(
        timeline, achievements, List.copyOf(hall.subList(0, Math.min(HALL_SIZE, hall.size()))));
  }

  private CompanyView.Industry industryView(CompanyState c) {
    if (c.rivals.isEmpty()) {
      return null;
    }
    int above = engine.rivalAbove(c);
    return new CompanyView.Industry(
        engine.industryRank(c),
        c.rivals.size() + 1,
        above < 0 ? null : engine.rivalName(above),
        above < 0 ? null : c.rivals.get(above));
  }

  private static CompanyView.Settlement settlementView(CompanyState.Settlement s) {
    return new CompanyView.Settlement(
        s.year,
        s.phase,
        s.omen,
        s.capitalBefore,
        s.capitalAfter,
        s.fee,
        s.hiring,
        s.investTotal == null
            ? null
            : new CompanyView.SettlementInvest(s.investTitle, s.investTotal),
        s.gradeBefore,
        s.gradeAfter,
        List.copyOf(s.overtook),
        List.copyOf(s.achieved),
        s.results.stream()
            .map(
                r ->
                    new CompanyView.Result(
                        r.employeeId, r.name, r.desk, r.stake, r.pnl, Map.copyOf(r.flips)))
            .toList(),
        List.copyOf(s.lines));
  }
}
