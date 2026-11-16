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
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class DefaultCompanyService implements CompanyService {

  private final CompanyRepository companies;
  private final MemoryRepository memories;
  private final CompanyEngine engine;
  private final IdleEngine idle;
  private final RewardsEngine rewards;
  private final SecureRandom seeds = new SecureRandom();

  DefaultCompanyService(
      CompanyRepository companies,
      MemoryRepository memories,
      CompanyEngine engine,
      IdleEngine idle,
      RewardsEngine rewards) {
    this.companies = companies;
    this.memories = memories;
    this.engine = engine;
    this.idle = idle;
    this.rewards = rewards;
  }

  @Override
  @Transactional
  public Optional<CompanyView> current(UUID sessionId) {
    return companies.latest(sessionId).map(row -> view(adopt(resume(row))));
  }

  /**
   * 옛 회사를 지금 규칙으로 옮겨 저장한다: 채용 뽑기 전에 차린 회사면 처음 채용권을 주고 도감을 채우고(decisions.md 312번), 무기 뽑기 전에 차린 회사면
   * 처음 무기 뽑기권을 주고(328·366번), 분기·결산이 있던 때의 회사면 실시간 구조로 옮긴다(523번).
   */
  private CompanyRepository.Row adopt(CompanyRepository.Row row) {
    CompanyState c = row.state();
    // 인력 관리가 있던 때의 저장 (524번): 쉬는 직원이 있으면 자리에 앉힌다.
    boolean resting = c.employees.stream().anyMatch(e -> e.desk == null);
    if (c.gachaReady
        && c.realtime
        && c.diamondsReady
        && c.weapon != null
        && c.weaponGachaReady
        && !resting
        && !engine.mental.needsWeaponReset(c)) {
      return row;
    }
    CompanyRepository.Row locked = companies.lockActive(row.sessionId()).orElse(row);
    boolean gacha = engine.adoptGacha(locked.state());
    boolean mental = engine.mental.adopt(locked.state());
    boolean moved = engine.adoptRealtime(locked.state());
    boolean seated = engine.seatAll(locked.state());
    // 무기·채용 뽑기의 옛 칸을 먼저 옮긴 뒤에 남은 뽑기권을 다이아로 바꾼다 (526번).
    boolean diamonds = engine.adoptDiamonds(locked.state());
    if (gacha || mental || moved || seated || diamonds) {
      companies.update(locked.id(), locked.state(), false);
    }
    return locked;
  }

  /** 끝난 회사를 되살린다 (523번): 파산·엔딩·시대의 끝으로 멈췄던 회사도 이어서 한다. 회사는 세션마다 하나고 더는 끝나지 않는다. */
  private CompanyRepository.Row resume(CompanyRepository.Row row) {
    if (!"ENDED".equals(row.status())) {
      return row;
    }
    CompanyRepository.Row locked =
        companies.lockLatest(row.sessionId()).orElseThrow(() -> new NotFoundException("회사가 없다"));
    if (!"ENDED".equals(locked.status())) {
      return locked;
    }
    engine.revive(locked.state());
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
    // 회사는 세션마다 하나고 끝나지 않는다 (523번): 파산해 닫고 다음 회사를 차리는 길은 없앴다.
    if (latest.isPresent()) {
      throw new InvalidRequestException("이미 회사가 있다");
    }
    CompanyState company = engine.open(new HashSeededRandom(seed), engine.openingCapital());
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
  public CompanyView convene(UUID sessionId) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.openMeeting(row.state(), new HashSeededRandom(row.seed()), idle.now());
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
  public CompanyView investBattle(UUID sessionId, String mode, int stars) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.invest.battle(row.state(), mode, stars);
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
  /** 다이아와 뽑기 값 (526번). */
  private CompanyView.Diamonds diamondsView(CompanyState c) {
    CompanyProperties.Diamonds rule = engine.diamonds();
    return new CompanyView.Diamonds(
        c.diamonds, rule.draw(), rule.tenDraw(), rule.tenCount(), rule.hire());
  }

  private CompanyView.Upgrade upgradeView(CompanyState c) {
    String to = engine.nextGrade(c);
    Long needed = engine.upgradeNeeded(c);
    if (to == null || needed == null) {
      return null;
    }
    return new CompanyView.Upgrade(to, engine.upgradeCost(c), needed, engine.canUpgrade(c));
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
                  (long) c.capital,
                  engine.grade((long) c.capital),
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
    // 분기·결산이 있던 때의 회사면 실시간 구조로 옮기고, 종목회의의 기회를 지금까지 센다 (523번). 요청 끝에 함께 저장된다.
    engine.adoptRealtime(row.state());
    engine.adoptDiamonds(row.state());
    engine.seatAll(row.state());
    engine.accrueMeetings(row.state(), idle.now());
    refill(row.state());
    return row;
  }

  // 테스트판의 지갑 (499번): 요청마다 다시 채우므로 한 번에 쓸 만큼이면 되고, 곱셈에도 넘치지 않는 크기.
  private static final long SANDBOX_CAPITAL = 1_000_000_000_000_000L;
  private static final long SANDBOX_DIAMONDS = 100_000_000L;

  /** 테스트판 회사면 자본·다이아를 다시 채운다. 요청 끝에 함께 저장된다. */
  private static void refill(CompanyState c) {
    if (!c.sandbox || c.sandboxFinite) return;
    // 그 벽의 물가(505번)만큼 채운다: 깊은 벽에서 버는 돈의 크기와 맞춘다.
    c.capital = Math.max(c.capital, SANDBOX_CAPITAL * CompanyEngine.inflation(c));
    c.diamonds = Math.max(c.diamonds, SANDBOX_DIAMONDS);
  }

  @Override
  @Transactional
  public CompanyView sandbox(UUID sessionId) {
    if (companies.lockActive(sessionId).isEmpty()) open(sessionId);
    CompanyRepository.Row row = lockActive(sessionId);
    row.state().sandbox = true;
    refill(row.state());
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  private CompanyRepository.Row lockSandbox(UUID sessionId) {
    CompanyRepository.Row row = lockActive(sessionId);
    if (!row.state().sandbox) throw new InvalidRequestException("테스트판 회사가 아니다");
    return row;
  }

  @Override
  @Transactional
  public CompanyView sandboxWall(UUID sessionId, long wall) {
    CompanyRepository.Row row = lockSandbox(sessionId);
    engine.mental.initWeapons(row.state());
    idle.jump(row.state(), wall);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView sandboxReset(UUID sessionId) {
    CompanyRepository.Row old = lockSandbox(sessionId);
    old.state().closed = true;
    companies.update(old.id(), old.state(), true);
    long seed = seeds.nextLong();
    CompanyState fresh = engine.open(new HashSeededRandom(seed), engine.openingCapital());
    fresh.sandbox = true;
    fresh.sandboxFinite = old.state().sandboxFinite;
    companies.insert(
        new CompanyRepository.Row(UUID.randomUUID(), sessionId, "ACTIVE", seed, fresh));
    return sandbox(sessionId);
  }

  @Override
  @Transactional
  public CompanyView sandboxWallet(UUID sessionId, boolean infinite) {
    CompanyRepository.Row row = lockSandbox(sessionId);
    CompanyState c = row.state();
    c.sandboxFinite = !infinite;
    if (infinite) {
      refill(c);
    } else {
      c.capital = Math.floor(engine.openingCapital() * CompanyEngine.inflation(c));
      c.diamonds = 0;
    }
    companies.update(row.id(), c, false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView sandboxCats(UUID sessionId, int level) {
    CompanyRepository.Row row = lockSandbox(sessionId);
    idle.grantCats(row.state(), level);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView sandboxWeapon(UUID sessionId, String grade) {
    CompanyRepository.Row row = lockSandbox(sessionId);
    // 사장냥과 출전한 고양이 넷이 하나씩 들고도 하나가 남는다.
    engine.mental.grant(row.state(), grade, 6);
    idle.releaseWeapons(row.state());
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  private CompanyView view(CompanyRepository.Row row) {
    CompanyState c = row.state();
    RaisingContent.Era era = engine.era(c);
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
                        engine.effectsOf(e),
                        engine.perkLine(e.stats, e.rank),
                        e.sector,
                        e.sector == null ? null : engine.sectorName(e.sector),
                        engine.scout.roleOf(e),
                        engine.quirks.code(e),
                        engine.quirks.name(e),
                        CompanyView.money(idle.incomeOf(c, e))))
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
    CompanyView.Meeting meeting = new CompanyView.Meeting(hrCap, engine.hotLine(c));
    long now = idle.now();
    engine.accrueMeetings(c, now);
    return new CompanyView(
        row.id(),
        c.number,
        new CompanyView.Era(era.code(), era.name(), era.description()),
        c.opening,
        CompanyView.money(c.capital),
        diamondsView(c),
        grade,
        next,
        upgradeView(c),
        engine.seats(c),
        employees,
        desks,
        meeting,
        gachaView(c),
        historyView(c),
        investView(c, new HashSeededRandom(row.seed())),
        new CompanyView.Meetings(
            c.meetingChances, engine.meetingMax(), engine.meetingWaitSeconds(c, now)),
        rewards.view(c),
        rewards.passView(c),
        rewards.shopView(c),
        lockedDesks,
        engine.mental.weaponViews(c),
        engine.mental.armoryView(c),
        engine.mental.upgradeViews(c),
        engine.mental.stagesView(c, idle.today()),
        engine.mental.assaultsView(c),
        idle.view(c),
        c.sandbox,
        c.sandbox && !c.sandboxFinite);
  }

  @Override
  @Transactional
  public CompanyView equipWeapon(UUID sessionId, String kind, String grade) {
    CompanyRepository.Row row = lockActive(sessionId);
    idle.requireFreeForBoss(row.state(), kind, grade);
    engine.mental.equip(row.state(), kind, grade);
    idle.releaseWeapons(row.state());
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView reportStage(UUID sessionId, int stage, boolean cleared, int stars) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.mental.reportStage(row.state(), stage, cleared, stars);
    if (cleared) {
      rewards.stageCleared(row.state());
    }
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView idleBeat(
      UUID sessionId, String runId, long sequence, String action, List<IdleHit> hits) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.mental.initWeapons(row.state());
    idle.beat(row.state(), runId, sequence, action, hits);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView reportAssault(UUID sessionId, int stage, boolean cleared, int stars) {
    CompanyRepository.Row row = lockActive(sessionId);
    throw new InvalidRequestException("매도벽 돌파는 자동 전투로 변경되었습니다");
  }

  @Override
  @Transactional
  public CompanyView attend(UUID sessionId) {
    CompanyRepository.Row row = lockActive(sessionId);
    rewards.attend(row.state());
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView buyShop(UUID sessionId, String code) {
    CompanyRepository.Row row = lockActive(sessionId);
    rewards.buy(row.state(), code);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView claimPass(UUID sessionId, Integer step) {
    CompanyRepository.Row row = lockActive(sessionId);
    rewards.claimPass(row.state(), step, new HashSeededRandom(row.seed()));
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView sandboxPassExp(UUID sessionId, long exp) {
    CompanyRepository.Row row = lockSandbox(sessionId);
    rewards.addPassExp(row.state(), exp);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView sandboxNextSeason(UUID sessionId) {
    CompanyRepository.Row row = lockSandbox(sessionId);
    rewards.nextSeason(row.state());
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView sandboxNextDay(UUID sessionId) {
    CompanyRepository.Row row = lockSandbox(sessionId);
    rewards.nextDay(row.state());
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView reportEx(UUID sessionId, int kills) {
    CompanyRepository.Row row = lockActive(sessionId);
    boolean first = !idle.today().equals(row.state().exDay);
    engine.mental.reportEx(row.state(), kills, idle.today());
    if (first) {
      rewards.exDone(row.state());
    }
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView buyBattleUpgrade(UUID sessionId, String kind, int levels) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.mental.buyUpgrade(row.state(), kind, levels);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView drawWeapon(UUID sessionId, int count) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.mental.drawWeapons(row.state(), new HashSeededRandom(row.seed()), count);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView mergeWeapon(UUID sessionId, String kind, String grade) {
    CompanyRepository.Row row = lockActive(sessionId);
    idle.requireFreeForMerge(row.state(), kind, grade, engine.mental.mergeCount());
    engine.mental.mergeWeapon(row.state(), kind, grade);
    idle.releaseWeapons(row.state());
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView drawCat(UUID sessionId, int count) {
    CompanyRepository.Row row = lockActive(sessionId);
    idle.drawCats(row.state(), new HashSeededRandom(row.seed()), count);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView useActive(UUID sessionId, String code) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.mental.initWeapons(row.state());
    idle.useActive(row.state(), code);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView retreatIdle(UUID sessionId) {
    CompanyRepository.Row row = lockActive(sessionId);
    idle.retreat(row.state());
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView fieldCat(UUID sessionId, String code, boolean fielded, String replaceCode) {
    CompanyRepository.Row row = lockActive(sessionId);
    idle.fieldCat(row.state(), code, fielded, replaceCode);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  @Override
  @Transactional
  public CompanyView equipCat(UUID sessionId, String code, String kind, String grade) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.mental.initWeapons(row.state());
    idle.equipCat(row.state(), code, kind, grade);
    companies.update(row.id(), row.state(), false);
    return view(row);
  }

  /** 채용 뽑기 (decisions.md 312번): 채용권, 데리고 있는 사람, 확률표, 마지막 뽑기, 도감. */
  private CompanyView.Gacha gachaView(CompanyState c) {
    List<CompanyView.Rate> rates =
        engine.rates().stream()
            .map(r -> new CompanyView.Rate(engine.rateGrade(c, r), r.percent(), r.star()))
            .toList();
    List<CompanyView.Drawn> drawn =
        c.lastDraw.stream()
            .map(
                d ->
                    new CompanyView.Drawn(
                        d.employeeId,
                        d.name,
                        d.grade,
                        d.star,
                        d.fresh,
                        d.hello,
                        engine.drawnPerk(d.grade)))
            .toList();
    List<CompanyView.CollectionEntry> collection =
        CompanyEngine.LADDER.stream()
            .map(g -> new CompanyView.CollectionEntry(g, c.collection.getOrDefault(g, 0)))
            .toList();
    return new CompanyView.Gacha(
        c.employees.size(), engine.seats(c), c.draws, engine.maxDraws(), rates, drawn, collection);
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
    // "너희가 알아서 해"는 뺐다 (352번).
    List<CompanyView.Option> options =
        List.of(InvestEngine.BUY, InvestEngine.SELL).stream()
            .map(code -> new CompanyView.Option(code, texts.options().get(code)))
            .toList();
    // 토론이 먼저 (352번): 회의를 열면 토론과 직원들이 기운 쪽이 결정 전에 보인다.
    boolean debated = meetings.convened(c) && invest.teamCall != null;
    List<CompanyView.DebateLine> debate =
        debated
            ? invest.debate.stream()
                .map(d -> new CompanyView.DebateLine(d.name, d.side, d.text, d.last, kindOf(d)))
                .toList()
            : List.of();
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
                invest.reactions.stream()
                    .map(d -> new CompanyView.DebateLine(d.name, d.side, d.text, d.last, kindOf(d)))
                    .toList(),
                meetings.credit(c),
                meetings.returnBp(invest),
                meetings.gainBp(invest),
                // 틀린 쪽은 손실 없이 0이다 (#697).
                0,
                investBattle(c, invest));
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
        debated ? invest.teamBuy : null,
        debated ? invest.teamSell : null,
        debated ? invest.teamCall : null,
        debate,
        engine.teamGrade.of(c),
        invest.scouted || Boolean.TRUE.equals(invest.found),
        new CompanyView.InvestRange(0, meetings.gainMaxBp()));
  }

  /** 옛 저장(295번 전)은 kind가 없다: last면 두 줄 가운데 앞이 WIN, 뒤가 LOSE였지만 구분할 수 없어 WIN으로 읽는다. */
  private static String kindOf(CompanyState.DebateLine d) {
    return d.kind != null ? d.kind : d.last ? InvestEngine.WIN : InvestEngine.TALK;
  }

  private static CompanyView.Finder finderView(CompanyState.Invest invest) {
    if (invest.finderId == null) {
      return null;
    }
    return new CompanyView.Finder(
        invest.finderId, invest.finderName, invest.finderRole, invest.finderDesk, invest.pitch);
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
                        a.code(),
                        a.name(),
                        a.description(),
                        c.achievements.get(a.code()),
                        a.isFail()))
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

  /** 종목 회의 뒤 전투의 화면 값 (414번). 지켜봤거나 아직 안 정했으면 null. */
  private CompanyView.InvestBattle investBattle(CompanyState c, CompanyState.Invest invest) {
    String mode = InvestEngine.battleMode(invest);
    if (mode == null) {
      return null;
    }
    Long after =
        invest.battleBonus == null ? null : CompanyEngine.plus(invest.total, invest.battleBonus);
    int best = engine.mental.bestStage(c);
    java.util.Map<String, Integer> parts = engine.invest.battleLevelParts(c, invest, best);
    return new CompanyView.InvestBattle(
        mode,
        engine.invest.battleLevel(c, invest, best),
        parts.entrySet().stream()
            .filter(e -> e.getValue() > 0)
            .map(e -> new CompanyView.LevelPart(e.getKey(), e.getValue()))
            .toList(),
        InvestEngine.battleOpen(invest),
        invest.battleStars,
        invest.battleBonus,
        invest.total,
        after);
  }
}
