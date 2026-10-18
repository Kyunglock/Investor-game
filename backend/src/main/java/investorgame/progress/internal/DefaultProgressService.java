package investorgame.progress.internal;

import investorgame.asset.AccountView;
import investorgame.asset.AssetService;
import investorgame.asset.TradeResult;
import investorgame.behavior.BehaviorService;
import investorgame.behavior.ChoiceContext;
import investorgame.behavior.Resolution;
import investorgame.character.CharacterService;
import investorgame.character.CharacterView;
import investorgame.character.GrowthSource;
import investorgame.character.StatChange;
import investorgame.character.TraitAxes;
import investorgame.character.TraitResult;
import investorgame.common.Action;
import investorgame.common.Direction;
import investorgame.common.GameProperties;
import investorgame.common.Phase;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.common.random.HashSeededRandom;
import investorgame.common.random.SeededRandom;
import investorgame.content.CareerDefinition;
import investorgame.content.ContentCatalog;
import investorgame.content.InvestorType;
import investorgame.content.JobDefinition;
import investorgame.content.StockDefinition;
import investorgame.event.ChoiceTicket;
import investorgame.event.CompleteResult;
import investorgame.event.Completion;
import investorgame.event.EventService;
import investorgame.event.EventView;
import investorgame.event.HintProvider;
import investorgame.event.Notice;
import investorgame.event.ScheduleResult;
import investorgame.event.SchedulingContext;
import investorgame.household.HouseholdService;
import investorgame.household.HouseholdView;
import investorgame.market.MarketService;
import investorgame.market.Quote;
import investorgame.market.ShockResult;
import investorgame.progress.ChoiceOutcome;
import investorgame.progress.GameView;
import investorgame.progress.ProgressService;
import investorgame.progress.StockHistory;
import investorgame.result.GameResult;
import investorgame.result.ResultService;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 한 판의 조율. 다른 도메인끼리는 서로를 부르지 않으므로 필요한 값은 여기서 읽어 인자로 넘긴다 (domains.md 3절). 매월 1일마다 시장 → 수입 → 지출 → 이자
 * 순서로 처리한다 (경제 개편 설계 9절). 난수는 판 시드에서 키별로 유도한다.
 */
@Service
class DefaultProgressService implements ProgressService {

  private static final long PERCENT = 100;
  private static final int BP = 10_000;
  private static final String DEVIATION = "DEVIATION";
  private static final String TRAIT = "TRAIT";
  private static final String SALARY = "SALARY";
  private static final String SPOUSE_INCOME = "SPOUSE_INCOME";
  private static final String SEVERANCE = "SEVERANCE";
  private static final String WINDFALL = "WINDFALL";
  private static final String EXPENSE = "EXPENSE";
  private static final String LIFE_COST = "LIFE_COST";
  private static final String TRADE_LOG = "TRADE";
  private static final String CAREER_LOG = "CAREER";

  private final GameRepository games;
  private final LogRepository logs;
  private final ProgressProperties properties;
  private final GameProperties calendar;
  private final CharacterService characters;
  private final AssetService assets;
  private final MarketService market;
  private final HouseholdService household;
  private final EventService events;
  private final BehaviorService behavior;
  private final ResultService results;
  private final ContentCatalog content;
  private final SecureRandom seeds = new SecureRandom();

  DefaultProgressService(
      GameRepository games,
      LogRepository logs,
      ProgressProperties properties,
      GameProperties calendar,
      CharacterService characters,
      AssetService assets,
      MarketService market,
      HouseholdService household,
      EventService events,
      BehaviorService behavior,
      ResultService results,
      ContentCatalog content) {
    this.games = games;
    this.logs = logs;
    this.properties = properties;
    this.calendar = calendar;
    this.characters = characters;
    this.assets = assets;
    this.market = market;
    this.household = household;
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
            Phase.CHILDHOOD,
            0,
            properties.startAge(),
            properties.endAge(),
            seeds.nextLong(),
            content.version(),
            null,
            games.now());
    games.insert(game);

    SeededRandom random = new HashSeededRandom(game.seed());
    CharacterView character = characters.create(game.id(), random.forKey("character", "create"));
    AccountView account = assets.create(game.id(), random.forKey("asset", "create"));
    market.create(game.id());
    household.create(game.id());
    logs.append(
        game.id(),
        0,
        "BIRTH",
        Map.of("stats", character.initialStats().toCodes(), "initialAsset", account.initialCash()));
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

