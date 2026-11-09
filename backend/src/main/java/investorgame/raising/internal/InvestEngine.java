package investorgame.raising.internal;

import investorgame.behavior.BehaviorService;
import investorgame.common.Direction;
import investorgame.common.Hint;
import investorgame.common.Korean;
import investorgame.common.Sentiment;
import investorgame.common.StatCodes;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.SeededRandom;
import investorgame.content.Clue;
import investorgame.content.ContentCatalog;
import investorgame.content.NewsClues;
import investorgame.content.NewsDefinition;
import investorgame.content.RaisingContent;
import investorgame.content.StockDefinition;
import investorgame.raising.internal.CompanyState.Employee;
import investorgame.raising.internal.CompanyState.Invest;
import investorgame.raising.internal.CompanyState.InvestResult;
import investorgame.raising.internal.CompanyState.Sentence;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.random.RandomGenerator;

/**
 * 투자 회의 (decisions.md 229번, #298). 해마다 한 번 단서 기사를 놓고 직원들과 고민한다. 리서치 팀이 형광펜을 긋고, 자리에 앉은 직원들이 한마디씩
 * 하고, 사장이 산다·판다·지켜본다를 고른다. 돈을 굴리는 직원은 사장 말대로 하거나, 꼬드김에 넘어가거나(줏대), "제가 알아서 할게요" 하고 제 판단대로 한다(자리가 원하는
 * 능력치, 폭락장이면 인내심). 제멋대로 한 직원이 맞을 때도 있다. 판정은 결산과 같은 확률을 쓴다. DB와 시각을 모른다.
 */
class InvestEngine {

  static final String BUY = "BUY";
  static final String SELL = "SELL";
  static final String HOLD = "HOLD";

  /** 사장이 "너희가 알아서 해" 하고 맡긴다 (decisions.md 279번). 직원들 의견을 저울질해 사거나 판다. */
  static final String TEAM = "TEAM";

  static final String BOSS = "BOSS";
  static final String OWN = "OWN";
  static final String SWAY = "SWAY";

  private static final String UP = "UP";
  private static final String DOWN = "DOWN";
  private static final String NEUTRAL = "NEUTRAL";
  private static final int SIDE_SENTENCES = 2;
  private static final int BP = 10_000;
  private static final int PERCENT = 100;

  private final CompanyEngine company;
  private final ContentCatalog content;
  private final BehaviorService behavior;
  private final CompanyProperties properties;

  InvestEngine(
      CompanyEngine company,
      ContentCatalog content,
      BehaviorService behavior,
      CompanyProperties properties) {
    this.company = company;
    this.content = content;
    this.behavior = behavior;
    this.properties = properties;
  }

  /**
   * 올해 투자 회의를 준비한다. 뉴스와 종목을 뽑고, 숨은 방향(올해 시장 갈래가 기울인다)을 정하고, 단서 기사(결정적 문장 하나 + 곁가지 둘 + 중립 하나)를 짓고,
   * 꼬드기는 단골 인물을 붙인다 (투자 원칙 장치 설계 2·3절).
   */
  Invest create(CompanyState c, SeededRandom random) {
    RandomGenerator rng = random.forKey("invest", c.turn());
    Invest invest = build(c, rng, null, 0);
    // 따로 굴린다: 기사·꼬드김 난수 차례를 바꾸지 않는다.
    invest.clarity = pickClarity(random.forKey("invest-clarity", c.turn()).nextInt(BP));
    // 연초에 준비만 해 두고, 직원이 물어 와야 열린다 (decisions.md 267번).
    invest.found = false;
    return invest;
  }

  /**
   * 직원이 종목을 물어 왔다 (decisions.md 267번): 그 사람의 섹터(섹터 데스크면 그 섹터, 아니면 관심 섹터)에서 뉴스와 종목을 새로 뽑는다. 가져온 사람의
   * 안목이 높을수록 오르는 종목일 때가 많고 기사가 또렷하다. 낮으면 소문이라 흐리다.
   */
  Invest found(CompanyState c, Employee finder, String role, SeededRandom random) {
    RandomGenerator rng = random.forKey("invest-found", c.turn());
    String sector = company.deskSector(finder.desk);
    if (sector == null) {
      sector = finder.sector;
    }
    if (sector == null) {
      List<String> sectors = content.sectors().stream().map(x -> x.code()).toList();
      sector = sectors.get(random.forKey("invest-found-sector", c.turn()).nextInt(sectors.size()));
    }
    int insight = finder.stats.get(StatCodes.INSIGHT);
    CompanyProperties.Scout rules = properties.scout();
    Invest invest = build(c, rng, sector, (insight - 50) * rules.upPerInsightBp());
    invest.clarity = clarityOf(insight);
    invest.found = true;
    invest.finderId = finder.id;
    invest.finderName = finder.name;
    invest.finderRole = role;
    invest.finderDesk = finder.desk;
    Map<String, String> names = names(content.stock(invest.stock));
    List<String> pitches = content.raising().company().scout().pitch().get(pitchTier(insight));
    // 지난번과 같은 한마디는 피한다 (#340)
    String last = c.invest == null ? null : c.invest.pitch;
    int at = random.forKey("invest-pitch", c.turn()).nextInt(pitches.size());
    invest.pitch = Korean.fill(pitches.get(at), names);
    if (invest.pitch.equals(last) && pitches.size() > 1) {
      invest.pitch = Korean.fill(pitches.get((at + 1) % pitches.size()), names);
    }
    return invest;
  }

  /** 가져온 사람의 안목으로 정하는 기사의 또렷함. */
  private String clarityOf(int insight) {
    CompanyProperties.Scout rules = properties.scout();
    List<CompanyProperties.Clarity> all = properties.invest().clarity();
    int at = insight >= rules.clearInsight() ? 0 : insight >= rules.murkyInsight() ? 1 : 2;
    return all.get(Math.min(at, all.size() - 1)).code();
  }

  /** 가져올 때 한마디의 말투: 소문(low)·기사(mid)·보고서(high). */
  private String pitchTier(int insight) {
    CompanyProperties.Scout rules = properties.scout();
    return insight >= rules.clearInsight()
        ? "high"
        : insight >= rules.murkyInsight() ? "mid" : "low";
  }

