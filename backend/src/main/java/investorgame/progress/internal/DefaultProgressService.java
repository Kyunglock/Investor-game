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
import investorgame.common.Hint;
import investorgame.common.Korean;
import investorgame.common.Phase;
import investorgame.common.Sex;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.common.random.HashSeededRandom;
import investorgame.common.random.SeededRandom;
import investorgame.content.AnalysisText;
import investorgame.content.CareerDefinition;
import investorgame.content.ChildWeddingText;
import investorgame.content.ContentCatalog;
import investorgame.content.CrisisDefinition;
import investorgame.content.InvestorType;
import investorgame.content.JobDefinition;
import investorgame.content.OutingText;
import investorgame.content.SpouseText;
import investorgame.content.StockDefinition;
import investorgame.content.TraitDefinition;
import investorgame.event.ChoiceTicket;
import investorgame.event.CompleteResult;
import investorgame.event.Completion;
import investorgame.event.EventKind;
import investorgame.event.EventService;
import investorgame.event.EventView;
import investorgame.event.HintProvider;
import investorgame.event.Notice;
import investorgame.event.ScheduleResult;
import investorgame.event.SchedulingContext;
import investorgame.household.HouseholdService;
import investorgame.household.HouseholdView;
import investorgame.household.Spouse;
import investorgame.housing.HousingService;
import investorgame.market.MarketCycle;
import investorgame.market.MarketService;
import investorgame.market.Quote;
import investorgame.market.ShockResult;
import investorgame.progress.ChoiceOutcome;
import investorgame.progress.GameSummary;
import investorgame.progress.GameView;
import investorgame.progress.MarketOverview;
import investorgame.progress.ProgressService;
import investorgame.progress.StockAnalysis;
import investorgame.progress.StockHistory;
import investorgame.result.Ending;
import investorgame.result.GameResult;
import investorgame.result.ResultService;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.Set;
import java.util.UUID;
import java.util.random.RandomGenerator;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 한 판의 조율. 다른 도메인끼리는 서로를 부르지 않으므로 필요한 값은 여기서 읽어 인자로 넘긴다 (domains.md 3절). 매월 1일마다 시장 → 수입 → 지출 → 이자
 * 순서로 처리한다 (경제 개편 설계 9절). 난수는 판 시드에서 키별로 유도한다.
 */
@Service
class DefaultProgressService implements ProgressService {

  private static final long PERCENT = 100;
  private static final String FULL_TIME_INVESTOR = "전업투자자";
  private static final int BP = 10_000;
  private static final String DEVIATION = "DEVIATION";
  private static final String TRAIT = "TRAIT";
  private static final String SALARY = "SALARY";
  private static final String SPOUSE_INCOME = "SPOUSE_INCOME";
  private static final String SEVERANCE = "SEVERANCE";
  private static final String PENSION = "PENSION";
  private static final String WINDFALL = "WINDFALL";
  private static final String EXPENSE = "EXPENSE";
  private static final String LIFE_COST = "LIFE_COST";
  private static final String TRADE_LOG = "TRADE";
  private static final String CAREER_LOG = "CAREER";

