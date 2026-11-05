package investorgame.raising.internal;

import investorgame.behavior.BehaviorService;
import investorgame.behavior.ChoiceContext;
import investorgame.behavior.Resolution;
import investorgame.common.Action;
import investorgame.common.Deviation;
import investorgame.common.Direction;
import investorgame.common.Hint;
import investorgame.common.Korean;
import investorgame.common.Sentiment;
import investorgame.common.StatCodes;
import investorgame.common.StatGrade;
import investorgame.common.Stats;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.CrisisDefinition;
import investorgame.content.NewsClues;
import investorgame.content.NewsDefinition;
import investorgame.content.RaisingContent;
import investorgame.content.StockDefinition;
import investorgame.raising.CardKind;
import investorgame.raising.CardOutcome;
import investorgame.raising.internal.RaisingProperties.ScriptedNews;
import investorgame.raising.internal.RaisingProperties.Slot;
import investorgame.raising.internal.RunState.Card;
import investorgame.raising.internal.RunState.Holding;
import investorgame.raising.internal.RunState.Option;
import investorgame.raising.internal.RunState.Sentence;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.random.RandomGenerator;
import org.springframework.stereotype.Component;

/**
 * 육성 한 판의 규칙: 카드를 펼치고, 고른 것을 판정하고, 시장을 한 장만큼 움직인다 (증권사 육성 설계 3절, 투자 원칙 장치 설계 1~3절). DB와 시각을 모르고 상태와
 * 난수만 받는다. 난수는 판 시드에서 (용도, 카드 번호)로 유도해 같은 판·같은 선택이면 같은 결과가 나온다.
 */
@Component
class RunEngine {

  static final String BUY = "BUY";
  static final String BUY_SMALL = "BUY_SMALL";
  static final String BUY_BIG = "BUY_BIG";
  static final String SELL = "SELL";
  static final String HOLD = "HOLD";
  static final String ACCEPT = "ACCEPT";
  static final String DECLINE = "DECLINE";
  static final String BORROW = "BORROW";
  static final String PASS = "PASS";
  static final String REGISTER = "REGISTER";

  /** 처음 온 사람에게 하나씩 여는 기능 (증권사 육성 설계 11.1절). 사기·지켜보기는 처음부터 있다. */
  static final String UNLOCK_SELL = "sell";

  static final String UNLOCK_HIGHLIGHTER = "highlighter";
  static final String UNLOCK_SIZE = "size";
  static final String UNLOCK_PRINCIPLE = "principle";
  static final String TIP_FLIP = "flip";

  static final String MODE_EASY = "EASY";
  static final String MODE_FLIP = "FLIP";
  static final String MODE_MISLEAD = "MISLEAD";

  private static final String UP = "UP";
  private static final String DOWN = "DOWN";
  private static final String NEUTRAL = "NEUTRAL";
  private static final int BP = 10_000;
  private static final int PERCENT = 100;
  private static final int SIDE_SENTENCES = 2;

  private final ContentCatalog content;
  private final BehaviorService behavior;
  private final RaisingProperties properties;

  RunEngine(ContentCatalog content, BehaviorService behavior, RaisingProperties properties) {
    this.content = content;
    this.behavior = behavior;
    this.properties = properties;
    for (ScriptedNews script : properties.scripted().news()) {
      NewsDefinition news =
          content.news().stream()
              .filter(n -> n.code().equals(script.news()))
              .findFirst()
              .orElseThrow(() -> new IllegalStateException("짜인 첫 판의 뉴스가 없다: " + script.news()));
      if (!news.sector().equals(content.stock(script.stock()).sector())
          || !news.fits(script.stock())) {
        throw new IllegalStateException("짜인 첫 판의 종목이 뉴스와 맞지 않다: " + script.stock());
      }
    }
  }

  int cardCount() {
    return properties.deck().size();
  }

  /** 새 판. 첫 카드까지 펼쳐 둔다. */
  RunState create(SeededRandom random, boolean scripted, RaisingMemory memory) {
    return create(random, scripted, memory, properties.fund(), false, null);
  }

  /**
   * 회사의 올해 시장 (증권사 육성 설계 6.2절). 공채 육성은 그해 회사가 겪는 시장과 같은 시장에서 한다.
   *
   * @param phase boom·normal·crash
   * @param omen 연초 회의에 뜬 폭락 조짐. 없으면 null. 폭락장이 아닌 해의 헛조짐일 수도 있다
   */
  record Year(String phase, String omen) {}

  /** fund: 운용금. 첫 육성은 사장의 사재, 공채 육성은 회사가 내준 돈 (6.5절). year: 공채 육성이면 회사의 올해 시장, 아니면 null. */
  RunState create(
      SeededRandom random,
      boolean scripted,
      RaisingMemory memory,
      long fund,
      boolean recruit,
      Year year) {
    RunState run = new RunState();
    run.scripted = scripted;
    run.fund = fund;
    run.cash = fund;
    run.recruit = recruit;
    run.marketPhase = year == null ? null : year.phase();
    if (scripted) {
      run.stats.putAll(properties.scripted().stats());
    } else {
      RandomGenerator rng = random.forKey("stats");
      for (String code : StatCodes.ALL) {
        run.stats.put(code, rollStat(rng));
      }
    }
    for (StockDefinition stock : content.stocks()) {
      run.startPrices.put(stock.code(), stock.basePrice());
      run.prices.put(stock.code(), stock.basePrice());
    }
    planCrisis(run, random.forKey("crisis"), scripted, year);
    deal(run, memory, random);
    return run;
  }

  /** 능력치마다 등급을 먼저 뽑고 그 띠 안에서 점수를 뽑는다 (decisions.md 24번, character.initial-stat과 같은 규칙). */
  private int rollStat(RandomGenerator rng) {
    int roll = rng.nextInt(PERCENT);
    int acc = 0;
    for (StatGrade grade : StatGrade.values()) {
      acc += properties.initialStat().gradePercent().getOrDefault(grade.name(), 0);
      if (roll < acc) {
        int min = Math.max(grade.min(), properties.initialStat().floor());
        return min + rng.nextInt(grade.max() - min + 1);
      }
    }
    throw new IllegalStateException("initial-stat.grade-percent의 합이 100이 아니다");
  }

