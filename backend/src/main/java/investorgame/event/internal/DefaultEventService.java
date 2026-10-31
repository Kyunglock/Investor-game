package investorgame.event.internal;

import investorgame.common.Direction;
import investorgame.common.GameProperties;
import investorgame.common.Hint;
import investorgame.common.Phase;
import investorgame.common.Sentiment;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.common.random.SeededRandom;
import investorgame.content.CareerDefinition;
import investorgame.content.ContentCatalog;
import investorgame.content.JobDefinition;
import investorgame.content.NewsDefinition;
import investorgame.content.NoticeDefinition;
import investorgame.content.OutingText;
import investorgame.content.ShakeDefinition;
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
import investorgame.event.HousingFacts;
import investorgame.event.ScheduleResult;
import investorgame.event.SchedulingContext;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.Set;
import java.util.UUID;
import java.util.function.ToIntFunction;
import java.util.random.RandomGenerator;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 발생 시점은 "종류별 마지막 발생 + 간격"으로 정한다. 간격과 숨은 값은 판 시드에서 키별로 유도하므로, 같은 상태에서 다시 불러도 같은 이벤트가 같은 날에 나온다
 * (specs/event.md 5.1·5.7절).
 */
@Service
class DefaultEventService implements EventService {

  static final String ACCEPT = "accept";
  static final String DECLINE = "decline";

  /** 결혼 제안의 정의 코드: "marriage:" + 배우자 조합 코드 (decisions.md 77번). 거절하면 2년 뒤 다른 사람이 온다. */
  static final String MARRIAGE = "marriage";

  static final String MARRIAGE_PREFIX = MARRIAGE + ":";
  static final String CHILD = "child";

  /** 자녀 결혼 선택의 정의 코드: "wedding:" + 자녀 순번 (decisions.md 68번). */
  static final String WEDDING_PREFIX = "wedding:";

  /** 가족 여행 제안의 정의 코드: "trip:" + 제안한 사람(spouse·parents·child:n) (decisions.md 71번). */
  static final String TRIP_PREFIX = "trip:";

  /** 아이의 나들이 정의 코드: "outing:" + 코드 + ":" + 아이 순번 (decisions.md 87번). */
  static final String OUTING_PREFIX = "outing:";

  /** 직업 선택 행의 definition_code: null이면 첫 선택, RETRY는 기다린 뒤, REHIRE는 실직 뒤. 문구가 달라진다. */
  static final String JOB_RETRY = "retry";

  static final String JOB_REHIRE = "rehire";

  /** 투자 시작 제안의 정의 코드: 첫 월급 날의 첫 제안 / 1년 뒤 다시 (decisions.md 117번). 옛 판은 null이라 첫 제안으로 본다. */
  static final String OFFER_FIRST = "first";

  static final String OFFER_AGAIN = "again";

  /** 이직 제안의 선택지 코드는 "move:<직업 코드>"다. 옮길 직업을 행에 같이 남긴다. */
  static final String MOVE_PREFIX = "move:";

  private static final List<String> NEWS_OPTIONS = List.of("BUY", "SELL", "HOLD");

  /** 흔들림: 버틴다(HOLD)·판다(SELL). 문구는 렌더러가 붙인다 (decisions.md 33번). */
  private static final List<String> SHAKE_OPTIONS = List.of("HOLD", "SELL");

  private static final String FRAUD = "FRAUD";

  /** 은퇴한 뒤의 배우자 월세 불만 문구 키(life.json spouseRent.jobLines). */
  static final String SPOUSE_RETIRED = "retired";

  private static final int BP = 10_000;
  private static final int PERCENT = 100;

  private final EventRepository repository;
  private final EventRenderer renderer;
  private final ContentCatalog content;
  private final EventProperties properties;
  private final GameProperties calendar;

  DefaultEventService(
      EventRepository repository,
      EventRenderer renderer,
      ContentCatalog content,
      EventProperties properties,
      GameProperties calendar) {
    this.repository = repository;
    this.renderer = renderer;
    this.content = content;
    this.properties = properties;
    this.calendar = calendar;
  }

  @Override
  @Transactional
  public ScheduleResult schedule(
      UUID gameId,
      SchedulingContext context,
      int fromDay,
      int toDay,
      SeededRandom random,
      HintProvider hints) {
    List<EventRow> rows = repository.findAll(gameId);
    Optional<Candidate> next = nextCandidate(rows, context, fromDay, random);
    if (next.isEmpty() || next.get().day() > toDay) {
      return new ScheduleResult(Optional.empty(), Optional.empty(), dayOf(next));
    }
    EventRow created = create(rows, next.get(), context, random, hints);
    repository.insert(gameId, created);
    if (created.kind() == EventKind.NOTICE) {
      // 알림은 선택이 없어 만들어지는 순간 해결된다. 판은 멈추지 않는다 (경제 개편 설계 7.3절).
      return new ScheduleResult(
          Optional.empty(), Optional.of(renderer.notice(created)), OptionalInt.empty());
    }
    return new ScheduleResult(
        Optional.of(renderer.render(created)), Optional.empty(), OptionalInt.empty());
  }