    // 보고된 시각이 다음 이벤트를 넘어도 판은 그 이벤트 시각에서 멈춘다. 달 처리도 거기까지만 한다.
    int stopDay = Math.min(day, nextEventDay(game, last).orElse(day));
    processMonths(game, last, stopDay);
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
  public ChoiceOutcome choose(
      UUID sessionId, UUID gameId, UUID eventId, String option, Long quantity) {
    GameRow game = lock(sessionId, gameId);
    EventView pendingView =
        events
            .pending(gameId)
            .filter(e -> e.eventId().equals(eventId))
            .orElseThrow(() -> new InvalidRequestException("대기 중인 이벤트가 아니다"));
    ChoiceTicket ticket = events.prepareChoice(gameId, eventId, option);
    SeededRandom random = new HashSeededRandom(game.seed());
    String optionLabel =
        pendingView.options().stream()
            .filter(o -> o.code().equals(option))
            .map(EventView.Option::label)
            .findFirst()
            .orElse(option);

    ChoiceOutcome.Outcome outcome =
        switch (ticket.effect()) {
          case ChoiceTicket.News news ->
              resolveNews(game, ticket, pendingView.title(), quantity, random);
          case ChoiceTicket.Job job -> {
            events.complete(gameId, eventId, new Completion(option, option, List.of()));
            if (job.isWait()) {
              // 더 나은 자리를 기다린다. 다음 직업 선택은 event.job.wait-days 뒤에 온다 (decisions.md 26번).
              logs.append(gameId, ticket.occursDay(), "JOB_WAIT", Map.of());
              yield simpleOutcome(ticket, "이번 제안은 넘기고 더 나은 자리를 기다리기로 했다.");
            }
            CharacterView before = characters.get(gameId);
            boolean rehire = before.careerStartDay() != null;
            characters.assignJob(gameId, job.jobCode(), ticket.occursDay());
            if (game.phase() == Phase.CHILDHOOD) {
              games.changePhase(gameId, Phase.SAVING);
            }
            JobDefinition definition = content.job(job.jobCode());
            logs.append(
                gameId,
                ticket.occursDay(),
                "JOB",
                Map.of(
                    "jobCode", definition.code(),
                    "jobTitle", definition.title(),
                    "monthlySalary", definition.baseMonthlySalary(),
                    "rehire", rehire));
            yield simpleOutcome(
                ticket,
                rehire
                    ? "%s(으)로 다시 일하기 시작했다. 월급이 다시 들어온다.".formatted(definition.title())
                    : "%s(으)로 일하기 시작했다. 월급은 매달 들어온다.".formatted(definition.title()));
          }
          case ChoiceTicket.Career career ->
              resolveCareer(game, ticket, career, pendingView.title(), random);
          case ChoiceTicket.Trait trait -> {
            // 성장기의 선택은 판정으로 뒤집지 않지만 능력치를 조금 움직인다 (경제 개편 설계 4.3절).
            List<StatChange> moved =
                characters.recordTraitChoice(
                    gameId, trait.traitDeltas(), trait.statDeltas(), ticket.occursDay());
            CompleteResult result =
                events.complete(gameId, eventId, new Completion(option, option, List.of()));
            logs.append(
                gameId,
                ticket.occursDay(),
                "TRAIT",
                Map.of(
                    "eventTitle", pendingView.title(),
                    "optionCode", option,
                    "optionLabel", optionLabel));
            List<ChoiceOutcome.Growth> growth = logGrowth(gameId, ticket.occursDay(), moved, TRAIT);
            if (!result.traitsComplete()) {
              yield simpleOutcome(ticket, trait.note(), growth);
            }
            TraitResult traits =
                characters.finalizeTraits(
                    gameId,
                    new TraitAxes(codes(content.risks()), codes(content.minds())),
                    random.forKey("character", "traits"));
            InvestorType type = content.investorType(traits.investorTypeCode());
            Map<String, Object> stylePayload = new HashMap<>();
            stylePayload.put("styleCode", traits.investmentStyle());
            stylePayload.put("styleName", content.styleName(traits.investmentStyle()));
            stylePayload.put("riskCode", traits.riskProfile());
            stylePayload.put("mindCode", traits.mindProfile());
            stylePayload.put("investorTypeCode", type.code());
            stylePayload.put("investorTypeName", type.name());
            logs.append(gameId, ticket.occursDay(), "STYLE", stylePayload);
            yield simpleOutcome(
                ticket,
                "%s\n\n자라 온 날들을 돌아보니 당신은 '%s'형 투자자다. %s 관심이 가는 분야는 %s."
                    .formatted(
                        trait.note(),
                        type.name(),
                        type.description(),
                        content.sectorName(traits.interestSector())),
                growth);
          }
          case ChoiceTicket.Offer offer -> {
            events.complete(gameId, eventId, new Completion(option, option, List.of()));
            logs.append(
                gameId,
                ticket.occursDay(),
                "OFFER",
                Map.of(
                    "eventTitle",
                    pendingView.title(),
                    "optionCode",
                    option,
                    "optionLabel",
                    optionLabel,
                    "accepted",
                    offer.accepted()));
            if (offer.accepted()) {
              games.startInvesting(gameId, ticket.occursDay());
              yield simpleOutcome(ticket, "투자를 시작했다. 이제 뉴스가 들려온다.");
            }
            yield simpleOutcome(ticket, "1년 뒤에 다시 생각해 보기로 했다.");
          }
          case ChoiceTicket.Life life -> resolveLife(game, ticket, life);
        };

    GameRow updated = lock(sessionId, gameId);
    scheduleAt(updated, updated.lastReportedDay(), updated.lastReportedDay());
    endIfFinished(updated);
    return new ChoiceOutcome(view(games.findLatest(sessionId).orElseThrow()), outcome);
  }

