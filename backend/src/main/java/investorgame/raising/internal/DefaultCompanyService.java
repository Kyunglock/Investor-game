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
    return companies.latest(sessionId).map(row -> view(adopt(resume(row))));
  }

  /** 채용 뽑기 전에 차린 회사면 처음 채용권을 주고 도감을 채워 저장한다 (decisions.md 312번). */
  private CompanyRepository.Row adopt(CompanyRepository.Row row) {
    if (row.state().gachaReady || !"ACTIVE".equals(row.status())) {
      return row;
    }
    CompanyRepository.Row locked = companies.lockActive(row.sessionId()).orElse(row);
    if (engine.adoptGacha(locked.state())) {
      companies.update(locked.id(), locked.state(), false);
    }
    return locked;
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
      // 망한 회사만 닫고 사장의 사재로 다음 회사를 차릴 수 있다 (247번).
      CompanyRepository.Row old = latest.get();
      // 망했거나(247번) 랜드마크 타워에 올라 엔딩을 본(276번) 회사만 닫고 다음 회사를 차린다.
      if (!"ACTIVE".equals(old.status()) || !engine.canRestart(old.state())) {
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
  public CompanyView draw(UUID sessionId, int count, int draws) {
    CompanyRepository.Row row = lockActive(sessionId);
    CompanyState c = row.state();
    // 이미 한 뽑기면 아무것도 하지 않는다(버튼 두 번, 끊긴 요청 다시 보내기, 254번과 같은 방식). 아직 오지 않은 것이면 400.
    if (draws < c.draws) {
      return view(row);
    }
    if (draws > c.draws) {
      throw new InvalidRequestException("아직 오지 않은 뽑기다: " + draws + "번");
    }
    engine.draw(c, count, new HashSeededRandom(row.seed()));
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView merge(UUID sessionId, int baseId, List<Integer> materialIds) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.merge(row.state(), baseId, materialIds);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView release(UUID sessionId, int employeeId) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.release(row.state(), employeeId);
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
    engine.invest.decide(row.state(), choice, big, new HashSeededRandom(row.seed()), true);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView answerProposal(UUID sessionId, boolean accept) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.invest.answerProposal(row.state(), accept, new HashSeededRandom(row.seed()));
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView verdict(UUID sessionId, String choice) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.invest.verdict(row.state(), choice);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView conveneMacro(UUID sessionId) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.macro.convene(row.state(), new HashSeededRandom(row.seed()));
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView macro(UUID sessionId, String stance) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.macro.decide(row.state(), stance, new HashSeededRandom(row.seed()));
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView answerRaise(UUID sessionId, boolean accept) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.pay.answer(row.state(), accept, new HashSeededRandom(row.seed()));
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView upgrade(UUID sessionId) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.upgrade(row.state());
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  /** 다음 건물로 가는 데 드는 돈 (296번). 끝 등급이거나 끝난 회사면 null. */
  private CompanyView.Upgrade upgradeView(CompanyState c) {
    if (c.buildingTo != null && !c.finished) {
      return new CompanyView.Upgrade(c.buildingTo, 0, 0, false, c.buildYears, c.buildLeft);
    }
    String to = engine.nextGrade(c);
    Long needed = engine.upgradeNeeded(c);
    if (to == null || needed == null || c.finished) {
      return null;
    }
    return new CompanyView.Upgrade(
        to, engine.upgradeCost(c), needed, engine.canUpgrade(c), engine.buildYears(to), null);
  }

  @Override
  @Transactional
  public CompanyView leader(UUID sessionId, String desk, int employeeId) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.teams.appoint(row.state(), desk, employeeId);
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
  public CompanyView settle(UUID sessionId, int year, int quarter) {
    CompanyRepository.Row row =
        companies.lockLatest(sessionId).orElseThrow(() -> new NotFoundException("회사가 없다"));
    CompanyState c = row.state();
    int asked = year * CompanyEngine.QUARTERS + quarter;
    int now = c.year * CompanyEngine.QUARTERS + c.quarter;
    if (asked < now) {
      return view(row);
    }
    if (asked > now || !"ACTIVE".equals(row.status())) {
      throw new InvalidRequestException("아직 오지 않은 분기다: " + year + "년 " + quarter + "분기");
    }
    // 회사는 분기마다, 해마다 이어진다 (236·268번). 랜드마크 타워에 오르면 엔딩이다 (276번).
    engine.settleQuarter(c, new HashSeededRandom(row.seed()));
    if (c.year > year) {
      recordYear(row, year);
    }
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
    CompanyRepository.Row row =
        companies.lockActive(sessionId).orElseThrow(() -> new NotFoundException("회사가 없다"));
    // 채용 뽑기 전에 차린 회사 (312번): 무엇을 하든 그 전에 옮긴다. 요청 끝에 함께 저장된다.
    engine.adoptGacha(row.state());
    if (row.state().finished) {
      throw new InvalidRequestException("엔딩을 본 회사다. 새 회사를 차려야 한다");
    }
    return row;
  }

  private CompanyView view(CompanyRepository.Row row) {
    CompanyState c = row.state();
    RaisingContent.Era era = engine.era(c);
    boolean ended = "ENDED".equals(row.status());
    String grade = engine.grade(c);
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
                        // ZZZ(맨 위)면 더 오를 데가 없다: "실전 경험 0/7"을 보이지 않는다 (264번).
                        CompanyEngine.overallGrade(e.stats).equals("SSS") && !engine.topRank(e)
                            ? engine.experienceNeeded(e)
                            : null,
                        engine.effectsOf(e),
                        engine.perkLine(e.stats, e.rank),
                        e.sector,
                        e.sector == null ? null : engine.sectorName(e.sector),
                        e.desk != null && e.desk.equals(e.lastDesk) ? e.deskYears : 0,
                        engine.settled(e),
                        engine.macro.roleOf(e),
                        engine.teams.leads(c, e),
                        engine.pay.salary(c, e),
                        e.morale))
            .toList();
    List<String> hot = engine.hotDesks(c);
    // 돕는 자리는 회사가 커 가며 하나씩 열린다 (#393). 이미 누가 앉아 있으면(열기 전에 앉힌 옛 회사) 보인다.
    java.util.Set<String> seated = new java.util.HashSet<>();
    c.employees.forEach(e -> seated.add(e.desk));
    List<CompanyView.Desk> desks =
        engine.desks().stream()
            .filter(d -> engine.deskOpen(c, d.code()) || seated.contains(d.code()))
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
                        d.trades() ? engine.returnsOf(d.code()).crashPercent() : null,
                        engine.unlockGrade(d.code())))
            .toList();
    List<CompanyView.LockedDesk> lockedDesks =
        engine.desks().stream()
            .filter(d -> !engine.deskOpen(c, d.code()) && !seated.contains(d.code()))
            .map(
                d ->
                    new CompanyView.LockedDesk(
                        d.code(), d.name(), d.description(), engine.unlockGrade(d.code())))
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
                poachView(c),
                raiseView(c));
    CompanyState.Settlement last = c.settlements.isEmpty() ? null : c.settlements.getLast();
    return new CompanyView(
        row.id(),
        ended ? CompanyView.Status.ENDED : CompanyView.Status.ACTIVE,
        c.number,
        new CompanyView.Era(era.code(), era.name(), era.description()),
        c.opening,
        c.year,
        c.quarter,
        c.capital,
        grade,
        next,
        upgradeView(c),
        engine.seats(c),
        employees,
        desks,
        meeting,
        gachaView(c),
        historyView(c),
        ended ? null : engine.brokeNotice(c),
        ended ? null : investView(c, new HashSeededRandom(row.seed())),
        ended ? null : macroView(c),
        c.quarters.isEmpty() ? null : quarterView(c.quarters.getLast()),
        last == null ? null : settlementView(last),
        c.finished
            ? new CompanyView.Ending(
                c.finishedYear == null ? c.year : c.finishedYear, c.capital, grade)
            : null,
        resignView(c),
        industryView(row),
        lockedDesks);
  }

  /** 연말 자본을 남기고 같은 연차 회사들 가운데 자리를 결산 소식에 적는다 (#351). 지난해보다 상위 몇 %가 5%p 넘게 오르거나 내렸으면 그렇게 말한다. */
  private void recordYear(CompanyRepository.Row row, int year) {
    CompanyState c = row.state();
    companies.recordYear(row.id(), year, c.capital);
    companies
        .rankAt(row.id(), year)
        .ifPresent(
            r -> {
              int top = (int) Math.max(1, Math.ceil(r[0] * 100.0 / r[1]));
              RaisingContent.Industry texts = engine.industryTexts();
              String template =
                  c.industryTop == null
                      ? texts.first()
                      : top < c.industryTop - 5
                          ? texts.up()
                          : top > c.industryTop + 5 ? texts.down() : texts.same();
              String line =
                  investorgame.common.Korean.fill(
                      template,
                      java.util.Map.of(
                          "year", String.valueOf(year),
                          "rank", String.valueOf(r[0]),
                          "total", String.valueOf(r[1]),
                          "top", String.valueOf(top)));
              c.industryTop = top;
              if (!c.settlements.isEmpty()) {
                c.settlements.getLast().lines.add(line);
              }
            });
  }

  /** 업계 순위 (#351): 지난 연말의 같은 연차 회사들 가운데 자리. */
  private CompanyView.Industry industryView(CompanyRepository.Row row) {
    int year = row.state().settlements.isEmpty() ? 0 : row.state().settlements.getLast().year;
    if (year < 1) {
      return null;
    }
    return companies
        .rankAt(row.id(), year)
        .map(r -> new CompanyView.Industry(year, r[0], r[1]))
        .orElse(null);
  }

  /** 채용 뽑기 (decisions.md 312번): 채용권, 데리고 있는 사람, 확률표, 마지막 뽑기, 도감. */
  private CompanyView.Gacha gachaView(CompanyState c) {
    List<CompanyView.Rate> rates =
        engine.rates().stream()
            .map(r -> new CompanyView.Rate(engine.rateGrade(c, r), r.percent(), r.star()))
            .toList();
    List<CompanyView.Drawn> drawn =
        c.lastDraw.stream()
            .map(d -> new CompanyView.Drawn(d.employeeId, d.name, d.grade, d.star, d.fresh))
            .toList();
    List<CompanyView.CollectionEntry> collection =
        CompanyEngine.LADDER.stream()
            .map(g -> new CompanyView.CollectionEntry(g, c.collection.getOrDefault(g, 0)))
            .toList();
    return new CompanyView.Gacha(
        c.tickets,
        c.employees.size(),
        engine.rosterMax(c),
        c.draws,
        engine.maxDraws(),
        engine.mergeCount(),
        rates,
        drawn,
        collection);
  }

  /** 사표를 들고 온 직원 (282번). 없으면 null. */
  private CompanyView.Resign resignView(CompanyState c) {
    CompanyState.Employee e = engine.pay.resigner(c);
    if (e == null) {
      return null;
    }
    return new CompanyView.Resign(
        e.id,
        e.name,
        c.resign.reason,
        engine.pay.resignLine(c),
        engine.pay.salary(c, e),
        engine.pay.keepSalary(c, e));
  }

  @Override
  @Transactional
  public CompanyView answerResign(UUID sessionId, boolean keep) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.pay.answerResign(row.state(), keep);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  private CompanyView.Invest investView(CompanyState c, HashSeededRandom random) {
    CompanyState.Invest invest = c.invest;
    if (invest == null) {
      return null;
    }
    InvestEngine meetings = engine.invest;
    // 한마디와 형광펜은 회의를 연 때 굳힌 것만 보인다 (249번).
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
        List.of(InvestEngine.BUY, InvestEngine.SELL, InvestEngine.HOLD, InvestEngine.TEAM).stream()
            .map(code -> new CompanyView.Option(code, texts.options().get(code)))
            .toList();
    CompanyView.InvestOutcome outcome =
        invest.choice == null
            ? null
            : new CompanyView.InvestOutcome(
                invest.choice,
                invest.big,
                invest.delegated,
                invest.teamBuy,
                invest.teamSell,
                invest.debate.stream()
                    .map(d -> new CompanyView.DebateLine(d.name, d.side, d.text, d.last, kindOf(d)))
                    .toList(),
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
                    .toList(),
                meetings.credit(c));
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
        finderView(invest),
        outcome,
        invest.proposalId == null || invest.choice != null
            ? null
            : new CompanyView.Proposal(
                invest.proposalId,
                invest.proposalName,
                invest.proposalAction,
                invest.proposalLine,
                invest.pendingChoice,
                invest.pendingBig,
                invest.pendingDelegated,
                invest.teamBuy,
                invest.teamSell,
                invest.pendingDelegated
                    ? invest.debate.stream()
                        .map(
                            d ->
                                new CompanyView.DebateLine(
                                    d.name, d.side, d.text, d.last, kindOf(d)))
                        .toList()
                    : List.of()),
        verdictView(c));
  }

  /** 옛 저장(295번 전)은 kind가 없다: last면 두 줄 가운데 앞이 WIN, 뒤가 LOSE였지만 구분할 수 없어 WIN으로 읽는다. */
  private static String kindOf(CompanyState.DebateLine d) {
    return d.kind != null ? d.kind : d.last ? InvestEngine.WIN : InvestEngine.TALK;
  }

  /** 막판 제안을 따른 뒤의 상과 벌 (283번). 따르지 않았으면 null. */
  private CompanyView.Verdict verdictView(CompanyState c) {
    CompanyState.Invest i = c.invest;
    if (i.followedId == null || i.choice == null) {
      return null;
    }
    boolean good = engine.invest.verdictGood(c);
    RaisingContent.Invest texts = engine.investTexts();
    List<CompanyView.Option> options =
        !i.verdictPending
            ? List.of()
            : (good ? InvestEngine.GOOD_VERDICTS : InvestEngine.BAD_VERDICTS)
                .stream()
                    .map(code -> new CompanyView.Option(code, texts.verdictOptions().get(code)))
                    .toList();
    String ask =
        investorgame.common.Korean.fill(
            texts.verdictAsk().get(good ? "GOOD" : "BAD"),
            Map.of("name", i.followedName, "pnl", CompanyEngine.money(Math.abs(i.total))));
    return new CompanyView.Verdict(i.followedId, i.followedName, good, ask, options, i.verdictLine);
  }

  private static CompanyView.Finder finderView(CompanyState.Invest invest) {
    if (invest.finderId == null) {
      return null;
    }
    return new CompanyView.Finder(
        invest.finderId, invest.finderName, invest.finderRole, invest.finderDesk, invest.pitch);
  }

  /** 거시경제 회의 (decisions.md 266번). 한마디와 형광펜은 회의를 연 때 굳힌 것만 보인다. */
  private CompanyView.Macro macroView(CompanyState c) {
    CompanyState.Macro macro = c.macro;
    if (macro == null) {
      return null;
    }
    MacroEngine meetings = engine.macro;
    List<CompanyView.MacroSentence> sentences = new java.util.ArrayList<>();
    for (int i = 0; i < macro.sentences.size(); i++) {
      CompanyState.Sentence s = macro.sentences.get(i);
      boolean highlighted =
          meetings.convened(c) && macro.highlightIndex != null && macro.highlightIndex == i;
      sentences.add(new CompanyView.MacroSentence(s.text, highlighted, s.omen));
    }
    List<CompanyView.Remark> remarks =
        meetings.convened(c)
            ? macro.remarks.stream()
                .map(
                    r -> new CompanyView.Remark(r.employeeId, r.name, r.desk, r.read, r.text, null))
                .toList()
            : List.of();
    List<CompanyView.Stance> stances =
        MacroEngine.STANCES.stream()
            .map(
                code ->
                    new CompanyView.Stance(
                        code,
                        meetings.stanceLabel(code),
                        meetings.stanceNote(code),
                        meetings.stakePercentOf(code)))
            .toList();
    CompanyView.MacroOutcome outcome = null;
    if (macro.stance != null) {
      CompanyView.Finder finder =
          c.invest != null && Boolean.TRUE.equals(c.invest.found) ? finderView(c.invest) : null;
      outcome =
          new CompanyView.MacroOutcome(
              macro.stance, finder, finder == null ? meetings.noneLine() : null);
    }
    RaisingContent.MacroTopic topic = meetings.topic(macro);
    return new CompanyView.Macro(
        topic.name(),
        topic.title(),
        sentences,
        meetings.convened(c) ? macro.highlightBy : null,
        remarks,
        stances,
        meetings.open(c),
        meetings.convened(c),
        outcome);
  }

  private CompanyView.Raise raiseView(CompanyState c) {
    CompanyState.Raise r = c.raise;
    if (r == null) {
      return null;
    }
    String name =
        c.employees.stream()
            .filter(e -> e.id == r.employeeId)
            .findFirst()
            .map(e -> e.name)
            .orElse("");
    return new CompanyView.Raise(
        r.employeeId, name, r.before, r.after, engine.pay.raiseLine(c), engine.pay.raiseOdds());
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
        p.rival != null ? p.rival : engine.poacher(),
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

  private List<CompanyView.Report> reportViews(List<CompanyState.Report> reports) {
    return reports.stream()
        .map(
            r -> {
              String deskName =
                  engine.desks().stream()
                      .filter(d -> d.code().equals(r.desk))
                      .findFirst()
                      .map(RaisingContent.Desk::name)
                      .orElse(r.desk);
              return new CompanyView.Report(
                  r.desk,
                  deskName,
                  r.leaderId,
                  r.leader,
                  engine.teams.head(deskName, r.leader),
                  r.pnl,
                  r.text);
            })
        .toList();
  }

  private CompanyView.Quarter quarterView(CompanyState.Quarter q) {
    return new CompanyView.Quarter(
        q.year,
        q.quarter,
        q.capitalBefore,
        q.capitalAfter,
        q.fee,
        q.staff,
        q.hiring,
        q.moving,
        q.salary,
        q.investTotal == null
            ? null
            : new CompanyView.SettlementInvest(q.investTitle, q.investTotal),
        q.macroTopic,
        q.macroStance,
        q.crash,
        List.copyOf(q.lines),
        reportViews(q.reports));
  }

  private CompanyView.Settlement settlementView(CompanyState.Settlement s) {
    return new CompanyView.Settlement(
        s.year,
        s.phase,
        s.omen,
        s.capitalBefore,
        s.capitalAfter,
        s.fee,
        s.hiring,
        s.moving,
        s.salary,
        s.investTotal == null
            ? null
            : new CompanyView.SettlementInvest(s.investTitle, s.investTotal),
        s.quarters.stream().map(this::quarterView).toList(),
        s.gradeBefore,
        s.gradeAfter,
        List.copyOf(s.achieved),
        s.results.stream()
            .map(
                r ->
                    new CompanyView.Result(
                        r.employeeId, r.name, r.desk, r.stake, r.pnl, Map.copyOf(r.flips)))
            .toList(),
        List.copyOf(s.lines),
        reportViews(s.reports),
        s.finished);
  }
}
