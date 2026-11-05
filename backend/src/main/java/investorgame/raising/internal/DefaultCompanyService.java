package investorgame.raising.internal;

import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.common.random.HashSeededRandom;
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
    return companies.latest(sessionId).map(this::view);
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
      CompanyRepository.Row row =
          new CompanyRepository.Row(UUID.randomUUID(), sessionId, "ACTIVE", seed, company);
      companies.insert(row);
      return view(row);
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
      if (company.employees.size() >= engine.seats(company.capital)) {
        if (replace == null || company.employees.stream().noneMatch(e -> e.id == replace)) {
          throw new InvalidRequestException("자리가 꽉 찼다. 바꿀 직원을 고른다");
        }
        company.employees.removeIf(e -> e.id == replace);
      }
      engine.hire(company, person.stats);
    }
    companies.update(row.id(), company, false);
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
  public CompanyView settle(UUID sessionId) {
    CompanyRepository.Row row = lockActive(sessionId);
    engine.settle(row.state(), new HashSeededRandom(row.seed()));
    boolean ended = row.state().year > engine.turns();
    companies.update(row.id(), row.state(), ended);
    return view(
        new CompanyRepository.Row(
            row.id(), row.sessionId(), ended ? "ENDED" : "ACTIVE", row.seed(), row.state()));
  }

  private CompanyRepository.Row lockActive(UUID sessionId) {
    return companies.lockActive(sessionId).orElseThrow(() -> new NotFoundException("회사가 없다"));
  }

  private CompanyView view(CompanyRepository.Row row) {
    CompanyState c = row.state();
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
                        CompanyEngine.overallGrade(e.stats),
                        CompanyEngine.grades(e.stats),
                        e.desk))
            .toList();
    List<CompanyView.Desk> desks =
        engine.desks().stream()
            .map(
                d ->
                    new CompanyView.Desk(
                        d.code(), d.name(), d.statCode(), d.trades(), d.description()))
            .toList();
    CompanyView.Meeting meeting =
        ended
            ? null
            : new CompanyView.Meeting(
                c.omen, engine.wantedLine(c), engine.recruitFund(c), !c.recruited, c.pendingRun);
    CompanyState.Settlement last = c.settlements.isEmpty() ? null : c.settlements.getLast();
    return new CompanyView(
        row.id(),
        ended ? CompanyView.Status.ENDED : CompanyView.Status.ACTIVE,
        c.year,
        engine.turns(),
        c.capital,
        grade,
        next,
        engine.seats(c.capital),
        employees,
        desks,
        meeting,
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