  // ---- 직장 장면: 능력치로 판정 → 월급·직장·돈·능력치 반영 (decisions.md 26번) ----

  private ChoiceOutcome.Outcome resolveCareer(
      GameRow game,
      ChoiceTicket ticket,
      ChoiceTicket.Career career,
      String eventTitle,
      SeededRandom random) {
    UUID gameId = game.id();
    int day = ticket.occursDay();
    CareerDefinition.Option option = career.option();
    CharacterView character = characters.get(gameId);
    boolean success = true;
    if (option.rolls()) {
      int stat = character.stats().toCodes().get(option.stat());
      int chanceBp = option.baseBp() + stat * option.perPointBp();
      success = random.forKey("career", ticket.seq()).nextInt(BP) < chanceBp;
    }
    CareerDefinition.Effect effect = success ? option.success() : option.fail();
    events.complete(
        gameId,
        ticket.eventId(),
        new Completion(ticket.optionCode(), ticket.optionCode(), List.of()));

    JobDefinition job = content.job(character.jobCode());
    long salaryBefore = monthlySalary(job, tenureYears(character, day), character.salaryBonusBp());
    StringBuilder message = new StringBuilder(effect.text());
    if (effect.quit()) {
      long severance = salaryBefore * effect.severanceMonths();
      if (severance > 0) {
        assets.credit(gameId, SEVERANCE, severance, day);
        message.append(" 위로금 %,d원을 받았다.".formatted(severance));
      }
      characters.quitJob(gameId);
      message.append(" 월급이 끊기고 생활비는 계속 나간다.");
    } else if (effect.moveJob() && career.targetJobCode() != null) {
      characters.changeJob(
          gameId, career.targetJobCode(), day, (int) (effect.moveSalaryPercent() * PERCENT));
      JobDefinition target = content.job(career.targetJobCode());
      long salaryAfter = monthlySalary(target, 0, (int) (effect.moveSalaryPercent() * PERCENT));
      message.append(" 월급 %,d원 → %,d원.".formatted(salaryBefore, salaryAfter));
    } else if (effect.salaryPercent() != 0) {
      characters.addSalaryBonus(gameId, (int) (effect.salaryPercent() * PERCENT));
      CharacterView after = characters.get(gameId);
      long salaryAfter = monthlySalary(job, tenureYears(after, day), after.salaryBonusBp());
      message.append(" 월급 %,d원 → %,d원.".formatted(salaryBefore, salaryAfter));
    }
    if (effect.amount() > 0) {
      assets.credit(gameId, WINDFALL, effect.amount(), day);
    } else if (effect.amount() < 0) {
      assets.spend(gameId, LIFE_COST, -effect.amount(), day, ticket.eventId());
    }
    List<ChoiceOutcome.Growth> growth = List.of();
    if (!effect.statDeltas().isEmpty()) {
      growth =
          logGrowth(
              gameId,
              day,
              characters.recordTraitChoice(gameId, Map.of(), effect.statDeltas(), day),
              CAREER_LOG);
    }
    CharacterView after = characters.get(gameId);
    Map<String, Object> payload = new HashMap<>();
    payload.put("eventTitle", eventTitle);
    payload.put("optionCode", option.code());
    payload.put("optionLabel", option.label());
    payload.put("success", success);
    payload.put("text", message.toString());
    payload.put("jobTitle", after.jobCode() == null ? null : content.job(after.jobCode()).title());
    payload.put(
        "monthlySalary",
        after.jobCode() == null
            ? 0
            : monthlySalary(
                content.job(after.jobCode()), tenureYears(after, day), after.salaryBonusBp()));
    logs.append(gameId, day, CAREER_LOG, payload);
    return simpleOutcome(ticket, message.toString(), growth);
  }

  // ---- 결혼·자녀 (경제 개편 설계 7.3절) ----

  private ChoiceOutcome.Outcome resolveLife(
      GameRow game, ChoiceTicket ticket, ChoiceTicket.Life life) {
    UUID gameId = game.id();
    int day = ticket.occursDay();
    events.complete(
        gameId,
        ticket.eventId(),
        new Completion(ticket.optionCode(), ticket.optionCode(), List.of()));
    if (!life.accepted()) {
      return simpleOutcome(ticket, "아직은 아니라고 했다.");
    }
    return switch (life.kind()) {
      case MARRIAGE -> {
        long cost = household.weddingCost(day);
        household.marry(gameId, day);
        assets.spend(gameId, LIFE_COST, cost, day, ticket.eventId());
        logs.append(gameId, day, "MARRIAGE", Map.of("cost", cost));
        yield simpleOutcome(ticket, "결혼했다. 결혼 비용 %,d원이 들었다.".formatted(cost));
      }
      case CHILD -> {
        long cost = household.childbirthCost(day);
        int seq = household.addChild(gameId, day);
        assets.spend(gameId, LIFE_COST, cost, day, ticket.eventId());
        logs.append(gameId, day, "CHILD", Map.of("seq", seq, "cost", cost));
        yield simpleOutcome(ticket, "%d번째 아이가 태어났다.".formatted(seq));
      }
    };
  }

