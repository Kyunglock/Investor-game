package investorgame.raising.internal;

import investorgame.behavior.BehaviorService;
import investorgame.common.Direction;
import investorgame.common.Hint;
import investorgame.common.Korean;
import investorgame.common.StatCodes;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.RaisingContent;
import investorgame.raising.internal.CompanyState.Employee;
import investorgame.raising.internal.CompanyState.Macro;
import investorgame.raising.internal.CompanyState.Sentence;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.random.RandomGenerator;

/**
 * 거시경제 회의 (decisions.md 266번, #329). 해마다 큰 흐름 하나(기준금리·환율·유가·물가·경기)를 놓고 직원들과 고민하고, 사장이 올해 회사의
 * 태도(공격·중립·방어)를 고른다. 숨은 답은 올해 시장 갈래(호황이면 오름, 폭락장이면 내림)와 섹터 바람이다. 태도는 그해 결산 전체(모든 데스크)의 판돈에 걸린다. 회의가
 * 끝나면 종목 발굴팀 직원이(낮은 확률로 섹터 데스크 직원도) 종목을 물어 온다: 종목 회의는 그때만 열린다 (267번). DB와 시각을 모른다.
 */
class MacroEngine {

  static final String AGGRESSIVE = "AGGRESSIVE";
  static final String NEUTRAL = "NEUTRAL";
  static final String DEFENSIVE = "DEFENSIVE";
  static final List<String> STANCES = List.of(AGGRESSIVE, NEUTRAL, DEFENSIVE);

  static final String SCOUT_DESK = "scout";

  private static final String UP = "UP";
  private static final String DOWN = "DOWN";
  private static final String NEUTRAL_READ = "NEUTRAL";
  private static final int BP = 10_000;
  private static final int PERCENT = 100;

  private final CompanyEngine company;
  private final InvestEngine invest;
  private final ContentCatalog content;
  private final BehaviorService behavior;
  private final CompanyProperties properties;

  MacroEngine(
      CompanyEngine company,
      InvestEngine invest,
      ContentCatalog content,
      BehaviorService behavior,
      CompanyProperties properties) {
    this.company = company;
    this.invest = invest;
    this.content = content;
    this.behavior = behavior;
    this.properties = properties;
  }

  private RaisingContent.Macro texts() {
    return content.raising().company().macro();
  }

  /**
   * 올해의 거시경제 회의를 준비한다 (281번: 한 해에 한 번, 주제 하나). 숨은 방향: 호황인 해면 오름, 폭락장인 해면 내림, 그 밖에는
   * normal-up-percent로 오름. 기사는 종목 회의와 같은 꼴(결정적 문장 하나 + 곁가지 둘 + 중립 하나)이고, 올해 폭락 조짐(헛조짐일 수도)이 있으면 기사에
   * 실린다.
   */
  Macro create(CompanyState c, SeededRandom random) {
    RandomGenerator rng = random.forKey("macro", c.turn());
    int topicRoll = rng.nextInt(BP);
    int upRoll = rng.nextInt(PERCENT);
    // 예전 꼬드김 한마디(decisions.md 278번에서 뺐다)의 몫을 뽑아만 둔다: 같은 시드면 기사가 전과 같게.
    rng.nextInt(2);
    rng.nextInt(BP);
    rng.nextInt(BP);
    List<RaisingContent.MacroTopic> topics = texts().topics();
    RaisingContent.MacroTopic topic = topics.get(topicRoll % topics.size());
    Macro macro = new Macro();
    macro.topic = topic.code();
    boolean crashYear = CompanyEngine.CRASH.equals(c.phase);
    macro.up =
        !crashYear && ("boom".equals(c.phase) || upRoll < properties.macro().normalUpPercent());
    macro.sentences =
        invest.article(topic.up(), topic.down(), topic.neutral(), macro.up, rng, Map.of());
    if (c.omen != null) {
      Sentence omen = new Sentence();
      omen.text = c.omen;
      omen.sign = DOWN;
      omen.omen = true;
      macro.sentences.add(rng.nextInt(macro.sentences.size() + 1), omen);
    }
    macro.clarity = invest.pickClarity(random.forKey("macro-clarity", c.turn()).nextInt(BP));
    return macro;
  }

  RaisingContent.MacroTopic topic(Macro macro) {
    return texts().topics().stream()
        .filter(t -> t.code().equals(macro.topic))
        .findFirst()
        .orElseThrow();
  }

  /** 지금 고를 수 있는가: 고르지 않은 회의가 있고 돈을 굴리는 직원이 있다. 태도는 돈을 굴리는 사람의 판돈에만 걸린다. */
  boolean open(CompanyState c) {
    return c.macro != null && c.macro.stance == null && !company.traders(c).isEmpty();
  }

  boolean convened(CompanyState c) {
    return c.macro != null && c.macro.remarks != null;
  }