  /** 최근에 나온 기사 몇 개는 다시 뽑지 않는다. */
  private static final int ARTICLE_NO_REPEAT = 8;

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
  private final HousingService housing;
  private final HousingFlow housingFlow;
  private final Comforter comforter;
  private final MarketDesk desk;
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
      ContentCatalog content,
      HousingService housing,
      HousingFlow housingFlow,
      MarketDesk desk,
      Comforter comforter) {
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
    this.housing = housing;
    this.housingFlow = housingFlow;
    this.comforter = comforter;
    this.desk = desk;
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
    housing.create(game.id());
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
  @Transactional(readOnly = true)
  public List<GameSummary> recentGames(int limit) {
    List<GameRepository.GameLine> lines = games.recent(limit, calendar.daysPerYear());
    Map<UUID, GameResult> resultByGame = new HashMap<>();
    for (GameResult r :
        results.findAll(lines.stream().map(GameRepository.GameLine::gameId).toList())) {
      resultByGame.put(r.gameId(), r);
    }
    return lines.stream()
        .map(
            g -> {
              GameResult r = resultByGame.get(g.gameId());
              return new GameSummary(
                  g.gameId(),
                  g.sessionId(),
                  g.status(),
                  g.startAge(),
                  r == null ? g.age() : r.finalAge(),
                  g.startedAt(),
                  g.updatedAt(),
                  g.endedAt(),
                  r == null ? null : r.initialAsset(),
                  r == null ? null : r.finalAsset(),
                  r == null ? null : r.ending().name());
            })
        .toList();
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
    OptionalInt bankruptDay = processMonths(game, last, stopDay);
    if (bankruptDay.isPresent()) {
      // 파산한 달에서 멈춘다. 이벤트는 더 예약하지 않고 바로 끝낸다 (decisions.md 27번).
      GameRow bankrupt = withDay(game, bankruptDay.getAsInt());
      games.updateDay(gameId, bankruptDay.getAsInt());
      end(bankrupt, Ending.BANKRUPT);
      return view(games.findLatest(sessionId).orElseThrow());
    }
    GameRow advanced = withDay(game, stopDay);
    games.updateDay(gameId, stopDay);
    scheduleAt(advanced, last, stopDay);
    endIfFinished(advanced);
    return view(games.findLatest(sessionId).orElseThrow());
  }

  @Override
  @Transactional
  public GameView quit(UUID sessionId, UUID gameId) {
    GameRow game = lock(sessionId, gameId);
    if (events.pending(gameId).isPresent()) {
      throw new InvalidRequestException("대기 중인 선택을 먼저 해야 한다");
    }
    end(game, Ending.QUIT);
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
          // 흔들림은 뉴스와 같은 판정·충격 흐름. "판다"는 전량이다 (decisions.md 33번).
          case ChoiceTicket.Shake shake ->
              resolveNews(game, ticket, pendingView.title(), null, random);
          case ChoiceTicket.Leverage leverage -> resolveLeverage(game, ticket, leverage, quantity);
          case ChoiceTicket.Housing home ->
              housingFlow.resolve(
                  gameId,
                  ticket,
                  home,
                  household.get(gameId),
                  monthlyIncome(characters.get(gameId), ticket.occursDay()),
                  cheongyakPoints(game, characters.get(gameId), ticket.occursDay()),
                  random);
          case ChoiceTicket.Job job -> {
            events.complete(gameId, eventId, new Completion(option, option, List.of()));
            if (job.isWait()) {
              // 더 나은 자리를 기다린다. 다음 직업 선택은 event.job.wait-days 뒤에 온다 (decisions.md 26번).
              logs.append(gameId, ticket.occursDay(), "JOB_WAIT", Map.of());
              yield simpleOutcome(ticket, "이번 제안은 넘기고 더 나은 자리를 기다리기로 했다.");
            }
            if (job.isInvest()) {
              // 전업투자자: 월급이 없다는 것 말고는 직장인과 같다. 투자 시작 제안을 건너뛰고 바로 투자기로 간다 (decisions.md 35번).
              boolean rehire = characters.get(gameId).careerStartDay() != null;
              characters.becomeFullTimeInvestor(gameId, ticket.occursDay());
              if (game.phase() != Phase.INVESTING) {
                games.startInvesting(gameId, ticket.occursDay());
              }
              logs.append(
                  gameId,
                  ticket.occursDay(),
                  "JOB",
                  Map.of(
                      "jobCode",
                      ChoiceTicket.Job.INVEST,
                      "jobTitle",
                      FULL_TIME_INVESTOR,
                      "monthlySalary",
                      0,
                      "rehire",
                      rehire,
                      "fullTimeInvestor",
                      true));
              yield simpleOutcome(ticket, "직장 대신 전업투자자의 길을 골랐다. 월급은 없고, 이제 뉴스가 들려온다.");
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
            // 결과가 갈리는 선택(빌려준 돈을 돌려받을지)은 판 시드로 굴려 돈·능력치·문구를 더한다 (decisions.md 41번).
            TraitDefinition.Outcome result =
                trait.outcomes().isEmpty()
                    ? null
                    : weightedOutcome(
                        trait.outcomes(), random.forKey("progress", "trait-outcome", ticket.seq()));
            Map<String, Integer> statDeltas = new HashMap<>(trait.statDeltas());
            long amount = trait.amount();
            if (result != null) {
              result.statDeltas().forEach((k, v) -> statDeltas.merge(k, v, Integer::sum));
              amount += result.amount();
            }
            // 성인 장면의 돈은 25세 기준이라 물가를 붙인다. 성장기는 그대로 (decisions.md 75번).
            if (trait.adult()) {
              amount =
                  amount < 0
                      ? -household.inflated(-amount, ticket.occursDay())
                      : household.inflated(amount, ticket.occursDay());
            }
            // 성장기는 부모님 품이라 빚을 지지 않는다: 통장에 있는 만큼만 쓴다 (decisions.md 84번). 초기 자산이 100만 원일 수도 있어 그대로 두면
            // 취업 전에 파산한다.
            boolean capped = false;
            if (!trait.adult() && amount < 0) {
              long cash = assets.get(gameId).cash();
              if (-amount > cash) {
                amount = -cash;
                capped = true;
              }
            }
            if (amount > 0) {
              assets.credit(gameId, WINDFALL, amount, ticket.occursDay());
            } else if (amount < 0) {
              assets.spend(gameId, LIFE_COST, -amount, ticket.occursDay(), eventId);
            }
            // 양가 부모 장면 등에서 가족을 챙기면 가까워지고 외면하면 멀어진다 (decisions.md 88번).
            if (trait.familyDelta() != 0) {
              household.bond(gameId, trait.familyDelta());
            }
            List<StatChange> moved =
                characters.recordTraitChoice(
                    gameId, trait.traitDeltas(), statDeltas, ticket.occursDay());
            CompleteResult completed =
                events.complete(gameId, eventId, new Completion(option, option, List.of()));
            Map<String, Object> traitPayload = new HashMap<>();
            traitPayload.put("eventTitle", pendingView.title());
            traitPayload.put("optionCode", option);
            traitPayload.put("optionLabel", optionLabel);
            if (result != null) {
              traitPayload.put("result", result.note());
            }
            if (amount != 0) {
              traitPayload.put("amount", amount);
            }
            logs.append(gameId, ticket.occursDay(), "TRAIT", traitPayload);
            List<ChoiceOutcome.Growth> growth = logGrowth(gameId, ticket.occursDay(), moved, TRAIT);
            // 돈이 오갔으면 얼마가 오갔는지 결과에 붙인다 (decisions.md 75번).
            String money =
                amount == 0
                    ? (capped ? " (통장이 비어 돈은 들지 않았다)" : "")
                    : " (통장 %s%,d원%s)"
                        .formatted(amount > 0 ? "+" : "", amount, capped ? ", 있는 만큼만" : "");
            String note =
                (result == null ? trait.note() : trait.note() + " " + result.note()) + money;
            if (!completed.traitsComplete()) {
              yield simpleOutcome(ticket, note, growth);
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
          case ChoiceTicket.Life life -> resolveLife(game, ticket, life, random);
          case ChoiceTicket.Marriage marriage -> resolveMarriage(game, ticket, marriage);
          case ChoiceTicket.ChildWedding wedding -> resolveChildWedding(game, ticket, wedding);
          case ChoiceTicket.FamilyTrip trip -> resolveFamilyTrip(game, ticket, trip);
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
      // 실적(지금 직장에서 쌓은 인상분)이 판정에 들어가는 장면도 있다: 대기업 50대 권고사직 (decisions.md 51번).
      int raisePercent = character.salaryBonusBp() / (int) PERCENT;
      int chanceBp =
          option.baseBp() + stat * option.perPointBp() + raisePercent * option.perRaisePercentBp();
      success = random.forKey("career", ticket.seq()).nextInt(BP) < chanceBp;
    }
    CareerDefinition.Effect effect = success ? option.success() : option.fail();
    // 승진·인상은 기쁘고, 실패는 지치고, 일을 잃으면 더 지친다 (decisions.md 82번).
    household.cheer(gameId, effect.quit() ? -HAPPY_QUIT : success ? HAPPY_CAREER : -HAPPY_CAREER);
    // 실제 행동에 판정 결과를 남겨 후속 장면(followUp)을 정할 수 있게 한다 (decisions.md 52번).
    events.complete(
        gameId,
        ticket.eventId(),
        new Completion(
            ticket.optionCode(),
            CareerDefinition.actualAction(ticket.optionCode(), success),
            List.of()));

    // 전업투자자는 직업이 없다. 투자자의 장면은 월급·직장을 건드리지 않는다(콘텐츠 검증).
    JobDefinition job = character.jobCode() == null ? null : content.job(character.jobCode());
    long salaryBefore =
        job == null
            ? 0
            : monthlySalary(job, tenureYears(character, day), character.salaryBonusBp());
    // 가족이 있으면 가족 때문에 버티고 위로받는 문구, 혼자면 불안과 친구의 문구 (decisions.md 83번).
    HouseholdView family = household.get(gameId);
    StringBuilder message =
        new StringBuilder(effect.textFor(family.married() || !family.children().isEmpty()));
    if (effect.becomeInvestor()) {
      // 번아웃 등에서 전업투자자로 전향: 직업 선택의 INVEST와 같다 (decisions.md 35·83번). 위로금은 받고 나온다.
      long severance = salaryBefore * effect.severanceMonths();
      if (severance > 0) {
        assets.credit(gameId, SEVERANCE, severance, day);
        message.append(" 위로금 %,d원을 받았다.".formatted(severance));
      }
      characters.quitJob(gameId);
      characters.becomeFullTimeInvestor(gameId, day);
      if (game.phase() != Phase.INVESTING) {
        games.startInvesting(gameId, day);
      }
      logs.append(
          gameId,
          day,
          "JOB",
          Map.of(
              "jobCode",
              ChoiceTicket.Job.INVEST,
              "jobTitle",
              FULL_TIME_INVESTOR,
              "monthlySalary",
              0,
              "rehire",
              true,
              "fullTimeInvestor",
              true));
    } else if (effect.becomeJob() != null) {
      characters.foundCompany(gameId, effect.becomeJob(), day);
      JobDefinition founded = content.job(effect.becomeJob());
      message.append(
          " 이제 %s다. 월급 %,d원이 나온다.".formatted(founded.title(), founded.baseMonthlySalary()));
    } else if (effect.quit()) {
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
    // 전업투자자의 장면은 기록에서 '직장'이 아니라 '투자'로 보인다 (decisions.md 52번).
    payload.put("fullTimeInvestor", character.fullTimeInvestorDay() != null);
    payload.put("text", message.toString());
    payload.put("jobTitle", after.jobCode() == null ? null : content.job(after.jobCode()).title());
    payload.put(
        "monthlySalary",
        after.jobCode() == null
            ? 0
            : monthlySalary(
                content.job(after.jobCode()), tenureYears(after, day), after.salaryBonusBp()));
    // 일을 잃거나 실패하면 누군가의 위로가 붙는다 (decisions.md 85번).
    String comfort =
        effect.quit() || effect.becomeInvestor() || !success
            ? comforter
                .comfort(
                    gameId,
                    effect.quit() || effect.becomeInvestor()
                        ? Comforter.LAYOFF
                        : Comforter.CAREER_FAIL,
                    day,
                    ageAt(game, day),
                    random.forKey("comfort", ticket.seq()))
                .orElse(null)
            : null;
    if (comfort != null) {
      payload.put("comfort", comfort);
    }
    logs.append(gameId, day, CAREER_LOG, payload);
    return withComfort(simpleOutcome(ticket, message.toString(), growth), comfort);
  }

  // ---- 결혼·자녀 (경제 개편 설계 7.3절) ----

  private ChoiceOutcome.Outcome resolveLife(
      GameRow game, ChoiceTicket ticket, ChoiceTicket.Life life, SeededRandom random) {
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
      case CHILD -> {
        long cost = household.childbirthCost(day);
        // 아이마다 독립해 나갈 나이를 지금 굴린다 (decisions.md 68번).
        ProgressProperties.Range leave = properties.childLeaveAge();
        int leaveAge = random.forKey("life", "leave", day).nextInt(leave.min(), leave.max() + 1);
        // 성별도 태어날 때 굴린다 (decisions.md 69번).
        Sex sex = random.forKey("life", "sex", day).nextBoolean() ? Sex.F : Sex.M;
        int seq = household.addChild(gameId, day, leaveAge, sex);
        household.cheer(gameId, HAPPY_CHILD);
        household.bond(gameId, BOND_CHILD);
        assets.spend(gameId, LIFE_COST, cost, day, ticket.eventId());
        logs.append(gameId, day, "CHILD", Map.of("seq", seq, "cost", cost, "sex", sex.name()));
        yield simpleOutcome(
            ticket, "%s %s이 태어났다.".formatted(childName(seq), sex == Sex.F ? "딸" : "아들"));
      }
    };
  }

  /** 결혼 (decisions.md 77번): 카드에서 소개된 그 사람과 결혼한다. 배우자의 직업·소득·소개가 가계에 남고 소득은 배우자 소득이 된다. */
  private ChoiceOutcome.Outcome resolveMarriage(
      GameRow game, ChoiceTicket ticket, ChoiceTicket.Marriage marriage) {
    UUID gameId = game.id();
    int day = ticket.occursDay();
    events.complete(
        gameId,
        ticket.eventId(),
        new Completion(ticket.optionCode(), ticket.optionCode(), List.of()));
    if (!marriage.accepted()) {
      return simpleOutcome(ticket, "아직은 아니라고 했다.");
    }
    SpouseText.Profile who = content.spouseText().profile(marriage.spouseCode());
    long cost = household.weddingCost(day);
    household.marry(gameId, day, new Spouse(who.name(), who.job(), who.income(), who.intro()));
    household.cheer(gameId, HAPPY_MARRIAGE);
    household.bond(gameId, BOND_MARRIAGE);
    assets.spend(gameId, LIFE_COST, cost, day, ticket.eventId());
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("cost", cost);
    payload.put("name", who.name());
    payload.put("job", who.job());
    payload.put("intro", who.intro());
    logs.append(gameId, day, "MARRIAGE", payload);
    return simpleOutcome(
        ticket,
        "%s 결혼했다. 결혼 비용 %,d원이 들었다.".formatted(Korean.withParticle(who.name(), "과", "와"), cost));
  }

  /** 자녀 결혼 (decisions.md 68번): 그때 물가의 결혼 비용 가운데 고른 비율만큼 내 돈이 나간다. 안 대주면 한 푼도 나가지 않는다. */
  private ChoiceOutcome.Outcome resolveChildWedding(
      GameRow game, ChoiceTicket ticket, ChoiceTicket.ChildWedding wedding) {
    UUID gameId = game.id();
    int day = ticket.occursDay();
    events.complete(
        gameId,
        ticket.eventId(),
        new Completion(ticket.optionCode(), ticket.optionCode(), List.of()));
    long total = household.weddingCost(day);
    long cost = total * wedding.shareBp() / BP;
    if (cost > 0) {
      assets.spend(gameId, LIFE_COST, cost, day, ticket.eventId());
    }
    // 대줄수록 뿌듯하고, 안 대주면 마음이 쓰인다 (decisions.md 82번).
    household.cheer(gameId, wedding.shareBp() >= BP ? 8 : wedding.shareBp() > 0 ? 4 : -4);
    household.bond(gameId, wedding.shareBp() >= BP ? 8 : wedding.shareBp() > 0 ? 4 : -6);
    logs.append(
        gameId,
        day,
        "CHILD_WEDDING",
        Map.of("seq", wedding.seq(), "total", total, "cost", cost, "shareBp", wedding.shareBp()));
    // 감동적인 결과 문구 여러 벌 가운데 하나 (decisions.md 86번). 넉넉한데 안 대줬으면 따로.
    String child = childName(wedding.seq());
    HouseholdView home = household.get(gameId);
    Sex childSex =
        home.children().stream()
            .filter(c -> c.seq() == wedding.seq())
            .map(HouseholdView.Child::sex)
            .findFirst()
            .orElse(Sex.M);
    ChildWeddingText text = content.childWeddingText();
    List<String> pool =
        cost == 0
            ? (netWorth(gameId) >= total * RICH_WEDDING_MULTIPLE
                ? text.noneRichTexts()
                : text.noneTexts())
            : cost >= total ? text.fullTexts() : text.halfTexts();
    RandomGenerator rng = new HashSeededRandom(game.seed()).forKey("wedding-text", ticket.seq());
    String message =
        pool.get(rng.nextInt(pool.size()))
            .replace("{child}", child)
            .replace("{word}", childSex == Sex.F ? "딸" : "아들")
            .replace("{total}", "%,d원".formatted(total))
            .replace("{cost}", "%,d원".formatted(cost));
    return simpleOutcome(ticket, message);
  }

  private static final List<String> CHILD_NAMES = List.of("첫째", "둘째", "셋째", "넷째", "다섯째");

  /** 보통 가족 여행 비용(25세 기준, 물가가 붙는다). 순자산의 1%가 더 크면 그만큼 (옛 알림과 같은 셈법). */
  private static final long TRIP_BASE_COST = 2_500_000;

  /** 순자산이 결혼 비용의 이 배수를 넘는데 한 푼도 안 대주면 '넉넉한데도' 문구 (decisions.md 86번). */
  private static final long RICH_WEDDING_MULTIPLE = 10;

  /** 행복도 변화 (decisions.md 82번). 기쁨은 작게 자주, 슬픔은 조금 더 크게. */
  private static final int HAPPY_MARRIAGE = 15;

  /** 가족 점수 변화 (decisions.md 88번). */
  private static final int BOND_MARRIAGE = 10;

  private static final int BOND_CHILD = 5;

  private static final int HAPPY_CHILD = 10;
  private static final int HAPPY_CHILD_LEFT = 3;
  private static final int HAPPY_CAREER = 5;
  private static final int HAPPY_QUIT = 10;
  private static final int HAPPY_FRUGAL = 2;
  private static final int HAPPY_BIG_GAIN = 3;
  private static final int HAPPY_BIG_LOSS = 5;

  /** 한 번의 뉴스 손익이 순자산의 이 비율(만분율)을 넘으면 행복도가 움직인다. */
  private static final long BIG_MOVE_BP = 500;

  private static final long TRIP_ASSET_PERCENT = 1;

  /**
   * 가족 여행 (decisions.md 71번): 보통 비용 = max(물가 반영 250만, 순자산 1%). 초호화는 4배, 당일치기는 1/5, 안 가면 0. 기록은 옛
   * 알림과 같은 LIFE(`noticeCode` family-trip)라 토스트·수첩 사진이 그대로 따라온다.
   */
  private ChoiceOutcome.Outcome resolveFamilyTrip(
      GameRow game, ChoiceTicket ticket, ChoiceTicket.FamilyTrip trip) {
    UUID gameId = game.id();
    int day = ticket.occursDay();
    events.complete(
        gameId,
        ticket.eventId(),
        new Completion(ticket.optionCode(), ticket.optionCode(), List.of()));
    // 아이의 나들이는 그 나들이의 비용(물가만), 가족 여행은 max(물가 반영 250만, 순자산 1%) (decisions.md 71·87번).
    OutingText outing = trip.outing() == null ? null : content.outing(trip.outing());
    long normal =
        outing != null
            ? household.inflated(outing.cost(), day)
            : Math.max(
                household.inflated(TRIP_BASE_COST, day),
                netWorth(gameId) * TRIP_ASSET_PERCENT / PERCENT);
    long cost = normal * trip.costBp() / BP;
    if (cost > 0) {
      assets.spend(gameId, LIFE_COST, cost, day, ticket.eventId());
    }
    // 호화로울수록 기쁘고, 안 가면 조금 서운하다 (decisions.md 82번).
    household.cheer(
        gameId,
        switch (ticket.optionCode()) {
          case ChoiceTicket.FamilyTrip.LUXURY -> outing != null ? 10 : 15;
          case ChoiceTicket.FamilyTrip.NORMAL -> outing != null ? 8 : 10;
          case ChoiceTicket.FamilyTrip.CHEAP -> outing != null ? 4 : 5;
          default -> outing != null ? -4 : -5;
        });
    // 같이 가면 가족이 가까워지고, 거절하면 멀어진다 (decisions.md 88번).
    household.bond(
        gameId,
        switch (ticket.optionCode()) {
          case ChoiceTicket.FamilyTrip.LUXURY -> outing != null ? 6 : 8;
          case ChoiceTicket.FamilyTrip.NORMAL -> outing != null ? 5 : 6;
          case ChoiceTicket.FamilyTrip.CHEAP -> outing != null ? 2 : 3;
          default -> outing != null ? -4 : -5;
        });
    String who = tripProposerName(trip.proposer());
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("eventId", ticket.eventId().toString());
    payload.put("noticeCode", outing != null ? "kid-outing" : "family-trip");
    payload.put("title", outing != null ? outing.name() : "가족 여행");
    if (outing != null) {
      payload.put("outing", outing.code());
    }
    payload.put("amount", -cost);
    payload.put("option", ticket.optionCode());
    payload.put("proposer", who);
    logs.append(gameId, day, "LIFE", payload);
    String message =
        outing != null
            ? outingMessage(outing, ticket.optionCode(), who, cost)
            : switch (ticket.optionCode()) {
              case ChoiceTicket.FamilyTrip.LUXURY ->
                  "온 가족이 호화롭게 다녀왔다. %,d원이 들었다. 사진첩이 두꺼워졌다.".formatted(cost);
              case ChoiceTicket.FamilyTrip.NORMAL ->
                  "가족 여행을 다녀왔다. %,d원이 들었다. 돈이 아깝지 않았다.".formatted(cost);
              case ChoiceTicket.FamilyTrip.CHEAP ->
                  "가까운 바다에 당일치기로 다녀왔다. %,d원이 들었다. 그래도 다들 좋아했다.".formatted(cost);
              default -> "이번엔 가지 않기로 했다. %s의 얼굴이 조금 어두웠다.".formatted(who);
            };
    return simpleOutcome(ticket, message);
  }

  /** 나들이 결과 문구: 선택마다 콘텐츠 문구에 아이 이름을 채우고, 돈이 들었으면 금액을 붙인다 (decisions.md 87번). */
  private static String outingMessage(OutingText outing, String option, String child, long cost) {
    String text =
        switch (option) {
          case ChoiceTicket.FamilyTrip.LUXURY -> outing.luxuryText();
          case ChoiceTicket.FamilyTrip.NORMAL -> outing.normalText();
          case ChoiceTicket.FamilyTrip.CHEAP -> outing.cheapText();
          default -> outing.noneText();
        };
    String filled = text.replace("{child}", child);
    return cost > 0 ? filled + " (%,d원)".formatted(cost) : filled;
  }

  private static String tripProposerName(String proposer) {
    if (proposer.startsWith("child:")) {
      return childName(Integer.parseInt(proposer.substring("child:".length())));
    }
    return "parents".equals(proposer) ? "부모님" : "배우자";
  }

  private static String childName(int seq) {
    return seq >= 1 && seq <= CHILD_NAMES.size() ? CHILD_NAMES.get(seq - 1) : seq + "번째";
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
    // 운 (decisions.md 78번): 들고 있는 종목에 충격이 닿을 때, 운이 따르면 손실은 줄고 이득은 커진다.
    int luckFactor =
        behavior.luckFactorPercent(
            character.stats().luck(),
            ticket.truth(),
            random.forKey("behavior", "luck", ticket.seq()));
    AccountView afterTrade = assets.get(gameId);
    boolean exposed =
        content.stocksOf(ticket.sectorCode()).stream()
            .anyMatch(s -> afterTrade.holdings().containsKey(s.code()));
    boolean lucky = exposed && luckFactor != PERCENT;
    boolean softened = lucky && ticket.truth() == Direction.DOWN;
    boolean boosted = lucky && ticket.truth() == Direction.UP;
    int magnitude =
        lucky ? (int) (ticket.magnitudeBp() * luckFactor / PERCENT) : ticket.magnitudeBp();
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
    // 순자산의 5%를 넘는 손익은 기분에 남는다 (decisions.md 82번).
    long worth = netWorth(gameId);
    if (worth > 0 && Math.abs(pnl) * BP / worth >= BIG_MOVE_BP) {
      household.cheer(gameId, pnl > 0 ? HAPPY_BIG_GAIN : -HAPPY_BIG_LOSS);
    }
    // 큰 손실 뒤에는 누군가의 위로가 붙는다 (decisions.md 85번).
    String comfort =
        worth > 0 && pnl < 0 && Math.abs(pnl) * BP / worth >= BIG_MOVE_BP
            ? comforter
                .comfort(
                    gameId,
                    Comforter.BIG_LOSS,
                    ticket.occursDay(),
                    ageAt(game, ticket.occursDay()),
                    random.forKey("comfort", ticket.seq()))
                .orElse(null)
            : null;
    // 결과 뒤 안목 한마디 (decisions.md 73번): 뉴스에서만, 내 행동이 결과와 맞았는지(good)와 안목 구간으로 고른다.
    String review =
        ticket.kind() == EventKind.NEWS
            ? pick(
                content.reviewPhrases(
                    Hint.Detail.of(character.stats().insight()).key(),
                    reviewGood(resolution.actual(), ticket.truth(), holding)),
                random.forKey("behavior", "review", ticket.seq()))
            : null;

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
    logs.append(gameId, ticket.occursDay(), ticket.kind().name(), newsPayload);
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
    pricePayload.put("luckBoosted", boosted);
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
            softened,
            boosted),
        growthViews,
        null,
        review,
        comfort);
  }

  // ---- 자유 매매 (경제 개편 설계 8절) ----

  @Override
  @Transactional
  public GameView listHome(UUID sessionId, UUID gameId, int seq, boolean listed) {
    GameRow game = lock(sessionId, gameId);
    if (events.pending(gameId).isPresent()) {
      throw new InvalidRequestException("먼저 선택을 해야 한다");
    }
    housingFlow.setListed(gameId, seq, listed, game.lastReportedDay());
    return view(game);
  }

  @Override
  @Transactional
  public GameView repayMortgage(UUID sessionId, UUID gameId, int seq, long amount) {
    GameRow game = lock(sessionId, gameId);
    if (events.pending(gameId).isPresent()) {
      throw new InvalidRequestException("먼저 선택을 해야 한다");
    }
    housingFlow.repay(gameId, seq, amount, game.lastReportedDay());
    return view(game);
  }

  @Override
  @Transactional
  public ChoiceOutcome trade(
      UUID sessionId, UUID gameId, String stockCode, Action side, long quantity) {
    // 대기 중인 선택이 있어도 막지 않는다. 매매창을 연 순간 도착한 이벤트는 창을 닫은 뒤에 처리한다 (매매창 설계 2절).
    GameRow game = lock(sessionId, gameId);
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
    long price = market.prices(gameId).get(stockCode);
    // 매매창의 자유 매매는 성향 판정 없이 고른 대로 체결한다 (decisions.md 81번). 성향에 뒤집히는 것은 이벤트 선택뿐이다.
    ChoiceOutcome.Trade trade =
        side == Action.BUY
            ? tradeView(assets.buy(gameId, stockCode, quantity, price, day, null))
            : tradeView(assets.sell(gameId, stockCode, quantity, price, day, null));

    Map<String, Object> payload = new HashMap<>();
    payload.put("stockCode", stockCode);
    payload.put("stockName", stock.name());
    payload.put("side", side.name());
    payload.put("chosen", side.name());
    payload.put("actual", side.name());
    payload.put("deviations", List.of());
    payload.put("status", trade.status());
    payload.put("quantity", trade.quantity());
    payload.put("price", trade.price());
    payload.put("amount", trade.amount());
    payload.put("realizedPnl", trade.realizedPnl());
    logs.append(gameId, day, TRADE_LOG, payload);

    return new ChoiceOutcome(
        view(games.findLatest(sessionId).orElseThrow()),
        new ChoiceOutcome.Outcome(
            TRADE_LOG,
            side.name(),
            side.name(),
            List.of(),
            trade,
            null,
            List.of(),
            null,
            null,
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

  @Override
  @Transactional
  public MarketOverview overview(UUID sessionId, UUID gameId) {
    GameRow game = latest(sessionId, gameId);
    return desk.overview(game.id(), new HashSeededRandom(game.seed()));
  }

  @Override
  @Transactional
  public StockAnalysis analysis(UUID sessionId, UUID gameId, String stockCode) {
    GameRow game = latest(sessionId, gameId);
    return desk.analysis(game.id(), requireStock(stockCode), new HashSeededRandom(game.seed()));
  }

  /** 끝난 판도 읽을 수 있는 조회용. 잠그지 않는다. */
  private GameRow latest(UUID sessionId, UUID gameId) {
    return games
        .findLatest(sessionId)
        .filter(g -> g.id().equals(gameId))
        .orElseThrow(() -> new NotFoundException("판이 없다"));
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

  /**
   * 빚투 (decisions.md 39번). 고르면 총자산의 leverage-loan-bp만큼 대출받아 그 종목을 산다. 판정은 없다: 바닥이었는지는 그 뒤 시장이 정한다.
   * 빚에는 다달이 이자가 붙고 수입이 들어오면 먼저 갚는다.
   */
  /**
   * 빚투 (decisions.md 39번). 빌릴 수 있는 최대는 순자산의 절반이고, 사용자가 수량(requested)을 정하면 그만큼만 빌려 산다. 최대를 넘으면 최대로
   * 자른다. 수량이 없으면 최대로 (54번).
   */
  private ChoiceOutcome.Outcome resolveLeverage(
      GameRow game, ChoiceTicket ticket, ChoiceTicket.Leverage leverage, Long requested) {
    UUID gameId = game.id();
    String option = ticket.optionCode();
    events.complete(gameId, ticket.eventId(), new Completion(option, option, List.of()));
    String stockName = content.stock(ticket.stockCode()).name();
    Map<String, Long> prices = market.prices(gameId);
    long price = prices.get(ticket.stockCode());
    long maxLoan =
        leverage.borrow() ? Math.max(0, netWorth(gameId)) * properties.leverageLoanBp() / BP : 0;
    long quantity = requested == null ? maxLoan / price : Math.min(requested, maxLoan / price);
    ChoiceOutcome.Trade trade = null;
    String message;
    if (quantity > 0) {
      assets.borrow(gameId, quantity * price, ticket.occursDay(), ticket.eventId());
      trade =
          tradeView(
              assets.buy(
                  gameId,
                  ticket.stockCode(),
                  quantity,
                  price,
                  ticket.occursDay(),
                  ticket.eventId()));
      message =
          "%s원을 빌려 %s %,d주를 더 샀다. 매달 이자가 붙는다. 바닥이었는지는 아무도 모른다."
              .formatted(String.format("%,d", quantity * price), stockName, quantity);
    } else if (leverage.borrow()) {
      message = "빌릴 수 있는 돈으로는 한 주도 살 수 없었다.";
    } else {
      message = "빚은 지지 않기로 했다.";
    }
    logs.append(
        gameId,
        ticket.occursDay(),
        "LEVERAGE",
        Map.of(
            "stockCode",
            ticket.stockCode(),
            "stockName",
            stockName,
            "dropBp",
            ticket.magnitudeBp(),
            "borrowed",
            quantity > 0,
            "loan",
            quantity * price,
            "quantity",
            quantity));
    return new ChoiceOutcome.Outcome(
        ticket.kind().name(),
        option,
        option,
        List.of(),
        trade,
        null,
        List.of(),
        message,
        null,
        null);
  }

  private static TraitDefinition.Outcome weightedOutcome(
      List<TraitDefinition.Outcome> outcomes, RandomGenerator rng) {
    int roll = rng.nextInt(outcomes.stream().mapToInt(TraitDefinition.Outcome::weight).sum());
    for (TraitDefinition.Outcome outcome : outcomes) {
      roll -= outcome.weight();
      if (roll < 0) {
        return outcome;
      }
    }
    return outcomes.getLast();
  }

  /** 내 행동이 결과와 맞았는가: 샀는데 올랐다, 팔았는데 내렸다, 들고 버텼는데 올랐다, 없이 지켜봤는데 내렸다. */
  static boolean reviewGood(Action actual, Direction truth, boolean holding) {
    return switch (actual) {
      case BUY -> truth == Direction.UP;
      case SELL -> truth == Direction.DOWN;
      case HOLD -> holding ? truth == Direction.UP : truth == Direction.DOWN;
    };
  }

  private static String pick(List<String> phrases, RandomGenerator rng) {
    return phrases.isEmpty() ? null : phrases.get(rng.nextInt(phrases.size()));
  }

  private static ChoiceOutcome.Outcome withComfort(ChoiceOutcome.Outcome outcome, String comfort) {
    return new ChoiceOutcome.Outcome(
        outcome.kind(),
        outcome.chosen(),
        outcome.actual(),
        outcome.deviations(),
        outcome.trade(),
        outcome.price(),
        outcome.growth(),
        outcome.message(),
        outcome.review(),
        comfort);
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
        message,
        null,
        null);
  }

  // ---- 시간 흐름: 매월 1일 (경제 개편 설계 9절) ----

  /**
   * (fromExclusive, toInclusive] 안의 매월 1일마다: 시장 → 월급·배우자 소득(은퇴 달이면 퇴직금, 그 뒤 달은 연금) → 생활비 → 이자 → 월말
   * 총자산(연 경계면 연간 자산). 생활비는 직업이 생긴 뒤부터 나간다. 정산 뒤 총자산이 0 아래면 그 달에 파산이다: 그 날을 돌려주고 멈춘다 (decisions.md
   * 27번).
   */
  private OptionalInt processMonths(GameRow game, int fromExclusive, int toInclusive) {
    UUID gameId = game.id();
    int month = calendar.daysPerMonth();
    SeededRandom random = new HashSeededRandom(game.seed());
    CharacterView character = characters.get(gameId);
    JobDefinition job = character.jobCode() == null ? null : content.job(character.jobCode());
    MarketCycle cycle = market.cycle(random);

    Map<Integer, AnalysisText.Article> articles = articles(game, random);

    for (int m = fromExclusive / month + 1; m * month <= toInclusive; m++) {
      int day = m * month;
      market.advanceTo(gameId, day, random);
      recordCycle(game, cycle, m, day);
      if (articles.containsKey(m)) {
        logs.append(
            gameId,
            day,
            "ARTICLE",
            Map.of("text", articles.get(m).text(), "sentiment", articles.get(m).sentiment()));
      }
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
        // 정년이 없는 직업(직접 세운 회사·농부)은 60세에도 은퇴하지 않고 월급을 계속 받는다. 연금은 나이로 나온다 (decisions.md 57번).
        boolean retires = job == null || job.retires();
        if (!retired && retires && household.retireMonth(day)) {
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
        long pension = household.pension(gameId, day);
        if (pension > 0) {
          assets.credit(gameId, PENSION, pension, day);
        }
        long spouse = household.spouseIncome(gameId, day);
        if (spouse > 0) {
          assets.credit(gameId, SPOUSE_INCOME, spouse, day);
        }
        assets.spend(gameId, EXPENSE, household.monthlyExpense(gameId, day), day, null);
        // 행복도는 달마다 50 쪽으로 돌아오고, 긴축(현금 < 생활비 또는 빚)이면 조금씩 지친다 (decisions.md 82번).
        household.driftHappiness(gameId);
        AccountView settled = assets.get(gameId);
        if (settled.debt() > 0 || settled.cash() < household.monthlyExpense(gameId, day)) {
          household.cheer(gameId, -HAPPY_FRUGAL);
        }
        // 이달에 독립해 나간 아이를 기록한다. 양육비는 이달부터 들지 않는다 (decisions.md 68번).
        for (HouseholdView.Child child : home.children()) {
          if (child.leaveDay() > day - month && child.leaveDay() <= day) {
            household.cheer(gameId, HAPPY_CHILD_LEFT);
            logs.append(
                gameId,
                day,
                "CHILD_LEFT",
                Map.of(
                    "seq", child.seq(),
                    "childAge", (day - child.birthDay()) / calendar.daysPerYear(),
                    "expense", household.monthlyExpense(gameId, day)));
          }
        }
      }
      // 월세·주담대 원리금·전세대출 이자, 갭투자 세입자 갱신, 매물 매수자 (주거 설계).
      housingFlow.month(gameId, m, day, random);
      assets.accrueInterest(gameId, day);
      long total = netWorth(gameId);
      logs.upsertMonth(gameId, m, total);
      if (day % calendar.daysPerYear() == 0) {
        logs.upsertYear(
            gameId,
            game.startAge() - 1 + day / calendar.daysPerYear(),
            total,
            assets.get(gameId).cash());
      }
      if (total < 0) {
        return OptionalInt.of(day);
      }
    }
    return OptionalInt.empty();
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

  /**
   * 경기 흐름을 기록한다 (decisions.md 38번). 전조는 그 달에 흘러나온 대로 남기지만 무엇의 전조인지는 말하지 않는다. 위기는 회복까지 끝난 달에야 "돌아보니
   * 그때가 대공황(불황)이었다"고 남긴다. 조정과 아무 일 없이 지나간 시기는 돌아볼 거리가 없어 남기지 않는다.
   */
  private void recordCycle(GameRow game, MarketCycle cycle, int month, int day) {
    UUID gameId = game.id();
    for (MarketCycle.Omen omen : cycle.omens()) {
      if (omen.month() == month) {
        logs.append(gameId, day, "OMEN", Map.of("text", omen.text()));
      }
    }
    int perMonth = calendar.daysPerMonth();
    for (MarketCycle.Crisis crisis : cycle.crises()) {
      if (crisis.severity() == MarketCycle.Severity.CORRECTION || crisis.revealMonth() != month) {
        continue;
      }
      CrisisDefinition definition =
          content.crises().stream()
              .filter(c -> c.code().equals(crisis.crisisCode()))
              .findFirst()
              .orElseThrow();
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("name", definition.name());
      payload.put("model", definition.model());
      payload.put("severity", crisis.severity().name());
      payload.put("startAge", ageAt(game, crisis.startMonth() * perMonth));
      payload.put("bottomAge", ageAt(game, crisis.bottomMonth() * perMonth));
      payload.put("endAge", ageAt(game, day));
      payload.put(
          "dropBp", market.averageDropBp(gameId, crisis.startMonth() - 1, crisis.revealMonth()));
      payload.put("omens", crisis.omens());
      logs.append(gameId, day, "CRISIS", payload);
    }
  }

  /**
   * 평범한 경제 기사가 나오는 달과 문구 (매매창 설계 3.3절). ("progress","articles") 키에서 간격과 문구를 차례로 뽑아 같은 판은 언제나 같다.
   * 최근에 나온 기사는 다시 뽑지 않는다.
   */
  private Map<Integer, AnalysisText.Article> articles(GameRow game, SeededRandom random) {
    List<AnalysisText.Article> pool = content.analysis().articles();
    RandomGenerator rng = random.forKey("progress", "articles");
    ProgressProperties.Range gap = properties.articleGapMonths();
    int lastMonth = endDay(game) / calendar.daysPerMonth();
    Map<Integer, AnalysisText.Article> articles = new HashMap<>();
    List<Integer> recent = new ArrayList<>();
    int month = properties.articleFirstMonth();
    while (true) {
      month += gap.min() + rng.nextInt(gap.max() - gap.min() + 1);
      if (month > lastMonth) {
        return articles;
      }
      int index = rng.nextInt(pool.size());
      while (recent.contains(index)) {
        index = (index + 1) % pool.size();
      }
      recent.add(index);
      if (recent.size() > ARTICLE_NO_REPEAT) {
        recent.removeFirst();
      }
      articles.put(month, pool.get(index));
    }
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
    // 빚투 제안에는 그 종목의 안목 해석을 힌트로 붙인다. 지금(쓰기 트랜잭션) 이 달의 해석을 정해 두면 조회는 읽기만 한다 (decisions.md 53번).
    result
        .pending()
        .filter(e -> e.kind() == EventKind.LEVERAGE && e.stockCode() != null)
        .ifPresent(e -> desk.analysis(game.id(), content.stock(e.stockCode()), random));
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
    if (notice.assetPercent() > 0) {
      long scaled = netWorth(gameId) * notice.assetPercent() / PERCENT;
      amount = -Math.max(-amount, scaled);
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
    end(game, Ending.NORMAL);
  }

  /** 판을 끝내고 결과를 남긴다. 파산이면 finalAge는 파산한 나이이고 연간 자산의 마지막 줄도 그 나이에 남아 곡선이 바닥에서 끝난다. */
  private void end(GameRow game, Ending ending) {
    int finalAge = ageAt(game, game.lastReportedDay());
    OffsetDateTime endedAt = games.now();
    games.end(game.id(), endedAt);
    AccountView account = assets.get(game.id());
    long finalAsset = netWorth(game.id());
    results.save(
        new GameResult(
            game.id(),
            game.sessionId(),
            game.contentVersion(),
            account.initialCash(),
            finalAsset,
            finalAge,
            ending,
            characters.get(game.id()).stats(),
            deviationCounts(game.id()),
            game.createdAt(),
            endedAt));
    // 종료일에 알림 비용이 겹치면 연 경계에서 먼저 쓴 값이 최종 자산과 어긋나므로 덮어쓴다.
    logs.replaceYear(game.id(), finalAge, finalAsset, account.cash());
    logs.append(
        game.id(),
        game.lastReportedDay(),
        "END",
        Map.of(
            "finalAge", finalAge,
            "ending", ending.name(),
            "debt", account.debt(),
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
        home.children().size(),
        home.children().stream().map(HouseholdView.Child::leaveDay).toList(),
        assets.get(game.id()).holdings().keySet().stream().sorted().toList(),
        character.fullTimeInvestorDay() != null,
        heldDropBp(game.id()),
        housingFlow.facts(
            game.id(),
            home,
            character.stats().luck(),
            monthlyIncome(character, game.lastReportedDay()),
            cheongyakPoints(game, character, game.lastReportedDay()),
            game.lastReportedDay()),
        netWorth(game.id()),
        unaffordableStocks(game.id()));
  }

  /** 현재가가 현금보다 비싸 한 주도 못 사는 종목 (decisions.md 59번). */
  private Set<String> unaffordableStocks(UUID gameId) {
    long cash = assets.get(gameId).cash();
    return market.prices(gameId).entrySet().stream()
        .filter(e -> e.getValue() > cash)
        .map(Map.Entry::getKey)
        .collect(Collectors.toSet());
  }

  /** 보유 종목별 최근 12달 고점 대비 낙폭(만분율). 빚투 제안의 근거다 (decisions.md 39번). */
  private Map<String, Integer> heldDropBp(UUID gameId) {
    Set<String> held = assets.get(gameId).holdings().keySet();
    Map<String, Integer> drops = new HashMap<>();
    for (Quote quote : market.quotes(gameId)) {
      if (!held.contains(quote.stockCode())) {
        continue;
      }
      long high = quote.last12().stream().mapToLong(Long::longValue).max().orElse(quote.price());
      drops.put(quote.stockCode(), high <= 0 ? 0 : (int) ((high - quote.price()) * BP / high));
    }
    return drops;
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
        sexOf(game),
        household.happiness(game.id()),
        household.familyScore(game.id()),
        character.stats(),
        character.initialStats(),
        account.cash(),
        account.cash() + invested - account.debt() + housingFlow.equity(gameId),
        account.initialCash(),
        invested,
        account.debt(),
        logs.findMonthTotal(gameId, month - 1).stream().boxed().findFirst().orElse(null),
        holdings,
        job(character, game.lastReportedDay()),
        character.fullTimeInvestorDay() != null,
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
        housingFlow.view(gameId, game.startAge()),
        pending.map(e -> pendingView(game, character, e, quoteByCode)).orElse(null),
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

  /** 내 성별은 고르지 않고 판 시드로 정한다 (poc.md: 성별·부모는 고르지 않음, decisions.md 69번). */
  private static Sex sexOf(GameRow game) {
    return new HashSeededRandom(game.seed()).forKey("progress", "sex").nextBoolean()
        ? Sex.F
        : Sex.M;
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
        home.children().stream()
            .map(
                child ->
                    new GameView.Child(
                        (day - child.birthDay()) / calendar.daysPerYear(),
                        child.leftBy(day),
                        child.sex()))
            .toList(),
        income,
        household.spouseIncome(game.id(), day),
        independent ? household.monthlyExpense(game.id(), day) : 0,
        retired,
        household.pension(game.id(), day),
        home.spouse() == null
            ? null
            : new GameView.Spouse(
                home.spouse().name(), home.spouse().job(), home.spouse().intro()));
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

  private GameView.PendingEvent pendingView(
      GameRow game, CharacterView character, EventView event, Map<String, Quote> quotes) {
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
        event.kind() == EventKind.LEVERAGE && event.stockCode() != null
            ? desk.storedAnalysisText(game.id(), event.stockCode()).orElse(null)
            : event.hintText(),
        event.swayText(),
        options(game, character, event));
  }

  /** 주거 선택지에는 드는 돈과 고를 수 없는 이유를 붙인다. 전세사기는 고른 뒤에야 드러나므로 여기서는 모른 채 계산한다. */
  private List<GameView.Option> options(GameRow game, CharacterView character, EventView event) {
    if (event.kind() != EventKind.HOUSING) {
      return event.options().stream()
          .map(o -> new GameView.Option(o.code(), o.label(), null, null))
          .toList();
    }
    List<HousingFlow.Plan> plans =
        housingFlow.plans(
            game.id(),
            event.options().stream().map(EventView.Option::code).toList(),
            false,
            household.get(game.id()),
            monthlyIncome(character, event.occursDay()),
            cheongyakPoints(game, character, event.occursDay()),
            event.occursDay());
    List<GameView.Option> options = new ArrayList<>();
    for (int i = 0; i < plans.size(); i++) {
      EventView.Option option = event.options().get(i);
      options.add(
          new GameView.Option(
              option.code(), option.label(), plans.get(i).detail(), plans.get(i).blocked()));
    }
    return options;
  }

  private int cheongyakPoints(GameRow game, CharacterView character, int day) {
    return HousingFlow.cheongyakPoints(
        game.startAge(),
        character.careerStartDay(),
        household.get(game.id()),
        day,
        calendar.daysPerYear());
  }

  /** 대출 심사(DSR)에 쓰는 월 소득: 월급(은퇴 전) + 배우자 소득. */
  private long monthlyIncome(CharacterView character, int day) {
    UUID gameId = character.gameId();
    boolean retired = household.get(gameId).retiredDay() != null;
    long salary =
        character.jobCode() == null || retired
            ? 0
            : monthlySalary(
                content.job(character.jobCode()),
                tenureYears(character, day),
                character.salaryBonusBp());
    return salary + household.spouseIncome(gameId, day);
  }

  /** 총자산: 현금 + 주식 평가액 − 빚 + 집 시세 + 보증금 − 주담대 − 전세대출 − 세입자 보증금. 파산은 이 값으로 가린다. */
  private long netWorth(UUID gameId) {
    return assets.totalAsset(gameId, market.prices(gameId)) + housingFlow.equity(gameId);
  }

  private static GameView.Result resultView(GameResult result) {
    long initial = result.initialAsset();
    return new GameView.Result(
        initial,
        result.finalAsset(),
        returnBp(initial, result.finalAsset()),
        result.finalAge(),
        result.ending(),
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