  // ---- 뉴스 선택: 판정 → 매매 → 충격 → 성장 (domains.md 3절 처리 흐름 2) ----

  /** quantity가 없으면 매수는 현금의 news-buy-ratio-bp 비율, 매도는 전량이다. 있으면 그 수량으로 하되 매도는 보유 수량에서 잘린다. */
  private ChoiceOutcome.Outcome resolveNews(
      GameRow game, ChoiceTicket ticket, String eventTitle, Long quantity, SeededRandom random) {
    UUID gameId = game.id();
    CharacterView character = characters.get(gameId);
    AccountView account = assets.get(gameId);
    Map<String, Long> prices = market.prices(gameId);
    String stockCode = ticket.stockCode();
    long price = prices.get(stockCode);
    Action chosen = Action.valueOf(ticket.optionCode());
    boolean holding = account.holdings().containsKey(stockCode);

    Resolution resolution =
        behavior.resolve(
            new ChoiceContext(chosen, character.stats(), ticket.swaySentiment(), holding),
            random.forKey("behavior", "resolve", ticket.seq()));
    ChoiceOutcome.Trade trade =
        switch (resolution.actual()) {
          case BUY -> {
            long buying =
                quantity != null
                    ? quantity
                    : account.cash() * properties.newsBuyRatioBp() / BP / price;
            yield buying < 1
                ? new ChoiceOutcome.Trade(
                    TradeResult.Status.INSUFFICIENT_CASH.name(), 0, price, 0, null)
                : tradeView(
                    assets.buy(
                        gameId, stockCode, buying, price, ticket.occursDay(), ticket.eventId()));
          }
          case SELL ->
              holding
                  ? tradeView(
                      assets.sell(
                          gameId,
                          stockCode,
                          quantity != null
                              ? quantity
                              : account.holdings().get(stockCode).quantity(),
                          price,
                          ticket.occursDay(),
                          ticket.eventId()))
                  : new ChoiceOutcome.Trade(
                      TradeResult.Status.NOTHING_TO_SELL.name(), 0, price, 0, null);
          case HOLD -> new ChoiceOutcome.Trade("HELD", 0, price, 0, null);
        };

    // 운: 떨어지는 뉴스이고 충격을 받는 종목을 들고 있을 때만 폭을 줄인다 (경제 개편 설계 5.4절).
    int lossFactor =
        behavior.lossFactorPercent(
            character.stats().luck(), random.forKey("behavior", "luck", ticket.seq()));
    AccountView afterTrade = assets.get(gameId);
    boolean exposed =
        content.stocksOf(ticket.sectorCode()).stream()
            .anyMatch(s -> afterTrade.holdings().containsKey(s.code()));
    boolean softened = ticket.truth() == Direction.DOWN && exposed && lossFactor < PERCENT;
    int magnitude =
        softened ? (int) (ticket.magnitudeBp() * lossFactor / PERCENT) : ticket.magnitudeBp();
    long before = assets.holdingsValue(gameId, prices);
    ShockResult shock =
        market.applyShock(
            gameId,
            ticket.sectorCode(),
            stockCode,
            ticket.sectorWide(),
            ticket.truth(),
            magnitude,
            ticket.occursDay(),
            ticket.eventId());
    long pnl = assets.holdingsValue(gameId, market.prices(gameId)) - before;

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

    String sectorName = content.sectorName(ticket.sectorCode());
    String stockName = content.stock(stockCode).name();
    Map<String, Object> newsPayload = new HashMap<>();
    newsPayload.put("eventTitle", eventTitle);
    newsPayload.put("sectorCode", ticket.sectorCode());
    newsPayload.put("sectorName", sectorName);
    newsPayload.put("stockCode", stockCode);
    newsPayload.put("stockName", stockName);
    newsPayload.put("chosen", chosen.name());
    newsPayload.put("actual", resolution.actual().name());
    newsPayload.put("deviations", deviationPayload(resolution));
    newsPayload.put(
        "trade",
        Map.of("status", trade.status(), "quantity", trade.quantity(), "amount", trade.amount()));
    logs.append(gameId, ticket.occursDay(), "NEWS", newsPayload);
    Map<String, Object> pricePayload = new HashMap<>();
    pricePayload.put("sectorCode", ticket.sectorCode());
    pricePayload.put("sectorName", sectorName);
    pricePayload.put("stockCode", stockCode);
    pricePayload.put("stockName", stockName);
    pricePayload.put("sectorWide", ticket.sectorWide());
    pricePayload.put("direction", ticket.truth().name());
    pricePayload.put("changeBp", magnitude);
    pricePayload.put("pnl", pnl);
    pricePayload.put("lossSoftened", softened);
    logs.append(gameId, ticket.occursDay(), "PRICE", pricePayload);
    List<ChoiceOutcome.Growth> growthViews =
        logGrowth(gameId, ticket.occursDay(), growth, DEVIATION);

    return new ChoiceOutcome.Outcome(
        ticket.kind().name(),
        chosen.name(),
        resolution.actual().name(),
        deviationViews(resolution),
        trade,
        new ChoiceOutcome.Price(
            ticket.sectorCode(),
            sectorName,
            stockCode,
            stockName,
            ticket.truth().name(),
            magnitude,
            pnl,
            softened),
        growthViews,
        null);
  }

