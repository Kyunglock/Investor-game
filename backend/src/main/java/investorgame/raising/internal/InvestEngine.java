package investorgame.raising.internal;

import investorgame.behavior.BehaviorService;
import investorgame.common.Direction;
import investorgame.common.Hint;
import investorgame.common.Korean;
import investorgame.common.Sentiment;
import investorgame.common.StatCodes;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.SeededRandom;
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
  static final String BOSS = "BOSS";
  static final String OWN = "OWN";
  static final String SWAY = "SWAY";

  private static final String UP = "UP";
  private static final String DOWN = "DOWN";
  private static final String NEUTRAL = "NEUTRAL";
  private static final int SIDE_SENTENCES = 2;
  private static final int BP = 10_000;
  private static final int PERCENT = 100;

  /** 한마디에 따오는 기사 문장의 길이. 넘으면 줄임표로 자른다. */
  private static final int QUOTE_CHARS = 20;

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
    RandomGenerator rng = random.forKey("invest", c.year);
    int pickRoll = rng.nextInt(BP);
    int stockRoll = rng.nextInt(BP);
    int upRoll = rng.nextInt(BP);
    int magnitudeRoll = rng.nextInt(BP);
    int swayRoll = rng.nextInt(2);
    int swayPhraseRoll = rng.nextInt(BP);
    int tempterRoll = rng.nextInt(BP);

    NewsDefinition news = pickNews(c, pickRoll);
    c.usedNews.add(news.code());
    List<StockDefinition> stocks =
        content.stocksOf(news.sector()).stream().filter(s -> news.fits(s.code())).toList();
    StockDefinition stock = stocks.get(stockRoll % stocks.size());
    Invest invest = new Invest();
    invest.news = news.code();
    invest.stock = stock.code();
    invest.up =
        upRoll
            < news.directionRule().upBp() + properties.invest().yearUpBp().getOrDefault(c.phase, 0);
    invest.magnitudeBp =
        news.magnitude().minBp()
            + magnitudeRoll % (news.magnitude().maxBp() - news.magnitude().minBp() + 1);
    Map<String, String> names = names(stock);
    invest.title = Korean.fill(news.title(), names);
    invest.sentences = article(content.clues(news.code()), invest.up, rng, names);

    Sentiment sentiment = swayRoll == 0 ? Sentiment.POS : Sentiment.NEG;
    List<String> phrases = content.swayPhrases(sentiment.name());
    // 직원과 이름이 같은 단골 인물(김대리)은 회의에 끼지 않는다: 누가 누구 말을 들었는지 헷갈린다.
    List<RaisingContent.Tempter> tempters =
        content.raising().tempters().stream()
            .filter(t -> c.employees.stream().noneMatch(e -> e.name.equals(t.name())))
            .filter(t -> c.applicants.stream().noneMatch(a -> a.name.equals(t.name())))
            .toList();
    if (tempters.isEmpty()) {
      tempters = content.raising().tempters();
    }
    // 따로 굴린다: 기사·꼬드김 난수 차례를 바꾸지 않는다.
    invest.clarity = pickClarity(random.forKey("invest-clarity", c.year).nextInt(BP));
    invest.swaySentiment = sentiment.name();
    invest.sway = phrases.get(swayPhraseRoll % phrases.size());
    invest.tempter = tempters.get(tempterRoll % tempters.size()).code();
    return invest;
  }

  private String pickClarity(int roll) {
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
    return properties.invest().clarity().stream()
        .filter(x -> x.code().equals(invest.clarity))
        .mapToInt(CompanyProperties.Clarity::penalty)
        .findFirst()
        .orElse(0);
  }

  /** 가장 흐린 기사(가장 크게 깎는)인가. 안목 높은 직원이 "이번 건 애매하다"고 말한다. */
  private boolean foggiest(Invest invest) {
    int most =
        properties.invest().clarity().stream()
            .mapToInt(CompanyProperties.Clarity::penalty)
            .max()
            .orElse(0);
    return most > 0 && penalty(invest) == most;
  }

  /** 이 회사에 아직 안 나온 뉴스를 가중치대로 뽑는다. 다 나왔으면 처음부터. */
  private NewsDefinition pickNews(CompanyState c, int roll) {
    List<NewsDefinition> roots = content.news().stream().filter(NewsDefinition::root).toList();
    List<NewsDefinition> pool = roots.stream().filter(n -> !c.usedNews.contains(n.code())).toList();
    if (pool.isEmpty()) {
      c.usedNews.clear();
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
    String truth = up ? UP : DOWN;
    String other = up ? DOWN : UP;
    List<String> truthPool = new ArrayList<>(up ? clues.up() : clues.down());
    List<String> otherPool = new ArrayList<>(up ? clues.down() : clues.up());
    List<String> neutralPool = new ArrayList<>(clues.neutral());
    List<Sentence> sentences = new ArrayList<>();
    sentences.add(sentence(draw(truthPool, rng, names), truth, true));
    boolean anyOther = false;
    for (int i = 0; i < SIDE_SENTENCES; i++) {
      boolean opposite =
          rng.nextInt(PERCENT) < properties.invest().sideOppositePercent()
              || (i == SIDE_SENTENCES - 1 && !anyOther);
      anyOther |= opposite;
      sentences.add(
          opposite
              ? sentence(draw(otherPool, rng, names), other, false)
              : sentence(draw(truthPool, rng, names), truth, false));
    }
    sentences.add(sentence(draw(neutralPool, rng, names), NEUTRAL, false));
    for (int i = sentences.size() - 1; i > 0; i--) {
      int j = rng.nextInt(i + 1);
      Sentence t = sentences.get(i);
      sentences.set(i, sentences.get(j));
      sentences.set(j, t);
    }
    return sentences;
  }

  private static Sentence sentence(String text, String sign, boolean decisive) {
    Sentence s = new Sentence();
    s.text = text;
    s.sign = sign;
    s.decisive = decisive;
    return s;
  }

  private static String draw(List<String> pool, RandomGenerator rng, Map<String, String> names) {
    return Korean.fill(pool.remove(rng.nextInt(pool.size())), names);
  }

  /** 투자 회의를 열 수 있는가: 정하지 않은 회의가 있고 돈을 굴리는 직원이 있다. */
  boolean open(CompanyState c) {
    return c.invest != null && c.invest.choice == null && !company.traders(c).isEmpty();
  }

  /** 형광펜: 리서치 팀이 있으면 그 안목으로 결정적 문장에, 빗나가면 반대쪽 곁가지에 긋는다. 리서치 팀이 없거나 방향을 못 읽으면 없다. */
  record Highlight(int index, String by) {}

  Optional<Highlight> highlight(CompanyState c, SeededRandom random) {
    Optional<Employee> researcher = company.researcher(c);
    if (researcher.isEmpty() || c.invest == null) {
      return Optional.empty();
    }
    Employee r = researcher.get();
    int insight = Math.max(0, r.stats.get(StatCodes.INSIGHT) - penalty(c.invest));
    Hint hint = read(c, insight, random.forKey("invest-hint", c.year, r.id));
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
   * 정한다: 낮으면 감·소문·차트 모양으로 큰소리치거나 갈팡질팡하고, 보통이면 기사 한 줄을 대충 근거로 망설이고, 높으면 결정적 문장을 짚고, 최고면 확신한다. 읽은 쪽의
   * 문장을 따온다(안목이 높고 맞게 읽었으면 결정적 문장).
   */
  record Remark(Employee employee, String read, String text, Integer stubbornBp) {}

  List<Remark> remarks(CompanyState c, SeededRandom random) {
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
      String line = lines.get(random.forKey("invest-remark", c.year, e.id).nextInt(lines.size()));
      String quote = quote(c.invest, read, voice);
      remarks.add(
          new Remark(e, read, Korean.fill(line, Map.of("quote", quote, "stock", stock)), stubborn));
    }
    return remarks;
  }

  /** 한마디에 따올 문장: 읽은 쪽으로 기운 문장. 안목이 높으면(HIGH 이상) 그 가운데 결정적 문장을 먼저 고른다. 길면 자른다. */
  private static String quote(Invest invest, String read, Hint.Detail voice) {
    boolean sharp = voice == Hint.Detail.HIGH || voice == Hint.Detail.EXPERT;
    Sentence pick = null;
    for (Sentence s : invest.sentences) {
      if (s.sign.equals(read) && (pick == null || (sharp && s.decisive))) {
        pick = s;
      }
    }
    String text = pick == null ? invest.title : pick.text;
    text = text.endsWith(".") ? text.substring(0, text.length() - 1) : text;
    return text.length() > QUOTE_CHARS ? text.substring(0, QUOTE_CHARS).strip() + "…" : text;
  }

  /** 고집이 보이는 정도: 없음·보통·높음 (제멋대로 할 확률이 stubbornBp 이상이면 보통, 두 배 이상이면 높음). */
  String stubbornLevel(int bp) {
    int line = properties.invest().stubbornBp();
    return bp >= line * 2 ? "HIGH" : bp >= line ? "MID" : "LOW";
  }

  /**
   * 직원이 기사를 읽은 쪽(UP·DOWN·NEUTRAL). 리서치 팀의 형광펜을 보지만 반만 믿는다: 리서치 팀이 더 밝으면 그 차이의 절반만큼 안목이 오른다(239번,
   * 전에는 리서치 팀의 안목을 그대로 빌려 모두 같은 말을 했다). 같은 해·같은 직원이면 늘 같다.
   */
  private String ownRead(CompanyState c, Employee e, SeededRandom random) {
    int own = e.stats.get(StatCodes.INSIGHT);
    int insight =
        Math.max(0, own + Math.max(0, company.researchInsight(c) - own) / 2 - penalty(c.invest));
    Hint hint = read(c, insight, random.forKey("invest-read", c.year, e.id));
    return hint.direction().name();
  }

  private Hint read(CompanyState c, int insight, RandomGenerator rng) {
    return behavior.hint(insight, c.invest.up ? Direction.UP : Direction.DOWN, rng);
  }

  /**
   * 사장이 고른다. 돈을 굴리는 직원마다 꼬드김(줏대) → 손 뒤집힘(자리 능력치) 순으로 굴린다. 꼬드김에 넘어가면 단골 인물 말대로(사라면 사고 팔라면 판다), 뒤집히면
   * "제가 알아서 할게요" 하고 제 판단대로 한다(제 판단이 사장과 같으면 그대로다). 맞으면 자리의 맞힘 몫, 틀리면 틀림 몫, 지켜보면 0. 손익은 바로 자본에 들어간다.
   */
  void decide(CompanyState c, String choice, SeededRandom random) {
    if (c.invest == null || c.invest.choice != null) {
      throw new InvalidRequestException("올해 투자 회의는 이미 했다");
    }
    if (!List.of(BUY, SELL, HOLD).contains(choice)) {
      throw new InvalidRequestException("고를 수 없는 것: " + choice);
    }
    List<Employee> traders = company.traders(c);
    if (traders.isEmpty()) {
      throw new InvalidRequestException("돈을 굴리는 자리에 아무도 없다");
    }
    RaisingContent.Invest texts = content.raising().company().invest();
    long stake = company.stakeOf(c, traders.size());
    String right = c.invest.up ? BUY : SELL;
    String swayAction = Sentiment.POS.name().equals(c.invest.swaySentiment) ? BUY : SELL;
    String who = tempterName(c.invest.tempter);
    long total = 0;
    for (Employee e : traders) {
      RandomGenerator rng = random.forKey("invest-decide", c.year, e.id);
      int swayRoll = rng.nextInt(BP);
      int flipRoll = rng.nextInt(BP);
      CompanyEngine.Odds odds = company.odds(c, e);
      String own = actionOf(ownRead(c, e, random));
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
      CompanyProperties.DeskReturn returns = company.returnsOf(e.desk);
      int bp =
          HOLD.equals(result.action)
              ? 0
              : result.action.equals(right) ? company.gainBp(c, e) : -returns.missBp();
      result.pnl = stake * bp / BP;
      total += result.pnl;
      Map<String, String> values = new HashMap<>();
      values.put("action", texts.actions().get(result.action));
      values.put("who", who);
      String template =
          switch (result.follow) {
            case SWAY -> texts.swayed();
            case OWN -> texts.rogue();
            default -> texts.obey();
          };
      result.line = Korean.fill(template, values);
      c.invest.results.add(result);
    }
    c.invest.choice = choice;
    c.invest.total = total;
    c.capital = Math.max(0, c.capital + total);
  }

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

  /** 정한 뒤 드러나는 한 줄: 종목이 몇 % 올랐는지 내렸는지. */
  String reveal(CompanyState c) {
    StockDefinition stock = content.stock(c.invest.stock);
    return Korean.fill(
        content.raising().company().invest().reveal().get(c.invest.up ? UP : DOWN),
        Map.of(
            "stock",
            stock.name(),
            "percent",
            String.valueOf(Math.round(c.invest.magnitudeBp / (float) PERCENT))));
  }
}
