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
import investorgame.content.ShakeDefinition;
import investorgame.content.StockDefinition;
import investorgame.content.TraitDefinition;
import investorgame.event.ChoiceTicket;
import investorgame.event.CompleteResult;
import investorgame.event.Completion;
import investorgame.event.EventKind;
import investorgame.event.EventService;
import investorgame.event.EventView;
import investorgame.event.HintProvider;
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
  static final String MARRIAGE = "marriage";
  static final String CHILD = "child";

  /** 직업 선택 행의 definition_code: null이면 첫 선택, RETRY는 기다린 뒤, REHIRE는 실직 뒤. 문구가 달라진다. */
  static final String JOB_RETRY = "retry";

  static final String JOB_REHIRE = "rehire";

  /** 이직 제안의 선택지 코드는 "move:<직업 코드>"다. 옮길 직업을 행에 같이 남긴다. */
  static final String MOVE_PREFIX = "move:";

  private static final List<String> NEWS_OPTIONS = List.of("BUY", "SELL", "HOLD");

  /** 흔들림: 버틴다(HOLD)·판다(SELL). 문구는 렌더러가 붙인다 (decisions.md 33번). */
  private static final List<String> SHAKE_OPTIONS = List.of("HOLD", "SELL");

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
            TraitDefinition.Option chosen =
                renderer.trait(row.definitionCode()).options().stream()
                    .filter(o -> o.code().equals(optionCode))
                    .findFirst()
                    .orElseThrow();
            yield new ChoiceTicket.Trait(chosen.traitDeltas(), chosen.statDeltas(), chosen.note());
          }
          case OFFER -> new ChoiceTicket.Offer(ACCEPT.equals(optionCode));
          case LIFE ->
              new ChoiceTicket.Life(
                  MARRIAGE.equals(row.definitionCode())
                      ? ChoiceTicket.LifeKind.MARRIAGE
                      : ChoiceTicket.LifeKind.CHILD,
                  ACCEPT.equals(optionCode));
          case NEWS -> new ChoiceTicket.News();
          case SHAKE -> new ChoiceTicket.Shake();
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
        row.hiddenDirection() == null ? null : Direction.valueOf(row.hiddenDirection()),
        row.hiddenMagnitudeBp() == null ? 0 : row.hiddenMagnitudeBp(),
        row.swaySentiment() == null ? null : Sentiment.valueOf(row.swaySentiment()),
        effect);
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
      List<EventRow> news = ofKind(rows, EventKind.NEWS);
      int base = news.isEmpty() ? context.investingStartDay() : last(news).occursDay();
      EventProperties.Range gap = properties.style(context.investmentStyle()).newsGapDays();
      candidates.add(new Candidate(EventKind.NEWS, base + roll(random, gap, "NEWS", news.size())));
      shakeCandidate(rows, context, random, candidates);
    }
    if (context.phase() != Phase.CHILDHOOD && context.careerStartDay() != null) {
      adultTraitCandidate(rows, context, random, candidates);
      lifeCandidates(rows, context, random, candidates);
      noticeCandidate(rows, context, random, candidates);
      careerCandidates(rows, context, random, candidates);
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
   * 취업 뒤 직장 (decisions.md 26번). 직업이 있으면 직장 장면(CAREER)이 간격을 두고 오고, 실직 중이면 다시 직업 선택(JOB)이 온다. 은퇴했거나
   * 전업투자자이거나 career.last-age를 넘으면 둘 다 없다.
   */
  private void careerCandidates(
      List<EventRow> rows,
      SchedulingContext context,
      SeededRandom random,
      List<Candidate> candidates) {
    if (context.retired() || context.fullTimeInvestor()) {
      return;
    }
    List<EventRow> careers = ofKind(rows, EventKind.CAREER);
    List<EventRow> jobs = ofKind(rows, EventKind.JOB);
    int day;
    EventKind kind;
    if (context.jobStartDay() == null) {
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

  /** 아직 안 나온 adult 장면. 직장이 배경인 장면(job)은 직장에 다니는 동안에만 고른다. 실직·은퇴 중에는 풀에 남겨 두었다가 다시 취업하면 나온다. */
  private List<TraitDefinition> adultTraitsLeft(List<EventRow> rows, SchedulingContext context) {
    List<EventRow> used = adultTraits(rows);
    boolean working = context.jobStartDay() != null && !context.retired();
    return content.adultTraits().stream()
        .filter(t -> working || !t.job())
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

  /** 결혼은 27~31세에 처음 묻고 거절하면 2년 뒤, 자녀는 결혼 1~2년 뒤부터 2~3년 간격으로 셋까지 (경제 개편 설계 7.3절). */
  private void lifeCandidates(
      List<EventRow> rows,
      SchedulingContext context,
      SeededRandom random,
      List<Candidate> candidates) {
    EventProperties.LifeSettings life = properties.life();
    int year = calendar.daysPerYear();
    if (!context.married()) {
      List<EventRow> asked = ofKind(rows, EventKind.LIFE, MARRIAGE);
      int day =
          asked.isEmpty()
              ? dayOfAge(
                  random
                      .forKey("event", "life", "marriage-age")
                      .nextInt(life.marriageAge().min(), life.marriageAge().max() + 1),
                  context)
              : last(asked).occursDay() + life.marriageRetryYears() * year;
      if (ageAt(day, context) <= life.marriageLastAge()) {
        candidates.add(new Candidate(EventKind.LIFE, day));
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
        candidates.add(new Candidate(EventKind.LIFE, day));
      }
    }
  }

  /** 보유 종목이 있을 때만: 마지막 흔들림(없으면 투자 시작일) + 간격. 어떤 종목이 흔들리는지는 만들 때 뽑는다 (decisions.md 33번). */
  private void shakeCandidate(
      List<EventRow> rows,
      SchedulingContext context,
      SeededRandom random,
      List<Candidate> candidates) {
    if (context.heldStockCodes().isEmpty()) {
      return;
    }
    List<EventRow> shakes = ofKind(rows, EventKind.SHAKE);
    int base = shakes.isEmpty() ? context.investingStartDay() : last(shakes).occursDay();
    candidates.add(
        new Candidate(
            EventKind.SHAKE,
            base + roll(random, properties.shake().gapDays(), "SHAKE", shakes.size())));
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
          simple(id, seq, EventKind.OFFER, null, candidate.day(), List.of(ACCEPT, DECLINE));
      case LIFE ->
          simple(
              id,
              seq,
              EventKind.LIFE,
              context.married() ? CHILD : MARRIAGE,
              candidate.day(),
              List.of(ACCEPT, DECLINE));
      case NOTICE -> notice(id, seq, candidate.day(), context, random);
      case NEWS -> news(id, seq, rows, candidate.day(), context, random, hints);
      case SHAKE -> shake(id, seq, candidate.day(), context, random);
    };
  }

  /** 보유 종목 흔들림. 보유 중 한 종목과 장면을 뽑고, 선택 뒤 그 종목이 움직일 숨은 방향·폭을 정한다. 힌트·다른 뉴스는 없다 (decisions.md 33번). */
  private EventRow shake(
      UUID id, int seq, int day, SchedulingContext context, SeededRandom random) {
    RandomGenerator rng = random.forKey("event", "shake", seq);
    List<String> held = context.heldStockCodes();
    String stockCode = held.get(rng.nextInt(held.size()));
    ShakeDefinition definition = weighted(content.shakes(), ShakeDefinition::weight, rng);
    EventProperties.ShakeSettings settings = properties.shake();
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

  /** 알림 정의를 가중치로 뽑는다. 결혼 뒤에만 나오는 정의는 미혼이면 후보에서 뺀다. 만들어지는 순간 RESOLVED다. */
  private EventRow notice(
      UUID id, int seq, int day, SchedulingContext context, SeededRandom random) {
    List<NoticeDefinition> eligible =
        content.notices().stream().filter(n -> context.married() || !n.requiresMarried()).toList();
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
    List<StockDefinition> stocks = content.stocksOf(definition.sector());
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
    List<String> hintPhrases = content.hintPhrases(hint.direction().name(), hint.strength().name());
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
        hint.direction() + "." + hint.strength() + "." + hintIndex,
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
    List<NewsDefinition> eligible =
        content.news().stream()
            .filter(NewsDefinition::root)
            .filter(n -> n.appearsFor(context.investmentStyle()))
            .toList();
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
    List<JobDefinition> remaining = new ArrayList<>(content.jobs());
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
    boolean betterExists = content.jobs().stream().anyMatch(j -> j.baseMonthlySalary() > bestNow);
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
   * 직장 장면. 연차 조건을 만족하는 장면 중 직전 장면을 뺀 나머지에서 가중치로 뽑는다. 이직 제안은 지금보다 월급이 많은 직업이 있을 때만 나오고, 옮길 직업을 선택지
   * 코드("move:<직업>")에 남긴다.
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
    String lastCode = previous.isEmpty() ? null : last(previous).definitionCode();
    int tenure = Math.max(0, day - context.jobStartDay()) / calendar.daysPerYear();
    long currentSalary = content.job(context.jobCode()).baseMonthlySalary();
    List<JobDefinition> betterJobs =
        content.jobs().stream().filter(j -> j.baseMonthlySalary() > currentSalary).toList();
    List<CareerDefinition> eligible =
        content.careers().stream()
            .filter(c -> c.minTenureYears() <= tenure)
            .filter(c -> !c.code().equals(lastCode))
            .filter(c -> !c.movesJob() || !betterJobs.isEmpty())
            .toList();
    if (eligible.isEmpty()) {
      eligible = content.careers().stream().filter(c -> !c.movesJob()).toList();
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