  // ---- 자유 매매 (경제 개편 설계 8절) ----

  @Override
  @Transactional
  public ChoiceOutcome trade(
      UUID sessionId, UUID gameId, String stockCode, Action side, long quantity) {
    GameRow game = lock(sessionId, gameId);
    if (events.pending(gameId).isPresent()) {
      throw new InvalidRequestException("먼저 선택을 해야 한다");
    }
    if (game.phase() != Phase.INVESTING) {
      throw new InvalidRequestException("투자를 시작한 뒤에 사고팔 수 있다");
    }
    if (side == Action.HOLD) {
      throw new InvalidRequestException("매수 또는 매도만 할 수 있다");
    }
    if (quantity < 1) {
      throw new InvalidRequestException("수량은 1 이상이어야 한다");
    }
    StockDefinition stock = requireStock(stockCode);
    int day = game.lastReportedDay();
    CharacterView character = characters.get(gameId);
    AccountView account = assets.get(gameId);
    long price = market.prices(gameId).get(stockCode);
    boolean holding = account.holdings().containsKey(stockCode);
    long seq = logs.findAll(gameId).stream().filter(e -> TRADE_LOG.equals(e.kind())).count() + 1;

    // 다른 뉴스가 없으므로 줏대 판정은 없고 용기 판정만 걸린다.
    Resolution resolution =
        behavior.resolve(
            new ChoiceContext(side, character.stats(), null, holding),
            new HashSeededRandom(game.seed()).forKey("behavior", "trade", seq));
    ChoiceOutcome.Trade trade =
        switch (resolution.actual()) {
          case BUY -> tradeView(assets.buy(gameId, stockCode, quantity, price, day, null));
          case SELL -> tradeView(assets.sell(gameId, stockCode, quantity, price, day, null));
          case HOLD -> new ChoiceOutcome.Trade("HELD", 0, price, 0, null);
        };
    List<StatChange> growth =
        characters.grow(
            gameId,
            resolution.deviations().stream()
                .map(d -> (GrowthSource) new GrowthSource.DeviationGrowth(d.statCode(), null))
                .toList(),
            day);

    Map<String, Object> payload = new HashMap<>();
    payload.put("stockCode", stockCode);
    payload.put("stockName", stock.name());
    payload.put("side", side.name());
    payload.put("chosen", side.name());
    payload.put("actual", resolution.actual().name());
    payload.put("deviations", deviationPayload(resolution));
    payload.put("status", trade.status());
    payload.put("quantity", trade.quantity());
    payload.put("price", trade.price());
    payload.put("amount", trade.amount());
    payload.put("realizedPnl", trade.realizedPnl());
    logs.append(gameId, day, TRADE_LOG, payload);
    List<ChoiceOutcome.Growth> growthViews = logGrowth(gameId, day, growth, DEVIATION);

    return new ChoiceOutcome(
        view(games.findLatest(sessionId).orElseThrow()),
        new ChoiceOutcome.Outcome(
            TRADE_LOG,
            side.name(),
            resolution.actual().name(),
            deviationViews(resolution),
            trade,
            null,
            growthViews,
            null));
  }

  @Override
  @Transactional(readOnly = true)
  public StockHistory history(UUID sessionId, UUID gameId, String stockCode) {
    GameRow game =
        games
            .findLatest(sessionId)
            .filter(g -> g.id().equals(gameId))
            .orElseThrow(() -> new NotFoundException("판이 없다"));
    requireStock(stockCode);
    return new StockHistory(
        stockCode,
        market.history(game.id(), stockCode).stream()
            .map(p -> new StockHistory.Point(p.month(), p.price()))
            .toList());
  }

  private StockDefinition requireStock(String stockCode) {
    try {
      return content.stock(stockCode);
    } catch (IllegalArgumentException e) {
      throw new NotFoundException("알 수 없는 종목이다");
    }
  }

  private static ChoiceOutcome.Trade tradeView(TradeResult result) {
    return new ChoiceOutcome.Trade(
        result.status().name(),
        result.quantity(),
        result.price(),
        result.amount(),
        result.status() == TradeResult.Status.EXECUTED && result.realizedPnl() != 0
            ? result.realizedPnl()
            : null);
  }

  private static List<ChoiceOutcome.DeviationView> deviationViews(Resolution resolution) {
    return resolution.deviations().stream()
        .map(
            d ->
                new ChoiceOutcome.DeviationView(
                    d.statCode(), d.from().name(), d.to().name(), d.source()))
        .toList();
  }

  private static List<Map<String, String>> deviationPayload(Resolution resolution) {
    return resolution.deviations().stream()
        .map(
            d -> {
              Map<String, String> entry = new HashMap<>();
              entry.put("statCode", d.statCode());
              entry.put("from", d.from().name());
              entry.put("to", d.to().name());
              if (d.source() != null) {
                entry.put("source", d.source());
              }
              return entry;
            })
        .toList();
  }

