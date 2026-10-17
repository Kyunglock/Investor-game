package investorgame.progress.internal;

import investorgame.asset.AccountView;
import investorgame.asset.AssetService;
import investorgame.asset.PriceChangeResult;
import investorgame.asset.TradeResult;
import investorgame.behavior.BehaviorService;
import investorgame.behavior.ChoiceContext;
import investorgame.behavior.Resolution;
import investorgame.character.CharacterService;
import investorgame.character.CharacterView;
import investorgame.character.GrowthSource;
import investorgame.character.StatChange;
import investorgame.character.TraitResult;
import investorgame.common.Action;
import investorgame.common.GameProperties;
import investorgame.common.Phase;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.common.random.HashSeededRandom;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.JobDefinition;
import investorgame.event.ChoiceTicket;
import investorgame.event.CompleteResult;
import investorgame.event.Completion;
import investorgame.event.EventService;
import investorgame.event.EventView;
import investorgame.event.HintProvider;
import investorgame.event.SchedulingContext;
import investorgame.progress.ChoiceOutcome;
import investorgame.progress.GameView;
import investorgame.progress.ProgressService;
import investorgame.result.GameResult;
import investorgame.result.ResultService;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 한 판의 조율. 다른 도메인끼리는 서로를 부르지 않으므로 필요한 값은 여기서 읽어 인자로 넘긴다 (domains.md 3절). 난수는 판 시드에서 키별로 유도한다. */
@Service
class DefaultProgressService implements ProgressService {

  private static final long PERCENT = 100;
  private static final int BP = 10_000;

  private final GameRepository games;
  private final ProgressProperties properties;
  private final GameProperties calendar;
  private final CharacterService characters;
  private final AssetService assets;
  private final EventService events;
  private final BehaviorService behavior;
  private final ResultService results;
  private final ContentCatalog content;
  private final SecureRandom seeds = new SecureRandom();

  DefaultProgressService(
      GameRepository games,
      ProgressProperties properties,
      GameProperties calendar,
      CharacterService characters,
      AssetService assets,
      EventService events,
      BehaviorService behavior,
      ResultService results,
      ContentCatalog content) {
    this.games = games;
    this.properties = properties;
    this.calendar = calendar;
    this.characters = characters;
    this.assets = assets;
    this.events = events;
    this.behavior = behavior;
    this.results = results;
    this.content = content;
  }

