package investorgame.content.internal;

import investorgame.common.Hint;
import investorgame.common.StatCodes;
import investorgame.content.Clue;
import investorgame.content.ContentCatalog;
import investorgame.content.CrisisDefinition;
import investorgame.content.NewsClues;
import investorgame.content.NewsDefinition;
import investorgame.content.RaisingContent;
import investorgame.content.StockDefinition;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** 클래스패스의 content/*.json을 읽는다. 빌드가 저장소의 content/를 넣어 준다 (build.gradle). */
@Component
class JsonContentCatalog implements ContentCatalog {

  static final List<String> FILES =
      List.of(
          "meta.json",
          "news.json",
          "phrases.json",
          "stocks.json",
          "crises.json",
          "raising.json",
          "clues.json");

  private final ContentProperties properties;
  private final Meta meta;
  private final List<NewsDefinition> news;
  private final Phrases phrases;
  private final List<StockDefinition> stocks;
  private final Crises crises;
  private final RaisingContent raising;
  private final Map<String, NewsClues> clues;
  private final Map<String, String> sectorNames;
  private final Map<String, String> styleNames;

  JsonContentCatalog(JsonMapper json, ContentProperties properties) {
    this.properties = properties;
    this.meta = read(json, "meta.json", new TypeReference<>() {});
    this.news = read(json, "news.json", new TypeReference<>() {});
    this.phrases = read(json, "phrases.json", new TypeReference<>() {});
    this.stocks =
        read(json, "stocks.json", new TypeReference<List<StockDefinition>>() {}).stream()
            .sorted(Comparator.comparing(StockDefinition::code))
            .toList();
    this.crises = read(json, "crises.json", new TypeReference<>() {});
    this.raising = read(json, "raising.json", new TypeReference<>() {});
    this.clues = read(json, "clues.json", new TypeReference<Map<String, NewsClues>>() {});
    this.sectorNames = toMap(meta.sectors());
    this.styleNames = toMap(meta.styles());
    validate();
  }

  @Override
  public String version() {
    return meta.version();
  }

  @Override
  public List<NamedCode> sectors() {
    return meta.sectors();
  }

  @Override
  public String sectorName(String code) {
    return sectorNames.getOrDefault(code, code);
  }

  @Override
  public String styleName(String code) {
    return styleNames.getOrDefault(code, code);
  }

  @Override
  public List<NewsDefinition> news() {
    return news;
  }

  @Override
  public List<StockDefinition> stocks() {
    return stocks;
  }