  /** 뉴스·종목·숨은 방향·기사·꼬드김을 짓는다. sector가 있으면 그 섹터의 뉴스만 뽑는다(없으면 모든 섹터). upBonusBp는 오를 확률에 더한다. */
  private Invest build(CompanyState c, RandomGenerator rng, String sector, int upBonusBp) {
    int pickRoll = rng.nextInt(BP);
    int stockRoll = rng.nextInt(BP);
    int upRoll = rng.nextInt(BP);
    int magnitudeRoll = rng.nextInt(BP);
    int swayRoll = rng.nextInt(2);
    int swayPhraseRoll = rng.nextInt(BP);
    int tempterRoll = rng.nextInt(BP);

    NewsDefinition news = pickNews(c, pickRoll, sector);
    c.usedNews.add(news.code());
    List<StockDefinition> fitting =
        content.stocksOf(news.sector()).stream().filter(s -> news.fits(s.code())).toList();
    // 지난 회의의 종목은 고를 수 있는 다른 종목이 있으면 이번에 쉰다 (#340)
    String lastStock = c.invest == null ? null : c.invest.stock;
    List<StockDefinition> fresh =
        fitting.stream().filter(s -> !s.code().equals(lastStock)).toList();
    List<StockDefinition> stocks = fresh.isEmpty() ? fitting : fresh;
    StockDefinition stock = stocks.get(stockRoll % stocks.size());
    Invest invest = new Invest();
    invest.news = news.code();
    invest.stock = stock.code();
    invest.up =
        upRoll
            < news.directionRule().upBp()
                + properties.invest().yearUpBp().getOrDefault(c.phase, 0)
                + upBonusBp;
    invest.magnitudeBp =
        news.magnitude().minBp()
            + magnitudeRoll % (news.magnitude().maxBp() - news.magnitude().minBp() + 1);
    Map<String, String> names = names(stock);
    invest.title = Korean.fill(news.title(), names);
    invest.sentences = article(content.clues(news.code()), invest.up, rng, names);

    Sentiment sentiment = swayRoll == 0 ? Sentiment.POS : Sentiment.NEG;
    List<String> phrases = content.swayPhrases(sentiment.name());
    invest.swaySentiment = sentiment.name();
    invest.sway = phrases.get(swayPhraseRoll % phrases.size());
    invest.tempter = tempterCode(c, tempterRoll);
    return invest;
  }

  /** 꼬드기는 단골 인물. 직원과 이름이 같은 인물(김대리)은 회의에 끼지 않는다: 누가 누구 말을 들었는지 헷갈린다. */
  String tempterCode(CompanyState c, int roll) {
    List<RaisingContent.Tempter> tempters =
        content.raising().tempters().stream()
            .filter(t -> c.employees.stream().noneMatch(e -> e.name.equals(t.name())))
            .toList();
    if (tempters.isEmpty()) {
      tempters = content.raising().tempters();
    }
    return tempters.get(roll % tempters.size()).code();
  }

  String pickClarity(int roll) {
    List<CompanyProperties.Clarity> all = properties.invest().clarity();
    int total = all.stream().mapToInt(CompanyProperties.Clarity::weight).sum();
    int pick = (int) ((long) roll * total / BP);
    for (CompanyProperties.Clarity x : all) {
      pick -= x.weight();
      if (pick < 0) {
        return x.code();
      }
    }
    return all.getLast().code();
  }

  /** 흐린 기사면 읽을 때 안목에서 빼는 점수. 옛 회의(clarity 없음)는 0. */
  private int penalty(Invest invest) {
    return penalty(invest.clarity);
  }

  private int penalty(String clarity) {
    return properties.invest().clarity().stream()
        .filter(x -> x.code().equals(clarity))
        .mapToInt(CompanyProperties.Clarity::penalty)
        .findFirst()
        .orElse(0);
  }

  /** 가장 흐린 기사(가장 크게 깎는)인가. 안목 높은 직원이 "이번 건 애매하다"고 말한다. */
  private boolean foggiest(Invest invest) {
    return foggiest(invest.clarity);
  }

  private boolean foggiest(String clarity) {
    int most =
        properties.invest().clarity().stream()
            .mapToInt(CompanyProperties.Clarity::penalty)
            .max()
            .orElse(0);
    return most > 0 && penalty(clarity) == most;
  }

  /** 이 회사에 아직 안 나온 뉴스를 가중치대로 뽑는다. 다 나왔으면 처음부터. sector가 있으면 그 섹터만(그 섹터에 뉴스가 없으면 모두). */
  private NewsDefinition pickNews(CompanyState c, int roll, String sector) {
    List<NewsDefinition> all = content.news().stream().filter(NewsDefinition::root).toList();
    List<NewsDefinition> inSector =
        sector == null ? all : all.stream().filter(n -> n.sector().equals(sector)).toList();
    List<NewsDefinition> roots = inSector.isEmpty() ? all : inSector;
    List<NewsDefinition> pool = roots.stream().filter(n -> !c.usedNews.contains(n.code())).toList();
    if (pool.isEmpty()) {
      c.usedNews.removeAll(roots.stream().map(NewsDefinition::code).toList());
      pool = roots;
    }
    int total = pool.stream().mapToInt(NewsDefinition::weight).sum();
    int pick = (int) ((long) roll * total / BP);
    for (NewsDefinition n : pool) {
      pick -= n.weight();
      if (pick < 0) {
        return n;
      }
    }
    return pool.getLast();
  }

  private Map<String, String> names(StockDefinition stock) {
    return Map.of("stock", stock.name(), "sectorName", content.sectorName(stock.sector()));
  }

  /**
   * 단서 기사: 결정적 문장 하나(숨은 방향 쪽) + 곁가지 둘(반대쪽으로 기운 무작위) + 중립 하나를 섞는다. 빗나간 형광펜이 그을 곳이 있게, 곁가지가 모두 같은 쪽이면
   * 하나를 반대쪽으로 바꾼다.
   */
  private List<Sentence> article(
      NewsClues clues, boolean up, RandomGenerator rng, Map<String, String> names) {
    return article(clues.up(), clues.down(), clues.neutral(), up, rng, names);
  }

  /** 단서 기사를 짓는다. */
  List<Sentence> article(
      List<Clue> ups,
      List<Clue> downs,
      List<String> neutrals,
      boolean up,
      RandomGenerator rng,
      Map<String, String> names) {
    String truth = up ? UP : DOWN;
    String other = up ? DOWN : UP;
    List<Clue> truthPool = new ArrayList<>(up ? ups : downs);
    List<Clue> otherPool = new ArrayList<>(up ? downs : ups);
    List<Clue> neutralPool =
        new ArrayList<>(neutrals.stream().map(t -> new Clue(t, null, null)).toList());
    List<Sentence> sentences = new ArrayList<>();
    sentences.add(sentence(draw(truthPool, otherPool, rng, names), truth, true));
    boolean anyOther = false;
    for (int i = 0; i < SIDE_SENTENCES; i++) {
      boolean opposite =
          (rng.nextInt(PERCENT) < properties.invest().sideOppositePercent()
                      || (i == SIDE_SENTENCES - 1 && !anyOther))
                  && !otherPool.isEmpty()
              || truthPool.isEmpty();
      anyOther |= opposite;
      sentences.add(
          opposite
              ? sentence(draw(otherPool, truthPool, rng, names), other, false)
              : sentence(draw(truthPool, otherPool, rng, names), truth, false));
    }
    sentences.add(sentence(draw(neutralPool, new ArrayList<>(), rng, names), NEUTRAL, false));
    for (int i = sentences.size() - 1; i > 0; i--) {
      int j = rng.nextInt(i + 1);
      Sentence t = sentences.get(i);
      sentences.set(i, sentences.get(j));
      sentences.set(j, t);
    }
    return sentences;
  }

