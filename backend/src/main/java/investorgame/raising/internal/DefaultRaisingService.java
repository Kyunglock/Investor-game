package investorgame.raising.internal;

import investorgame.common.StatCodes;
import investorgame.common.StatGrade;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.RaisingContent;
import investorgame.content.StockDefinition;
import investorgame.raising.CardOutcome;
import investorgame.raising.RaisingService;
import investorgame.raising.RunChoice;
import investorgame.raising.RunView;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class DefaultRaisingService implements RaisingService {

  private static final int BP = 10_000;

  private final RunRepository runs;
  private final RunEngine engine;
  private final ContentCatalog content;
  private final SecureRandom seeds = new SecureRandom();

  DefaultRaisingService(RunRepository runs, RunEngine engine, ContentCatalog content) {
    this.runs = runs;
    this.engine = engine;
    this.content = content;
  }

  @Override
  @Transactional
  public RunView start(UUID sessionId) {
    RaisingMemory memory = runs.lockMemory(sessionId);
    runs.abandonActive(sessionId);
    // 처음 온 사람의 첫 판만 짜인 판이다. 끝내지 않고 다시 시작해도 두 번째 판부터는 무작위다 (11.2절).
    boolean scripted = memory.runsStarted == 0;
    memory.runsStarted++;
    long seed = seeds.nextLong();
    RunState state = engine.create(new HashSeededRandom(seed), scripted, memory);
    RunRepository.Row row =
        new RunRepository.Row(UUID.randomUUID(), sessionId, "ACTIVE", seed, scripted, state);
    runs.insert(row, content.version());
    runs.saveMemory(sessionId, memory);
    return view(row, memory);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<RunView> current(UUID sessionId) {
    RaisingMemory memory = runs.memory(sessionId);
    return runs.latest(sessionId).map(row -> view(row, memory));
  }

  @Override
  @Transactional
  public RunChoice choose(UUID sessionId, UUID runId, int card, String option) {
    RaisingMemory memory = runs.lockMemory(sessionId);
    RunRepository.Row row =
        runs.lockActive(sessionId, runId).orElseThrow(() -> new NotFoundException("진행 중인 판이 없다"));
    RunState state = row.state();
    if (card != state.card) {
      throw new InvalidRequestException("이미 지나간 카드다");
    }
    CardOutcome outcome = engine.choose(state, memory, option, new HashSeededRandom(row.seed()));
    boolean ended = state.current == null;
    runs.update(runId, state, ended);
    runs.saveMemory(sessionId, memory);
    RunRepository.Row saved =
        new RunRepository.Row(
            row.id(),
            row.sessionId(),
            ended ? "ENDED" : "ACTIVE",
            row.seed(),
            row.scripted(),
            state);
    return new RunChoice(outcome, view(saved, memory));
  }

  private RunView view(RunRepository.Row row, RaisingMemory memory) {
    RunState run = row.state();
    Map<String, String> grades = new LinkedHashMap<>();
    for (String code : StatCodes.ALL) {
      grades.put(code, StatGrade.of(run.stats.get(code)).name());
    }
    String overall = overallGrade(run);
    List<RunView.Holding> holdings = new ArrayList<>();
    run.holdings.forEach(
        (code, holding) -> {
          StockDefinition stock = content.stock(code);
          long price = run.prices.get(code);
          long value = holding.quantity * price;
          long cost = holding.quantity * holding.avgCost;
          holdings.add(
              new RunView.Holding(
                  code,
                  stock.name(),
                  content.sectorName(stock.sector()),
                  holding.quantity,
                  holding.avgCost,
                  price,
                  value,
                  value - cost,
                  cost == 0 ? 0 : (int) ((value - cost) * BP / cost)));
        });
    List<RunView.Device> devices =
        run.devices.stream()
            .map(engine::device)
            .map(d -> new RunView.Device(d.code(), d.statCode(), d.name(), d.cost()))
            .toList();
    String style = RunEngine.topTrait(run, "style.");
    String sector = RunEngine.topTrait(run, "sector.");
    boolean ended = run.current == null;
    long total = run.totalAsset();
    return new RunView(
        row.id(),
        ended ? RunView.Status.ENDED : RunView.Status.ACTIVE,
        run.card,
        engine.cardCount(),
        row.scripted(),
        run.fund,
        run.cash,
        run.debt,
        total,
        holdings,
        grades,
        overall,
        style == null ? null : new RunView.Named(style, content.styleName(style)),
        sector == null ? null : new RunView.Named(sector, content.sectorName(sector)),
        devices,
        List.copyOf(memory.unlocked),
        ended ? null : cardView(run),
        ended
            ? new RunView.Result(
                overall,
                run.fund,
                total,
                (int) ((total - run.fund) * BP / run.fund),
                run.totalFlips,
                List.copyOf(run.highlights))
            : null);
  }

  /** 종합 등급: 다섯 능력치(운 포함)의 평균 (증권사 육성 설계 2.3절). */
  private static String overallGrade(RunState run) {
    int sum = run.stats.values().stream().mapToInt(Integer::intValue).sum();
    return StatGrade.of(Math.round(sum / (float) run.stats.size())).name();
  }

  private RunView.CardView cardView(RunState run) {
    RunState.Card card = run.current;
    RunView.Stock stock = null;
    if (card.stockCode != null) {
      StockDefinition definition = content.stock(card.stockCode);
      stock =
          new RunView.Stock(
              definition.code(),
              definition.name(),
              content.sectorName(definition.sector()),
              run.prices.get(definition.code()),
              engine.changeBp(run, definition.code()),
              run.held(definition.code()));
    }
    List<RunView.Sentence> sentences = new ArrayList<>();
    for (int i = 0; i < card.sentences.size(); i++) {
      sentences.add(new RunView.Sentence(card.sentences.get(i).text, i == card.highlight));
    }
    RunView.Sway sway = null;
    if (card.tempter != null) {
      RaisingContent.Tempter tempter =
          content.raising().tempters().stream()
              .filter(t -> t.code().equals(card.tempter))
              .findFirst()
              .orElseThrow();
      sway = new RunView.Sway(tempter.name(), card.sway);
    }
    return new RunView.CardView(
        card.kind,
        card.title,
        card.body,
        stock,
        sentences,
        card.memo,
        sway,
        card.omen,
        card.options.stream().map(o -> new RunView.Option(o.code, o.label, o.detail)).toList(),
        List.copyOf(card.tips));
  }
}