  /**
   * 육성에서도 경기 흐름의 전조와 위기가 온다 (3.1절). 짜인 첫 판에는 위기가 없다: 가르칠 것에만 집중한다. 공채 육성은 회사의 올해 시장을 따른다 (6.2절):
   * 폭락장이면 반드시 위기가 오고 연초 회의의 조짐이 신입의 뉴스에도 나온다. 폭락장이 아닌 해의 헛조짐도 뉴스에 한 번 나오지만 아무 일도 없다.
   */
  private void planCrisis(RunState run, RandomGenerator rng, boolean scripted, Year year) {
    RaisingProperties.Crisis settings = properties.crisis();
    int chanceRoll = rng.nextInt(PERCENT);
    int silentRoll = rng.nextInt(PERCENT);
    List<Integer> newsSlots = new ArrayList<>();
    for (int i = 0; i < properties.deck().size(); i++) {
      if (properties.deck().get(i) == Slot.NEWS) {
        newsSlots.add(i);
      }
    }
    List<Integer> candidates =
        newsSlots.stream()
            .filter(i -> i >= settings.fromCard())
            .filter(i -> newsSlots.indexOf(i) >= settings.omenCards())
            .toList();
    int atRoll = rng.nextInt(Math.max(1, candidates.size()));
    List<CrisisDefinition> crises = content.crises();
    int which = rng.nextInt(crises.size());
    if (year != null && !candidates.isEmpty()) {
      planYear(run, rng, year, newsSlots, candidates.get(atRoll), crises.get(which));
      return;
    }
    if (scripted || candidates.isEmpty() || chanceRoll >= settings.chancePercent()) {
      return;
    }
    RunState.Crisis crisis = new RunState.Crisis();
    crisis.code = crises.get(which).code();
    crisis.atCard = candidates.get(atRoll);
    if (silentRoll >= settings.silentPercent()) {
      List<String> omens = new ArrayList<>(crises.get(which).omens());
      int at = newsSlots.indexOf(crisis.atCard);
      for (int k = settings.omenCards(); k >= 1; k--) {
        crisis.omenCards.add(newsSlots.get(at - k));
        crisis.omens.add(omens.remove(rng.nextInt(omens.size())));
      }
    }
    run.crisis = crisis;
  }

  private void planYear(
      RunState run,
      RandomGenerator rng,
      Year year,
      List<Integer> newsSlots,
      int atCard,
      CrisisDefinition fallback) {
    boolean crash = CompanyEngine.CRASH.equals(year.phase());
    if (!crash && year.omen() == null) {
      return;
    }
    RunState.Crisis crisis = new RunState.Crisis();
    crisis.atCard = atCard;
    crisis.hits = crash;
    int at = newsSlots.indexOf(atCard);
    if (!crash) {
      // 헛조짐: 위기 자리 바로 앞 뉴스에 한 번 나오고 아무 일도 없다.
      crisis.code = fallback.code();
      crisis.omenCards.add(newsSlots.get(at - 1));
      crisis.omens.add(year.omen());
      run.crisis = crisis;
      return;
    }
    CrisisDefinition definition =
        content.crises().stream()
            .filter(c -> year.omen() != null && c.omens().contains(year.omen()))
            .findFirst()
            .orElse(fallback);
    crisis.code = definition.code();
    if (year.omen() != null) {
      // 첫 조짐은 연초 회의에서 본 그 문장이다. 나머지는 같은 갈래의 조짐.
      List<String> omens = new ArrayList<>(definition.omens());
      omens.remove(year.omen());
      for (int k = properties.crisis().omenCards(); k >= 1; k--) {
        crisis.omenCards.add(newsSlots.get(at - k));
        crisis.omens.add(
            crisis.omens.isEmpty() ? year.omen() : omens.remove(rng.nextInt(omens.size())));
      }
    }
    run.crisis = crisis;
  }

  // ---------------------------------------------------------------- 카드 펼치기

  /** 지금 카드 번호의 카드를 펼친다. 끝났으면 비운다. */
  void deal(RunState run, RaisingMemory memory, SeededRandom random) {
    if (run.card >= properties.deck().size()) {
      run.current = null;
      return;
    }
    RandomGenerator rng = random.forKey("deal", run.card);
    Slot slot = properties.deck().get(run.card);
    run.current =
        switch (slot) {
          case TRAIT_STYLE ->
              contentCard(run, CardKind.TRAIT, traitsOf(RaisingContent.SLOT_STYLE), rng);
          case TRAIT_SECTOR ->
              contentCard(run, CardKind.TRAIT, traitsOf(RaisingContent.SLOT_SECTOR), rng);
          case NEWS -> newsSlot(run, memory, rng);
          case BIG -> contentCard(run, CardKind.BIG, content.raising().bigs(), rng);
          case LEVERAGE -> leverageCard(run, rng);
          case EXAM -> examCard();
        };
  }

  private List<RaisingContent.Card> traitsOf(String slot) {
    return content.raising().traits().stream().filter(c -> slot.equals(c.slot())).toList();
  }

  private Card contentCard(
      RunState run, CardKind kind, List<RaisingContent.Card> pool, RandomGenerator rng) {
    List<RaisingContent.Card> fresh =
        pool.stream().filter(c -> !run.usedCards.contains(c.code())).toList();
    List<RaisingContent.Card> from = fresh.isEmpty() ? pool : fresh;
    RaisingContent.Card picked = from.get(rng.nextInt(from.size()));
    run.usedCards.add(picked.code());
    Card card = new Card();
    card.kind = kind;
    card.code = picked.code();
    card.title = picked.title();
    card.body = picked.body();
    for (RaisingContent.Option option : picked.options()) {
      card.options.add(new Option(option.code(), option.label(), null));
    }
    return card;
  }

  private Card examCard() {
    RaisingContent.Exam exam = content.raising().exam();
    Card card = new Card();
    card.kind = CardKind.EXAM;
    card.title = exam.title();
    card.body = exam.body();
    card.options.add(new Option(REGISTER, exam.registerLabel(), null));
    return card;
  }