  /** 그해 결산에 걸리는 태도. 고르지 않았거나 회의가 없던 해면 중립. */
  String stance(CompanyState c) {
    return c.macro == null || c.macro.stance == null ? NEUTRAL : c.macro.stance;
  }

  /** 그해 결산 판돈 비율(%). */
  int stakePercent(CompanyState c) {
    return stakePercentOf(stance(c));
  }

  /**
   * 태도가 숨은 방향과 맞았는가에 따라 판단마다 더하거나 빼는 만분율 (#388). 공격은 오를 때, 방어는 내릴 때 맞다. 중립은 0. 전에는 공격이 판돈만 키워 기사를 안
   * 읽고 늘 공격해도 이겼다.
   */
  int stanceBp(CompanyState c) {
    String stance = stance(c);
    if (c.macro == null || NEUTRAL.equals(stance)) {
      return 0;
    }
    boolean right = AGGRESSIVE.equals(stance) == c.macro.up;
    return right
        ? properties.macro().rightBp().getOrDefault(stance, 0)
        : -properties.macro().wrongBp().getOrDefault(stance, 0);
  }

  /** 폭락장의 시장 손익에 곱하는 비율(%): 방어면 줄어든다. */
  int crashPercent(CompanyState c) {
    return DEFENSIVE.equals(stance(c)) ? properties.macro().defensiveCrashPercent() : PERCENT;
  }

  /** 섹터 바람(만분율): 그 자리가 순풍이면 +wind, 역풍이면 −wind, 아니면 0. 회의가 없던 해면 0. */
  int windBp(CompanyState c, String desk) {
    if (c.macro == null) {
      return 0;
    }
    RaisingContent.Wind wind = topic(c.macro).winds().get(c.macro.up ? UP : DOWN);
    if (wind.tail().contains(desk)) {
      return properties.macro().windBp();
    }
    return wind.head().contains(desk) ? -properties.macro().windBp() : 0;
  }

  /**
   * 회의를 연다: 지금 배치로 한마디와 리서치 팀 형광펜을 굳힌다 (249번과 같다). 이미 열었으면 아무것도 하지 않는다. 열 수 없으면(골랐거나 돈을 굴리는 사람이 없다)
   * 400.
   */
  void convene(CompanyState c, SeededRandom random) {
    if (convened(c)) {
      return;
    }
    if (!open(c)) {
      throw new InvalidRequestException("지금 열 수 있는 거시경제 회의가 없다");
    }
    RaisingContent.Macro texts = texts();
    Macro macro = c.macro;
    List<CompanyState.Remark> remarks = new ArrayList<>();
    java.util.Set<String> used = new java.util.HashSet<>();
    int penalty = invest.penalty(macro.clarity);
    for (Employee e : c.employees) {
      if (e.desk == null || CompanyEngine.HR_DESK.equals(e.desk)) {
        continue;
      }
      int own = e.stats.get(StatCodes.INSIGHT);
      int insight = Math.max(0, own + Math.max(0, company.researchInsight(c) - own) / 2 - penalty);
      String read = read(macro, insight, random.forKey("macro-read", c.turn(), e.id));
      Hint.Detail voice = Hint.Detail.of(own);
      boolean sharp = voice == Hint.Detail.HIGH || voice == Hint.Detail.EXPERT;
      String tier =
          sharp && invest.foggiest(macro.clarity) && !NEUTRAL_READ.equals(read)
              ? "foggy"
              : voice.key();
      List<String> lines = texts.remarks().get(tier).get(read);
      String line =
          company.fresh(
              c, lines, random.forKey("macro-remark", c.turn(), e.id).nextInt(lines.size()), used);
      InvestEngine.Points points =
          InvestEngine.points(
              macro.sentences,
              read,
              voice,
              content.raising().company().invest().points(),
              texts.omenPoint());
      CompanyState.Remark r = new CompanyState.Remark();
      r.employeeId = e.id;
      r.name = e.name;
      r.desk = e.desk;
      r.read = read;
      r.text = Korean.fill(line, Map.of("point", points.point(), "against", points.against()));
      remarks.add(r);
    }
    macro.remarks = remarks;
    company.remember(c, used);
    Optional<Employee> researcher = company.researcher(c);
    if (researcher.isPresent()) {
      Employee r = researcher.get();
      int insight = Math.max(0, r.stats.get(StatCodes.INSIGHT) - penalty);
      String pointed = read(macro, insight, random.forKey("macro-hint", c.turn(), r.id));
      boolean right = pointed.equals(macro.up ? UP : DOWN);
      for (int i = 0; i < macro.sentences.size() && !NEUTRAL_READ.equals(pointed); i++) {
        Sentence s = macro.sentences.get(i);
        if (right ? s.decisive : s.sign.equals(pointed) && !s.omen) {
          macro.highlightIndex = i;
          macro.highlightBy = r.name;
          break;
        }
      }
    }
  }