  /** 값이 실제로 바뀐 능력치만 인생 기록에 남기고 결과용으로 돌려준다. */
  private List<ChoiceOutcome.Growth> logGrowth(
      UUID gameId, int day, List<StatChange> changes, String reason) {
    List<ChoiceOutcome.Growth> views = new ArrayList<>();
    for (StatChange g : changes) {
      if (g.valueAfter() == g.valueBefore()) {
        continue;
      }
      logs.append(
          gameId,
          day,
          "GROWTH",
          Map.of(
              "statCode", g.statCode(),
              "before", g.valueBefore(),
              "after", g.valueAfter(),
              "reason", reason));
      views.add(new ChoiceOutcome.Growth(g.statCode(), g.valueBefore(), g.valueAfter(), reason));
    }
    return views;
  }

  private static List<String> codes(List<ContentCatalog.NamedCode> named) {
    return named.stream().map(ContentCatalog.NamedCode::code).toList();
  }

  private static ChoiceOutcome.Outcome simpleOutcome(ChoiceTicket ticket, String message) {
    return simpleOutcome(ticket, message, List.of());
  }

  private static ChoiceOutcome.Outcome simpleOutcome(
      ChoiceTicket ticket, String message, List<ChoiceOutcome.Growth> growth) {
    return new ChoiceOutcome.Outcome(
        ticket.kind().name(),
        ticket.optionCode(),
        ticket.optionCode(),
        List.of(),
        null,
        null,
        growth,
        message);
  }

  // ---- 시간 흐름: 매월 1일 (경제 개편 설계 9절) ----

  /**
   * (fromExclusive, toInclusive] 안의 매월 1일마다: 시장 → 월급·배우자 소득(은퇴 달이면 퇴직금) → 생활비 → 이자 → 월말 총자산(연 경계면
   * 연간 자산). 생활비는 직업이 생긴 뒤부터 나간다.
   */
  private void processMonths(GameRow game, int fromExclusive, int toInclusive) {
    UUID gameId = game.id();
    int month = calendar.daysPerMonth();
    SeededRandom random = new HashSeededRandom(game.seed());
    CharacterView character = characters.get(gameId);
    JobDefinition job = character.jobCode() == null ? null : content.job(character.jobCode());

    for (int m = fromExclusive / month + 1; m * month <= toInclusive; m++) {
      int day = m * month;
      market.advanceTo(gameId, day, random);
      // 생활비는 처음 일을 시작한 뒤부터 나간다(실직 중에도). 월급은 지금 직업이 있을 때만 (decisions.md 26번).
      boolean independent = character.careerStartDay() != null && day > character.careerStartDay();
      boolean working = job != null && day > character.jobStartDay();
      if (independent) {
        HouseholdView home = household.get(gameId);
        boolean retired = home.retiredDay() != null;
        long salary =
            working
                ? monthlySalary(job, tenureYears(character, day), character.salaryBonusBp())
                : 0;
        if (!retired && household.retireMonth(day)) {
          long severance = salary * tenureYears(character, day);
          if (severance > 0) {
            assets.credit(gameId, SEVERANCE, severance, day);
          }
          household.retire(gameId, day);
          logs.append(
              gameId, day, "RETIRE", Map.of("age", ageAt(game, day), "severance", severance));
        } else if (!retired && working) {
          assets.credit(gameId, SALARY, salary, day);
        }
        long spouse = household.spouseIncome(gameId, day);
        if (spouse > 0) {
          assets.credit(gameId, SPOUSE_INCOME, spouse, day);
        }
        assets.spend(gameId, EXPENSE, household.monthlyExpense(gameId, day), day, null);
      }
      assets.accrueInterest(gameId, day);
      Map<String, Long> prices = market.prices(gameId);
      long total = assets.totalAsset(gameId, prices);
      logs.upsertMonth(gameId, m, total);
      if (day % calendar.daysPerYear() == 0) {
        logs.upsertYear(
            gameId,
            game.startAge() - 1 + day / calendar.daysPerYear(),
            total,
            assets.get(gameId).cash());
      }
    }
  }

  /** 월급 = 기본 월급 × (1 + 연차 인상)^연차 × (1 + 협상·승진 인상분). */
  private static long monthlySalary(JobDefinition job, int tenureYears, int bonusBp) {
    long salary = job.baseMonthlySalary();
    for (int year = 0; year < tenureYears; year++) {
      salary = salary * (PERCENT + job.raisePercentPerYear()) / PERCENT;
    }
    return salary * (BP + bonusBp) / BP;
  }

  private int tenureYears(CharacterView character, int day) {
    return character.jobStartDay() == null
        ? 0
        : Math.max(0, day - character.jobStartDay()) / calendar.daysPerYear();
  }

  private int ageAt(GameRow game, int day) {
    return game.startAge() + day / calendar.daysPerYear();
  }

  private void scheduleAt(GameRow game, int fromDay, int toDay) {
    CharacterView character = characters.get(game.id());
    SeededRandom random = new HashSeededRandom(game.seed());
    HintProvider hints =
        (truth, seq) ->
            behavior.hint(
                character.stats().insight(), truth, random.forKey("behavior", "hint", seq));
    ScheduleResult result =
        events.schedule(game.id(), context(game, character), fromDay, toDay, random, hints);
    result.notice().ifPresent(notice -> applyNotice(game, character, notice));
  }