  /** 뉴스 자리. 원칙 카드·풀기 카드가 기다리면 그 자리를 대신한다: 판 전체 카드 수는 늘지 않는다 (투자 원칙 장치 설계 1.2절). */
  private Card newsSlot(RunState run, RaisingMemory memory, RandomGenerator rng) {
    if (run.pendingPrinciple != null) {
      String stat = run.pendingPrinciple;
      run.pendingPrinciple = null;
      run.principlesOffered++;
      Card card = deviceCard(CardKind.PRINCIPLE, stat);
      if (memory.unlocked.add(UNLOCK_PRINCIPLE)) {
        tip(card, memory, UNLOCK_PRINCIPLE);
      }
      return card;
    }
    if (run.pendingRelease != null) {
      String stat = run.pendingRelease;
      run.pendingRelease = null;
      run.releaseOffered = true;
      return deviceCard(CardKind.RELEASE, stat);
    }
    return newsCard(run, memory, rng);
  }

  private Card deviceCard(CardKind kind, String stat) {
    RaisingContent.Device device = device(stat);
    Card card = new Card();
    card.kind = kind;
    card.code = device.code();
    card.deviceStat = stat;
    if (kind == CardKind.PRINCIPLE) {
      card.title = device.offerTitle();
      card.body = device.offerBody();
      card.options.add(new Option(ACCEPT, device.acceptLabel(), device.cost()));
      card.options.add(new Option(DECLINE, device.declineLabel(), null));
    } else {
      card.title = device.releaseTitle();
      card.body = device.releaseBody();
      card.options.add(new Option(ACCEPT, device.releaseLabel(), null));
      card.options.add(new Option(DECLINE, device.keepLabel(), device.cost()));
    }
    return card;
  }

  RaisingContent.Device device(String stat) {
    return content.raising().devices().stream()
        .filter(d -> d.statCode().equals(stat))
        .findFirst()
        .orElseThrow();
  }

  private Card newsCard(RunState run, RaisingMemory memory, RandomGenerator rng) {
    // 난수는 쓰이지 않는 단계도 같은 순서로 뽑는다. 짜인 판이든 아니든 수열이 같아야 재현된다.
    int pickRoll = rng.nextInt(BP);
    int stockRoll = rng.nextInt(BP);
    int upRoll = rng.nextInt(BP);
    int magnitudeRoll = rng.nextInt(BP);
    int swayRoll = rng.nextInt(2);
    int swayPhraseRoll = rng.nextInt(BP);
    int tempterRoll = rng.nextInt(BP);
    int memoRoll = rng.nextInt(BP);

    ScriptedNews script =
        run.scripted && run.scriptedNews < properties.scripted().news().size()
            ? properties.scripted().news().get(run.scriptedNews)
            : null;
    if (run.scripted) {
      run.scriptedNews++;
    }
    NewsDefinition news =
        script != null
            ? content.news().stream()
                .filter(n -> n.code().equals(script.news()))
                .findFirst()
                .orElseThrow()
            : pickNews(run, pickRoll);
    run.usedNews.add(news.code());
    String stockCode = script != null ? script.stock() : pickStock(news, stockRoll);
    StockDefinition stock = content.stock(stockCode);
    // 공채 육성은 회사의 올해 시장을 따른다: 호황이면 오르는 뉴스가, 폭락장이면 내리는 뉴스가 많다 (6.2절).
    int upBp =
        news.directionRule().upBp()
            + (run.marketPhase == null
                ? 0
                : properties.yearUpBp().getOrDefault(run.marketPhase, 0));
    boolean up = script != null ? script.up() : upRoll < upBp;
    int magnitude =
        news.magnitude().minBp()
            + magnitudeRoll % (news.magnitude().maxBp() - news.magnitude().minBp() + 1);

    Card card = new Card();
    card.kind = CardKind.NEWS;
    card.code = news.code();
    card.stockCode = stockCode;
    card.sectorWide = news.sectorWide();
    card.up = up;
    card.magnitudeBp = magnitude;
    card.scriptMode = script == null ? null : script.mode();
    Map<String, String> names = names(stock);
    card.title = Korean.fill(news.title(), names);

    tipsForNews(card, memory);
    buildArticle(card, run, memory, rng, names, news, memoRoll);

    // 단톡방을 나가면 꼬드김도, 세상사(폭락 조짐)도 보이지 않는다 (투자 원칙 장치 설계 1.1절).
    boolean chatLeft = run.devices.contains(StatCodes.CONVICTION);
    if (!chatLeft && card.scriptMode == null || MODE_FLIP.equals(card.scriptMode)) {
      Sentiment sentiment = swayRoll == 0 ? Sentiment.POS : Sentiment.NEG;
      List<String> phrases = content.swayPhrases(sentiment.name());
      List<RaisingContent.Tempter> tempters = content.raising().tempters();
      card.swaySentiment = sentiment.name();
      card.sway = phrases.get(swayPhraseRoll % phrases.size());
      card.tempter = tempters.get(tempterRoll % tempters.size()).code();
    }
    if (!chatLeft && run.crisis != null) {
      int at = run.crisis.omenCards.indexOf(run.card);
      if (at >= 0) {
        card.omen = run.crisis.omens.get(at);
      }
    }
    newsOptions(card, run, memory);
    return card;
  }

  private Map<String, String> names(StockDefinition stock) {
    return Map.of("stock", stock.name(), "sectorName", content.sectorName(stock.sector()));
  }

  /** 관심 섹터의 뉴스가 두 배로 자주 나온다. 이 판에 나온 뉴스는 다시 나오지 않는다. */
  private NewsDefinition pickNews(RunState run, int roll) {
    String sector = topTrait(run, "sector.");
    List<NewsDefinition> pool =
        content.news().stream()
            .filter(NewsDefinition::root)
            .filter(n -> !run.usedNews.contains(n.code()))
            .toList();
    int total = 0;
    for (NewsDefinition n : pool) {
      total += weight(n, sector);
    }
    int pick = (int) ((long) roll * total / BP);
    for (NewsDefinition n : pool) {
      pick -= weight(n, sector);
      if (pick < 0) {
        return n;
      }
    }
    return pool.getLast();
  }

  private static int weight(NewsDefinition news, String sector) {
    return news.sector().equals(sector) ? news.weight() * 2 : news.weight();
  }

