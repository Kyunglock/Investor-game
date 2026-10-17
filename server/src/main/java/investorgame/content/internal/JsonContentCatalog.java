package investorgame.content.internal;

import investorgame.content.ContentCatalog;
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

  JsonContentCatalog(JsonMapper json) {
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
    for (TraitDefinition trait : traits) {
      require(trait.options().size() >= 2, "성향 장면에 선택지가 둘 이상 있어야 한다: " + trait.code());
      for (TraitDefinition.Option option : trait.options()) {
        validateTraitDeltas(trait.code() + "/" + option.code(), option.traitDeltas());
      }
    }
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
      } else {
        require(false, "알 수 없는 성향 키: " + where + " " + key);
      }
    }
    require(hasStyle && hasSector, "선택지가 스타일과 섹터를 모두 드러내야 한다: " + where);
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

  record Meta(String version, List<NamedCode> styles, List<NamedCode> sectors) {}

  record Phrases(
      Map<String, Map<String, List<String>>> hints,
      Map<String, List<String>> sway,
      TextBlock job,
      OfferText offer) {}
}