  private String read(Macro macro, int insight, RandomGenerator rng) {
    return behavior.hint(insight, macro.up ? Direction.UP : Direction.DOWN, rng).direction().name();
  }

  /**
   * 사장이 올해 태도를 고른다. 창을 거치지 않고 바로 골라도 지금 배치로 회의를 연 셈 친다. 고르면 회의가 끝나고 직원이 종목을 물어 온다(267번). 이미 골랐거나 없는
   * 태도면 400.
   */
  void decide(CompanyState c, String stance, SeededRandom random) {
    if (!STANCES.contains(stance)) {
      throw new InvalidRequestException("고를 수 없는 태도: " + stance);
    }
    if (c.macro == null || c.macro.stance != null) {
      throw new InvalidRequestException("올해 거시경제 회의는 이미 했다");
    }
    convene(c, random);
    c.macro.stance = stance;
    discover(c, random);
  }

  /**
   * 종목을 물어 온 사람의 호칭 (#346): 그 자리의 팀장이면 분기 실적의 팀장 보고와 같이 "종목 발굴팀 팀장", 아니면 직함. 전에는 같은 사람이 회의에서는 "종목
   * 발굴 담당", 실적에서는 "종목 발굴팀 팀장"이었다.
   */
  String finderTitle(CompanyState c, Employee e) {
    if (e.desk != null && company.teams.leads(c, e)) {
      return company.desk(e.desk).name() + " 팀장";
    }
    return roleOf(e);
  }

  /** 종목 발굴팀에 앉은 사람의 직함 (decisions.md 267번). 직함이 없는 자리면 null. */
  String roleOf(Employee e) {
    if (e.desk == null) {
      return null;
    }
    List<String> roles = company.deskRoles(e.desk);
    if (roles == null) {
      return null;
    }
    int at = CompanyEngine.LADDER.indexOf(CompanyEngine.employeeGrade(e));
    int c = CompanyEngine.LADDER.indexOf("C");
    int s = CompanyEngine.LADDER.indexOf("S");
    return roles.get(at < c ? 0 : at < s ? 1 : 2);
  }

  /**
   * 종목을 물어 온다 (267번). 종목 발굴팀 직원부터(안목이 높은 사람부터) base + 안목 × insight-percent / 100 확률로, 그다음 섹터 데스크
   * 직원이 desk-percent 확률로. 먼저 가져온 한 사람의 종목으로 종목 회의가 열린다. 첫 회사의 첫 분기에는 회의를 배우게 돈을 굴리는 직원이 꼭 하나 가져온다.
   * 돈을 굴리는 사람이 없으면 가져와도 굴릴 수 없어 아무도 오지 않는다.
   */
  void discover(CompanyState c, SeededRandom random) {
    if (c.invest == null || !Boolean.FALSE.equals(c.invest.found)) {
      return;
    }
    List<Employee> traders = company.traders(c);
    if (traders.isEmpty()) {
      return;
    }
    CompanyProperties.Scout rules = properties.scout();
    List<Employee> scouts =
        c.employees.stream()
            .filter(e -> SCOUT_DESK.equals(e.desk))
            .sorted(
                Comparator.comparingInt((Employee e) -> -e.stats.get(StatCodes.INSIGHT))
                    .thenComparingInt(e -> e.id))
            .toList();
    Employee finder = null;
    for (Employee e : scouts) {
      int chance =
          rules.basePercent() + e.stats.get(StatCodes.INSIGHT) * rules.insightPercent() / PERCENT;
      if (random.forKey("scout", c.turn(), e.id).nextInt(PERCENT) < chance) {
        finder = e;
        break;
      }
    }
    if (finder == null) {
      for (Employee e : traders) {
        if (company.deskSector(e.desk) != null
            && random.forKey("scout-desk", c.turn(), e.id).nextInt(PERCENT) < rules.deskPercent()) {
          finder = e;
          break;
        }
      }
    }
    if (finder == null && c.number == 1 && c.year == 1 && c.quarter == 1) {
      finder = traders.getFirst();
    }
    if (finder == null) {
      return;
    }
    c.usedNews.remove(c.invest.news);
    c.invest = invest.found(c, finder, finderTitle(c, finder), random);
  }

  /** 분기 실적의 한 줄: 그 분기 주제가 분 섹터 바람 (266·268번). */
  String windLine(CompanyState c) {
    return topic(c.macro).winds().get(c.macro.up ? UP : DOWN).line();
  }

  String stanceLabel(String stance) {
    return texts().stances().get(stance);
  }

  String stanceNote(String stance) {
    return texts().notes().get(stance);
  }

  int stakePercentOf(String stance) {
    return properties.macro().stakePercent().getOrDefault(stance, PERCENT);
  }

  /** 회의가 끝났는데 아무도 종목을 물어 오지 않은 해의 한 줄. */
  String noneLine() {
    return texts().scout().none();
  }
}