  private static Sentence sentence(Clue clue, String sign, boolean decisive) {
    Sentence s = new Sentence();
    s.text = clue.text();
    s.point = clue.point();
    s.sign = sign;
    s.decisive = decisive;
    return s;
  }

  /** pool에서 한 문장을 뽑고, 같은 꼬리표를 단 반대쪽 문장은 opposite에서 뺀다 (#341). */
  private static Clue draw(
      List<Clue> pool, List<Clue> opposite, RandomGenerator rng, Map<String, String> names) {
    Clue clue = pool.remove(rng.nextInt(pool.size()));
    if (clue.topic() != null) {
      opposite.removeIf(o -> clue.topic().equals(o.topic()));
    }
    return new Clue(
        Korean.fill(clue.text(), names),
        clue.point() == null ? null : Korean.fill(clue.point(), names),
        clue.topic());
  }

  /** 종목 회의를 열 수 있는가: 직원이 물어 온(267번) 정하지 않은 회의가 있고 돈을 굴리는 직원이 있다. */
  boolean open(CompanyState c) {
    return c.invest != null
        && !Boolean.FALSE.equals(c.invest.found)
        && c.invest.choice == null
        && !company.traders(c).isEmpty();
  }

  /** 회의를 열어 한마디와 형광펜을 굳혔는가 (249번). */
  boolean convened(CompanyState c) {
    return c.invest != null && c.invest.remarks != null;
  }

  /**
   * 회의를 연다 (decisions.md 249번): 지금 배치로 직원 한마디와 리서치 팀 형광펜을 굳힌다. 그 뒤로 배치를 바꿔도 회의에서 본 말과 직원의 제 판단은
   * 그대로다. 이미 열었으면 아무것도 하지 않는다. 열 수 없는 회의(정했거나 돈을 굴리는 사람이 없다)면 400.
   */
  void convene(CompanyState c, SeededRandom random) {
    if (convened(c)) {
      return;
    }
    if (!open(c)) {
      throw new InvalidRequestException("지금 열 수 있는 투자 회의가 없다");
    }
    List<CompanyState.Remark> frozen = new ArrayList<>();
    java.util.Set<String> used = new java.util.HashSet<>();
    for (Remark r : liveRemarks(c, random, used)) {
      CompanyState.Remark x = new CompanyState.Remark();
      x.employeeId = r.employee().id;
      x.name = r.employee().name;
      x.desk = r.employee().desk;
      x.read = r.read();
      x.text = r.text();
      x.stubbornBp = r.stubbornBp();
      frozen.add(x);
    }
    Optional<Highlight> highlight = liveHighlight(c, random);
    c.invest.remarks = frozen;
    company.remember(c, used);
    c.invest.highlightIndex = highlight.map(Highlight::index).orElse(null);
    c.invest.highlightBy = highlight.map(Highlight::by).orElse(null);
    // 토론이 먼저 (decisions.md 352번): 회의를 열면 매수파·매도파가 맞붙어 한쪽으로 기운다. 사장은 그 뒤에 고른다.
    c.invest.teamCall = teamCall(c, random);
  }

  /** 형광펜: 리서치 팀이 있으면 그 안목으로 결정적 문장에, 빗나가면 반대쪽 곁가지에 긋는다. 리서치 팀이 없거나 방향을 못 읽으면 없다. */
  record Highlight(int index, String by) {}

  /** 회의에서 보이는 형광펜. 회의를 열기 전에는 없다: 배치를 바꿔 가며 미리 들여다볼 수 없다 (249번). */
  Optional<Highlight> highlight(CompanyState c) {
    if (!convened(c) || c.invest.highlightIndex == null) {
      return Optional.empty();
    }
    return Optional.of(new Highlight(c.invest.highlightIndex, c.invest.highlightBy));
  }

  /** 지금 배치로 긋는 형광펜. 회의를 열 때와 시험에서만 부른다. */
  Optional<Highlight> liveHighlight(CompanyState c, SeededRandom random) {
    Optional<Employee> researcher = company.researcher(c);
    if (researcher.isEmpty() || c.invest == null) {
      return Optional.empty();
    }
    Employee r = researcher.get();
    int insight = Math.max(0, r.stats.get(StatCodes.INSIGHT) - penalty(c.invest));
    Hint hint = read(c, insight, random.forKey("invest-hint", c.turn(), r.id));
    if (hint.direction() == Hint.HintDirection.NEUTRAL) {
      return Optional.empty();
    }
    String pointed = hint.direction().name();
    for (int i = 0; i < c.invest.sentences.size(); i++) {
      Sentence s = c.invest.sentences.get(i);
      boolean right = pointed.equals(c.invest.up ? UP : DOWN);
      if (right ? s.decisive : s.sign.equals(pointed)) {
        return Optional.of(new Highlight(i, r.name));
      }
    }
    return Optional.empty();
  }

  /**
   * 자리에 앉은 직원의 한마디 (decisions.md 239번). 기사를 읽은 쪽은 자기 안목(리서치 팀 형광펜으로 반쯤 올린)이 정하고, 말투는 자기 안목의 구간이
   * 정한다: 낮으면 감·소문·차트 모양으로 큰소리치거나 갈팡질팡하고, 보통이면 기사 한 대목을 대충 근거로 망설이고, 높으면 결정적 대목을 짚고, 최고면 확신한다. 기사
   * 문장을 따오지 않고 요지를 엮어 자기 말로 한다(272번): 읽은 쪽의 요지를 근거로(안목이 높고 맞게 읽었으면 결정적 문장의 요지), 반대쪽 요지와 견준다.
   */
  record Remark(Employee employee, String read, String text, Integer stubbornBp) {}

  /** 회의에서 보이는 한마디. 회의를 열기 전에는 비어 있다 (249번). */
  List<CompanyState.Remark> remarks(CompanyState c) {
    return convened(c) ? c.invest.remarks : List.of();
  }

  /** 지금 배치로 하는 한마디. 회의를 열 때와 시험에서만 부른다. */
  List<Remark> liveRemarks(CompanyState c, SeededRandom random) {
    return liveRemarks(c, random, new java.util.HashSet<>());
  }