  @Override
  @Transactional(readOnly = true)
  public OptionalInt peekNextEventDay(
      UUID gameId, SchedulingContext context, int fromDay, SeededRandom random) {
    return dayOf(nextCandidate(repository.findAll(gameId), context, fromDay, random));
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<EventView> pending(UUID gameId) {
    return repository.findAll(gameId).stream()
        .filter(EventRow::pending)
        .findFirst()
        .map(renderer::render);
  }

  @Override
  @Transactional(readOnly = true)
  public ChoiceTicket prepareChoice(UUID gameId, UUID eventId, String optionCode) {
    EventRow row =
        repository.find(gameId, eventId).orElseThrow(() -> new NotFoundException("이벤트가 없다"));
    if (!row.pending()) {
      throw new InvalidRequestException("이미 해결된 이벤트다");
    }
    if (!row.options().contains(optionCode)) {
      throw new InvalidRequestException("이 이벤트에 없는 선택지다");
    }
    ChoiceTicket.Effect effect =
        switch (row.kind()) {
          case JOB -> new ChoiceTicket.Job(optionCode);
          case CAREER -> {
            CareerDefinition career = content.career(row.definitionCode());
            String code = optionCode.startsWith(MOVE_PREFIX) ? "move" : optionCode;
            CareerDefinition.Option chosen =
                career.options().stream()
                    .filter(o -> o.code().equals(code))
                    .findFirst()
                    .orElseThrow();
            String target =
                optionCode.startsWith(MOVE_PREFIX)
                    ? optionCode.substring(MOVE_PREFIX.length())
                    : null;
            yield new ChoiceTicket.Career(chosen, target);
          }
          case TRAIT -> {
            TraitDefinition definition = renderer.trait(row.definitionCode());
            TraitDefinition.Option chosen =
                definition.options().stream()
                    .filter(o -> o.code().equals(optionCode))
                    .findFirst()
                    .orElseThrow();
            yield new ChoiceTicket.Trait(
                chosen.traitDeltas(),
                chosen.statDeltas(),
                chosen.note(),
                chosen.amount(),
                chosen.outcomes(),
                definition.adult(),
                chosen.familyDelta());
          }
          case OFFER -> new ChoiceTicket.Offer(ACCEPT.equals(optionCode));
          case LIFE ->
              row.definitionCode().startsWith(WEDDING_PREFIX)
                  ? new ChoiceTicket.ChildWedding(
                      weddingSeq(row.definitionCode()), weddingShareBp(optionCode))
                  : row.definitionCode().startsWith(TRIP_PREFIX)
                      ? new ChoiceTicket.FamilyTrip(
                          tripProposer(row.definitionCode()), tripCostBp(optionCode), null)
                      : row.definitionCode().startsWith(OUTING_PREFIX)
                          ? new ChoiceTicket.FamilyTrip(
                              "child:" + outingChild(row.definitionCode()),
                              tripCostBp(optionCode),
                              outingCode(row.definitionCode()))
                          : row.definitionCode().startsWith(MARRIAGE_PREFIX)
                              ? new ChoiceTicket.Marriage(
                                  spouseCode(row.definitionCode()), ACCEPT.equals(optionCode))
                              : new ChoiceTicket.Life(
                                  ChoiceTicket.LifeKind.CHILD, ACCEPT.equals(optionCode));
          case NEWS -> new ChoiceTicket.News(hintDirection(row.hintCode()));
          case SHAKE -> new ChoiceTicket.Shake();
          case LEVERAGE ->
              new ChoiceTicket.Leverage(ChoiceTicket.Leverage.BORROW.equals(optionCode));
          case HOUSING ->
              new ChoiceTicket.Housing(row.definitionCode(), FRAUD.equals(row.hiddenDirection()));
          case NOTICE -> throw new InvalidRequestException("알림은 선택할 수 없다");
        };
    return new ChoiceTicket(
        row.id(),
        row.kind(),
        optionCode,
        row.seq(),
        row.occursDay(),
        row.sectorCode(),
        row.stockCode(),
        row.sectorWide(),
        // 주거 이벤트의 숨은 값은 주가 방향이 아니라 전세사기 표시다(effect에 담았다).
        row.hiddenDirection() == null || row.kind() == EventKind.HOUSING
            ? null
            : Direction.valueOf(row.hiddenDirection()),
        row.hiddenMagnitudeBp() == null ? 0 : row.hiddenMagnitudeBp(),
        row.swaySentiment() == null ? null : Sentiment.valueOf(row.swaySentiment()),
        effect);
  }

  /** 힌트 코드("UP.STRONG.high.0")의 앞 조각이 방향이다. 옛 판이나 모르는 형식이면 null. */
  private static Hint.HintDirection hintDirection(String hintCode) {
    if (hintCode == null || hintCode.isEmpty()) {
      return null;
    }
    try {
      return Hint.HintDirection.valueOf(hintCode.split("\\.", 2)[0]);
    } catch (IllegalArgumentException e) {
      return null;
    }
  }

  @Override
  @Transactional
  public CompleteResult complete(UUID gameId, UUID eventId, Completion completion) {
    EventRow row =
        repository.find(gameId, eventId).orElseThrow(() -> new NotFoundException("이벤트가 없다"));
    repository.resolve(
        gameId,
        eventId,
        completion.chosenOption(),
        completion.actualOption(),
        completion.deviations());
    // 취업 뒤 일상 장면(adult)은 성향 확정에 세지 않는다.
    boolean traitsComplete =
        row.kind() == EventKind.TRAIT
            && !isAdultTrait(row)
            && repository.findAll(gameId).stream()
                    .filter(r -> r.kind() == EventKind.TRAIT && r.resolved() && !isAdultTrait(r))
                    .count()
                >= content.traitStages().size();
    return new CompleteResult(traitsComplete);
  }

  @Override
  @Transactional(readOnly = true)
  public Map<String, Integer> deviationCounts(UUID gameId) {
    return repository.deviationCounts(gameId);
  }

  // ---- 발생 시점 (specs/event.md 5.2절) ----

  private Optional<Candidate> nextCandidate(
      List<EventRow> rows, SchedulingContext context, int fromDay, SeededRandom random) {
    if (rows.stream().anyMatch(EventRow::pending)) {
      return Optional.empty();
    }
    List<Candidate> candidates = new ArrayList<>();
    if (context.phase() == Phase.CHILDHOOD) {
      childhoodCandidates(rows, context, candidates);
    } else if (context.phase() == Phase.SAVING) {
      savingCandidates(rows, context, candidates);
    } else if (context.phase() == Phase.INVESTING && context.investingStartDay() != null) {
      // 살 돈도 없고 든 것도 없으면 뉴스에서 고를 게 관망뿐이라 띄우지 않는다. 돈이 생기면 다음 틱에 바로 온다 (decisions.md 59번).
      Optional<Integer> newsDay = Optional.empty();
      if (content.stocks().stream().anyMatch(st -> context.tradable(st.code()))) {
        List<EventRow> news = ofKind(rows, EventKind.NEWS);
        int base = news.isEmpty() ? context.investingStartDay() : last(news).occursDay();
        newsDay = nextNewsDay(base, context, random);
        newsDay.ifPresent(day -> candidates.add(new Candidate(EventKind.NEWS, day)));
      }
      shakeCandidate(rows, context, random, newsDay, candidates);
      leverageCandidate(rows, context, candidates);
    }
    if (context.phase() != Phase.CHILDHOOD && context.careerStartDay() != null) {
      adultTraitCandidate(rows, context, random, candidates);
      lifeCandidates(rows, context, random, candidates);
      noticeCandidate(rows, context, random, candidates);
      careerCandidates(rows, context, random, candidates);
      housingCandidates(rows, context, candidates);
    }
    return candidates.stream()
        .min(Comparator.comparingInt(Candidate::day).thenComparing(Candidate::kind))
        .map(c -> new Candidate(c.kind(), Math.max(c.day(), fromDay)))
        .filter(c -> c.day() <= context.endDay());
  }

  /** 성장기: 콘텐츠가 정한 나이마다 일상의 성향 이벤트가 오고, 성향이 다 정해지면 직업 선택이 온다. */
  private void childhoodCandidates(
      List<EventRow> rows, SchedulingContext context, List<Candidate> candidates) {
    List<EventRow> traits = ofKind(rows, EventKind.TRAIT);
    List<ContentCatalog.TraitStage> stages = content.traitStages();
    if (traits.size() < stages.size()) {
      // 장면은 그 나이의 중간(반년째)에 온다. 시작 나이와 같은 단계가 0일에 바로 뜨지 않게 한다.
      int day = dayOfAge(stages.get(traits.size()).age(), context) + calendar.daysPerYear() / 2;
      int after = traits.isEmpty() ? 0 : last(traits).occursDay();
      candidates.add(new Candidate(EventKind.TRAIT, Math.max(day, after)));
    } else if (context.traitsFinalized() && context.jobStartDay() == null) {
      // 첫 직업 선택. "기다린다"를 골랐으면 wait-days 뒤에 다시 온다.
      List<EventRow> jobs = ofKind(rows, EventKind.JOB);
      int day =
          jobs.isEmpty()
              ? dayOfAge(properties.job().age(), context)
              : last(jobs).occursDay() + properties.job().waitDays();
      candidates.add(new Candidate(EventKind.JOB, Math.max(day, last(traits).occursDay())));
    }
  }

  /**
   * 취업 뒤 직장 (decisions.md 26번). 직업이 있으면 직장 장면(CAREER)이 간격을 두고 오고, 실직 중이면 다시 직업 선택(JOB)이 온다.
   * 전업투자자에게는 투자자의 장면이 같은 간격으로 온다(decisions.md 52번). 직전 장면의 결과가 후속 장면(followUp)을 정했으면 그 날 수 뒤에 그것이
   * 먼저 온다. 은퇴했거나 career.last-age를 넘으면 없다.
   */
  private void careerCandidates(
      List<EventRow> rows,
      SchedulingContext context,
      SeededRandom random,
      List<Candidate> candidates) {
    if (context.retired()) {
      return;
    }
    List<EventRow> careers = ofKind(rows, EventKind.CAREER);
    List<EventRow> jobs = ofKind(rows, EventKind.JOB);
    Optional<FollowUp> followUp = followUp(careers);
    int day;
    EventKind kind;
    if (followUp.isPresent() && (context.jobStartDay() != null || context.fullTimeInvestor())) {
      day = last(careers).occursDay() + followUp.get().days();
      kind = EventKind.CAREER;
    } else if (context.fullTimeInvestor()) {
      // 투자자가 된 날(마지막 직업 선택) 또는 마지막 장면부터 센다.
      int base =
          Math.max(
              careers.isEmpty() ? context.careerStartDay() : last(careers).occursDay(),
              jobs.isEmpty() ? context.careerStartDay() : last(jobs).occursDay());
      day = base + roll(random, properties.career().gapDays(), "CAREER", careers.size());
      kind = EventKind.CAREER;
    } else if (context.jobStartDay() == null) {
      // 실직 중: 마지막 직장 장면(실직 원인) 또는 마지막 직업 선택(기다림) 뒤에 다시 고른다.
      EventRow lastCareer = careers.isEmpty() ? null : last(careers);
      EventRow lastJob = jobs.isEmpty() ? null : last(jobs);
      boolean waited =
          lastJob != null && (lastCareer == null || lastJob.occursDay() > lastCareer.occursDay());
      day =
          waited
              ? lastJob.occursDay() + properties.job().waitDays()
              : (lastCareer == null ? context.careerStartDay() : lastCareer.occursDay())
                  + properties.job().rehireDays();
      kind = EventKind.JOB;
    } else {
      int base =
          careers.isEmpty()
              ? context.jobStartDay()
              : Math.max(context.jobStartDay(), last(careers).occursDay());
      day = base + roll(random, properties.career().gapDays(), "CAREER", careers.size());
      kind = EventKind.CAREER;
    }
    if (ageAt(day, context) <= properties.career().lastAge()) {
      candidates.add(new Candidate(kind, day));
    }
  }

  private record FollowUp(String code, int days) {}

  /** 마지막 직장 장면의 결과가 정한 후속 장면. 그 장면이 아직 안 끝났거나 결과에 후속이 없으면 비어 있다. */
  private Optional<FollowUp> followUp(List<EventRow> careers) {
    if (careers.isEmpty() || !last(careers).resolved()) {
      return Optional.empty();
    }
    EventRow row = last(careers);
    return repository
        .actualAction(row.id())
        .map(actual -> content.career(row.definitionCode()).effectOf(actual))
        .filter(effect -> effect.followUp() != null)
        .map(effect -> new FollowUp(effect.followUp(), effect.followUpDays()));
  }

  /**
   * 취업 뒤: 일상 장면(adult)이 간격을 두고 온다. 성향은 바꾸지 않고 능력치만 움직인다. 지금 고를 수 있는 장면이 없으면(풀을 다 썼거나 실직 중인데 직장 장면만
   * 남음) 오지 않는다 (decisions.md 23번).
   */
  private void adultTraitCandidate(
      List<EventRow> rows,
      SchedulingContext context,
      SeededRandom random,
      List<Candidate> candidates) {
    if (adultTraitsLeft(rows, context).isEmpty()) {
      return;
    }
    List<EventRow> used = adultTraits(rows);
    int base = used.isEmpty() ? context.careerStartDay() : last(used).occursDay();
    candidates.add(
        new Candidate(
            EventKind.TRAIT,
            base + roll(random, properties.trait().adultGapDays(), "TRAIT", used.size())));
  }

  /**
   * 아직 안 나온 adult 장면. 직장이 배경인 장면(job)은 직장에 다니는 동안에만, 보유 주식이 전제인 장면(holdings)은 들고 있는 종목이 있을 때만 고른다
   * (decisions.md 115번). 전제가 안 맞으면 풀에 남겨 두었다가 맞을 때 나온다.
   */
  private List<TraitDefinition> adultTraitsLeft(List<EventRow> rows, SchedulingContext context) {
    List<EventRow> used = adultTraits(rows);
    boolean working = context.jobStartDay() != null && !context.retired();
    return content.adultTraits().stream()
        .filter(t -> working || !t.job())
        .filter(t -> !t.holdings() || !context.heldStockCodes().isEmpty())
        // 양가 부모 장면은 결혼한 뒤에만 (decisions.md 76번).
        .filter(t -> context.married() || !t.married())
        .filter(t -> used.stream().noneMatch(u -> t.code().equals(u.definitionCode())))
        .toList();
  }

  private List<EventRow> adultTraits(List<EventRow> rows) {
    return ofKind(rows, EventKind.TRAIT).stream().filter(this::isAdultTrait).toList();
  }

  private boolean isAdultTrait(EventRow row) {
    return row.kind() == EventKind.TRAIT
        && content.adultTraits().stream().anyMatch(t -> t.code().equals(row.definitionCode()));
  }

  /** 저축기: 첫 월급 이후 투자 시작을 묻고, 거절하면 1년 뒤에 다시 묻는다 (decisions.md 6번). */
  private void savingCandidates(
      List<EventRow> rows, SchedulingContext context, List<Candidate> candidates) {
    if (context.salaryStartDay() == null) {
      return;
    }
    List<EventRow> offers = ofKind(rows, EventKind.OFFER);
    int day =
        offers.isEmpty()
            ? context.salaryStartDay()
            : last(offers).occursDay() + calendar.daysPerYear();
    candidates.add(new Candidate(EventKind.OFFER, day));
  }

  /** 결혼·자녀·자녀 결혼 가운데 올 수 있는 것을 모두 후보로 넣는다. 어느 것이 뜰지는 만들 때 가장 이른 것으로 정한다. */
  private void lifeCandidates(
      List<EventRow> rows,
      SchedulingContext context,
      SeededRandom random,
      List<Candidate> candidates) {
    for (LifeDue due : lifeDues(rows, context, random)) {
      candidates.add(new Candidate(EventKind.LIFE, due.day()));
    }
  }

  /** 생활 선택 하나가 올 날. code는 marriage·child·wedding:n·trip:who. */
  private record LifeDue(String code, int day) {}

  /** 가장 이른 생활 선택. 같은 날이면 결혼·자녀가 자녀 결혼보다 먼저다. */
  private String lifeDefinition(
      List<EventRow> rows, SchedulingContext context, SeededRandom random) {
    return lifeDues(rows, context, random).stream()
        .min(Comparator.comparingInt(LifeDue::day))
        .map(LifeDue::code)
        .orElseThrow();
  }

  /**
   * 결혼은 27~31세에 처음 묻고 거절하면 2년 뒤, 자녀는 결혼 1~2년 뒤부터 2~3년 간격으로 셋까지 (경제 개편 설계 7.3절). 자녀가 독립해 나간 뒤 2~5년이면
   * 그 아이의 결혼 선택이 온다 (decisions.md 68번). 아이마다 한 번이다.
   */
  private List<LifeDue> lifeDues(
      List<EventRow> rows, SchedulingContext context, SeededRandom random) {
    List<LifeDue> dues = new ArrayList<>();
    EventProperties.LifeSettings life = properties.life();
    int year = calendar.daysPerYear();
    for (int i = 0; i < context.childLeaveDays().size(); i++) {
      int seq = i + 1;
      if (ofKind(rows, EventKind.LIFE, WEDDING_PREFIX + seq).isEmpty()) {
        int years = roll(random, life.childWeddingGapYears(), "WEDDING", seq);
        dues.add(new LifeDue(WEDDING_PREFIX + seq, context.childLeaveDays().get(i) + years * year));
      }
    }
    if (!context.married()) {
      List<EventRow> asked = marriageAsked(rows);
      int day =
          asked.isEmpty()
              ? dayOfAge(
                  random
                      .forKey("event", "life", "marriage-age")
                      .nextInt(life.marriageAge().min(), life.marriageAge().max() + 1),
                  context)
              : last(asked).occursDay() + life.marriageRetryYears() * year;
      if (ageAt(day, context) <= life.marriageLastAge()) {
        // 상대는 제안마다 새로 뽑는다. 같은 판·같은 순번이면 같은 사람이다 (decisions.md 77번).
        SpouseText spouse = content.spouseText();
        RandomGenerator rng = random.forKey("event", "life", "spouse", asked.size());
        String code =
            spouse.encode(
                rng.nextInt(spouse.personalities().size()),
                rng.nextInt(spouse.economies().size()),
                rng.nextInt(spouse.lives().size()));
        dues.add(new LifeDue(MARRIAGE_PREFIX + code, day));
      }
    } else if (context.childrenCount() < life.maxChildren() && context.marriedDay() != null) {
      List<EventRow> asked = ofKind(rows, EventKind.LIFE, CHILD);
      EventProperties.Range gap =
          asked.isEmpty() ? life.childFirstGapYears() : life.childGapYears();
      int base = asked.isEmpty() ? context.marriedDay() : last(asked).occursDay();
      int years =
          random.forKey("event", "life", "child", asked.size()).nextInt(gap.min(), gap.max() + 1);
      int day = base + years * year;
      if (ageAt(day, context) <= life.childLastAge()) {
        dues.add(new LifeDue(CHILD, day));
      }
    }
    // 가족 점수가 바닥이면 여행·나들이를 같이 가자는 사람이 없다 (decisions.md 111번).
    boolean warm = context.family() >= life.coldFamilyBelow();
    // 가족 여행 (decisions.md 71번): 결혼 뒤 3~6년마다 가족 가운데 누군가 여행을 가자고 한다. 자동으로 가지 않고 선택이다.
    if (warm && context.married() && context.marriedDay() != null) {
      List<EventRow> trips =
          rows.stream()
              .filter(
                  r ->
                      r.kind() == EventKind.LIFE
                          && r.definitionCode() != null
                          && r.definitionCode().startsWith(TRIP_PREFIX))
              .toList();
      int base = trips.isEmpty() ? context.marriedDay() : last(trips).occursDay();
      int day = base + roll(random, life.tripGapYears(), "TRIP", trips.size()) * year;
      if (ageAt(day, context) <= life.tripLastAge()) {
        String who =
            tripProposer(context, day, random.forKey("event", "life", "trip-who", trips.size()));
        dues.add(new LifeDue(TRIP_PREFIX + who, day));
      }
    }
    // 아이의 나들이 (decisions.md 87번): 어린 아이가 집에 있는 동안 1~2년마다 하나씩 조른다. 그 아이의 나이에 맞는 것만 (106번).
    List<EventRow> outings =
        rows.stream()
            .filter(
                r ->
                    r.kind() == EventKind.LIFE
                        && r.definitionCode() != null
                        && r.definitionCode().startsWith(OUTING_PREFIX))
            .toList();
    if (warm && context.marriedDay() != null && !context.childBirthDays().isEmpty()) {
      int base = outings.isEmpty() ? context.marriedDay() : last(outings).occursDay();
      int gap = base + roll(random, life.outingGapYears(), "OUTING", outings.size()) * year;
      // 그 나이에 맞는 나들이가 하나라도 있는 아이만 후보다. 두 살은 동물원도 아직이라, 그런 아이만 있으면 맞는 나이가 될 때까지 미룬다.
      Integer day = firstOutingDay(context, gap);
      if (day != null) {
        List<Integer> young =
            youngChildren(context, day).stream()
                .filter(seq -> !fittingOutings(context, seq, day).isEmpty())
                .toList();
        RandomGenerator rng = random.forKey("event", "life", "outing", outings.size());
        int seq = young.get(rng.nextInt(young.size()));
        List<OutingText> kinds = fittingOutings(context, seq, day);
        String kind = kinds.get(rng.nextInt(kinds.size())).code();
        dues.add(new LifeDue(OUTING_PREFIX + kind + ":" + seq, day));
      }
    }
    return dues;
  }

  /**
   * from 이후 처음으로 어느 아이에게든 맞는 나들이가 있는 날. 그날 이미 있으면 그날, 아니면 어떤 아이가 어떤 나들이의 나이가 되는 가장 이른 날. 없으면 null.
   */
  private Integer firstOutingDay(SchedulingContext context, int from) {
    if (youngChildren(context, from).stream()
        .anyMatch(seq -> !fittingOutings(context, seq, from).isEmpty())) {
      return from;
    }
    int year = calendar.daysPerYear();
    Integer earliest = null;
    for (int i = 0; i < context.childBirthDays().size(); i++) {
      int birth = context.childBirthDays().get(i);
      Integer leave = context.childLeaveDays().size() > i ? context.childLeaveDays().get(i) : null;
      for (OutingText outing : content.outings()) {
        int day = birth + outing.minAge() * year;
        if (day > from && (leave == null || leave > day) && (earliest == null || day < earliest)) {
          earliest = day;
        }
      }
    }
    return earliest;
  }

  /** 그날 집에 있는 어린 아이(한 살에서 열세 살)의 순번. */
  private List<Integer> youngChildren(SchedulingContext context, int day) {
    List<Integer> young = new ArrayList<>();
    for (int i = 0; i < context.childBirthDays().size(); i++) {
      int age = childAge(context, i + 1, day);
      boolean atHome =
          context.childLeaveDays().size() <= i || context.childLeaveDays().get(i) > day;
      if (atHome && age >= 1 && age <= 13) {
        young.add(i + 1);
      }
    }
    return young;
  }

  /** 그 아이의 그날 나이(세). */
  private int childAge(SchedulingContext context, int seq, int day) {
    return (day - context.childBirthDays().get(seq - 1)) / calendar.daysPerYear();
  }

  /** 그 아이의 나이에 맞는 나들이·행사 (decisions.md 106번). */
  private List<OutingText> fittingOutings(SchedulingContext context, int seq, int day) {
    int age = childAge(context, seq, day);
    return content.outings().stream().filter(o -> o.fits(age)).toList();
  }

  static String outingCode(String definitionCode) {
    String rest = definitionCode.substring(OUTING_PREFIX.length());
    return rest.substring(0, rest.indexOf(':'));
  }

  static int outingChild(String definitionCode) {
    String rest = definitionCode.substring(OUTING_PREFIX.length());
    return Integer.parseInt(rest.substring(rest.indexOf(':') + 1));
  }

  /** 여행을 가자고 하는 사람: 배우자, 집에 있는 여섯 살 넘은 아이, 55세까지는 부모님도. */
  private String tripProposer(SchedulingContext context, int day, RandomGenerator rng) {
    List<String> who = new ArrayList<>();
    who.add("spouse");
    for (int i = 0; i < context.childLeaveDays().size(); i++) {
      int leave = context.childLeaveDays().get(i);
      boolean oldEnough = context.childBirthDays().size() > i && childAge(context, i + 1, day) >= 6;
      if (leave > day && oldEnough) {
        who.add("child:" + (i + 1));
      }
    }
    if (ageAt(day, context) <= 55) {
      who.add("parents");
    }
    return who.get(rng.nextInt(who.size()));
  }

  static String tripProposer(String definitionCode) {
    return definitionCode.substring(TRIP_PREFIX.length());
  }

  private static int tripCostBp(String optionCode) {
    return switch (optionCode) {
      case ChoiceTicket.FamilyTrip.LUXURY -> 40_000;
      case ChoiceTicket.FamilyTrip.NORMAL -> 10_000;
      case ChoiceTicket.FamilyTrip.CHEAP -> 2_000;
      default -> 0;
    };
  }

  private static List<EventRow> marriageAsked(List<EventRow> rows) {
    return rows.stream()
        .filter(
            r ->
                r.kind() == EventKind.LIFE
                    && r.definitionCode() != null
                    && r.definitionCode().startsWith(MARRIAGE))
        .toList();
  }

  static String spouseCode(String definitionCode) {
    return definitionCode.substring(MARRIAGE_PREFIX.length());
  }

  static int weddingSeq(String definitionCode) {
    return Integer.parseInt(definitionCode.substring(WEDDING_PREFIX.length()));
  }

  private static int weddingShareBp(String optionCode) {
    return switch (optionCode) {
      case ChoiceTicket.ChildWedding.FULL -> 10_000;
      case ChoiceTicket.ChildWedding.HALF -> 5_000;
      default -> 0;
    };
  }

  /**
   * 뉴스는 해마다 yearly-chance-bp 확률로 한 번, 그 해 안의 한 날에 온다. 안 걸린 해는 없다 (decisions.md 80번). 해마다의 굴림과 날은 판
   * 시드와 해 번호로 정해져 같은 판이면 같다. base(마지막 뉴스나 투자 시작) 뒤의 첫 뉴스 날을 돌려준다.
   */
  private Optional<Integer> nextNewsDay(int base, SchedulingContext context, SeededRandom random) {
    int year = calendar.daysPerYear();
    int endYear = context.endDay() / year;
    for (int y = base / year; y <= endYear; y++) {
      RandomGenerator rng = random.forKey("event", "news-year", y);
      boolean comes = rng.nextInt(BP) < properties.news().yearlyChanceBp();
      int day = y * year + rng.nextInt(year);
      if (comes && day > base) {
        return Optional.of(day);
      }
    }
    return Optional.empty();
  }

  /**
   * 보유 종목이 있을 때만: 마지막 흔들림(없으면 투자 시작일) + 간격. 산 지 min-held-days가 안 된 종목만 들고 있으면 가장 먼저 그 날이 되는 때로 미루고,
   * 뉴스(직전·다음)와는 after-news-days 넘게 떨어뜨린다 (decisions.md 109번). 어떤 종목이 흔들리는지는 만들 때 뽑는다 (33번).
   */
  private void shakeCandidate(
      List<EventRow> rows,
      SchedulingContext context,
      SeededRandom random,
      Optional<Integer> nextNewsDay,
      List<Candidate> candidates) {
    if (context.heldStockCodes().isEmpty()) {
      return;
    }
    EventProperties.ShakeSettings settings = properties.shake();
    List<EventRow> shakes = ofKind(rows, EventKind.SHAKE);
    int base = shakes.isEmpty() ? context.investingStartDay() : last(shakes).occursDay();
    int day = base + roll(random, settings.gapDays(), "SHAKE", shakes.size());
    // 들고 있는 것 가운데 가장 먼저 "산 지 충분히 지난" 종목이 생기는 날까지 미룬다.
    int earliest =
        context.heldStockCodes().stream()
            .mapToInt(
                code -> {
                  SchedulingContext.HeldStock facts = context.heldStocks().get(code);
                  return facts == null || facts.lastBuyDay() == null
                      ? 0
                      : facts.lastBuyDay() + settings.minHeldDays();
                })
            .min()
            .orElse(0);
    day = Math.max(day, earliest);
    List<EventRow> news = ofKind(rows, EventKind.NEWS);
    if (!news.isEmpty()) {
      day = Math.max(day, last(news).occursDay() + settings.afterNewsDays());
    }
    if (nextNewsDay.isPresent()
        && day >= nextNewsDay.get() - settings.afterNewsDays()
        && day < nextNewsDay.get() + settings.afterNewsDays()) {
      day = nextNewsDay.get() + settings.afterNewsDays();
    }
    candidates.add(new Candidate(EventKind.SHAKE, day));
  }

  /** 장면의 전제가 그 종목에 맞는가: drop은 12달 고점 대비 낙폭, flat은 최근 반년 폭. 전제 없는 장면은 늘 맞는다. */
  private static boolean shakeFits(
      ShakeDefinition definition,
      String stockCode,
      SchedulingContext context,
      EventProperties.ShakeSettings settings) {
    if (definition.requires() == null) {
      return true;
    }
    if (ShakeDefinition.REQUIRES_DROP.equals(definition.requires())) {
      return context.heldDropBp().getOrDefault(stockCode, 0) >= settings.plungeDropBp();
    }
    SchedulingContext.HeldStock facts = context.heldStocks().get(stockCode);
    return facts != null && facts.rangeBp() <= settings.flatRangeBp();
  }

  /**
   * 주거 (주거 설계 4절). 처음 일을 시작하면 독립(move-out), 세입자는 만기(lease-end)마다, 2채 미만이면 결혼·출산·서울 집값 급등 뒤에 "집
   * 살까?"(buy, 최소 buy-gap-days 간격)가 온다.
   */
  private void housingCandidates(
      List<EventRow> rows, SchedulingContext context, List<Candidate> candidates) {
    earliestHousing(rows, context)
        .ifPresent(due -> candidates.add(new Candidate(EventKind.HOUSING, due.getValue())));
  }

  /**
   * 주거 이벤트마다 언제 오는가. 처음 일을 시작하면 독립(move-out), 세입자는 만기(lease-end)마다, 집이 없고 영끌이 되면 청약 공고(cheongyak)가
   * cheongyak-gap-days마다, 2채 미만이면 결혼·출산·서울 집값 급등 뒤에 "집 살까?"(buy, 최소 buy-gap-days 간격)가 온다. 순서가 같은 날의
   * 우선순위다.
   */
  private Map<String, Integer> housingDue(List<EventRow> rows, SchedulingContext context) {
    HousingFacts housing = context.housing();
    Map<String, Integer> due = new java.util.LinkedHashMap<>();
    if ("PARENTS".equals(housing.tenure())) {
      due.put(ChoiceTicket.Housing.MOVE_OUT, context.careerStartDay());
      return due;
    }
    if (housing.leaseEndDay() != null) {
      due.put(ChoiceTicket.Housing.LEASE_END, housing.leaseEndDay());
    }
    // 하루에 주거 장면은 하나, 사이는 scene-gap-days 넘게 (decisions.md 110번). 만기·독립은 날이 정해져 있으니 나머지를 미룬다.
    List<EventRow> scenes = ofKind(rows, EventKind.HOUSING);
    int lastScene = scenes.isEmpty() ? -1 : last(scenes).occursDay();
    spouseRentDue(rows, context)
        .map(d -> spaced(d, lastScene, housing))
        .ifPresent(d -> due.put(ChoiceTicket.Housing.SPOUSE_RENT, d));
    Optional<Integer> crampedDue = crampedDue(rows, context);
    crampedDue
        .map(d -> spaced(d, lastScene, housing))
        .ifPresent(d -> due.put(ChoiceTicket.Housing.CRAMPED, d));
    // 돈이 안 돼 '넘긴다'밖에 못 고를 공고는 띄우지 않는다. 영끌이 되는 순간 다음 공고가 온다 (#26, decisions.md 48번).
    if (housing.homes() == 0 && housing.cheongyakAffordable()) {
      List<EventRow> notices = housingOf(rows, ChoiceTicket.Housing.CHEONGYAK);
      due.put(
          ChoiceTicket.Housing.CHEONGYAK,
          spaced(
              notices.isEmpty()
                  ? context.careerStartDay() + properties.housing().cheongyakGapDays()
                  : last(notices).occursDay() + properties.housing().cheongyakGapDays(),
              lastScene,
              housing));
    }
    if (housing.homes() >= 2) {
      return due;
    }
    List<EventRow> buys = housingOf(rows, ChoiceTicket.Housing.BUY);
    int lastBuy = buys.isEmpty() ? -1 : last(buys).occursDay();
    int base =
        buys.isEmpty() ? context.careerStartDay() : lastBuy + properties.housing().buyGapDays();
    List<Integer> triggers = new ArrayList<>();
    // 결혼·출산의 "집 살까?"는 그 뒤에 다른 주거 장면(만기·좁다·배우자 불만)이 왔으면 띄우지 않는다: 그 장면에 이미 매수 선택지가 있었다 (#117, 110번).
    if (context.marriedDay() != null && crampedDue.isEmpty()) {
      triggers.add(context.marriedDay());
    }
    if (housing.lastChildDay() != null && crampedDue.isEmpty()) {
      triggers.add(housing.lastChildDay());
    }
    if (housing.seoulChange12mBp() >= properties.housing().surgeBp()) {
      triggers.add(Math.max(base, lastScene + 1));
    }
    triggers.stream()
        .filter(d -> d > lastScene)
        .min(Integer::compare)
        .ifPresent(
            d -> due.put(ChoiceTicket.Housing.BUY, spaced(Math.max(base, d), lastScene, housing)));
    return due;
  }

  /** 날이 정해지지 않은 주거 장면을 직전 주거 장면에서 scene-gap-days 뒤로 미루고, 만기가 그 안에 있으면 만기 뒤로 보낸다(만기에서 옮기면 된다). */
  private int spaced(int due, int lastScene, HousingFacts housing) {
    int gap = properties.housing().sceneGapDays();
    int day = lastScene < 0 ? due : Math.max(due, lastScene + gap);
    if (housing.leaseEndDay() != null
        && day > housing.leaseEndDay() - gap
        && day <= housing.leaseEndDay()) {
      day = housing.leaseEndDay() + gap;
    }
    return day;
  }

  /**
   * 배우자의 월세 불만 (#116): 결혼했고 월세에 살면, 결혼(또는 그 뒤 독립) 1년 뒤 처음 묻는다. 그 뒤로도 월세면(미뤘거나 거슬렀거나) 1년 반마다 다시 묻고,
   * 마지막으로 물은 뒤 아이가 태어나면 반년 뒤로 앞당긴다. 단계는 물은 횟수. 60세를 넘으면 더 묻지 않는다.
   */
  private Optional<Integer> spouseRentDue(List<EventRow> rows, SchedulingContext context) {
    HousingFacts housing = context.housing();
    if (!context.married()
        || context.marriedDay() == null
        || context.careerStartDay() == null
        || !"MONTHLY".equals(housing.tenure())) {
      return Optional.empty();
    }
    EventProperties.SpouseRentSettings settings = properties.housing().spouseRent();
    List<EventRow> asked = spouseRentAsked(rows);
    // 마지막 단계(decisions.md 111번): 배우자가 계약서를 들고 온다. 감당할 수 없으면 월세로 굳어져 더 묻지 않고, 그 뒤로는 끝이다.
    int level = asked.size() + 1;
    if (level > settings.finalLevel()
        || (level == settings.finalLevel() && !housing.canLeaveMonthly())) {
      return Optional.empty();
    }
    // 전세사기·집주인 거절로 월세에 밀린 직후에 "적금 깨서 보증금 보태자"는 어설프다. 큰 일 뒤에는 반년 미룬다 (decisions.md 110번).
    int shock =
        ofKind(rows, EventKind.HOUSING).stream()
            .filter(
                r ->
                    ChoiceTicket.Housing.LEASE_REFUSED.equals(r.definitionCode())
                        || FRAUD.equals(r.hiddenDirection()))
            .mapToInt(EventRow::occursDay)
            .max()
            .orElse(-1);
    int due;
    if (asked.isEmpty()) {
      due = Math.max(context.marriedDay(), context.careerStartDay()) + settings.firstGapDays();
    } else {
      int lastAsk = last(asked).occursDay();
      due = lastAsk + settings.retryGapDays();
      if (housing.lastChildDay() != null && housing.lastChildDay() > lastAsk) {
        due =
            Math.min(
                due,
                Math.max(
                    housing.lastChildDay() + settings.childGapDays(),
                    lastAsk + settings.childGapDays()));
      }
    }
    if (shock >= 0) {
      due = Math.max(due, shock + properties.housing().afterShockDays());
    }
    return ageAt(due, context) <= settings.lastAge() ? Optional.of(due) : Optional.empty();
  }

  /**
   * 집이 좁다 (#117): 결혼·출산으로 세집이 식구 수에 비해 좁아졋으면 그로부터 두 달 뒤 묻는다. 그 일 뒤에 이미 물었으면 다시 묻지 않고(다음 만기에 옮기면
   * 된다), 세 만기가 반년 안이면 따로 띄우지 않는다.
   */
  private Optional<Integer> crampedDue(List<EventRow> rows, SchedulingContext context) {
    HousingFacts housing = context.housing();
    if (!housing.cramped()) {
      return Optional.empty();
    }
    int since = -1;
    if (context.marriedDay() != null) {
      since = context.marriedDay();
    }
    if (housing.lastChildDay() != null) {
      since = Math.max(since, housing.lastChildDay());
    }
    if (since < 0) {
      return Optional.empty();
    }
    List<EventRow> asked = crampedAsked(rows);
    if (!asked.isEmpty() && last(asked).occursDay() >= since) {
      return Optional.empty();
    }
    int due = since + properties.housing().crampedDelayDays();
    if (housing.leaseEndDay() != null
        && housing.leaseEndDay() <= due + properties.housing().crampedLeaseWindowDays()) {
      return Optional.empty();
    }
    return Optional.of(due);
  }

  private static List<EventRow> crampedAsked(List<EventRow> rows) {
    return ofKind(rows, EventKind.HOUSING).stream()
        .filter(r -> ChoiceTicket.Housing.isCramped(r.definitionCode()))
        .toList();
  }

  private static List<EventRow> spouseRentAsked(List<EventRow> rows) {
    return ofKind(rows, EventKind.HOUSING).stream()
        .filter(r -> ChoiceTicket.Housing.isSpouseRent(r.definitionCode()))
        .toList();
  }

  /** 가장 먼저 오는 주거 이벤트. 같은 날이면 housingDue의 순서가 먼저다. */
  private Optional<Map.Entry<String, Integer>> earliestHousing(
      List<EventRow> rows, SchedulingContext context) {
    Map.Entry<String, Integer> earliest = null;
    for (Map.Entry<String, Integer> entry : housingDue(rows, context).entrySet()) {
      if (earliest == null || entry.getValue() < earliest.getValue()) {
        earliest = entry;
      }
    }
    return Optional.ofNullable(earliest);
  }

  private List<EventRow> housingOf(List<EventRow> rows, String definition) {
    return ofKind(rows, EventKind.HOUSING).stream()
        .filter(r -> definition.equals(r.definitionCode()))
        .toList();
  }

  /** 빚투 제안: 든 종목이 크게 빠졌고 지난 제안에서 충분히 지났으면 지금 묻는다 (decisions.md 39번). */
  private void leverageCandidate(
      List<EventRow> rows, SchedulingContext context, List<Candidate> candidates) {
    if (plunged(context).isEmpty()) {
      return;
    }
    List<EventRow> asked = ofKind(rows, EventKind.LEVERAGE);
    int base =
        asked.isEmpty()
            ? context.investingStartDay()
            : last(asked).occursDay() + properties.leverage().gapDays();
    candidates.add(new Candidate(EventKind.LEVERAGE, base));
  }

  /** 가장 많이 빠진 보유 종목. 기준 낙폭을 넘는 것이 없으면 비어 있다. 같은 낙폭이면 코드순. */
  private Optional<Map.Entry<String, Integer>> plunged(SchedulingContext context) {
    return context.heldDropBp().entrySet().stream()
        .filter(e -> e.getValue() >= properties.leverage().dropBp())
        .max(
            Map.Entry.<String, Integer>comparingByValue()
                .thenComparing(Map.Entry.comparingByKey(Comparator.reverseOrder())));
  }

  private void noticeCandidate(
      List<EventRow> rows,
      SchedulingContext context,
      SeededRandom random,
      List<Candidate> candidates) {
    List<EventRow> notices = ofKind(rows, EventKind.NOTICE);
    int base = notices.isEmpty() ? context.careerStartDay() : last(notices).occursDay();
    candidates.add(
        new Candidate(
            EventKind.NOTICE,
            base + roll(random, properties.notice().gapDays(), "NOTICE", notices.size())));
  }

  private int ageAt(int day, SchedulingContext context) {
    return context.startAge() + day / calendar.daysPerYear();
  }

  private int dayOfAge(int age, SchedulingContext context) {
    return (age - context.startAge()) * calendar.daysPerYear();
  }

  // ---- 이벤트 만들기 ----

  private EventRow create(
      List<EventRow> rows,
      Candidate candidate,
      SchedulingContext context,
      SeededRandom random,
      HintProvider hints) {
    int seq = rows.stream().mapToInt(EventRow::seq).max().orElse(0) + 1;
    UUID id = UUID.randomUUID();
    return switch (candidate.kind()) {
      case JOB -> jobEvent(id, seq, rows, candidate.day(), context, random);
      case CAREER -> careerEvent(id, seq, rows, candidate.day(), context, random);
      case TRAIT -> {
        // 단계마다 장면을 판 시드로 랜덤하게 뽑는다. 판마다 다른 질문이 나오고, 같은 판은 다시 불러도 같다.
        // 취업 뒤(성장기가 아님)에는 아직 안 나온 adult 장면 중에서 뽑는다.
        TraitDefinition trait;
        if (context.phase() == Phase.CHILDHOOD) {
          int stage = ofKind(rows, EventKind.TRAIT).size();
          List<TraitDefinition> scenes = content.traitStages().get(stage).scenes();
          trait = scenes.get(random.forKey("event", "trait-scene", stage).nextInt(scenes.size()));
        } else {
          List<TraitDefinition> left = adultTraitsLeft(rows, context);
          trait =
              left.get(
                  random
                      .forKey("event", "trait-scene", "adult", adultTraits(rows).size())
                      .nextInt(left.size()));
        }
        yield simple(
            id,
            seq,
            EventKind.TRAIT,
            trait.code(),
            candidate.day(),
            trait.options().stream().map(TraitDefinition.Option::code).toList());
      }
      case OFFER ->
          // 첫 제안은 첫 월급 날, 그 뒤는 1년마다. 문구가 다르다 (decisions.md 117번).
          simple(
              id,
              seq,
              EventKind.OFFER,
              ofKind(rows, EventKind.OFFER).isEmpty() ? OFFER_FIRST : OFFER_AGAIN,
              candidate.day(),
              List.of(ACCEPT, DECLINE));
      case LIFE -> {
        String code = lifeDefinition(rows, context, random);
        yield simple(
            id,
            seq,
            EventKind.LIFE,
            code,
            candidate.day(),
            code.startsWith(WEDDING_PREFIX)
                ? List.of(
                    ChoiceTicket.ChildWedding.FULL,
                    ChoiceTicket.ChildWedding.HALF,
                    ChoiceTicket.ChildWedding.NONE)
                : code.startsWith(TRIP_PREFIX) || code.startsWith(OUTING_PREFIX)
                    ? List.of(
                        ChoiceTicket.FamilyTrip.LUXURY,
                        ChoiceTicket.FamilyTrip.NORMAL,
                        ChoiceTicket.FamilyTrip.CHEAP,
                        ChoiceTicket.FamilyTrip.NONE)
                    : List.of(ACCEPT, DECLINE));
      }
      case NOTICE -> notice(id, seq, candidate.day(), context, random);
      case NEWS -> news(id, seq, rows, candidate.day(), context, random, hints);
      case SHAKE -> shake(id, seq, candidate.day(), context, random);
      case LEVERAGE -> leverage(id, seq, candidate.day(), context);
      case HOUSING -> housing(id, seq, candidate.day(), rows, context, random);
    };
  }

  /**
   * 보유 종목 흔들림. 산 지 충분히 지난 보유 종목 가운데 하나를 뽑고, 그 종목의 상태에 맞는 장면(급락 알림은 크게 빠졌을 때, 제자리걸음은 반년 폭이 작을 때)만
   * 고른다. 선택 뒤 그 종목이 움직일 숨은 방향·폭을 정한다. 힌트·다른 뉴스는 없다 (decisions.md 33번·109번).
   */
  private EventRow shake(
      UUID id, int seq, int day, SchedulingContext context, SeededRandom random) {
    RandomGenerator rng = random.forKey("event", "shake", seq);
    EventProperties.ShakeSettings settings = properties.shake();
    List<String> seasoned =
        context.heldStockCodes().stream()
            .filter(code -> context.heldLongEnough(code, day, settings.minHeldDays()))
            .toList();
    List<String> held = seasoned.isEmpty() ? context.heldStockCodes() : seasoned;
    String stockCode = held.get(rng.nextInt(held.size()));
    List<ShakeDefinition> fitting =
        content.shakes().stream()
            .filter(sh -> shakeFits(sh, stockCode, context, settings))
            .toList();
    ShakeDefinition definition = weighted(fitting, ShakeDefinition::weight, rng);
    Direction truth = rng.nextInt(BP) < settings.upBp() ? Direction.UP : Direction.DOWN;
    int magnitude = rng.nextInt(settings.magnitudeBp().min(), settings.magnitudeBp().max() + 1);
    return new EventRow(
        id,
        seq,
        EventKind.SHAKE,
        definition.code(),
        content.stock(stockCode).sector(),
        stockCode,
        false,
        day,
        EventRow.PENDING,
        truth.name(),
        magnitude,
        null,
        null,
        null,
        SHAKE_OPTIONS);
  }

  /**
   * 주거 이벤트. 가장 먼저 온 것(housingDue): 독립·만기·청약·집 사기. 보증보험 없는 빌라 전세의 만기에는 전세사기를 굴려 숨겨 둔다(고른 뒤에 드러난다).
   * 선택지는 형편과 상관없이 늘 같은 목록이고, 감당할 수 있는지는 진행이 따져 막는다.
   */
  private EventRow housing(
      UUID id,
      int seq,
      int day,
      List<EventRow> rows,
      SchedulingContext context,
      SeededRandom random) {
    HousingFacts housing = context.housing();
    String definition;
    List<String> options = new ArrayList<>();
    boolean roomForHome = housing.homes() < 2;
    definition =
        earliestHousing(rows, context).map(Map.Entry::getKey).orElse(ChoiceTicket.Housing.BUY);
    if (ChoiceTicket.Housing.MOVE_OUT.equals(definition)) {
      options.addAll(ChoiceTicket.Housing.RENTALS);
    } else if (ChoiceTicket.Housing.CHEONGYAK.equals(definition)) {
      options.add(ChoiceTicket.Housing.APPLY);
      options.add(ChoiceTicket.Housing.PASS);
    } else if (ChoiceTicket.Housing.SPOUSE_RENT.equals(definition)) {
      // 배우자가 월세살이를 그만하자고 한다 (#116): 전세로 옮기거나, 집을 사거나, 설득해 미루거나, 거스른다. 월세 그대로는 선택지가 아니다.
      // 은퇴 뒤에는 직장 전제 문구 대신 은퇴 문구 (decisions.md 111번).
      int level = spouseRentAsked(rows).size() + 1;
      definition =
          ChoiceTicket.Housing.spouseRentCode(
              level,
              context.childrenCount(),
              context.retired() ? SPOUSE_RETIRED : context.spouseJob());
      options.add(ChoiceTicket.Housing.VILLA);
      options.add(ChoiceTicket.Housing.VILLA_INSURED);
      options.add(ChoiceTicket.Housing.APT_JEONSE);
      if (roomForHome) {
        options.add(ChoiceTicket.Housing.BUY_SEOUL);
        options.add(ChoiceTicket.Housing.BUY_GYEONGGI);
      }
      // 마지막 단계면 배우자가 계약서를 들고 와 미루기·거스르기가 없다. 현금이 넉넉하면 "조금만 더 모으자"는 통하지 않는다 (111번).
      if (level < properties.housing().spouseRent().finalLevel()) {
        if (!housing.cashForJeonse()) {
          options.add(ChoiceTicket.Housing.WAIT);
        }
        options.add(ChoiceTicket.Housing.STAY);
      }
    } else if (ChoiceTicket.Housing.CRAMPED.equals(definition)) {
      // 집이 좁다 (#117): 더 넓은 집으로 옮기거나(세·매수), 좁아도 그냥 산다. 막내가 태어나 좁아졌으면 그 아이의 순번을 싣는다.
      boolean byChild =
          housing.lastChildDay() != null
              && (context.marriedDay() == null || housing.lastChildDay() >= context.marriedDay());
      definition = ChoiceTicket.Housing.crampedCode(byChild ? context.childrenCount() : null);
      options.addAll(ChoiceTicket.Housing.RENTALS);
      if (roomForHome) {
        options.add(ChoiceTicket.Housing.BUY_SEOUL);
        options.add(ChoiceTicket.Housing.BUY_GYEONGGI);
      }
      options.add(ChoiceTicket.Housing.ENDURE);
    } else if (ChoiceTicket.Housing.LEASE_END.equals(definition)) {
      // 전세사기가 아니면 운에 따라 집주인이 재계약을 거절한다. 그러면 '2년 더 살기' 없이 옮길 곳만 고른다 (#25).
      boolean refused =
          !(housing.villaUninsured() && fraud(seq, random))
              && random.forKey("event", "housing", "refuse", seq).nextInt(BP)
                  < refuseBp(housing.luck());
      if (refused) {
        definition = ChoiceTicket.Housing.LEASE_REFUSED;
      } else {
        options.add(ChoiceTicket.Housing.KEEP);
      }
      options.addAll(ChoiceTicket.Housing.RENTALS);
      if (roomForHome) {
        options.add(ChoiceTicket.Housing.BUY_SEOUL);
        options.add(ChoiceTicket.Housing.BUY_GYEONGGI);
      }
    } else {
      definition = ChoiceTicket.Housing.BUY;
      if (!housing.ownsResidence()) {
        options.add(ChoiceTicket.Housing.BUY_SEOUL);
        options.add(ChoiceTicket.Housing.BUY_GYEONGGI);
      }
      options.add(ChoiceTicket.Housing.GAP);
      options.add(ChoiceTicket.Housing.PASS);
    }
    boolean fraud =
        ChoiceTicket.Housing.LEASE_END.equals(definition)
            && housing.villaUninsured()
            && fraud(seq, random);
    return new EventRow(
        id,
        seq,
        EventKind.HOUSING,
        definition,
        null,
        null,
        false,
        day,
        EventRow.PENDING,
        fraud ? FRAUD : null,
        null,
        null,
        null,
        null,
        List.copyOf(options));
  }

  private boolean fraud(int seq, SeededRandom random) {
    return random.forKey("event", "housing", "fraud", seq).nextInt(BP)
        < properties.housing().fraudBp();
  }

  private int refuseBp(int luck) {
    EventProperties.Refuse refuse = properties.housing().refuseBp();
    int clamped = Math.clamp(luck, 0, 100);
    return refuse.unlucky() - (refuse.unlucky() - refuse.lucky()) * clamped / 100;
  }

  /** 빚투 제안. 가장 많이 빠진 보유 종목을 묻고, 낙폭은 제목에 쓰도록 남긴다. 숨은 방향은 없다: 그 뒤는 시장이 정한다. */
  private EventRow leverage(UUID id, int seq, int day, SchedulingContext context) {
    Map.Entry<String, Integer> worst = plunged(context).orElseThrow();
    return new EventRow(
        id,
        seq,
        EventKind.LEVERAGE,
        null,
        content.stock(worst.getKey()).sector(),
        worst.getKey(),
        false,
        day,
        EventRow.PENDING,
        null,
        worst.getValue(),
        null,
        null,
        null,
        List.of(ChoiceTicket.Leverage.BORROW, ChoiceTicket.Leverage.PASS));
  }

  /** 알림 정의를 가중치로 뽑는다. 결혼 뒤에만 나오는 정의는 미혼이면 후보에서 뺀다. 만들어지는 순간 RESOLVED다. */
  private EventRow notice(
      UUID id, int seq, int day, SchedulingContext context, SeededRandom random) {
    // 결혼·직장·자녀가 있어야 말이 되는 알림은 그때만 고른다(무직인데 명절 보너스가 나오지 않게).
    boolean working = context.jobStartDay() != null && !context.retired();
    List<NoticeDefinition> eligible =
        content.notices().stream()
            .filter(n -> context.married() || !n.requiresMarried())
            .filter(n -> working || !n.requiresJob())
            .filter(n -> context.childrenCount() > 0 || !n.requiresChildren())
            .toList();
    NoticeDefinition definition =
        weighted(eligible, NoticeDefinition::weight, random.forKey("event", "notice", seq));
    return new EventRow(
        id,
        seq,
        EventKind.NOTICE,
        definition.code(),
        null,
        null,
        false,
        day,
        EventRow.RESOLVED,
        null,
        null,
        null,
        null,
        null,
        List.of());
  }

  private EventRow news(
      UUID id,
      int seq,
      List<EventRow> rows,
      int day,
      SchedulingContext context,
      SeededRandom random,
      HintProvider hints) {
    // 이 안에서 뽑는 순서: 정의 → 종목 → 방향 → 폭 → 분위기 → 분위기 문구 (specs/event.md 5.7절, 경제 개편 설계 5.4절)
    RandomGenerator rng = random.forKey("event", "news", seq);
    NewsDefinition definition = pickNews(rows, context, rng);
    // 그 뉴스가 어울리는 종목(없으면 섹터 전부) 가운데 사거나 팔 수 있는 것을 뽑는다. 하나도 없으면(정의를 고를 때 걸렀으니 드물다) 어울리는 것 전부에서
    // (decisions.md 113번).
    List<StockDefinition> sectorStocks =
        content.stocksOf(definition.sector()).stream()
            .filter(st -> definition.fits(st.code()))
            .toList();
    List<StockDefinition> tradable =
        sectorStocks.stream().filter(st -> context.tradable(st.code())).toList();
    List<StockDefinition> stocks = tradable.isEmpty() ? sectorStocks : tradable;
    StockDefinition stock = stocks.get(rng.nextInt(stocks.size()));
    Direction truth =
        rng.nextInt(BP) < definition.directionRule().upBp() ? Direction.UP : Direction.DOWN;
    NewsDefinition.Magnitude range = definition.magnitude();
    int magnitude =
        rng.nextInt(range.minBp(), range.maxBp() + 1)
            * properties.style(context.investmentStyle()).magnitudePercent()
            / PERCENT;
    Sentiment sway = rng.nextBoolean() ? Sentiment.POS : Sentiment.NEG;
    int swayIndex = rng.nextInt(content.swayPhrases(sway.name()).size());

    Hint hint = hints.hintFor(truth, seq);
    List<String> hintPhrases =
        content.hintPhrases(hint.detail().key(), hint.direction().name(), hint.strength().name());
    int hintIndex = random.forKey("event", "hint", seq).nextInt(hintPhrases.size());

    return new EventRow(
        id,
        seq,
        EventKind.NEWS,
        definition.code(),
        definition.sector(),
        stock.code(),
        definition.sectorWide(),
        day,
        EventRow.PENDING,
        truth.name(),
        magnitude,
        hint.direction() + "." + hint.strength() + "." + hint.detail().key() + "." + hintIndex,
        sway.name(),
        sway.name() + "." + swayIndex,
        NEWS_OPTIONS);
  }

  /** 관심 섹터는 가중치를 키우고, 최근에 나온 정의는 빼고 뽑는다 (specs/event.md 5.4절). */
  private NewsDefinition pickNews(
      List<EventRow> rows, SchedulingContext context, RandomGenerator rng) {
    List<EventRow> news = ofKind(rows, EventKind.NEWS);
    Set<String> recent =
        news
            .subList(Math.max(0, news.size() - properties.news().noRepeatWindow()), news.size())
            .stream()
            .map(EventRow::definitionCode)
            .collect(Collectors.toSet());
    List<NewsDefinition> all =
        content.news().stream()
            .filter(NewsDefinition::root)
            .filter(n -> n.appearsFor(context.investmentStyle()))
            .toList();
    // 사거나 팔 수 있는 어울리는 종목이 있는 뉴스만. 그런 뉴스가 없으면 전부에서 (decisions.md 59번·113번).
    List<NewsDefinition> actionable =
        all.stream()
            .filter(
                n ->
                    content.stocksOf(n.sector()).stream()
                        .filter(st -> n.fits(st.code()))
                        .anyMatch(st -> context.tradable(st.code())))
            .toList();
    List<NewsDefinition> eligible = actionable.isEmpty() ? all : actionable;
    List<NewsDefinition> fresh = eligible.stream().filter(n -> !recent.contains(n.code())).toList();
    return weighted(
        fresh.isEmpty() ? eligible : fresh,
        n ->
            n.weight()
                * (n.sector().equals(context.interestSector())
                    ? properties.news().interestWeightPercent()
                    : PERCENT),
        rng);
  }

  /**
   * 직업 선택 (decisions.md 26번). 선택지는 가중치로 뽑되, 기다린 뒤라면 직전 제안의 최고 월급보다 나은 직업을 하나는 섞는다(있다면). 끝에 "기다린다"
   * 선택지는 아직 기다릴 수 있고 지금 제안보다 월급이 많은 직업이 남아 있을 때만 붙고, 맨 끝에는 언제나 "전업투자자가 된다"가 붙는다.
   */
  private EventRow jobEvent(
      UUID id,
      int seq,
      List<EventRow> rows,
      int day,
      SchedulingContext context,
      SeededRandom random) {
    List<EventRow> streak = jobStreak(rows);
    boolean rehire = context.careerStartDay() != null;
    RandomGenerator rng = random.forKey("event", "job-options", streak.size());
    long bestBefore =
        streak.stream()
            .flatMap(r -> r.options().stream())
            .filter(ChoiceTicket.Job::isJobCode)
            .mapToLong(code -> content.job(code).baseMonthlySalary())
            .max()
            .orElse(0);
    // 직접 세운 회사의 대표 같은 직업은 제안에 나오지 않는다 (decisions.md 52번).
    List<JobDefinition> remaining =
        new ArrayList<>(content.jobs().stream().filter(JobDefinition::offered).toList());
    List<String> picked = new ArrayList<>();
    if (!streak.isEmpty()) {
      List<JobDefinition> better =
          remaining.stream().filter(j -> j.baseMonthlySalary() > bestBefore).toList();
      if (!better.isEmpty()) {
        JobDefinition job = weighted(better, JobDefinition::weight, rng);
        remaining.remove(job);
        picked.add(job.code());
      }
    }
    while (picked.size() < properties.job().optionCount() && !remaining.isEmpty()) {
      JobDefinition job = weighted(remaining, JobDefinition::weight, rng);
      remaining.remove(job);
      picked.add(job.code());
    }
    long bestNow =
        picked.stream().mapToLong(code -> content.job(code).baseMonthlySalary()).max().orElse(0);
    boolean betterExists =
        content.jobs().stream()
            .filter(JobDefinition::offered)
            .anyMatch(j -> j.baseMonthlySalary() > bestNow);
    if (streak.size() < properties.job().maxWaits() && betterExists) {
      picked.add(ChoiceTicket.Job.WAIT);
    }
    // 직업을 아예 고르지 않을 수도 있다: 월급 없이 투자로만 산다 (decisions.md 35번).
    picked.add(ChoiceTicket.Job.INVEST);
    String definition = streak.isEmpty() ? (rehire ? JOB_REHIRE : null) : JOB_RETRY;
    return simple(id, seq, EventKind.JOB, definition, day, picked);
  }

  /** 지금 이어지고 있는 "기다림" 줄: 마지막 직장 장면(실직) 뒤의 직업 선택들. 성장기라면 지금까지의 직업 선택 전부. */
  private List<EventRow> jobStreak(List<EventRow> rows) {
    List<EventRow> careers = ofKind(rows, EventKind.CAREER);
    int after = careers.isEmpty() ? -1 : last(careers).occursDay();
    return ofKind(rows, EventKind.JOB).stream().filter(r -> r.occursDay() > after).toList();
  }

  /**
   * 직장 장면. 직전 장면의 결과가 후속 장면을 정했으면 그것을 낸다. 아니면 지금 직업·나이·순자산·연차 조건을 만족하는 장면 중 직전 장면과 후속 전용 장면을 뺀
   * 나머지에서 가중치로 뽑는다 (decisions.md 51·52번). 이직 제안은 지금보다 월급이 많은 직업이 있을 때만 나오고, 옮길 직업을 선택지
   * 코드("move:<직업>")에 남긴다. 전업투자자는 직업 자리에 CareerDefinition.FULL_TIME_INVESTOR를 쓴다.
   */
  private EventRow careerEvent(
      UUID id,
      int seq,
      List<EventRow> rows,
      int day,
      SchedulingContext context,
      SeededRandom random) {
    RandomGenerator rng = random.forKey("event", "career", seq);
    List<EventRow> previous = ofKind(rows, EventKind.CAREER);
    Optional<FollowUp> followUp = followUp(previous);
    if (followUp.isPresent()) {
      CareerDefinition next = content.career(followUp.get().code());
      return simple(
          id,
          seq,
          EventKind.CAREER,
          next.code(),
          day,
          next.options().stream().map(CareerDefinition.Option::code).toList());
    }
    String lastCode = previous.isEmpty() ? null : last(previous).definitionCode();
    boolean investor = context.fullTimeInvestor();
    String jobCode = investor ? CareerDefinition.FULL_TIME_INVESTOR : context.jobCode();
    int start = investor ? context.careerStartDay() : context.jobStartDay();
    int tenure = Math.max(0, day - start) / calendar.daysPerYear();
    int age = ageAt(day, context);
    long currentSalary = investor ? Long.MAX_VALUE : content.job(jobCode).baseMonthlySalary();
    List<JobDefinition> betterJobs =
        content.jobs().stream()
            .filter(JobDefinition::offered)
            .filter(j -> j.baseMonthlySalary() > currentSalary)
            .toList();
    List<CareerDefinition> eligible =
        content.careers().stream()
            .filter(c -> !c.followUpOnly())
            .filter(c -> c.fits(jobCode, age, context.netWorth()))
            .filter(c -> c.minTenureYears() <= tenure)
            .filter(c -> !c.code().equals(lastCode))
            .filter(c -> !c.movesJob() || !betterJobs.isEmpty())
            .toList();
    if (eligible.isEmpty()) {
      // 조건을 다 풀어도 그 직업의 장면은 지킨다. 콘텐츠 검증이 직업마다 조건 없는 장면을 하나는 보장한다.
      eligible =
          content.careers().stream()
              .filter(c -> c.forJob(jobCode) && !c.movesJob() && c.unconditional())
              .toList();
    }
    CareerDefinition career = weighted(eligible, CareerDefinition::weight, rng);
    JobDefinition target =
        career.movesJob() ? weighted(betterJobs, JobDefinition::weight, rng) : null;
    List<String> options =
        career.options().stream()
            .map(o -> o.success().moveJob() ? MOVE_PREFIX + target.code() : o.code())
            .toList();
    return simple(id, seq, EventKind.CAREER, career.code(), day, options);
  }

  private static <T> T weighted(List<T> items, ToIntFunction<T> weight, RandomGenerator rng) {
    int total = items.stream().mapToInt(weight).sum();
    int roll = rng.nextInt(total);
    for (T item : items) {
      roll -= weight.applyAsInt(item);
      if (roll < 0) {
        return item;
      }
    }
    throw new IllegalStateException("가중치 합이 맞지 않는다");
  }

  private static EventRow simple(
      UUID id, int seq, EventKind kind, String definitionCode, int day, List<String> options) {
    return new EventRow(
        id,
        seq,
        kind,
        definitionCode,
        null,
        null,
        false,
        day,
        EventRow.PENDING,
        null,
        null,
        null,
        null,
        null,
        options);
  }

  private static List<EventRow> ofKind(List<EventRow> rows, EventKind kind, String definitionCode) {
    return rows.stream()
        .filter(r -> r.kind() == kind && definitionCode.equals(r.definitionCode()))
        .toList();
  }

  private static int roll(
      SeededRandom random, EventProperties.Range range, String kind, int index) {
    return random.forKey("event", "gap", kind, index).nextInt(range.min(), range.max() + 1);
  }

  private static List<EventRow> ofKind(List<EventRow> rows, EventKind kind) {
    return rows.stream().filter(r -> r.kind() == kind).toList();
  }

  private static EventRow last(List<EventRow> rows) {
    return rows.stream().max(Comparator.comparingInt(EventRow::occursDay)).orElseThrow();
  }

  private static OptionalInt dayOf(Optional<Candidate> candidate) {
    return candidate.map(c -> OptionalInt.of(c.day())).orElse(OptionalInt.empty());
  }

  private record Candidate(EventKind kind, int day) {}
}