  private String pickStock(NewsDefinition news, int roll) {
    List<StockDefinition> stocks =
        content.stocksOf(news.sector()).stream().filter(s -> news.fits(s.code())).toList();
    return stocks.get(roll % stocks.size()).code();
  }

  /**
   * 단서 기사: 결정적 문장 하나(숨은 방향 쪽) + 곁가지 둘(반대쪽으로 기운 무작위) + 중립 하나를 섞는다. 형광펜은 안목 정답률로 결정적 문장에, 빗나가면 반대쪽
   * 곁가지에 긋는다 (투자 원칙 장치 설계 3.1절).
   */
  private void buildArticle(
      Card card,
      RunState run,
      RaisingMemory memory,
      RandomGenerator rng,
      Map<String, String> names,
      NewsDefinition news,
      int memoRoll) {
    NewsClues clues = content.clues(news.code());
    String truth = card.up ? UP : DOWN;
    String other = card.up ? DOWN : UP;
    List<String> truthPool = new ArrayList<>(card.up ? clues.up() : clues.down());
    List<String> otherPool = new ArrayList<>(card.up ? clues.down() : clues.up());
    List<String> neutralPool = new ArrayList<>(clues.neutral());

    int[] sideRolls = new int[SIDE_SENTENCES];
    for (int i = 0; i < SIDE_SENTENCES; i++) {
      sideRolls[i] = rng.nextInt(PERCENT);
    }
    List<Sentence> sentences = new ArrayList<>();
    sentences.add(new Sentence(draw(truthPool, rng, names), truth, true));
    for (int i = 0; i < SIDE_SENTENCES; i++) {
      boolean opposite =
          switch (card.scriptMode == null ? "" : card.scriptMode) {
            case MODE_EASY -> false;
            case MODE_MISLEAD -> i == SIDE_SENTENCES - 1;
            default -> sideRolls[i] < properties.sideOppositePercent();
          };
      sentences.add(
          opposite
              ? new Sentence(draw(otherPool, rng, names), other, false)
              : new Sentence(draw(truthPool, rng, names), truth, false));
    }
    sentences.add(new Sentence(draw(neutralPool, rng, names), NEUTRAL, false));
    // 섞는다 (Fisher-Yates).
    for (int i = sentences.size() - 1; i > 0; i--) {
      int j = rng.nextInt(i + 1);
      Sentence t = sentences.get(i);
      sentences.set(i, sentences.get(j));
      sentences.set(j, t);
    }
    card.sentences = sentences;

    Hint hint =
        behavior.hint(
            run.stats.get(StatCodes.INSIGHT), card.up ? Direction.UP : Direction.DOWN, rng);
    if (!memory.unlocked.contains(UNLOCK_HIGHLIGHTER)) {
      return;
    }
    Hint.HintDirection pointed = hint.direction();
    if (MODE_MISLEAD.equals(card.scriptMode)) {
      pointed = card.up ? Hint.HintDirection.DOWN : Hint.HintDirection.UP;
    }
    if (pointed != Hint.HintDirection.NEUTRAL) {
      boolean right = pointed.name().equals(truth);
      card.highlight =
          right ? decisiveIndex(card) : oppositeSide(card, other, otherPool, rng, names);
    }
    List<String> memos =
        content.hintPhrases(
            hint.detail().key(),
            pointed.name(),
            pointed == Hint.HintDirection.NEUTRAL
                ? Hint.HintStrength.MILD.name()
                : hint.strength().name());
    Map<String, String> values = new HashMap<>(names);
    values.put("min", String.valueOf(news.magnitude().minBp() / PERCENT));
    values.put("max", String.valueOf(news.magnitude().maxBp() / PERCENT));
    card.memo = Korean.fill(memos.get(memoRoll % memos.size()), values);
  }

  private static int decisiveIndex(Card card) {
    for (int i = 0; i < card.sentences.size(); i++) {
      if (card.sentences.get(i).decisive) {
        return i;
      }
    }
    throw new IllegalStateException("결정적 문장이 없다");
  }

  /** 빗나간 형광펜이 그을 반대쪽 곁가지. 곁가지가 모두 같은 쪽이면 하나를 반대쪽 문장으로 바꾼다. */
  private static int oppositeSide(
      Card card,
      String other,
      List<String> otherPool,
      RandomGenerator rng,
      Map<String, String> names) {
    for (int i = 0; i < card.sentences.size(); i++) {
      if (card.sentences.get(i).sign.equals(other)) {
        return i;
      }
    }
    for (int i = 0; i < card.sentences.size(); i++) {
      Sentence s = card.sentences.get(i);
      if (!s.decisive && !s.sign.equals(NEUTRAL)) {
        card.sentences.set(i, new Sentence(draw(otherPool, rng, names), other, false));
        return i;
      }
    }
    throw new IllegalStateException("곁가지 문장이 없다");
  }

  private static String draw(List<String> pool, RandomGenerator rng, Map<String, String> names) {
    return Korean.fill(pool.remove(rng.nextInt(pool.size())), names);
  }

  /** 처음 온 사람에게는 사기·지켜보기만, 주식이 생기면 팔기, 형광펜을 한 번 본 다음 뉴스부터 조금/크게 (11.1절). */
  private void tipsForNews(Card card, RaisingMemory memory) {
    if (memory.tipsShown.contains(UNLOCK_HIGHLIGHTER) && memory.unlocked.add(UNLOCK_SIZE)) {
      tip(card, memory, UNLOCK_SIZE);
    }
    for (String feature : List.of(UNLOCK_SELL, UNLOCK_HIGHLIGHTER)) {
      if (memory.unlocked.contains(feature) && !memory.tipsShown.contains(feature)) {
        tip(card, memory, feature);
      }
    }
  }

  private void tip(Card card, RaisingMemory memory, String feature) {
    memory.tipsShown.add(feature);
    String text = content.raising().unlockTips().get(feature);
    if (text != null) {
      card.tips.add(text);
    }
  }