  /** used에 이번 회의에서 쓴 문구 틀을 담는다 (#392). */
  List<Remark> liveRemarks(CompanyState c, SeededRandom random, java.util.Set<String> used) {
    if (c.invest == null) {
      return List.of();
    }
    RaisingContent.Invest texts = content.raising().company().invest();
    String stock = content.stock(c.invest.stock).name();
    List<Remark> remarks = new ArrayList<>();
    for (Employee e : c.employees) {
      if (e.desk == null || CompanyEngine.HR_DESK.equals(e.desk)) {
        continue;
      }
      String read = ownRead(c, e, random);
      boolean trades = company.traders(c).contains(e);
      Integer stubborn = null;
      if (trades) {
        CompanyEngine.Odds odds = company.odds(c, e);
        // 둘 중 하나라도 일어나면 사장 말대로 하지 않는다.
        stubborn = odds.swayBp() + (BP - odds.swayBp()) * odds.flipBp() / BP;
      }
      Hint.Detail voice = Hint.Detail.of(e.stats.get(StatCodes.INSIGHT));
      boolean sharp = voice == Hint.Detail.HIGH || voice == Hint.Detail.EXPERT;
      // 흐린 기사(241번): 안목 높은 직원은 애매하다는 것을 알아채고 그렇게 말한다.
      String tier = sharp && foggiest(c.invest) && !NEUTRAL.equals(read) ? "foggy" : voice.key();
      List<String> lines = texts.remarks().get(tier).get(read);
      String line =
          company.fresh(
              c, lines, random.forKey("invest-remark", c.turn(), e.id).nextInt(lines.size()), used);
      Points points = points(c.invest.sentences, read, voice, texts.points());
      remarks.add(
          new Remark(
              e,
              read,
              Korean.fill(
                  line,
                  Map.of("point", points.point(), "against", points.against(), "stock", stock)),
              stubborn));
    }
    return remarks;
  }

  /**
   * 한마디에 엮는 요지 둘 (decisions.md 272번). point는 제 판단의 근거, against는 견주어 본 반대쪽 근거다.
   *
   * @param point 읽은 쪽(모르겠다면 오름 쪽)으로 기운 문장의 요지. 안목이 높으면(HIGH 이상) 그 가운데 결정적 문장을 먼저 고른다
   * @param against 반대쪽(모르겠다면 내림 쪽)으로 기운 문장의 요지
   */
  record Points(String point, String against) {}

  /** 기사에서 한마디에 엮을 요지를 고른다. 요지가 없는 문장(이 규칙 전에 지은 기사)이면 fallback(UP·DOWN)을 쓴다. */
  static Points points(
      List<Sentence> sentences, String read, Hint.Detail voice, Map<String, String> fallback) {
    boolean sharp = voice == Hint.Detail.HIGH || voice == Hint.Detail.EXPERT;
    String mine = NEUTRAL.equals(read) ? UP : read;
    String theirs = UP.equals(mine) ? DOWN : UP;
    return new Points(
        pointOf(pick(sentences, mine, sharp), mine, fallback),
        pointOf(pick(sentences, theirs, false), theirs, fallback));
  }

  private static Sentence pick(List<Sentence> sentences, String sign, boolean sharp) {
    Sentence pick = null;
    for (Sentence s : sentences) {
      if (s.sign.equals(sign) && (pick == null || (sharp && s.decisive))) {
        pick = s;
      }
    }
    return pick;
  }

  private static String pointOf(Sentence s, String sign, Map<String, String> fallback) {
    return s != null && s.point != null ? s.point : fallback.get(sign);
  }

  /** 고집이 보이는 정도: 없음·보통·높음 (제멋대로 할 확률이 stubbornBp 이상이면 보통, 두 배 이상이면 높음). */
  String stubbornLevel(int bp) {
    int line = properties.invest().stubbornBp();
    return bp >= line * 2 ? "HIGH" : bp >= line ? "MID" : "LOW";
  }

  /**
   * 직원이 기사를 읽은 쪽(UP·DOWN·NEUTRAL). 리서치 팀의 형광펜을 보지만 반만 믿는다: 리서치 팀이 더 밝으면 그 차이의 절반만큼 안목이 오른다(239번,
   * 전에는 리서치 팀의 안목을 그대로 빌려 모두 같은 말을 했다). 종합 등급이 높을수록 더 잘 읽고(387번, 등급 효과의 판단 보정), SSS 이상은 전설의 촉으로 늘
   * 맞게 읽는다. 같은 해·같은 직원이면 늘 같다.
   */
  private String ownRead(CompanyState c, Employee e, SeededRandom random) {
    if (CompanyEngine.reaches(e, CompanyEngine.LEGEND)) {
      return c.invest.up ? UP : DOWN;
    }
    int own = e.stats.get(StatCodes.INSIGHT);
    int insight =
        Math.clamp(
            own
                + Math.max(0, company.researchInsight(c) - own) / 2
                - penalty(c.invest)
                + company.perkReadBonus(e),
            0,
            MAX_INSIGHT);
    Hint hint = read(c, insight, random.forKey("invest-read", c.turn(), e.id));
    return hint.direction().name();
  }

  private static final int MAX_INSIGHT = 100;

  private Hint read(CompanyState c, int insight, RandomGenerator rng) {
    return behavior.hint(insight, c.invest.up ? Direction.UP : Direction.DOWN, rng);
  }

  /**
   * 사장이 고른다. 돈을 굴리는 직원마다 꼬드김(줏대) → 손 뒤집힘(자리 능력치) 순으로 굴린다. 꼬드김에 넘어가면 단골 인물 말대로(사라면 사고 팔라면 판다), 뒤집히면
   * "제가 알아서 할게요" 하고 제 판단대로 한다(제 판단이 사장과 같으면 그대로다). 맞으면 회의만의 수익률(388번, 기사가 클수록 크게, 최대 +300%), 틀리면
   * 그만큼 잃고(최대 −50%), 지켜보면 0. 손익은 바로 자본에 들어간다.
   */
  void decide(CompanyState c, String choice, SeededRandom random) {
    decide(c, choice, false, random);
  }