  /** 알림성 생활 이벤트의 돈을 반영하고 기록한다 (경제 개편 설계 7.3절). */
  private void applyNotice(GameRow game, CharacterView character, Notice notice) {
    UUID gameId = game.id();
    long amount = notice.amount();
    if (notice.salaryPercent() > 0 && character.jobCode() != null) {
      amount =
          monthlySalary(
                  content.job(character.jobCode()),
                  tenureYears(character, notice.occursDay()),
                  character.salaryBonusBp())
              * notice.salaryPercent()
              / PERCENT;
    }
    if (amount > 0) {
      assets.credit(gameId, WINDFALL, amount, notice.occursDay());
    } else if (amount < 0) {
      assets.spend(gameId, LIFE_COST, -amount, notice.occursDay(), notice.eventId());
    }
    logs.append(
        gameId,
        notice.occursDay(),
        "LIFE",
        Map.of(
            "eventId", notice.eventId().toString(),
            "noticeCode", notice.code(),
            "title", notice.title(),
            "amount", amount));
  }

  private void endIfFinished(GameRow game) {
    if (game.lastReportedDay() < endDay(game) || events.pending(game.id()).isPresent()) {
      return;
    }
    OffsetDateTime endedAt = games.now();
    games.end(game.id(), endedAt);
    AccountView account = assets.get(game.id());
    long finalAsset = assets.totalAsset(game.id(), market.prices(game.id()));
    results.save(
        new GameResult(
            game.id(),
            game.sessionId(),
            game.contentVersion(),
            account.initialCash(),
            finalAsset,
            game.endAge(),
            characters.get(game.id()).stats(),
            deviationCounts(game.id()),
            game.createdAt(),
            endedAt));
    // 종료일에 알림 비용이 겹치면 연 경계에서 먼저 쓴 값이 최종 자산과 어긋나므로 덮어쓴다.
    logs.replaceYear(game.id(), game.endAge(), finalAsset, account.cash());
    logs.append(
        game.id(),
        game.lastReportedDay(),
        "END",
        Map.of(
            "finalAge", game.endAge(),
            "initialAsset", account.initialCash(),
            "finalAsset", finalAsset,
            "returnBp", returnBp(account.initialCash(), finalAsset)));
  }

  /** 뉴스 이탈(이벤트 도메인) + 자유 매매 이탈(진행의 TRADE 기록)을 합친다 (경제 개편 설계 8.2절). */
  private Map<String, Integer> deviationCounts(UUID gameId) {
    Map<String, Integer> counts = new HashMap<>(events.deviationCounts(gameId));
    for (GameView.LogEntry entry : logs.findAll(gameId)) {
      if (!TRADE_LOG.equals(entry.kind())) {
        continue;
      }
      Object deviations = entry.payload().get("deviations");
      if (deviations instanceof List<?> list) {
        for (Object d : list) {
          if (d instanceof Map<?, ?> map && map.get("statCode") instanceof String code) {
            counts.merge(code, 1, Integer::sum);
          }
        }
      }
    }
    return counts;
  }

  private static int returnBp(long initial, long finalAsset) {
    return initial == 0 ? 0 : (int) ((finalAsset - initial) * BP / initial);
  }

  private SchedulingContext context(GameRow game, CharacterView character) {
    HouseholdView home = household.get(game.id());
    return new SchedulingContext(
        game.phase(),
        game.startAge(),
        character.investmentStyle(),
        character.interestSector(),
        character.jobStartDay() == null ? null : character.jobStartDay() + calendar.daysPerMonth(),
        character.investmentStyle() != null,
        game.investingStartDay(),
        endDay(game),
        character.jobStartDay(),
        character.jobCode(),
        character.careerStartDay(),
        home.retiredDay() != null,
        home.married(),
        home.marriedDay(),
        home.childBirthDays().size());
  }

  // ---- 화면용 상태 ----