  private void newsOptions(Card card, RunState run, RaisingMemory memory) {
    long held = run.held(card.stockCode);
    boolean autoBuy = run.devices.contains(StatCodes.COURAGE);
    if (!memory.unlocked.contains(UNLOCK_SIZE)) {
      card.options.add(new Option(BUY, "산다", amount(run.cash, properties.buyRatioBp())));
    } else if (autoBuy) {
      card.options.add(
          new Option(BUY_SMALL, "조금 산다 (자동이체)", amount(run.cash, properties.smallRatioBp())));
    } else {
      card.options.add(new Option(BUY_SMALL, "조금 산다", amount(run.cash, properties.smallRatioBp())));
      card.options.add(new Option(BUY_BIG, "크게 산다", amount(run.cash, properties.bigRatioBp())));
    }
    if (memory.unlocked.contains(UNLOCK_SELL) && held > 0) {
      card.options.add(new Option(SELL, "판다", "가진 %,d주 전부".formatted(held)));
    }
    card.options.add(new Option(HOLD, "지켜본다", null));
  }

  private static String amount(long cash, int ratioBp) {
    return "현금의 %d%% · %s".formatted(ratioBp / PERCENT, won(cash * ratioBp / BP));
  }

  static String won(long amount) {
    long abs = Math.abs(amount);
    String sign = amount < 0 ? "−" : "";
    if (abs >= 100_000_000L) {
      long eok = abs / 100_000_000L;
      long man = abs % 100_000_000L / 10_000L;
      return sign + (man == 0 ? "%,d억 원".formatted(eok) : "%,d억 %,d만 원".formatted(eok, man));
    }
    return sign + "%,d만 원".formatted(abs / 10_000L);
  }

  private Card leverageCard(RunState run, RandomGenerator rng) {
    String worst =
        run.prices.keySet().stream()
            .sorted()
            .min(Comparator.comparingLong(code -> changeBp(run, code)))
            .orElseThrow();
    int drop = -changeBp(run, worst);
    if (drop < properties.leverage().minDropBp()) {
      return contentCard(run, CardKind.BIG, content.raising().bigs(), rng);
    }
    RaisingContent.Leverage text = content.raising().leverage();
    Map<String, String> values = new HashMap<>(names(content.stock(worst)));
    values.put("drop", String.valueOf(drop / PERCENT));
    Card card = new Card();
    card.kind = CardKind.LEVERAGE;
    card.stockCode = worst;
    card.dropBp = drop;
    card.title = Korean.fill(text.title(), values);
    card.body = Korean.fill(text.body(), values);
    long loan = run.totalAsset() * properties.leverage().loanBp() / BP;
    card.options.add(new Option(BORROW, text.borrowLabel(), "빌리는 돈 " + won(loan)));
    card.options.add(new Option(PASS, text.passLabel(), null));
    return card;
  }

  int changeBp(RunState run, String stockCode) {
    long start = run.startPrices.get(stockCode);
    return (int) ((run.prices.get(stockCode) - start) * BP / start);
  }

  // ---------------------------------------------------------------- 고르기

  /** 펼쳐진 카드에 선택을 내고 다음 카드를 펼친다. 고를 수 없는 선택이면 400. */
  CardOutcome choose(RunState run, RaisingMemory memory, String option, SeededRandom random) {
    Card card = run.current;
    if (card == null) {
      throw new InvalidRequestException("끝난 판이다");
    }
    if (card.options.stream().noneMatch(o -> o.code.equals(option))) {
      throw new InvalidRequestException("고를 수 없는 선택: " + option);
    }
    RandomGenerator rng = random.forKey("choose", run.card);
    CardOutcome outcome =
        switch (card.kind) {
          case TRAIT -> chooseTrait(run, card, option);
          case NEWS -> chooseNews(run, memory, card, option, rng);
          case PRINCIPLE, RELEASE -> chooseDevice(run, card, option, rng);
          case BIG -> chooseBig(run, card, option, rng);
          case LEVERAGE -> chooseLeverage(run, card, option, rng);
          case EXAM -> chooseExam(run, memory);
        };
    run.card++;
    deal(run, memory, random);
    return outcome;
  }

  private RaisingContent.Option contentOption(Card card, String option) {
    return java.util.stream.Stream.concat(
            content.raising().traits().stream(), content.raising().bigs().stream())
        .filter(c -> c.code().equals(card.code))
        .findFirst()
        .orElseThrow()
        .options()
        .stream()
        .filter(o -> o.code().equals(option))
        .findFirst()
        .orElseThrow();
  }

  private CardOutcome chooseTrait(RunState run, Card card, String option) {
    RaisingContent.Option picked = contentOption(card, option);
    picked.traitDeltas().forEach((k, v) -> run.traitScores.merge(k, v, Integer::sum));
    List<CardOutcome.Growth> growth = applyStatDeltas(run, picked.statDeltas());
    return simple(card, option, List.of(picked.note()), growth);
  }

  private CardOutcome chooseBig(RunState run, Card card, String option, RandomGenerator rng) {
    RaisingContent.Option picked = contentOption(card, option);
    List<String> lines = new ArrayList<>();
    lines.add(picked.note());
    int roll = rng.nextInt(BP);
    if (!picked.outcomes().isEmpty()) {
      int total = picked.outcomes().stream().mapToInt(RaisingContent.CashOutcome::weight).sum();
      int pick = (int) ((long) roll * total / BP);
      for (RaisingContent.CashOutcome result : picked.outcomes()) {
        pick -= result.weight();
        if (pick < 0) {
          long change = run.cash * result.cashPercent() / PERCENT;
          run.cash = Math.max(0, run.cash + change);
          lines.add(result.note());
          if (change != 0) {
            lines.add("현금 " + (change > 0 ? "+" : "") + won(change));
          }
          break;
        }
      }
    }
    List<CardOutcome.Growth> growth = applyStatDeltas(run, picked.statDeltas());
    lines.addAll(stepMarket(run, null, false, 0, rng));
    return simple(card, option, lines, growth);
  }

  private CardOutcome chooseLeverage(RunState run, Card card, String option, RandomGenerator rng) {
    RaisingContent.Leverage text = content.raising().leverage();
    List<String> lines = new ArrayList<>();
    CardOutcome.Trade trade = null;
    if (option.equals(BORROW)) {
      long loan = run.totalAsset() * properties.leverage().loanBp() / BP;
      run.debt += loan;
      run.cash += loan;
      trade = buy(run, card.stockCode, loan);
      lines.add(text.borrowNote());
    } else {
      lines.add(text.passNote());
    }
    lines.addAll(stepMarket(run, null, false, 0, rng));
    return new CardOutcome(
        card.kind, option, option, List.of(), trade, null, null, null, null, lines, List.of(),
        null);
  }