  /**
   * 크게 정할 수도 있다 (decisions.md 260번): 판돈이 두 배고, 직원이 사장 말을 안 들을 확률(꼬드김·제 판단)이 1.5배다("사장님이 너무 세게
   * 가시는데요"). 지켜보기는 크게 할 수 없다. 지켜봤으면 맞는 쪽으로 했을 때 벌었을 돈을 남겨 결과에 보인다.
   */
  void decide(CompanyState c, String choice, boolean big, SeededRandom random) {
    if (big && HOLD.equals(choice)) {
      throw new InvalidRequestException("지켜보기는 크게 할 수 없다");
    }
    if (c.invest == null || c.invest.choice != null) {
      throw new InvalidRequestException("이번 분기 종목 회의는 이미 했다");
    }
    if (Boolean.FALSE.equals(c.invest.found)) {
      throw new InvalidRequestException("이번 분기에는 아직 아무도 종목을 물어 오지 않았다");
    }
    // "너희가 알아서 해"는 뺐다 (352번): 토론은 회의를 열 때 먼저 하고, 마지막은 늘 사장이 고른다.
    if (!List.of(BUY, SELL, HOLD).contains(choice)) {
      throw new InvalidRequestException("고를 수 없는 것: " + choice);
    }
    List<Employee> traders = company.traders(c);
    if (traders.isEmpty()) {
      throw new InvalidRequestException("돈을 굴리는 자리에 아무도 없다");
    }
    // 창을 거치지 않고 바로 정해도(옛 화면, 시험) 지금 배치로 회의를 연 셈 친다.
    convene(c, random);
    boolean delegated = false;
    execute(c, choice, big, delegated, random);
  }

  /** 정한 쪽으로 직원마다 굴린다. */
  private void execute(
      CompanyState c, String choice, boolean big, boolean delegated, SeededRandom random) {
    List<Employee> traders = company.traders(c);
    Map<Integer, String> reads = new HashMap<>();
    c.invest.remarks.forEach(r -> reads.put(r.employeeId, r.read));
    RaisingContent.Invest texts = content.raising().company().invest();
    // 한 분기의 회의라 판돈도 한 분기 몫이다 (decisions.md 268번): 한 해 몫을 걸면 분기마다 열리는 회의가 한 해 경제를 뒤집는다.
    // 회의 손익 배율 (decisions.md 281번): 분기 몫에 meeting-stake-percent를 곱해 회의 한 번의 무게를 키운다.
    // 회의 수익률의 폭은 그대로 두고 규모의 벽은 판돈에 세운다 (decisions.md 388번).
    long stake =
        company.scaledMeetingStake(
            c,
            company.stakeOf(c, traders.size())
                * (big ? properties.invest().bigStakePercent() : PERCENT)
                / PERCENT
                * properties.invest().meetingStakePercent()
                / PERCENT
                / CompanyEngine.QUARTERS);
    // 종목 회의만의 수익률 (388번): 데스크 몫과 떼어 내 기사의 크기로 정한다. 누가 어느 자리에 앉았든 같다.
    int gainBp = gainBp(c.invest);
    int lossBp = lossBp(c.invest, big);
    int stubborn = big ? properties.invest().bigStubbornPercent() : PERCENT;
    long missed = 0;
    String right = c.invest.up ? BUY : SELL;
    String swayAction = Sentiment.POS.name().equals(c.invest.swaySentiment) ? BUY : SELL;
    String who = tempterName(c.invest.tempter);
    long total = 0;
    for (Employee e : traders) {
      RandomGenerator rng = random.forKey("invest-decide", c.turn(), e.id);
      int swayRoll = rng.nextInt(BP);
      int flipRoll = rng.nextInt(BP);
      CompanyEngine.Odds base = company.odds(c, e);
      CompanyEngine.Odds odds =
          new CompanyEngine.Odds(
              Math.min(BP, base.swayBp() * stubborn / PERCENT),
              Math.min(BP, base.flipBp() * stubborn / PERCENT));
      // 제 판단은 회의에서 한 말 그대로다. 회의를 연 뒤에 앉힌 사람은 지금 읽는다.
      String own = actionOf(reads.computeIfAbsent(e.id, id -> ownRead(c, e, random)));
      InvestResult result = new InvestResult();
      result.employeeId = e.id;
      result.name = e.name;
      result.desk = e.desk;
      if (swayRoll < odds.swayBp() && !swayAction.equals(choice)) {
        result.action = swayAction;
        result.follow = SWAY;
      } else if (flipRoll < odds.flipBp() && !own.equals(choice)) {
        result.action = own;
        result.follow = OWN;
      } else {
        result.action = choice;
        result.follow = BOSS;
      }
      // 맞대결 막대(235번): 사장 말과 맞붙은 것. 일어난 쪽이 있으면 그것, 없으면 먼저 굴린 꼬드김부터 사장과 다른 것.
      if (SWAY.equals(result.follow)
          || (BOSS.equals(result.follow) && !swayAction.equals(choice))) {
        result.rivalKind = SWAY;
        result.rival = swayAction;
        result.guard = StatCodes.CONVICTION;
      } else if (OWN.equals(result.follow) || !own.equals(choice)) {
        result.rivalKind = OWN;
        result.rival = own;
        result.guard = company.flipStat(c, e);
      }
      int bp = HOLD.equals(result.action) ? 0 : result.action.equals(right) ? gainBp : -lossBp;
      result.pnl = CompanyEngine.ofStake(stake, bp);
      total += result.pnl;
      e.totalPnl += result.pnl;
      missed += CompanyEngine.ofStake(stake, gainBp);
      Map<String, String> values = new HashMap<>();
      values.put("action", texts.actions().get(result.action));
      values.put("who", who);
      String template =
          switch (result.follow) {
            case SWAY -> texts.swayed();
            case OWN -> texts.rogue();
            default -> delegated ? texts.team() : texts.obey();
          };
      result.line = Korean.fill(template, values);
      c.invest.results.add(result);
    }
    // 판돈이 건물의 값이라 자본보다 클 수 있다 (411번): 잃을 자본이 모자라면 잃은 사람들의 손실을 그만큼 줄인다.
    long[] capped =
        CompanyEngine.capLosses(
            c.capital, c.invest.results.stream().mapToLong(r -> r.pnl).toArray());
    total = 0;
    for (int i = 0; i < capped.length; i++) {
      InvestResult r = c.invest.results.get(i);
      long cut = capped[i] - r.pnl;
      if (cut != 0) {
        r.pnl = capped[i];
        traders.stream()
            .filter(e -> e.id == r.employeeId)
            .findFirst()
            .ifPresent(e -> e.totalPnl += cut);
      }
      total += r.pnl;
    }
    c.invest.choice = choice;
    c.invest.big = big;
    c.invest.delegated = delegated;
    c.invest.missed = HOLD.equals(choice) ? missed : null;
    c.invest.total = total;
    c.invest.stake = stake * traders.size();
    c.capital = Math.max(0, c.capital + total);
    c.invest.reactions = reactions(c, choice, random);
    // 자기 말을 들어 줬는지에 따라 사기가 움직인다 (270번). 맡겼으면 사장이 들어 주고 말고가 없다.
    if (!delegated) {
      company.pay.afterMeeting(c);
    }
  }