  @Override
  @Transactional
  public GameView start(UUID sessionId) {
    games.abandonActive(sessionId);
    GameRow game =
        new GameRow(
            UUID.randomUUID(),
            sessionId,
            "ACTIVE",
            Phase.SAVING,
            0,
            properties.startAge(),
            properties.endAge(),
            seeds.nextLong(),
            content.version(),
            null,
            games.now());
    games.insert(game);

    SeededRandom random = new HashSeededRandom(game.seed());
    characters.create(game.id(), random.forKey("character", "create"));
    assets.create(game.id(), random.forKey("asset", "create"));
    scheduleAt(game, 0, 0);
    return view(game);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<GameView> current(UUID sessionId) {
    return games.findLatest(sessionId).map(this::view);
  }

  @Override
  @Transactional
  public GameView advance(UUID sessionId, UUID gameId, int day) {
    GameRow game = lock(sessionId, gameId);
    int last = game.lastReportedDay();
    if (day < last) {
      throw new InvalidRequestException("게임 시각은 거꾸로 갈 수 없다");
    }
    if (day - last > properties.maxSkipDays()) {
      throw new InvalidRequestException("한 번에 건너뛸 수 있는 구간을 넘었다");
    }
    if (day > endDay(game)) {
      throw new InvalidRequestException("종료 나이를 넘는 시각이다");
    }
    Optional<EventView> pending = events.pending(gameId);
    if (pending.isPresent() && day > pending.get().occursDay()) {
      throw new InvalidRequestException("대기 중인 선택을 먼저 해야 한다");
    }

    // 보고된 시각이 다음 이벤트를 넘어도 판은 그 이벤트 시각에서 멈춘다. 월급도 거기까지만 넣는다.
    int stopDay = Math.min(day, nextEventDay(game, last).orElse(day));
    paySalaries(game, last, stopDay);
    GameRow advanced = withDay(game, stopDay);
    games.updateDay(gameId, stopDay);
    scheduleAt(advanced, last, stopDay);
    endIfFinished(advanced);
    return view(games.findLatest(sessionId).orElseThrow());
  }

  private OptionalInt nextEventDay(GameRow game, int fromDay) {
    return events.peekNextEventDay(
        game.id(),
        context(game, characters.get(game.id())),
        fromDay,
        new HashSeededRandom(game.seed()));
  }

  @Override
  @Transactional
  public ChoiceOutcome choose(UUID sessionId, UUID gameId, UUID eventId, String option) {
    GameRow game = lock(sessionId, gameId);
    ChoiceTicket ticket = events.prepareChoice(gameId, eventId, option);
    SeededRandom random = new HashSeededRandom(game.seed());

    ChoiceOutcome.Outcome outcome =
        switch (ticket.effect()) {
          case ChoiceTicket.News news -> resolveNews(game, ticket, random);
          case ChoiceTicket.Job job -> {
            characters.assignJob(gameId, job.jobCode(), ticket.occursDay());
            events.complete(gameId, eventId, new Completion(option, option, List.of()));
            JobDefinition definition = content.job(job.jobCode());
            yield simpleOutcome(
                ticket, "%s(으)로 일하기 시작했다. 월급은 매달 들어온다.".formatted(definition.title()));
          }
          case ChoiceTicket.Trait trait -> {
            characters.recordTraitChoice(gameId, trait.traitDeltas());
            CompleteResult result =
                events.complete(gameId, eventId, new Completion(option, option, List.of()));
            if (!result.traitsComplete()) {
              yield simpleOutcome(ticket, "선택이 마음 한쪽에 남았다.");
            }
            TraitResult traits =
                characters.finalizeTraits(gameId, random.forKey("character", "traits"));
            yield simpleOutcome(
                ticket,
                "당신은 %s다. 관심이 가는 분야는 %s."
                    .formatted(
                        content.styleName(traits.investmentStyle()),
                        content.sectorName(traits.interestSector())));
          }
          case ChoiceTicket.Offer offer -> {
            events.complete(gameId, eventId, new Completion(option, option, List.of()));
            if (offer.accepted()) {
              games.startInvesting(gameId, ticket.occursDay());
              yield simpleOutcome(ticket, "투자를 시작했다. 이제 뉴스가 들려온다.");
            }
            yield simpleOutcome(ticket, "1년 뒤에 다시 생각해 보기로 했다.");
          }
        };

    GameRow updated = lock(sessionId, gameId);
    scheduleAt(updated, updated.lastReportedDay(), updated.lastReportedDay());
    endIfFinished(updated);
    return new ChoiceOutcome(view(games.findLatest(sessionId).orElseThrow()), outcome);
  }

  // ---- 뉴스 선택: 판정 → 매매 → 주가 변동 → 성장 (domains.md 3절 처리 흐름 2) ----

  private ChoiceOutcome.Outcome resolveNews(
      GameRow game, ChoiceTicket ticket, SeededRandom random) {
    UUID gameId = game.id();
    CharacterView character = characters.get(gameId);
    AccountView account = assets.get(gameId);
    Action chosen = Action.valueOf(ticket.optionCode());
    boolean holding = account.holdings().getOrDefault(ticket.sectorCode(), 0L) > 0;

    Resolution resolution =
        behavior.resolve(
            new ChoiceContext(chosen, character.stats(), ticket.swaySentiment(), holding),
            random.forKey("behavior", "resolve", ticket.seq()));
    TradeResult trade =
        assets.trade(
            gameId, resolution.actual(), ticket.sectorCode(), ticket.occursDay(), ticket.eventId());
    int lossFactor =
        behavior.lossFactorPercent(
            character.stats().luck(), random.forKey("behavior", "luck", ticket.seq()));
    PriceChangeResult price =
        assets.applyPriceChange(
            gameId,
            ticket.sectorCode(),
            ticket.truth(),
            ticket.magnitudeBp(),
            lossFactor,
            ticket.occursDay(),
            ticket.eventId());
    List<StatChange> growth =
        characters.grow(
            gameId,
            resolution.deviations().stream()
                .map(
                    d ->
                        (GrowthSource)
                            new GrowthSource.DeviationGrowth(d.statCode(), ticket.eventId()))
                .toList(),
            ticket.occursDay());
    events.complete(
        gameId,
        ticket.eventId(),
        new Completion(chosen.name(), resolution.actual().name(), resolution.deviations()));

    return new ChoiceOutcome.Outcome(
        ticket.kind().name(),
        chosen.name(),
        resolution.actual().name(),
        resolution.deviations().stream()
            .map(d -> new ChoiceOutcome.DeviationView(d.statCode(), d.from().name(), d.to().name()))
            .toList(),
        new ChoiceOutcome.Trade(trade.status().name(), trade.amount()),
        new ChoiceOutcome.Price(
            ticket.sectorCode(),
            content.sectorName(ticket.sectorCode()),
            ticket.truth().name(),
            ticket.magnitudeBp(),
            price.pnl(),
            price.lossSoftened()),
        growth.stream()
            .filter(g -> g.valueAfter() != g.valueBefore())
            .map(g -> new ChoiceOutcome.Growth(g.statCode(), g.valueBefore(), g.valueAfter()))
            .toList(),
        null);
  }

  private static ChoiceOutcome.Outcome simpleOutcome(ChoiceTicket ticket, String message) {
    return new ChoiceOutcome.Outcome(
        ticket.kind().name(),
        ticket.optionCode(),
        ticket.optionCode(),
        List.of(),
        null,
        null,
        List.of(),
        message);
  }

  // ---- 시간 흐름 ----

  /** 직업 시작일부터 30일마다 월급을 넣는다. 연차가 오르면 연봉도 오른다 (decisions.md 4번). */
  private void paySalaries(GameRow game, int fromExclusive, int toInclusive) {
    CharacterView character = characters.get(game.id());
    if (character.jobCode() == null) {
      return;
    }
    JobDefinition job = content.job(character.jobCode());
    int start = character.jobStartDay();
    int month = calendar.daysPerMonth();
    int firstPayday = Math.max(1, (fromExclusive - start) / month + 1);
    for (int k = firstPayday; start + k * month <= toInclusive; k++) {
      int payday = start + k * month;
      assets.creditSalary(
          game.id(), monthlySalary(job, (payday - start) / calendar.daysPerYear()), payday);
    }
  }

  private static long monthlySalary(JobDefinition job, int tenureYears) {
    long salary = job.baseMonthlySalary();
    for (int year = 0; year < tenureYears; year++) {
      salary = salary * (PERCENT + job.raisePercentPerYear()) / PERCENT;
    }
    return salary;
  }

  private void scheduleAt(GameRow game, int fromDay, int toDay) {
    CharacterView character = characters.get(game.id());
    SeededRandom random = new HashSeededRandom(game.seed());
    HintProvider hints =
        (truth, seq) ->
            behavior.hint(
                character.stats().insight(), truth, random.forKey("behavior", "hint", seq));
    events.schedule(game.id(), context(game, character), fromDay, toDay, random, hints);
  }

  private void endIfFinished(GameRow game) {
    if (game.lastReportedDay() < endDay(game) || events.pending(game.id()).isPresent()) {
      return;
    }
    OffsetDateTime endedAt = games.now();
    games.end(game.id(), endedAt);
    results.save(
        new GameResult(
            game.id(),
            game.sessionId(),
            game.contentVersion(),
            assets.get(game.id()).initialCash(),
            assets.totalAsset(game.id()),
            game.endAge(),
            characters.get(game.id()).stats(),
            events.deviationCounts(game.id()),
            game.createdAt(),
            endedAt));
  }

  private SchedulingContext context(GameRow game, CharacterView character) {
    return new SchedulingContext(
        game.phase(),
        character.investmentStyle(),
        character.interestSector(),
        character.jobStartDay() == null ? null : character.jobStartDay() + calendar.daysPerMonth(),
        character.investmentStyle() != null,
        game.investingStartDay(),
        endDay(game));
  }

  // ---- 화면용 상태 ----

  private GameView view(GameRow game) {
    CharacterView character = characters.get(game.id());
    AccountView account = assets.get(game.id());
    boolean ended = game.ended();
    Optional<EventView> pending = ended ? Optional.empty() : events.pending(game.id());
    Integer nextEventDay =
        ended || pending.isPresent()
            ? null
            : nextEventDay(game, game.lastReportedDay()).stream().boxed().findFirst().orElse(null);

    return new GameView(
        game.id(),
        ended ? GameView.Status.ENDED : GameView.Status.ACTIVE,
        game.phase(),
        game.lastReportedDay(),
        game.startAge(),
        game.endAge(),
        calendar.daysPerYear(),
        character.stats(),
        character.initialStats(),
        account.cash(),
        assets.totalAsset(game.id()),
        account.initialCash(),
        account.holdings().entrySet().stream()
            .map(
                e -> new GameView.Holding(e.getKey(), content.sectorName(e.getKey()), e.getValue()))
            .toList(),
        job(character, game.lastReportedDay()),
        character.investmentStyle() == null
            ? null
            : new GameView.Named(
                character.investmentStyle(), content.styleName(character.investmentStyle())),
        character.interestSector() == null
            ? null
            : new GameView.Named(
                character.interestSector(), content.sectorName(character.interestSector())),
        pending.map(this::pendingView).orElse(null),
        nextEventDay,
        ended
            ? results.find(game.id()).map(DefaultProgressService::resultView).orElse(null)
            : null);
  }

  private GameView.Job job(CharacterView character, int day) {
    if (character.jobCode() == null) {
      return null;
    }
    JobDefinition job = content.job(character.jobCode());
    int tenure = Math.max(0, day - character.jobStartDay()) / calendar.daysPerYear();
    return new GameView.Job(job.code(), job.title(), monthlySalary(job, tenure));
  }

  private GameView.PendingEvent pendingView(EventView event) {
    return new GameView.PendingEvent(
        event.eventId(),
        event.kind().name(),
        event.occursDay(),
        event.sectorCode(),
        event.sectorCode() == null ? null : content.sectorName(event.sectorCode()),
        event.title(),
        event.body(),
        event.hintText(),
        event.swayText(),
        event.options().stream().map(o -> new GameView.Option(o.code(), o.label())).toList());
  }

  private static GameView.Result resultView(GameResult result) {
    long initial = result.initialAsset();
    int returnBp = initial == 0 ? 0 : (int) ((result.finalAsset() - initial) * BP / initial);
    return new GameView.Result(
        initial,
        result.finalAsset(),
        returnBp,
        result.finalAge(),
        Map.copyOf(result.deviationCounts()));
  }

  private GameRow lock(UUID sessionId, UUID gameId) {
    return games
        .lockActive(sessionId, gameId)
        .orElseThrow(() -> new NotFoundException("진행 중인 판이 없다"));
  }

  private int endDay(GameRow game) {
    return (game.endAge() - game.startAge()) * calendar.daysPerYear();
  }

  private static GameRow withDay(GameRow game, int day) {
    return new GameRow(
        game.id(),
        game.sessionId(),
        game.status(),
        game.phase(),
        day,
        game.startAge(),
        game.endAge(),
        game.seed(),
        game.contentVersion(),
        game.investingStartDay(),
        game.createdAt());
  }
}
