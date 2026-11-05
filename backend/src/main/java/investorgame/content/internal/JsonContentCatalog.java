package investorgame.content.internal;

import investorgame.common.Hint;
import investorgame.common.StatCodes;
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

  private static final String STYLE_PREFIX = "style.";
  private static final String SECTOR_PREFIX = "sector.";
  private static final String RISK_PREFIX = "risk.";
  private static final String MIND_PREFIX = "mind.";

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
  private final Map<String, String> riskNames;
  private final Map<String, String> mindNames;

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
    this.riskNames = toMap(meta.risks());
    this.mindNames = toMap(meta.minds());
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

  private void validateRaising() {
    require(raising != null, "raising.json이 비어 있다");
    for (String slot : List.of(RaisingContent.SLOT_STYLE, RaisingContent.SLOT_SECTOR)) {
      require(
          raising.traits().stream().anyMatch(card -> slot.equals(card.slot())),
          "육성 성향 카드가 없다: " + slot);
    }
    require(!raising.bigs().isEmpty(), "돈이 걸린 큰일 카드가 없다");
    for (RaisingContent.Card card :
        java.util.stream.Stream.concat(raising.traits().stream(), raising.bigs().stream())
            .toList()) {
      require(card.options().size() >= 2, "육성 카드의 선택지는 둘 이상이어야 한다: " + card.code());
      for (RaisingContent.Option option : card.options()) {
        String where = card.code() + "/" + option.code();
        validateTraitDeltas(where, option.traitDeltas());
        validateStatDeltas(where, option.statDeltas());
        for (RaisingContent.CashOutcome outcome : option.outcomes()) {
          require(outcome.weight() > 0, "결과 가중치는 양수여야 한다: " + where);
        }
      }
    }
    require(raising.tempters().size() >= 2, "단골 꼬드김 인물이 모자란다");
    require(raising.omenReview() != null, "위기 전조 돌아보기 문구가 없다");
    RaisingContent.Company company = raising.company();
    require(company != null && !company.names().isEmpty(), "회사 문구가 없다");
    require(company.desks().stream().anyMatch(RaisingContent.Desk::trades), "돈을 굴리는 자리가 없다");
    require(!company.eras().isEmpty() && company.sale() != null, "시대·매각 문구가 없다");
    require(
        company.gradeLines() != null && company.statNames().keySet().containsAll(StatCodes.ALL),
        "직원 등급 소식 문구가 없다");
    require(
        company.effects() != null && company.effects().list().size() == 6, "X 이상 효과는 여섯 개여야 한다");
    for (RaisingContent.Era era : company.eras()) {
      require(
          era.phaseWeights().values().stream().mapToInt(Integer::intValue).sum() > 0,
          "시대의 시장 가중치가 없다: " + era.code());
    }
    for (RaisingContent.Desk desk : company.desks()) {
      require(StatCodes.ALL.contains(desk.statCode()), "자리의 능력치가 없다: " + desk.code());
      require(company.wanted().containsKey(desk.code()), "연초 회의 문구가 없다: " + desk.code());
    }
    for (String stat : List.of(StatCodes.CONVICTION, StatCodes.PATIENCE, StatCodes.COURAGE)) {
      require(company.flipLines().containsKey(stat), "결산 소식 줄이 없다: " + stat);
    }
    for (String stat : List.of(StatCodes.CONVICTION, StatCodes.PATIENCE, StatCodes.COURAGE)) {
      require(
          raising.devices().stream().filter(d -> stat.equals(d.statCode())).count() == 1,
          "능력치마다 투자 원칙 장치가 하나씩 있어야 한다: " + stat);
      require(raising.flipTips().containsKey(stat), "처음 뒤집힘 설명이 없다: " + stat);
    }
    for (NewsDefinition definition : news) {
      NewsClues clue = clues.get(definition.code());
      require(clue != null, "단서 기사 문장이 없다: " + definition.code());
      require(
          clue.up().size() >= 3 && clue.down().size() >= 3 && !clue.neutral().isEmpty(),
          "단서 기사 문장이 모자란다(오름·내림 셋 이상, 중립 하나 이상): " + definition.code());
    }
  }

  private void validateTraitDeltas(String where, Map<String, Integer> deltas) {
    boolean hasStyle = false;
    boolean hasSector = false;
    for (String key : deltas.keySet()) {
      if (key.startsWith(STYLE_PREFIX)) {
        require(
            styleNames.containsKey(key.substring(STYLE_PREFIX.length())), "알 수 없는 스타일: " + where);
        hasStyle = true;
      } else if (key.startsWith(SECTOR_PREFIX)) {
        require(
            sectorNames.containsKey(key.substring(SECTOR_PREFIX.length())), "알 수 없는 섹터: " + where);
        hasSector = true;
      } else if (key.startsWith(RISK_PREFIX)) {
        require(
            riskNames.containsKey(key.substring(RISK_PREFIX.length())), "알 수 없는 위험 축: " + where);
      } else if (key.startsWith(MIND_PREFIX)) {
        require(
            mindNames.containsKey(key.substring(MIND_PREFIX.length())), "알 수 없는 소신 축: " + where);
      } else {
        require(false, "알 수 없는 성향 키: " + where + " " + key);
      }
    }
  }

  private void validateStatDeltas(String where, Map<String, Integer> deltas) {
    for (Map.Entry<String, Integer> entry : deltas.entrySet()) {
      require(
          StatCodes.ALL.contains(entry.getKey()) && !StatCodes.LUCK.equals(entry.getKey()),
          "성향 선택이 움직일 수 없는 능력치: " + where + " " + entry.getKey());
      require(
          Math.abs(entry.getValue()) <= properties.traitStatMaxDelta(),
          "능력치 변화 폭이 너무 크다: " + where + " " + entry.getKey());
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