  /**
   * 종목 회의에서 맞혔을 때의 수익률(만분율, decisions.md 388번): 기사의 크기가 콘텐츠의 가장 작은 폭 ~ 가장 큰 폭에서 어디쯤인지(0~1)를
   * gain-power만큼 거듭제곱해 gain-min-bp ~ gain-max-bp에 놓는다. 평범한 기사는 수십 %, 가장 크게 움직이는 기사는 +300%.
   */
  int gainBp(Invest invest) {
    CompanyProperties.Returns r = properties.invest().returns();
    double at = Math.pow(magnitudeAt(invest.magnitudeBp), r.gainPower());
    return (int) Math.round(r.gainMinBp() + (r.gainMaxBp() - r.gainMinBp()) * at);
  }

  /**
   * 종목 회의에서 틀렸을 때 잃는 몫(만분율, 양수, 388번): 기사가 클수록 곧게 늘어난다(loss-min-bp ~ loss-max-bp). 크게 틀리면
   * big-miss-percent를 곱하지만(#388) loss-cap-bp(−50%)보다 더 잃지는 않는다.
   */
  int lossBp(Invest invest, boolean big) {
    CompanyProperties.Returns r = properties.invest().returns();
    double at = magnitudeAt(invest.magnitudeBp);
    long loss = Math.round(r.lossMinBp() + (r.lossMaxBp() - r.lossMinBp()) * at);
    if (big) {
      loss = loss * properties.invest().bigMissPercent() / PERCENT;
    }
    return (int) Math.min(r.lossCapBp(), loss);
  }

  /** 회의 뒤 전투 모드 (414번, #573): 틀린 쪽에 걸었으면 디펜스, 맞힌 쪽이면 공격 판. */
  static final String DEFENSE = "DEFENSE";

  static final String ASSAULT = "ASSAULT";

  /** 이 회의 뒤에 할 전투. 아직 안 정했거나 지켜봤으면 null. */
  static String battleMode(Invest invest) {
    if (invest == null || invest.choice == null || HOLD.equals(invest.choice)) {
      return null;
    }
    String right = invest.up ? BUY : SELL;
    return right.equals(invest.choice) ? ASSAULT : DEFENSE;
  }

  /**
   * 회의 뒤 전투의 세기 (414번): 1부터. 크게 움직인 종목일수록(기사의 크기 0~1을 0~4로), 크게 걸었으면 +1, 깬 번호 스테이지 10개마다 +1. 앱이
   * 적·벽의 세기에 쓴다.
   */
  int battleLevel(Invest invest, int bestStage) {
    return 1
        + (int) Math.round(magnitudeAt(invest.magnitudeBp) * 4)
        + (invest.big ? 1 : 0)
        + bestStage / 10;
  }

  /** 아직 회의 뒤 전투를 할 수 있는가. */
  static boolean battleOpen(Invest invest) {
    return battleMode(invest) != null && !invest.battleClosed && invest.battleStars == null;
  }

  /**
   * 회의 뒤 전투의 결과를 받아 회의 손익을 확정한다 (414번, #573). 디펜스는 별에 따라 잃은 몫을 남기는 비율이 줄고(별 3개면 손실을 없애고 판돈의 일부를 더
   * 번다), 공격은 번 몫을 키운다. 바뀐 몫(0 이상)을 자본에 더하고 돌려준다. 한 회의에 한 번, 그 분기 안에만.
   */
  long battle(CompanyState c, String mode, int stars) {
    Invest invest = c.invest;
    String expected = battleMode(invest);
    if (expected == null) {
      throw new InvalidRequestException("이번 회의 뒤에는 전투가 없다");
    }
    if (!expected.equals(mode)) {
      throw new InvalidRequestException("이번 회의 뒤 전투는 " + expected + "다");
    }
    if (!battleOpen(invest)) {
      throw new InvalidRequestException("이번 회의 뒤 전투는 이미 끝났다");
    }
    if (stars < 0 || stars > 3) {
      throw new InvalidRequestException("별은 0~3개다: " + stars);
    }
    CompanyProperties.Battle rule = properties.invest().battle();
    long bonus = 0;
    if (DEFENSE.equals(mode)) {
      if (invest.total < 0) {
        long kept = invest.total * rule.defenseKeepPercent().get(stars) / PERCENT;
        bonus = kept - invest.total;
      }
      if (stars == 3 && invest.stake != null) {
        bonus += invest.stake * rule.defenseGainPercent() / PERCENT;
      }
    } else if (invest.total > 0) {
      bonus =
          CompanyEngine.ofStake(invest.total, (long) rule.assaultPercent().get(stars) * 100)
              - invest.total;
    }
    bonus = Math.max(0, bonus);
    invest.battleStars = stars;
    invest.battleBonus = bonus;
    invest.battleClosed = true;
    c.capital = CompanyEngine.plus(c.capital, bonus);
    return bonus;
  }

  /** 화면에 보이는 회의 수익률의 범위(만분율): 틀렸을 때 가장 크게 잃는 몫과 맞혔을 때 가장 크게 버는 몫 (388번). */
  int lossCapBp() {
    return properties.invest().returns().lossCapBp();
  }

  int gainMaxBp() {
    return properties.invest().returns().gainMaxBp();
  }

  /** 회의 수익률(만분율) = 회의 손익 ÷ 건 판돈 (388번). 판돈을 적기 전에 정한 회의거나 판돈이 0이면 null. */
  Integer returnBp(Invest invest) {
    if (invest.stake == null || invest.stake <= 0) {
      return null;
    }
    return (int) Math.round(invest.total * (double) BP / invest.stake);
  }

  /**
   * 회의 뒤 종목이 움직인 폭(%, 양수, #405 뒤 사용자 요청): 회의 수익률의 폭(−50% ~ +300%, 388번)과 같게, 올랐으면 맞혔을 때 수익률(+15% ~
   * +300%), 내렸으면 틀렸을 때 잃는 몫(−20% ~ −50%)이다. 차트·"n% 올랐다" 문구·발굴 보고가 이 값을 쓴다. 기사의 크기(magnitudeBp,
   * 4~35%)는 이 폭이 콘텐츠의 어디쯤인지 정하는 데만 쓴다.
   */
  int movedPercent(Invest invest) {
    int bp = invest.up ? gainBp(invest) : lossBp(invest, false);
    return Math.round(bp / (float) PERCENT);
  }

  /** 기사의 크기가 콘텐츠의 모든 뉴스에서 가장 작은 폭 ~ 가장 큰 폭 사이 어디쯤인가(0~1). */
  private double magnitudeAt(int magnitudeBp) {
    int least = content.news().stream().mapToInt(n -> n.magnitude().minBp()).min().orElse(0);
    int most = content.news().stream().mapToInt(n -> n.magnitude().maxBp()).max().orElse(least);
    if (most <= least) {
      return 1;
    }
    return Math.clamp((magnitudeBp - least) / (double) (most - least), 0.0, 1.0);
  }