  @Override
  public StockDefinition stock(String code) {
    return stocks.stream()
        .filter(s -> s.code().equals(code))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("알 수 없는 종목: " + code));
  }

  @Override
  public List<StockDefinition> stocksOf(String sectorCode) {
    return stocks.stream().filter(s -> s.sector().equals(sectorCode)).toList();
  }

  @Override
  public List<CrisisDefinition> crises() {
    return crises.scenarios().stream()
        .sorted(Comparator.comparing(CrisisDefinition::code))
        .toList();
  }

  @Override
  public List<String> commonOmens() {
    return crises.commonOmens();
  }

  @Override
  public List<String> hintPhrases(String detail, String direction, String strength) {
    return phrases
        .hints()
        .getOrDefault(detail, Map.of())
        .getOrDefault(direction, Map.of())
        .getOrDefault(strength, List.of());
  }

  @Override
  public List<String> swayPhrases(String sentiment) {
    return phrases.sway().getOrDefault(sentiment, List.of());
  }

  @Override
  public RaisingContent raising() {
    return raising;
  }

  @Override
  public NewsClues clues(String newsCode) {
    NewsClues clue = clues.get(newsCode);
    if (clue == null) {
      throw new IllegalArgumentException("단서 기사 문장이 없는 뉴스: " + newsCode);
    }
    return clue;
  }

  private void validate() {
    require(!news.isEmpty(), "뉴스가 하나도 없다");
    for (NewsDefinition definition : news) {
      require(
          sectorNames.containsKey(definition.sector()), "뉴스가 알 수 없는 섹터를 쓴다: " + definition.code());
      require(
          definition.magnitude().minBp() > 0
              && definition.magnitude().minBp() <= definition.magnitude().maxBp(),
          "뉴스 변동 폭이 잘못되었다: " + definition.code());
      if (definition.stocks() != null) {
        require(!definition.stocks().isEmpty(), "뉴스의 종목 목록이 비었다: " + definition.code());
        for (String code : definition.stocks()) {
          require(
              stocksOf(definition.sector()).stream().anyMatch(st -> st.code().equals(code)),
              "뉴스의 종목이 그 섹터에 없다: " + definition.code() + "/" + code);
        }
      }
    }
    // 종목마다 자기에게 어울리는 종목 뉴스(섹터 전체 뉴스 말고)가 하나는 있어야 한다 (decisions.md 113번).
    for (StockDefinition stock : stocks) {
      require(
          news.stream()
              .anyMatch(
                  n ->
                      n.sector().equals(stock.sector()) && !n.sectorWide() && n.fits(stock.code())),
          "어울리는 종목 뉴스가 없는 종목: " + stock.code());
    }
    for (Hint.Detail detail : Hint.Detail.values()) {
      for (String direction : Set.of("UP", "DOWN")) {
        for (String strength : Set.of("MILD", "STRONG")) {
          require(
              !hintPhrases(detail.key(), direction, strength).isEmpty(),
              "힌트 문구가 없다: " + detail.key() + " " + direction + strength);
        }
      }
      require(
          !hintPhrases(detail.key(), "NEUTRAL", "MILD").isEmpty(),
          "모호한 힌트 문구가 없다: " + detail.key());
    }
    require(!crises.scenarios().isEmpty(), "시장 위기 갈래가 하나도 없다");
    for (CrisisDefinition crisis : crises.scenarios()) {
      require(crisis.omens().size() >= 2, "위기 갈래의 전조 문구가 모자란다: " + crisis.code());
    }
    require(!crises.commonOmens().isEmpty(), "공통 전조 문구가 없다");
    validateStocks();
    require(!swayPhrases("POS").isEmpty() && !swayPhrases("NEG").isEmpty(), "다른 뉴스 문구가 없다");
    validateRaising();
  }

  /** 거시경제 회의와 종목 발굴 문구 (decisions.md 266·267번). */
  private void validateMacro(RaisingContent.Company company) {
    for (RaisingContent.Desk desk : company.desks()) {
      require(desk.roles() == null || desk.roles().size() == 3, "직함은 셋이어야 한다: " + desk.code());
    }
    RaisingContent.Macro macro = company.macro();
    List<String> stances = List.of("AGGRESSIVE", "NEUTRAL", "DEFENSIVE");
    require(
        macro != null
            && macro.stances().keySet().containsAll(stances)
            && macro.notes().keySet().containsAll(stances),
        "거시경제 회의 문구가 없다");
    require(macro.topics().size() >= 3, "거시경제 회의 주제가 셋 이상이어야 한다");
    for (RaisingContent.MacroTopic topic : macro.topics()) {
      require(
          topic.up().size() >= 3 && topic.down().size() >= 3 && !topic.neutral().isEmpty(),
          "거시경제 기사 문장이 모자란다(오름·내림 셋 이상, 중립 하나 이상): " + topic.code());
      requirePoints(topic.up(), "거시경제 " + topic.code());
      requirePoints(topic.down(), "거시경제 " + topic.code());
      for (String side : List.of("UP", "DOWN")) {
        RaisingContent.Wind wind = topic.winds().get(side);
        require(wind != null && wind.line() != null, "섹터 바람이 없다: " + topic.code() + " " + side);
        for (String code :
            java.util.stream.Stream.concat(wind.tail().stream(), wind.head().stream()).toList()) {
          require(
              company.desks().stream().anyMatch(d -> d.code().equals(code) && d.trades()),
              "섹터 바람이 돈을 굴리는 자리가 아니다: " + topic.code() + " " + code);
        }
      }
    }
    for (String voice : List.of("low", "mid", "high", "expert")) {
      for (String read : List.of("UP", "DOWN", "NEUTRAL")) {
        List<String> lines = macro.remarks().getOrDefault(voice, Map.of()).get(read);
        require(lines != null && !lines.isEmpty(), "거시경제 한마디가 없다: " + voice + " " + read);
      }
    }
    for (String read : List.of("UP", "DOWN")) {
      List<String> lines = macro.remarks().getOrDefault("foggy", Map.of()).get(read);
      require(lines != null && !lines.isEmpty(), "흐린 거시경제 기사의 한마디가 없다: " + read);
    }
    requireNoQuote(macro.remarks(), "거시경제");
    requirePoint(macro.omenPoint(), "거시경제 폭락 조짐");
    require(
        company.quarters() != null
            && company.quarters().crash() != null
            && company.quarters().crashAt() != null,
        "분기 결산 문구가 없다");
    RaisingContent.Teams teams = company.teams();
    require(
        teams != null
            && teams.head() != null
            && teams.appointed() != null
            && List.of("up", "down", "flat").stream()
                .allMatch(k -> !teams.trading().getOrDefault(k, List.of()).isEmpty())
            && teams
                .flips()
                .keySet()
                .containsAll(List.of(StatCodes.CONVICTION, StatCodes.PATIENCE, StatCodes.COURAGE))
            && teams.selfFlips().keySet().containsAll(teams.flips().keySet()),
        "팀장 보고 문구가 없다");
    // 돕는 자리의 보고는 그 기간에 한 일을 말한다 (decisions.md 278번).
    for (String key :
        List.of(
            "research",
            "researchNone",
            "researchIdle",
            "risk",
            "riskNone",
            "hr",
            "scoutUp",
            "scoutDown",
            "scoutMany",
            "scoutNone")) {
      require(teams.support().containsKey(key), "돕는 자리의 팀장 보고가 없다: " + key);
    }
    RaisingContent.Scout scout = macro.scout();
    require(
        scout != null
            && scout.none() != null
            && scout.credit().keySet().containsAll(List.of("UP", "DOWN")),
        "종목 발굴 문구가 없다");
    for (String voice : List.of("low", "mid", "high")) {
      require(
          !scout.pitch().getOrDefault(voice, List.of()).isEmpty(), "종목을 가져올 때 한마디가 없다: " + voice);
    }
  }

  private void validateRaising() {
    require(raising != null, "raising.json이 비어 있다");
    require(raising.tempters().size() >= 2, "단골 꼬드김 인물이 모자란다");
    RaisingContent.Company company = raising.company();
    require(company != null && !company.names().isEmpty(), "회사 문구가 없다");
    require(company.desks().stream().anyMatch(RaisingContent.Desk::trades), "돈을 굴리는 자리가 없다");
    require(!company.eras().isEmpty() && company.sale() != null, "시대·매각 문구가 없다");
    require(
        company.gradeLines() != null && company.statNames().keySet().containsAll(StatCodes.ALL),
        "직원 등급 소식 문구가 없다");
    require(
        company.effects() != null && company.effects().list().size() == 9,
        "X 이상 효과는 아홉 개여야 한다(X~ZZZ, XS·XSS·GOD)");
    require(
        company.perks() != null
            && company
                .perks()
                .names()
                .keySet()
                .containsAll(List.of("F", "E", "D", "C", "B", "A", "S", "SS", "SSS"))
            && company.perks().line() != null
            && company.perks().lineTop() != null
            && company.perks().grown() != null,
        "등급 효과 문구가 없다");
    for (RaisingContent.Era era : company.eras()) {
      require(
          era.phaseWeights().values().stream().mapToInt(Integer::intValue).sum() > 0,
          "시대의 시장 가중치가 없다: " + era.code());
    }
    require(company.hotLine() != null, "뜨는 섹터 문구가 없다");
    for (RaisingContent.Desk desk : company.desks()) {
      require(StatCodes.ALL.contains(desk.statCode()), "자리의 능력치가 없다: " + desk.code());
      require(company.wanted().containsKey(desk.code()), "연초 회의 문구가 없다: " + desk.code());
      require(
          desk.sector() == null || (desk.trades() && sectorNames.containsKey(desk.sector())),
          "섹터 데스크의 섹터가 없다: " + desk.code());
    }
    for (RaisingContent.Era era : company.eras()) {
      for (String code : era.deskBonusBp().keySet()) {
        require(
            company.desks().stream().anyMatch(d -> d.code().equals(code) && d.trades()),
            "시대 보너스가 돈을 굴리는 자리가 아니다: " + era.code() + " " + code);
      }
    }
    for (String stat : List.of(StatCodes.CONVICTION, StatCodes.PATIENCE, StatCodes.COURAGE)) {
      require(company.flipLines().containsKey(stat), "결산 소식 줄이 없다: " + stat);
    }
    require(
        company.market() != null
            && company.market().veteran() != null
            && company.market().star() != null
            && company.market().starArrived() != null
            && company.market().starLeft() != null,
        "공채 시장 문구가 없다");
    require(
        company.bankrupt() != null
            && company.bankrupt().notice() != null
            && company.bankrupt().emptied() != null
            && company.bankrupt().opening() != null,
        "망한 회사 문구가 없다");
    require(company.seatsCut() != null, "자리가 줄 때의 소식 줄이 없다");
    require(
        company.people() != null
            && company.people().poacher() != null
            && company.people().poach() != null
            && company.people().kept() != null
            && company.people().left() != null
            && company.people().ignored() != null
            && company.people().settled() != null
            && company.people().raiseAsk() != null
            && company.people().raised() != null
            && company.people().frozen() != null
            && company.people().raiseIgnored() != null
            && company.people().meetingIgnored() != null
            && company.people().heard() != null
            && company.people().rested() != null,
        "사람 이야기 문구가 없다");
    require(
        company.history() != null
            && company
                .history()
                .events()
                .keySet()
                .containsAll(List.of("open", "rise", "left", "best", "worst"))
            && !company.history().achievements().isEmpty(),
        "회사 연표·업적 문구가 없다");
    require(
        company.surnames() != null
            && !company.surnames().isEmpty()
            && company.names() != null
            && !company.names().isEmpty(),
        "직원 이름(성·이름)이 없다");
    require(
        company.surnames().stream().distinct().count() == company.surnames().size()
            && company.names().stream().distinct().count() == company.names().size(),
        "직원 성·이름이 겹친다");
    require(
        company.eraTurn() != null
            && company.eraTurn().ending() != null
            && company.eraTurn().changed() != null,
        "시대가 바뀌는 문구가 없다");
    require(company.eras().size() >= 2, "시대가 둘 이상이어야 바뀐다");
    RaisingContent.Invest invest = company.invest();
    require(
        invest != null
            && invest.options().keySet().containsAll(List.of("BUY", "SELL", "HOLD"))
            && invest.actions().keySet().containsAll(List.of("BUY", "SELL", "HOLD"))
            && invest.remarks() != null
            && invest.points() != null
            && invest.reveal().keySet().containsAll(List.of("UP", "DOWN")),
        "투자 회의 문구가 없다");
    for (String voice : List.of("low", "mid", "high", "expert")) {
      for (String read : List.of("UP", "DOWN", "NEUTRAL")) {
        List<String> lines = invest.remarks().getOrDefault(voice, Map.of()).get(read);
        require(lines != null && !lines.isEmpty(), "직원 한마디가 없다: " + voice + " " + read);
      }
    }
    for (String read : List.of("UP", "DOWN")) {
      List<String> lines = invest.remarks().getOrDefault("foggy", Map.of()).get(read);
      require(lines != null && !lines.isEmpty(), "흐린 기사의 한마디가 없다: " + read);
      requirePoint(invest.points().get(read), "투자 회의 대신 쓰는 요지 " + read);
    }
    requireNoQuote(invest.remarks(), "투자 회의");
    RaisingContent.Debate debate = invest.debate();
    require(debate != null, "맡긴 회의의 토론 문구가 없다");
    for (String side : List.of("BUY", "SELL")) {
      List<String> lines = debate.lines().get(side);
      require(lines != null && lines.size() >= 3, "토론 말이 모자란다(셋 이상): " + side);
      List<String> win = debate.win().get(side);
      require(win != null && !win.isEmpty(), "토론 결판 말이 없다: " + side);
    }
    require(!debate.lose().isEmpty(), "토론에서 진 쪽의 말이 없다");
    require(debate.bystanders().size() >= 2, "토론에 끌려 나올 사람이 둘 있어야 한다");
    requireNoQuote(Map.of("debate", debate.lines()), "토론");
    for (String stat : List.of(StatCodes.CONVICTION, StatCodes.PATIENCE, StatCodes.COURAGE)) {
      require(raising.flipTips().containsKey(stat), "처음 뒤집힘 설명이 없다: " + stat);
    }
    validateMacro(company);
    for (NewsDefinition definition : news) {
      NewsClues clue = clues.get(definition.code());
      require(clue != null, "단서 기사 문장이 없다: " + definition.code());
      require(
          clue.up().size() >= 3 && clue.down().size() >= 3 && !clue.neutral().isEmpty(),
          "단서 기사 문장이 모자란다(오름·내림 셋 이상, 중립 하나 이상): " + definition.code());
      requirePoints(clue.up(), "단서 기사 " + definition.code());
      requirePoints(clue.down(), "단서 기사 " + definition.code());
    }
  }

  private static final Set<String> VOLATILITIES = Set.of("low", "mid", "high");

  /** 섹터마다 종목이 하나 이상 있어야 뉴스가 매매 대상 종목을 뽑을 수 있다 (경제 개편 설계 5.4절). */
  private void validateStocks() {
    require(!stocks.isEmpty(), "종목이 하나도 없다");
    require(
        stocks.stream().map(StockDefinition::code).distinct().count() == stocks.size(),
        "종목 코드가 겹친다");
    require(
        stocks.stream().map(StockDefinition::name).distinct().count() == stocks.size(),
        "종목 이름이 겹친다");
    for (StockDefinition stock : stocks) {
      require(sectorNames.containsKey(stock.sector()), "종목이 알 수 없는 섹터를 쓴다: " + stock.code());
      require(stock.basePrice() > 0, "종목 기준가는 0보다 커야 한다: " + stock.code());
      require(VOLATILITIES.contains(stock.volatility()), "알 수 없는 변동성 등급: " + stock.code());
    }
    for (NamedCode sector : meta.sectors()) {
      require(!stocksOf(sector.code()).isEmpty(), "종목이 없는 섹터: " + sector.code());
    }
  }

  /** 요지가 가장 길 수 있는 글자 수 (decisions.md 272번). 한마디에 둘을 엮어도 모바일에서 두 줄 안팎이 되게. */
  private static final int POINT_CHARS = 30;

  /** 오름·내림 문장마다 요지가 있어야 한다 (272번). */
  private static void requirePoints(List<Clue> clues, String where) {
    for (Clue clue : clues) {
      require(clue.text() != null && !clue.text().isBlank(), where + " 문장이 비었다");
      requirePoint(clue.point(), where + " 「" + clue.text() + "」");
    }
  }

  /**
   * 요지는 한마디 틀에 "{point}는 점", "{point}면"처럼 이어 붙는다 (272번). 그래서 "~다"로 끝나야 하고, "빚이다"처럼 "이다"로 끝나면 "빚이다는
   * 점"이 되어 안 된다(그럴 땐 "빚으로 댄다"처럼 쓴다). 기사 문장을 그대로 옮기지 않게 짧아야 한다.
   */
  private static void requirePoint(String point, String where) {
    require(point != null && !point.isBlank(), "요지가 없다: " + where);
    require(point.endsWith("다") && !point.endsWith("이다"), "요지는 '~다'로 끝나야 한다(이다는 안 된다): " + where);
    require(point.length() <= POINT_CHARS, "요지가 너무 길다(" + POINT_CHARS + "자 이하): " + where);
  }

  /** 한마디 틀은 기사 문장을 따오지 않는다 (272번). 옛 {quote} 자리표시가 남으면 안 된다. */
  private static void requireNoQuote(Map<String, Map<String, List<String>>> remarks, String where) {
    remarks.forEach(
        (voice, byRead) ->
            byRead.forEach(
                (read, lines) ->
                    lines.forEach(
                        line ->
                            require(
                                !line.contains("{quote}") && !line.contains("‘"),
                                where + " 한마디가 기사를 따온다: " + voice + " " + read))));
  }

  private static void require(boolean condition, String message) {
    if (!condition) {
      throw new IllegalStateException("콘텐츠 오류: " + message);
    }
  }

  private static Map<String, String> toMap(List<NamedCode> codes) {
    return codes.stream().collect(Collectors.toUnmodifiableMap(NamedCode::code, NamedCode::name));
  }

  /** content.dirs 중 파일이 있는 첫 디렉터리를, 없으면 클래스 경로(빌드가 복사한 content/)를 읽는다. */
  private <T> T read(JsonMapper json, String file, TypeReference<T> type) {
    Path onDisk =
        properties.dirs().stream()
            .map(dir -> Path.of(dir, file))
            .filter(Files::isRegularFile)
            .findFirst()
            .orElse(null);
    try (InputStream in =
        onDisk != null
            ? Files.newInputStream(onDisk)
            : new ClassPathResource("content/" + file).getInputStream()) {
      return json.readValue(in, type);
    } catch (IOException e) {
      throw new UncheckedIOException(
          "콘텐츠 파일을 읽을 수 없다: %s (content.dirs=%s와 클래스 경로 content/ 모두 없음. IDE에서 실행했다면 content.dirs에 저장소의 content 폴더를 넣는다)"
              .formatted(file, properties.dirs()),
          e);
    }
  }

  record Meta(
      String version,
      List<NamedCode> styles,
      List<NamedCode> risks,
      List<NamedCode> minds,
      List<NamedCode> sectors) {}

  record Crises(List<CrisisDefinition> scenarios, List<String> commonOmens) {}

  record Phrases(
      Map<String, Map<String, Map<String, List<String>>>> hints, Map<String, List<String>> sway) {}
}