  private GameView view(GameRow game) {
    UUID gameId = game.id();
    CharacterView character = characters.get(gameId);
    AccountView account = assets.get(gameId);
    Map<String, Long> prices = market.prices(gameId);
    List<Quote> quotes = market.quotes(gameId);
    int month = market.currentMonth(gameId);
    boolean ended = game.ended();
    Optional<EventView> pending = ended ? Optional.empty() : events.pending(gameId);
    Integer nextEventDay =
        ended || pending.isPresent()
            ? null
            : nextEventDay(game, game.lastReportedDay()).stream().boxed().findFirst().orElse(null);

    List<GameView.Holding> holdings = new ArrayList<>();
    long invested = 0;
    for (Map.Entry<String, AccountView.Holding> e : account.holdings().entrySet()) {
      StockDefinition stock = content.stock(e.getKey());
      long price = prices.getOrDefault(e.getKey(), 0L);
      long value = e.getValue().quantity() * price;
      long pnl = value - e.getValue().costBasis();
      int pnlBp = e.getValue().costBasis() == 0 ? 0 : (int) (pnl * BP / e.getValue().costBasis());
      invested += value;
      holdings.add(
          new GameView.Holding(
              stock.code(),
              stock.name(),
              stock.sector(),
              content.sectorName(stock.sector()),
              e.getValue().quantity(),
              e.getValue().avgCost(),
              price,
              value,
              pnl,
              pnlBp));
    }
    Map<String, Quote> quoteByCode = new HashMap<>();
    quotes.forEach(q -> quoteByCode.put(q.stockCode(), q));

    return new GameView(
        gameId,
        ended ? GameView.Status.ENDED : GameView.Status.ACTIVE,
        game.phase(),
        game.lastReportedDay(),
        game.startAge(),
        game.endAge(),
        calendar.daysPerYear(),
        character.stats(),
        character.initialStats(),
        account.cash(),
        account.cash() + invested - account.debt(),
        account.initialCash(),
        invested,
        account.debt(),
        logs.findMonthTotal(gameId, month - 1).stream().boxed().findFirst().orElse(null),
        holdings,
        job(character, game.lastReportedDay()),
        character.investmentStyle() == null
            ? null
            : new GameView.Named(
                character.investmentStyle(), content.styleName(character.investmentStyle())),
        character.riskProfile() == null
            ? null
            : new GameView.Named(
                character.riskProfile(), content.riskName(character.riskProfile())),
        character.mindProfile() == null
            ? null
            : new GameView.Named(
                character.mindProfile(), content.mindName(character.mindProfile())),
        character.interestSector() == null
            ? null
            : new GameView.Named(
                character.interestSector(), content.sectorName(character.interestSector())),
        character.investorType() == null ? null : investorTypeView(character.investorType()),
        new GameView.Market(month, quotes.stream().map(this::quoteView).toList()),
        householdView(game, character),
        pending.map(e -> pendingView(e, quoteByCode)).orElse(null),
        nextEventDay,
        ended ? results.find(gameId).map(DefaultProgressService::resultView).orElse(null) : null,
        logs.findAll(gameId),
        logs.findYears(gameId));
  }

  private GameView.StockQuote quoteView(Quote quote) {
    StockDefinition stock = content.stock(quote.stockCode());
    return new GameView.StockQuote(
        stock.code(),
        stock.name(),
        stock.sector(),
        content.sectorName(stock.sector()),
        quote.price(),
        changeBp(quote.price(), quote.priceMonthAgo()),
        changeBp(quote.price(), quote.priceYearAgo()),
        quote.last12());
  }

  private static int changeBp(long now, long before) {
    return before <= 0 ? 0 : (int) ((now - before) * BP / before);
  }

  private GameView.Household householdView(GameRow game, CharacterView character) {
    HouseholdView home = household.get(game.id());
    int day = game.lastReportedDay();
    boolean independent = character.careerStartDay() != null && day > character.careerStartDay();
    boolean working = character.jobCode() != null && day > character.jobStartDay();
    boolean retired = home.retiredDay() != null;
    long income =
        working && !retired
            ? monthlySalary(
                content.job(character.jobCode()),
                tenureYears(character, day),
                character.salaryBonusBp())
            : 0;
    return new GameView.Household(
        home.married(),
        home.marriedDay() == null ? null : ageAt(game, home.marriedDay()),
        home.childBirthDays().stream()
            .map(birth -> new GameView.Child((day - birth) / calendar.daysPerYear()))
            .toList(),
        income,
        household.spouseIncome(game.id(), day),
        independent ? household.monthlyExpense(game.id(), day) : 0,
        retired);
  }

  private GameView.InvestorType investorTypeView(String code) {
    InvestorType type = content.investorType(code);
    return new GameView.InvestorType(type.code(), type.name(), type.description());
  }

  private GameView.Job job(CharacterView character, int day) {
    if (character.jobCode() == null) {
      return null;
    }
    JobDefinition job = content.job(character.jobCode());
    return new GameView.Job(
        job.code(),
        job.title(),
        monthlySalary(job, tenureYears(character, day), character.salaryBonusBp()),
        tenureYears(character, day));
  }

  private GameView.PendingEvent pendingView(EventView event, Map<String, Quote> quotes) {
    String stockName = event.stockCode() == null ? null : content.stock(event.stockCode()).name();
    Quote quote = event.stockCode() == null ? null : quotes.get(event.stockCode());
    return new GameView.PendingEvent(
        event.eventId(),
        event.kind().name(),
        event.occursDay(),
        event.sectorCode(),
        event.sectorCode() == null ? null : content.sectorName(event.sectorCode()),
        event.stockCode(),
        stockName,
        event.sectorWide(),
        quote == null ? null : quote.last12(),
        event.title(),
        event.body(),
        event.hintText(),
        event.swayText(),
        event.options().stream().map(o -> new GameView.Option(o.code(), o.label())).toList());
  }

  private static GameView.Result resultView(GameResult result) {
    long initial = result.initialAsset();
    return new GameView.Result(
        initial,
        result.finalAsset(),
        returnBp(initial, result.finalAsset()),
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
