package investorgame.content.internal;

import investorgame.common.StatCodes;
import investorgame.content.ContentCatalog;
import investorgame.content.InvestorType;
import investorgame.content.JobDefinition;
import investorgame.content.NewsDefinition;
import investorgame.content.TraitDefinition;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
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
      List.of("meta.json", "jobs.json", "traits.json", "news.json", "phrases.json");

  private final Meta meta;
  private final List<JobDefinition> jobs;
  private final List<TraitDefinition> traits;
  private final List<TraitStage> traitStages;
  private final List<NewsDefinition> news;
  private final Phrases phrases;
  private final Map<String, String> sectorNames;
  private final Map<String, String> styleNames;
  private final Map<String, String> riskNames;
  private final Map<String, String> mindNames;
  private final Map<String, InvestorType> investorTypes;
  private final ContentProperties properties;

  JsonContentCatalog(JsonMapper json, ContentProperties properties) {
    this.properties = properties;
    this.meta = read(json, "meta.json", new TypeReference<>() {});
    this.jobs = read(json, "jobs.json", new TypeReference<>() {});
    this.traits =
        read(json, "traits.json", new TypeReference<List<TraitDefinition>>() {}).stream()
            .sorted(Comparator.comparingInt(TraitDefinition::age))
            .toList();
    this.traitStages =
        traits.stream()
            .collect(Collectors.groupingBy(TraitDefinition::age, TreeMap::new, Collectors.toList()))
            .entrySet()
            .stream()
            .map(e -> new TraitStage(e.getKey(), List.copyOf(e.getValue())))
            .toList();
    this.news = read(json, "news.json", new TypeReference<>() {});
    this.phrases = read(json, "phrases.json", new TypeReference<>() {});
    this.sectorNames = toMap(meta.sectors());
    this.styleNames = toMap(meta.styles());
    this.riskNames = toMap(meta.risks());
    this.mindNames = toMap(meta.minds());
    this.investorTypes =
        meta.investorTypes().stream()
            .collect(Collectors.toUnmodifiableMap(InvestorType::code, t -> t));
    validate();
  }

  @Override
  public List<NamedCode> styles() {
    return meta.styles();
  }

  @Override
  public List<NamedCode> risks() {
    return meta.risks();
  }

  @Override
  public List<NamedCode> minds() {
    return meta.minds();
  }

  @Override
  public String riskName(String code) {
    return riskNames.getOrDefault(code, code);
  }

  @Override
  public String mindName(String code) {
    return mindNames.getOrDefault(code, code);
  }

  @Override
  public InvestorType investorType(String code) {
    InvestorType type = investorTypes.get(code);
    if (type == null) {
      throw new IllegalArgumentException("알 수 없는 투자자 유형: " + code);
    }
    return type;
  }

  @Override
  public List<InvestorType> investorTypes() {
    return meta.investorTypes();
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
  public List<JobDefinition> jobs() {
    return jobs;
  }

  @Override
  public JobDefinition job(String code) {
    return jobs.stream()
        .filter(j -> j.code().equals(code))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("알 수 없는 직업: " + code));
  }

  @Override
  public List<TraitDefinition> traits() {
    return traits;
  }

  @Override
  public List<TraitStage> traitStages() {
    return traitStages;
  }

  @Override
  public List<NewsDefinition> news() {
    return news;
  }

  @Override
  public List<String> hintPhrases(String direction, String strength) {
    return phrases.hints().getOrDefault(direction, Map.of()).getOrDefault(strength, List.of());
  }

  @Override
  public List<String> swayPhrases(String sentiment) {
    return phrases.sway().getOrDefault(sentiment, List.of());
  }

  @Override
  public TextBlock jobEventText() {
    return phrases.job();
  }

  @Override
  public OfferText offerText() {
    return phrases.offer();
  }

  /** 잘못된 콘텐츠는 서버 시작 단계에서 실패시킨다. 게임 중에 터지는 것보다 낫다. */
  private void validate() {
    require(!jobs.isEmpty(), "직업이 하나도 없다");
    require(!traits.isEmpty(), "성향 이벤트가 하나도 없다");
    require(!news.isEmpty(), "뉴스가 하나도 없다");
    require(
        traits.stream().map(TraitDefinition::code).distinct().count() == traits.size(),
        "성향 장면 코드가 겹친다");
    ContentProperties.Range optionRange = properties.traitOptions();
    for (TraitDefinition trait : traits) {
      int count = trait.options().size();
      require(
          count >= optionRange.min() && count <= optionRange.max(),
          "성향 장면의 선택지는 %d~%d개여야 한다: %s"
              .formatted(optionRange.min(), optionRange.max(), trait.code()));
      for (TraitDefinition.Option option : trait.options()) {
        String where = trait.code() + "/" + option.code();
        validateTraitDeltas(where, option.traitDeltas());
        validateStatDeltas(where, option.statDeltas());
      }
    }
    validateInvestorTypes(meta.styles(), meta.risks(), meta.minds(), meta.investorTypes());
    for (NewsDefinition definition : news) {
      require(
          sectorNames.containsKey(definition.sector()), "뉴스가 알 수 없는 섹터를 쓴다: " + definition.code());
      require(
          definition.magnitude().minBp() > 0
              && definition.magnitude().minBp() <= definition.magnitude().maxBp(),
          "뉴스 변동 폭이 잘못되었다: " + definition.code());
    }
    for (String direction : Set.of("UP", "DOWN")) {
      for (String strength : Set.of("MILD", "STRONG")) {
        require(!hintPhrases(direction, strength).isEmpty(), "힌트 문구가 없다: " + direction + strength);
      }
    }
    require(!hintPhrases("NEUTRAL", "MILD").isEmpty(), "모호한 힌트 문구가 없다");
    require(!swayPhrases("POS").isEmpty() && !swayPhrases("NEG").isEmpty(), "다른 뉴스 문구가 없다");
  }

  /** 모든 선택지가 스타일과 섹터를 하나씩 이상 드러내야 한다. 그래야 판마다 어떤 장면이 뽑히고 무엇을 골라도 투자 스타일과 관심 섹터가 반드시 정해진다. */
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
    require(hasStyle && hasSector, "선택지가 스타일과 섹터를 모두 드러내야 한다: " + where);
  }

  /** 성향 선택이 움직이는 능력치는 운을 뺀 넷이고 폭이 제한된다. 운은 타고난 값이다 (확정). */
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

  /** 기간 × 위험 × 소신 조합마다 유형이 정확히 하나씩 있어야 한다. 빠지면 성향 확정 시점에 터지므로 시작 때 막는다. */
  static void validateInvestorTypes(
      List<NamedCode> styles,
      List<NamedCode> risks,
      List<NamedCode> minds,
      List<InvestorType> types) {
    Set<String> codes = types.stream().map(InvestorType::code).collect(Collectors.toSet());
    require(codes.size() == types.size(), "투자자 유형 코드가 겹친다");
    int expected = styles.size() * risks.size() * minds.size();
    require(types.size() == expected, "투자자 유형은 %d개여야 한다".formatted(expected));
    for (NamedCode style : styles) {
      for (NamedCode risk : risks) {
        for (NamedCode mind : minds) {
          String code = style.code() + "-" + risk.code() + "-" + mind.code();
          require(codes.contains(code), "투자자 유형이 없다: " + code);
        }
      }
    }
    for (InvestorType type : types) {
      require(
          type.name() != null
              && !type.name().isBlank()
              && type.description() != null
              && !type.description().isBlank(),
          "투자자 유형의 이름과 설명이 있어야 한다: " + type.code());
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

  private static <T> T read(JsonMapper json, String file, TypeReference<T> type) {
    try (InputStream in = new ClassPathResource("content/" + file).getInputStream()) {
      return json.readValue(in, type);
    } catch (IOException e) {
      throw new UncheckedIOException("콘텐츠 파일을 읽을 수 없다: " + file, e);
    }
  }

  record Meta(
      String version,
      List<NamedCode> styles,
      List<NamedCode> risks,
      List<NamedCode> minds,
      List<NamedCode> sectors,
      List<InvestorType> investorTypes) {}

  record Phrases(
      Map<String, Map<String, List<String>>> hints,
      Map<String, List<String>> sway,
      TextBlock job,
      OfferText offer) {}
}