  private CardOutcome chooseDevice(RunState run, Card card, String option, RandomGenerator rng) {
    RaisingContent.Device device = device(card.deviceStat);
    List<String> lines = new ArrayList<>();
    if (card.kind == CardKind.PRINCIPLE) {
      if (option.equals(ACCEPT) && run.devices.size() < properties.principle().maxDevices()) {
        run.devices.add(card.deviceStat);
        run.chatLeftPending = card.deviceStat.equals(StatCodes.CONVICTION);
        run.highlights.add(device.name() + " 원칙을 세웠다");
        lines.add(device.acceptNote());
      } else {
        // 거절하면 그 능력치의 뒤집힘을 0으로 되돌린다. 다시 두 번 뒤집히면 남은 횟수 안에서 또 뜬다 (1.2절).
        run.flips.put(card.deviceStat, 0);
        lines.add(device.declineNote());
      }
    } else if (option.equals(ACCEPT)) {
      run.devices.remove(card.deviceStat);
      run.highlights.add(device.name() + " 원칙을 풀었다");
      lines.add(device.releaseNote());
    }
    lines.addAll(stepMarket(run, null, false, 0, rng));
    return simple(card, option, lines, List.of());
  }

  private CardOutcome chooseExam(RunState run, RaisingMemory memory) {
    long interest = run.debt * properties.leverage().interestBp() / BP;
    List<String> lines = new ArrayList<>();
    if (interest > 0) {
      run.cash -= interest;
      lines.add(Korean.fill("빚 이자로 {amount}을(를) 냈다", Map.of("amount", won(interest))));
    }
    memory.runsFinished++;
    return new CardOutcome(
        CardKind.EXAM,
        REGISTER,
        REGISTER,
        List.of(),
        null,
        null,
        null,
        null,
        null,
        lines,
        List.of(),
        null);
  }

  private static CardOutcome simple(
      Card card, String option, List<String> lines, List<CardOutcome.Growth> growth) {
    return new CardOutcome(
        card.kind,
        option,
        option,
        List.of(),
        null,
        null,
        null,
        null,
        null,
        lines.stream().filter(l -> l != null && !l.isBlank()).toList(),
        growth,
        null);
  }

  private List<CardOutcome.Growth> applyStatDeltas(RunState run, Map<String, Integer> deltas) {
    List<CardOutcome.Growth> growth = new ArrayList<>();
    for (String code : StatCodes.ALL) {
      Integer delta = deltas.get(code);
      if (delta == null || delta == 0 || code.equals(StatCodes.LUCK)) {
        continue;
      }
      int before = run.stats.get(code);
      int after = Math.clamp(before + delta, properties.minStat(), properties.maxStat());
      if (after != before) {
        run.stats.put(code, after);
        growth.add(growthOf(code, after - before, before, after));
      }
    }
    return growth;
  }

  private static CardOutcome.Growth growthOf(String code, int delta, int before, int after) {
    return new CardOutcome.Growth(
        code, delta, StatGrade.of(before).name(), StatGrade.of(after).name());
  }

  // ---------------------------------------------------------------- 뉴스

  private CardOutcome chooseNews(
      RunState run, RaisingMemory memory, Card card, String option, RandomGenerator rng) {
    Stats stats = Stats.fromCodes(run.stats);
    long heldBefore = run.held(card.stockCode);
    long cashBefore = run.cash;
    boolean holding = heldBefore > 0;
    Action chosenAction = actionOf(option);
    ChoiceContext.Guards guards =
        new ChoiceContext.Guards(
            run.devices.contains(StatCodes.CONVICTION),
            run.devices.contains(StatCodes.PATIENCE),
            run.devices.contains(StatCodes.COURAGE));
    Sentiment sway = card.swaySentiment == null ? null : Sentiment.valueOf(card.swaySentiment);
    Resolution resolution =
        behavior.resolve(new ChoiceContext(chosenAction, stats, sway, holding, guards), rng);
    List<Deviation> deviations = scriptedDeviations(card, chosenAction, holding, resolution);
    boolean sized = card.options.stream().anyMatch(o -> o.code.equals(BUY_SMALL));
    String actual = actualOption(option, deviations, sized);

    // 매매: 크게 = 현금 50%, 조금 = 15%, 판다 = 전량. 증권 앱을 지웠으면 판 것은 다음 장 가격으로 체결된다.
    boolean deferredSell = actual.equals(SELL) && guards.patience();
    CardOutcome.Trade trade = null;
    if (actual.startsWith(BUY)) {
      trade = buy(run, card.stockCode, run.cash * ratioOf(actual) / BP);
    } else if (actual.equals(SELL) && !deferredSell) {
      trade = sell(run, card.stockCode, false);
    }

    long priceBefore = run.prices.get(card.stockCode);
    long heldDuring = run.held(card.stockCode);
    List<String> lines = new ArrayList<>();
    int luck =
        behavior.luckFactorPercent(
            run.stats.get(StatCodes.LUCK), card.up ? Direction.UP : Direction.DOWN, rng);
    lines.addAll(stepMarket(run, card, heldDuring > 0, heldDuring > 0 ? luck : PERCENT, rng));
    long priceAfter = run.prices.get(card.stockCode);
    if (deferredSell) {
      trade = sell(run, card.stockCode, true);
    }
    long actualPnl = heldDuring * (priceAfter - priceBefore);
    Long ifChosen = null;
    if (!actual.equals(option)) {
      long chosenHeld = quantityIf(option, heldBefore, cashBefore, priceBefore, guards.patience());
      ifChosen = chosenHeld * (priceAfter - priceBefore);
    }

    List<CardOutcome.Flip> flips = new ArrayList<>();
    List<CardOutcome.Growth> growth = new ArrayList<>();
    String tip = null;
    for (Deviation deviation : deviations) {
      String who = null;
      String from = deviation.from().name();
      String to = deviation.to().name();
      if (deviation.statCode().equals(StatCodes.CONVICTION)) {
        RaisingContent.Tempter tempter = tempter(card.tempter);
        who = tempter.name();
        int count = memory.tempterCounts.merge(tempter.code(), 1, Integer::sum);
        String line =
            count == 1 ? tempter.first() : count == 2 ? tempter.again() : tempter.repeat();
        lines.add(Korean.fill(line, names(content.stock(card.stockCode))));
        if (actualPnl > 0 && actual.startsWith(BUY)) {
          lines.add(Korean.fill(tempter.won(), names(content.stock(card.stockCode))));
        }
        if (!run.tempted.contains(tempter.name())) {
          run.tempted.add(tempter.name());
        }
      }
      if (deviation.statCode().equals(StatCodes.COURAGE)
          && option.equals(BUY_BIG)
          && actual.equals(BUY_SMALL)) {
        from = BUY_BIG;
        to = BUY_SMALL;
      }
      flips.add(new CardOutcome.Flip(deviation.statCode(), from, to, who));
      run.flips.merge(deviation.statCode(), 1, Integer::sum);
      run.totalFlips++;
      if (memory.tipsShown.add(TIP_FLIP)) {
        tip = content.raising().flipTips().get(deviation.statCode());
      }
      growth.addAll(gainExp(run, memory, deviation.statCode(), properties.deviationExp()));
    }
    if (run.chatLeftPending) {
      run.chatLeftPending = false;
      lines.add(chatLeftLine(run));
    }
    growth.addAll(gainExp(run, memory, StatCodes.INSIGHT, properties.reviewInsightExp()));
    queueDeviceCards(run);
    if (!actual.equals(option)) {
      run.highlights.add("%s: %s → %s".formatted(card.title, label(option), label(actual)));
    }
    if (run.held(card.stockCode) > 0) {
      memory.unlocked.add(UNLOCK_SELL);
    }
    String decisive = card.sentences.get(decisiveIndex(card)).text;
    int changeBp = (int) ((priceAfter - priceBefore) * BP / priceBefore);
    return new CardOutcome(
        CardKind.NEWS,
        option,
        actual,
        flips,
        trade,
        new CardOutcome.PriceMove(changeBp, priceAfter >= priceBefore),
        ifChosen,
        actualPnl,
        decisive,
        lines,
        growth,
        tip);
  }

