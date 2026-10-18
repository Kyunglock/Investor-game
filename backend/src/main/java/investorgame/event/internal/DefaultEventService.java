package investorgame.event.internal;

import investorgame.common.Direction;
import investorgame.common.GameProperties;
import investorgame.common.Hint;
import investorgame.common.Phase;
import investorgame.common.Sentiment;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.JobDefinition;
import investorgame.content.NewsDefinition;
import investorgame.content.NoticeDefinition;
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
  private static final List<String> NEWS_OPTIONS = List.of("BUY", "SELL", "HOLD");
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
    boolean traitsComplete =
        row.kind() == EventKind.TRAIT
            && repository.findAll(gameId).stream()
                    .filter(r -> r.kind() == EventKind.TRAIT && r.resolved())
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
    }
    if (context.phase() != Phase.CHILDHOOD && context.jobStartDay() != null) {
      lifeCandidates(rows, context, random, candidates);
      noticeCandidate(rows, context, random, candidates);
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
      int day = dayOfAge(stages.get(traits.size()).age(), context);
      int after = traits.isEmpty() ? 0 : last(traits).occursDay();
      candidates.add(new Candidate(EventKind.TRAIT, Math.max(day, after)));
    } else if (context.traitsFinalized() && ofKind(rows, EventKind.JOB).isEmpty()) {
      int day = dayOfAge(properties.job().age(), context);
      candidates.add(new Candidate(EventKind.JOB, Math.max(day, last(traits).occursDay())));
    }
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

  private void noticeCandidate(
      List<EventRow> rows,
      SchedulingContext context,
      SeededRandom random,
      List<Candidate> candidates) {
    List<EventRow> notices = ofKind(rows, EventKind.NOTICE);
    int base = notices.isEmpty() ? context.jobStartDay() : last(notices).occursDay();
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
      case JOB ->
          simple(
              id,
              seq,
              EventKind.JOB,
              null,
              candidate.day(),
              sampleJobs(random.forKey("event", "job-options")));
      case TRAIT -> {
        // 단계마다 장면을 판 시드로 랜덤하게 뽑는다. 판마다 다른 질문이 나오고, 같은 판은 다시 불러도 같다.
        int stage = ofKind(rows, EventKind.TRAIT).size();
        List<TraitDefinition> scenes = content.traitStages().get(stage).scenes();
        TraitDefinition trait =
            scenes.get(random.forKey("event", "trait-scene", stage).nextInt(scenes.size()));
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
    };
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

  private List<String> sampleJobs(RandomGenerator rng) {
    List<JobDefinition> remaining = new ArrayList<>(content.jobs());
    List<String> picked = new ArrayList<>();
    while (picked.size() < properties.job().optionCount() && !remaining.isEmpty()) {
      JobDefinition job = weighted(remaining, JobDefinition::weight, rng);
      remaining.remove(job);
      picked.add(job.code());
    }
    return picked;
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