  /**
   * 토론의 결론 (decisions.md 279·352번): 회의에서 나온 한마디를 저울에 단다. 사자는 매수 쪽, 팔자는 매도 쪽에 그 직원의 안목 + 10만큼
   * 얹고(모르겠다는 얹지 않는다), 무게만큼의 확률로 한쪽이 이긴다. 양쪽 다 비었으면 반반. 맞붙은 무게는 화면의 불꽃 장면이 쓴다. 사거나 팔 뿐 지켜보지는 않는다.
   * 전에는 "너희가 알아서 해"로 맡길 때만 돌렸고 그게 곧 결정이었다. 지금은 회의를 열 때 돌려 토론을 먼저 보이고, 결정은 사장이 한다.
   */
  private String teamCall(CompanyState c, SeededRandom random) {
    int buy = 0;
    int sell = 0;
    for (CompanyState.Remark r : c.invest.remarks) {
      Employee e = c.employees.stream().filter(x -> x.id == r.employeeId).findFirst().orElse(null);
      int weight = (e == null ? 0 : e.stats.get(StatCodes.INSIGHT)) + TEAM_WEIGHT_BASE;
      if (UP.equals(r.read)) {
        buy += weight;
      } else if (DOWN.equals(r.read)) {
        sell += weight;
      }
    }
    c.invest.teamBuy = buy;
    c.invest.teamSell = sell;
    RandomGenerator rng = random.forKey("invest-team", c.turn());
    boolean buys = buy + sell == 0 ? rng.nextBoolean() : rng.nextInt(buy + sell) < buy;
    c.invest.debate = debate(c, buys, random);
    return buys ? BUY : SELL;
  }

  /**
   * 결과가 드러난 뒤 양쪽의 반응 (decisions.md 358번, #415): 토론에서 각 쪽을 대표해 말한 첫 사람이 한마디씩. 맞힌 쪽은 사장이 따랐으면 cheer,
   * 안 따랐으면 toldYou. 틀린 쪽은 사장이 따랐으면 sorry, 안 따랐으면 relief. 지켜봤으면 아무도 따르지 않은 것이다. 토론이 없으면(옛 회의) 비어 있다.
   */
  private List<CompanyState.DebateLine> reactions(
      CompanyState c, String choice, SeededRandom random) {
    List<CompanyState.DebateLine> out = new ArrayList<>();
    Map<String, List<String>> after = content.raising().company().invest().debate().after();
    if (after == null || c.invest.debate.isEmpty()) {
      return out;
    }
    RandomGenerator rng = random.forKey("invest-after", c.turn());
    String right = c.invest.up ? BUY : SELL;
    for (String side : List.of(BUY, SELL)) {
      CompanyState.DebateLine speaker =
          c.invest.debate.stream()
              .filter(d -> side.equals(d.side) && !d.last)
              .findFirst()
              .orElse(null);
      if (speaker == null) {
        continue;
      }
      boolean isRight = side.equals(right);
      boolean followed = side.equals(choice);
      String key = isRight ? (followed ? "cheer" : "toldYou") : (followed ? "sorry" : "relief");
      List<String> lines = after.getOrDefault(key, List.of());
      if (lines.isEmpty()) {
        continue;
      }
      String text =
          Korean.fill(
              lines.get(rng.nextInt(lines.size())),
              Map.of("stock", company.stockName(c.invest.stock)));
      out.add(debateLine(speaker.name, side, text, isRight ? WIN : LOSE));
    }
    return out;
  }

  /** 토론에서 오가는 말의 차례 수: 매수파·매도파가 이만큼씩 번갈아 말한 뒤 결판을 낸다 (304번: 셋에서 둘로, 대신 한마디가 길다). */
  private static final int DEBATE_ROUNDS = 2;