  private static String label(String option) {
    return switch (option) {
      case BUY -> "산다";
      case BUY_SMALL -> "조금 산다";
      case BUY_BIG -> "크게 산다";
      case SELL -> "판다";
      default -> "지켜본다";
    };
  }

  private RaisingContent.Tempter tempter(String code) {
    return content.raising().tempters().stream()
        .filter(t -> t.code().equals(code))
        .findFirst()
        .orElseThrow();
  }

  /** 단톡방을 나간 뒤의 서운한 한 줄. 이 판에서 꼬드긴 사람이 있으면 그 사람이, 없으면 첫 단골이 말한다. */
  private String chatLeftLine(RunState run) {
    List<RaisingContent.Tempter> tempters = content.raising().tempters();
    String last = run.tempted.isEmpty() ? null : run.tempted.getLast();
    return tempters.stream()
        .filter(t -> t.name().equals(last))
        .findFirst()
        .orElse(tempters.getFirst())
        .chatLeft();
  }

  private static Action actionOf(String option) {
    return switch (option) {
      case BUY, BUY_SMALL, BUY_BIG -> Action.BUY;
      case SELL -> Action.SELL;
      default -> Action.HOLD;
    };
  }

  private int ratioOf(String buyOption) {
    return switch (buyOption) {
      case BUY_SMALL -> properties.smallRatioBp();
      case BUY_BIG -> properties.bigRatioBp();
      default -> properties.buyRatioBp();
    };
  }

  /**
   * 짜인 첫 판: EASY와 MISLEAD는 뒤집히지 않고, FLIP은 무엇을 고르든 한 번 뒤집힌다 (증권사 육성 설계 11.2절). 짜이지 않은 카드는 판정 그대로다.
   */
  private static List<Deviation> scriptedDeviations(
      Card card, Action chosen, boolean holding, Resolution resolution) {
    if (card.scriptMode == null) {
      return resolution.deviations();
    }
    if (!card.scriptMode.equals(MODE_FLIP)) {
      return List.of();
    }
    return switch (chosen) {
      case BUY, SELL -> List.of(new Deviation(StatCodes.COURAGE, chosen, Action.HOLD));
      case HOLD ->
          holding
              ? List.of(new Deviation(StatCodes.PATIENCE, Action.HOLD, Action.SELL))
              : List.of(new Deviation(StatCodes.CONVICTION, Action.HOLD, Action.BUY, card.tempter));
    };
  }

  /**
   * 판정 뒤 실제 선택. 용기 판정은 한 단계만 내린다: 크게 → 조금, 조금(산다) → 지켜본다. 꼬드김으로 사게 되면 조금 산다. 조금/크게가 열리기 전(sized가
   * 아니면)에는 그냥 산다 (투자 원칙 장치 설계 3.2절).
   */
  private static String actualOption(String option, List<Deviation> deviations, boolean sized) {
    String actual = option;
    for (Deviation deviation : deviations) {
      actual =
          switch (deviation.to()) {
            case HOLD ->
                deviation.statCode().equals(StatCodes.COURAGE) && actual.equals(BUY_BIG)
                    ? BUY_SMALL
                    : HOLD;
            case SELL -> SELL;
            case BUY -> sized ? BUY_SMALL : BUY;
          };
    }
    return actual;
  }

  /** 고른 대로 했다면 이 카드 동안 들고 있었을 수량. */
  private long quantityIf(
      String option, long heldBefore, long cashBefore, long price, boolean deferredSell) {
    return switch (option) {
      case SELL -> deferredSell ? heldBefore : 0;
      case HOLD -> heldBefore;
      default -> heldBefore + cashBefore * ratioOf(option) / BP / price;
    };
  }

  private CardOutcome.Trade buy(RunState run, String stockCode, long budget) {
    long price = run.prices.get(stockCode);
    long quantity = Math.min(budget, run.cash) / price;
    if (quantity <= 0) {
      return null;
    }
    long amount = quantity * price;
    Holding holding = run.holdings.computeIfAbsent(stockCode, k -> new Holding());
    holding.avgCost = (holding.avgCost * holding.quantity + amount) / (holding.quantity + quantity);
    holding.quantity += quantity;
    run.cash -= amount;
    return new CardOutcome.Trade(Action.BUY.name(), quantity, price, amount, false);
  }

  private CardOutcome.Trade sell(RunState run, String stockCode, boolean deferred) {
    Holding holding = run.holdings.remove(stockCode);
    if (holding == null) {
      return null;
    }
    long price = run.prices.get(stockCode);
    long amount = holding.quantity * price;
    run.cash += amount;
    return new CardOutcome.Trade(SELL, holding.quantity, price, amount, deferred);
  }

  /** 능력치 경험치. expPerPoint마다 +1. 운은 오르지 않는다. 안목이 처음 오르면 형광펜이 열린다 (11.1절). */
  private List<CardOutcome.Growth> gainExp(
      RunState run, RaisingMemory memory, String code, int amount) {
    if (code.equals(StatCodes.LUCK) || amount <= 0) {
      return List.of();
    }
    int total = run.exp.getOrDefault(code, 0) + amount;
    int points = total / properties.expPerPoint();
    run.exp.put(code, total % properties.expPerPoint());
    int before = run.stats.get(code);
    int after = Math.min(properties.maxStat(), before + points);
    if (after == before) {
      return List.of();
    }
    run.stats.put(code, after);
    if (code.equals(StatCodes.INSIGHT)) {
      memory.unlocked.add(UNLOCK_HIGHLIGHTER);
    }
    return List.of(growthOf(code, after - before, before, after));
  }

  /** 같은 능력치로 두 번 뒤집히면 원칙 카드, 장치를 건 능력치가 충분히 오르면 풀기 카드를 다음 뉴스 자리에 (1.2·1.3절). */
  private void queueDeviceCards(RunState run) {
    if (run.pendingPrinciple == null
        && run.principlesOffered < properties.principle().perRun()
        && run.devices.size() < properties.principle().maxDevices()) {
      for (String stat : List.of(StatCodes.CONVICTION, StatCodes.PATIENCE, StatCodes.COURAGE)) {
        if (!run.devices.contains(stat)
            && run.flips.getOrDefault(stat, 0) >= properties.principle().flips()) {
          run.pendingPrinciple = stat;
          break;
        }
      }
    }
    if (run.pendingRelease == null && !run.releaseOffered) {
      for (String stat : run.devices) {
        if (run.stats.get(stat) >= properties.principle().releaseAt()) {
          run.pendingRelease = stat;
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------- 시장

  /**
   * 카드 한 장(한 분기)만큼 시장을 움직인다: 뉴스 충격(종목, 같은 섹터에 일부 파급), 종목마다 저절로 흔들림, 위기. luckPercent는 들고 있는 종목에 충격이
   * 닿을 때의 운 (decisions.md 78번). 돌려주는 줄은 결과 문구다.
   */
  private List<String> stepMarket(
      RunState run, Card news, boolean holdingNews, int luckPercent, RandomGenerator rng) {
    List<String> lines = new ArrayList<>();
    List<String> codes = run.prices.keySet().stream().sorted().toList();
    Map<String, Integer> moveBp = new HashMap<>();
    for (String code : codes) {
      StockDefinition stock = content.stock(code);
      int noise = properties.noiseBp().getOrDefault(stock.volatility(), 0);
      int drift = stock.driftBpPerYear() / 4;
      moveBp.put(code, drift + rng.nextInt(2 * noise + 1) - noise);
    }
    if (news != null) {
      StockDefinition target = content.stock(news.stockCode);
      int shock = news.up ? news.magnitudeBp : -news.magnitudeBp;
      int applied = holdingNews && luckPercent != PERCENT ? shock * luckPercent / PERCENT : shock;
      if (holdingNews && luckPercent != PERCENT) {
        lines.add(news.up ? "운이 따랐다. 오름폭이 더 컸다." : "운이 따랐다. 빠질 만큼 다 빠지진 않았다.");
      }
      for (StockDefinition stock : content.stocksOf(target.sector())) {
        int part =
            news.sectorWide || stock.code().equals(target.code())
                ? applied
                : shock * properties.spilloverPercent() / PERCENT;
        moveBp.merge(stock.code(), part, Integer::sum);
      }
    }
    if (run.crisis != null && run.crisis.hits && run.crisis.atCard == run.card) {
      CrisisDefinition crisis =
          content.crises().stream()
              .filter(c -> c.code().equals(run.crisis.code))
              .findFirst()
              .orElseThrow();
      RaisingProperties.Range fall = properties.crisis().fallBp();
      int base = fall.min() + rng.nextInt(fall.max() - fall.min() + 1);
      for (String code : codes) {
        int sectorFall = base * crisis.sectorPercentOf(content.stock(code).sector()) / PERCENT;
        moveBp.merge(code, -sectorFall, Integer::sum);
      }
      Map<String, String> name = Map.of("name", crisis.name());
      lines.add(Korean.fill("{name}이(가) 터졌다. 시장 전체가 무너졌다.", name));
      run.highlights.add(
          Korean.fill(
              (run.crisis.omenCards.isEmpty() ? "조짐 없이 " : "폭락 조짐 뒤에 ") + "{name}을(를) 겪었다", name));
    }
    for (String code : codes) {
      long price = run.prices.get(code);
      int bp = Math.max(-BP + 100, moveBp.get(code));
      run.prices.put(code, Math.max(100, price + price * bp / BP));
    }
    return lines;
  }

  // ---------------------------------------------------------------- 성향

  /** 성향 점수가 가장 높은 코드(접두사를 뗀 것). 점수가 없으면 null. */
  static String topTrait(RunState run, String prefix) {
    return run.traitScores.entrySet().stream()
        .filter(e -> e.getKey().startsWith(prefix))
        .max(
            Map.Entry.<String, Integer>comparingByValue().thenComparing(Map.Entry.comparingByKey()))
        .map(e -> e.getKey().substring(prefix.length()))
        .orElse(null);
  }
}