  /**
   * 맡긴 회의의 토론 (decisions.md 285·295번). 사자고 한 직원은 매수파, 팔자고 한 직원은 매도파다. 말은 **팀장만** 한다(295번: 사람이 늘어
   * 회의실이 꽉 찼다): 그쪽에 팀장이 없으면 안목이 가장 높은 사람이, 한쪽이 아예 비었으면 모르겠다던 직원이, 그도 없으면 옆자리 사람이 끌려 나와 그쪽을 든다. 말에는
   * 기사의 요지를 제 말로 엮는다(따오지 않는다). 두 바퀴 뒤 결판은 세 박자다: 사회(말한 사람 가운데 안목이 가장 높은 사람)가 양쪽 무게를 읽으며 표결을 부르고, 이긴
   * 쪽 첫 사람이 선언하고, 진 쪽 첫 사람이 토를 달고 물러난다. 승패는 저울이 이미 정했다.
   */
  private List<CompanyState.DebateLine> debate(CompanyState c, boolean buys, SeededRandom random) {
    RaisingContent.Debate texts = content.raising().company().invest().debate();
    Map<String, String> fallback = content.raising().company().invest().points();
    String stock = content.stock(c.invest.stock).name();
    Map<String, List<String>> sides = new HashMap<>();
    sides.put(BUY, new ArrayList<>());
    sides.put(SELL, new ArrayList<>());
    List<String> undecided = new ArrayList<>();
    // 안목이 높은 사람부터: 선언과 승복은 그 쪽의 첫 사람이 한다.
    List<CompanyState.Remark> remarks = new ArrayList<>(c.invest.remarks);
    Map<Integer, Integer> insight = new HashMap<>();
    Map<Integer, Boolean> leads = new HashMap<>();
    for (CompanyState.Remark r : remarks) {
      Employee e = c.employees.stream().filter(x -> x.id == r.employeeId).findFirst().orElse(null);
      insight.put(r.employeeId, e == null ? 0 : e.stats.get(StatCodes.INSIGHT));
      leads.put(r.employeeId, e != null && company.teams.leads(c, e));
    }
    remarks.sort(
        java.util.Comparator.comparingInt((CompanyState.Remark r) -> insight.get(r.employeeId))
            .reversed());
    for (String side : List.of(BUY, SELL)) {
      String read = BUY.equals(side) ? UP : DOWN;
      List<CompanyState.Remark> mine = remarks.stream().filter(r -> read.equals(r.read)).toList();
      List<String> speakers =
          mine.stream().filter(r -> leads.get(r.employeeId)).map(r -> r.name).toList();
      if (speakers.isEmpty() && !mine.isEmpty()) {
        speakers = List.of(mine.getFirst().name);
      }
      sides.get(side).addAll(speakers);
    }
    remarks.stream()
        .filter(r -> !UP.equals(r.read) && !DOWN.equals(r.read))
        .forEach(r -> undecided.add(r.name));
    int bystander = 0;
    for (String side : List.of(BUY, SELL)) {
      if (sides.get(side).isEmpty()) {
        sides
            .get(side)
            .add(
                undecided.isEmpty()
                    ? texts.bystanders().get(bystander++)
                    : undecided.removeFirst());
      }
    }
    Map<String, List<String>> points = new HashMap<>();
    points.put(UP, sidePoints(c.invest.sentences, UP, fallback));
    points.put(DOWN, sidePoints(c.invest.sentences, DOWN, fallback));
    RandomGenerator rng = random.forKey("invest-debate", c.turn());
    Map<String, List<String>> lines = new HashMap<>();
    for (String side : List.of(BUY, SELL)) {
      List<String> shuffled = new ArrayList<>(texts.lines().get(side));
      java.util.Collections.shuffle(shuffled, rng);
      lines.put(side, shuffled);
    }
    List<CompanyState.DebateLine> out = new ArrayList<>();
    for (int i = 0; i < DEBATE_ROUNDS; i++) {
      for (String side : List.of(BUY, SELL)) {
        List<String> mine = points.get(BUY.equals(side) ? UP : DOWN);
        List<String> theirs = points.get(BUY.equals(side) ? DOWN : UP);
        String text =
            Korean.fill(
                lines.get(side).get(i % lines.get(side).size()),
                Map.of(
                    "point", mine.get(i % mine.size()),
                    "against", theirs.get(i % theirs.size()),
                    "stock", stock));
        List<String> names = sides.get(side);
        out.add(debateLine(names.get(i % names.size()), side, text, TALK));
      }
    }
    String winner = buys ? BUY : SELL;
    String loser = buys ? SELL : BUY;
    // 사회: 말한 사람 가운데 안목이 가장 높은 사람(remarks는 안목 순이라 양쪽 첫 사람 가운데 먼저 나오는 쪽). 끌려 나온 사람은 사회를 못 본다.
    String chairSide =
        remarks.stream()
            .filter(r -> sides.get(BUY).contains(r.name) || sides.get(SELL).contains(r.name))
            .findFirst()
            .map(r -> sides.get(BUY).contains(r.name) ? BUY : SELL)
            .orElse(winner);
    out.add(
        debateLine(
            sides.get(chairSide).getFirst(),
            chairSide,
            Korean.fill(
                texts.tally().get(rng.nextInt(texts.tally().size())),
                Map.of(
                    "buy", String.valueOf(c.invest.teamBuy),
                    "sell", String.valueOf(c.invest.teamSell))),
            TALLY));
    List<String> win = texts.win().get(winner);
    out.add(
        debateLine(sides.get(winner).getFirst(), winner, win.get(rng.nextInt(win.size())), WIN));
    out.add(
        debateLine(
            sides.get(loser).getFirst(),
            loser,
            texts.lose().get(rng.nextInt(texts.lose().size())),
            LOSE));
    return out;
  }

  /** 토론 줄의 종류 (295번). */
  static final String TALK = "TALK";

  static final String TALLY = "TALLY";
  static final String WIN = "WIN";
  static final String LOSE = "LOSE";

  /** 한쪽으로 기운 문장의 요지들(겹치지 않게). 요지가 하나도 없으면(옛 기사) 대신 쓰는 요지 하나. */
  private static List<String> sidePoints(
      List<Sentence> sentences, String sign, Map<String, String> fallback) {
    List<String> out = new ArrayList<>();
    for (Sentence s : sentences) {
      if (sign.equals(s.sign) && s.point != null && !out.contains(s.point)) {
        out.add(s.point);
      }
    }
    if (out.isEmpty()) {
      out.add(fallback.get(sign));
    }
    return out;
  }

  private static CompanyState.DebateLine debateLine(
      String name, String side, String text, String kind) {
    CompanyState.DebateLine line = new CompanyState.DebateLine();
    line.name = name;
    line.side = side;
    line.text = text;
    line.kind = kind;
    line.last = !TALK.equals(kind);
    return line;
  }

  /** 맡길 때 한마디 하나의 무게 바닥: 안목이 0이어도 목소리는 있다. */
  private static final int TEAM_WEIGHT_BASE = 10;

  String tempterName(String code) {
    return content.raising().tempters().stream()
        .filter(t -> t.code().equals(code))
        .findFirst()
        .map(RaisingContent.Tempter::name)
        .orElse(code);
  }

  private static String actionOf(String read) {
    return switch (read) {
      case UP -> BUY;
      case DOWN -> SELL;
      default -> HOLD;
    };
  }

  /**
   * 정한 뒤 물어 온 직원을 칭찬하거나 탓하는 한 줄 (decisions.md 267번). 물어 온 사람의 회의 의견도 본다 (#340): 맞는 말을 했는데 사장이 다르게
   * 골랐으면 "들을 걸 그랬다", 가져와 놓고 팔자고 했는데 빠졌으면 칭찬, 팔자고 했는데 올랐으면 그 말을 짚는다. 물어 온 사람이 없는 옛 회의면 null.
   */
  String credit(CompanyState c) {
    Invest invest = c.invest;
    if (invest.finderName == null || invest.choice == null) {
      return null;
    }
    String who =
        invest.finderRole == null ? invest.finderName : invest.finderName + " " + invest.finderRole;
    String read =
        invest.remarks == null
            ? null
            : invest.remarks.stream()
                .filter(r -> invest.finderId != null && r.employeeId == invest.finderId)
                .map(r -> r.read)
                .findFirst()
                .orElse(null);
    String right = invest.up ? UP : DOWN;
    String key = right;
    if (right.equals(read) && !invest.choice.equals(actionOf(read))) {
      key = "ignored";
    } else if (DOWN.equals(read) && !invest.up) {
      key = "readDown";
    } else if (DOWN.equals(read) && invest.up) {
      key = "missed";
    }
    return Korean.fill(
        content.raising().company().scout().credit().get(key),
        Map.of(
            "name",
            who,
            "stock",
            content.stock(invest.stock).name(),
            "percent",
            String.valueOf(movedPercent(invest)),
            "moved",
            invest.up ? "올랐다" : "빠졌다"));
  }

  /** 정한 뒤 드러나는 한 줄: 종목이 몇 % 올랐는지 내렸는지. */
  String reveal(CompanyState c) {
    StockDefinition stock = content.stock(c.invest.stock);
    return Korean.fill(
        content.raising().company().invest().reveal().get(c.invest.up ? UP : DOWN),
        Map.of("stock", stock.name(), "percent", String.valueOf(movedPercent(c.invest))));
  }
}
