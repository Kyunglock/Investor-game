package investorgame.content.internal;

import investorgame.common.Hint;
import investorgame.common.StatCodes;
import investorgame.content.AnalysisText;
import investorgame.content.CareerDefinition;
import investorgame.content.ChildWeddingText;
import investorgame.content.ContentCatalog;
import investorgame.content.CrisisDefinition;
import investorgame.content.FamilyTripText;
import investorgame.content.HomeRegion;
import investorgame.content.InvestorType;
import investorgame.content.JobDefinition;
import investorgame.content.LifeText;
import investorgame.content.NewsDefinition;
import investorgame.content.NoticeDefinition;
import investorgame.content.OutingText;
import investorgame.content.PartTimeJob;
import investorgame.content.ShakeDefinition;
import investorgame.content.SpouseRentText;
import investorgame.content.SpouseText;
import investorgame.content.StockDefinition;
import investorgame.content.TraitDefinition;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
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
      List.of(
          "meta.json",
          "jobs.json",
          "careers.json",
          "traits.json",
          "news.json",
          "phrases.json",
          "stocks.json",
          "life.json",
          "shakes.json",
          "crises.json",
          "homes.json",
          "analysis.json");

  private final Meta meta;
  private final List<JobDefinition> jobs;
  private final List<CareerDefinition> careers;
  private final List<TraitDefinition> traits;
  private final List<TraitStage> traitStages;
  private final List<TraitDefinition> adultTraits;
  private final List<NewsDefinition> news;
  private final Phrases phrases;
  private final List<StockDefinition> stocks;
  private final List<ShakeDefinition> shakes;
  private final Crises crises;
  private final List<HomeRegion> homeRegions;
  private final Life life;
  private final AnalysisText analysis;
  private final Map<String, String> sectorNames;
  private final Map<String, String> styleNames;
  private final Map<String, String> riskNames;
  private final Map<String, String> mindNames;
  private final Map<String, InvestorType> investorTypes;
  private final ContentProperties properties;

  JsonContentCatalog(JsonMapper json, ContentProperties properties) {
    this.properties = properties;
    // read()가 properties.dirs()를 쓰므로 먼저 받아 둔다.
    this.meta = read(json, "meta.json", new TypeReference<>() {});
    this.jobs = read(json, "jobs.json", new TypeReference<>() {});
    this.careers =
        read(json, "careers.json", new TypeReference<List<CareerDefinition>>() {}).stream()
            .sorted(Comparator.comparing(CareerDefinition::code))
            .toList();
    this.traits =
        read(json, "traits.json", new TypeReference<List<TraitDefinition>>() {}).stream()
            .sorted(Comparator.comparingInt(TraitDefinition::age))
            .toList();
    this.adultTraits =
        traits.stream()
            .filter(TraitDefinition::adult)
            .sorted(Comparator.comparing(TraitDefinition::code))
            .toList();
    this.traitStages =
        traits.stream()
            .filter(t -> !t.adult())
            .collect(Collectors.groupingBy(TraitDefinition::age, TreeMap::new, Collectors.toList()))
            .entrySet()
            .stream()
            .map(e -> new TraitStage(e.getKey(), List.copyOf(e.getValue())))
            .toList();
    this.news = read(json, "news.json", new TypeReference<>() {});
    this.phrases = read(json, "phrases.json", new TypeReference<>() {});
    this.stocks =
        read(json, "stocks.json", new TypeReference<List<StockDefinition>>() {}).stream()
            .sorted(Comparator.comparing(StockDefinition::code))
            .toList();
    this.shakes =
        read(json, "shakes.json", new TypeReference<List<ShakeDefinition>>() {}).stream()
            .sorted(Comparator.comparing(ShakeDefinition::code))
            .toList();
    this.life = read(json, "life.json", new TypeReference<>() {});
    this.crises = read(json, "crises.json", new TypeReference<>() {});
    this.homeRegions = read(json, "homes.json", new TypeReference<>() {});
    this.analysis = read(json, "analysis.json", new TypeReference<>() {});
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
  public List<CareerDefinition> careers() {
    return careers;
  }

  @Override
  public CareerDefinition career(String code) {
    return careers.stream()
        .filter(c -> c.code().equals(code))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("알 수 없는 직장 장면: " + code));
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
  public List<TraitDefinition> adultTraits() {
    return adultTraits;
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
  public List<NoticeDefinition> notices() {
    return life.notices();
  }

  @Override
  public List<ShakeDefinition> shakes() {
    return shakes;
  }

  @Override
  public List<CrisisDefinition> crises() {
    return crises.scenarios().stream()
        .sorted(Comparator.comparing(CrisisDefinition::code))
        .toList();
  }

  @Override
  public List<HomeRegion> homeRegions() {
    return homeRegions;
  }

  @Override
  public HomeRegion homeRegion(String code) {
    return homeRegions.stream()
        .filter(r -> r.code().equals(code))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("콘텐츠에 없는 지역: " + code));
  }

  @Override
  public List<String> commonOmens() {
    return crises.commonOmens();
  }

  @Override
  public ShakeDefinition shake(String code) {
    return shakes.stream()
        .filter(x -> x.code().equals(code))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("콘텐츠에 없는 흔들림 장면: " + code));
  }

  @Override
  public LifeText lifeText(String kind) {
    return switch (kind) {
      case "marriage" -> life.marriage();
      case "child" -> life.child();
      default -> throw new IllegalArgumentException("알 수 없는 생활 이벤트: " + kind);
    };
  }

  @Override
  public ChildWeddingText childWeddingText() {
    return life.childWedding();
  }

  @Override
  public List<PartTimeJob> partTimeJobs() {
    return life.partTimes();
  }

  @Override
  public FamilyTripText familyTripText() {
    return life.familyTrip();
  }

  @Override
  public SpouseText spouseText() {
    return life.spouse();
  }

  @Override
  public SpouseRentText spouseRentText() {
    return life.spouseRent();
  }

  @Override
  public List<OutingText> outings() {
    return life.outings();
  }

  @Override
  public OutingText outing(String code) {
    return life.outings().stream()
        .filter(o -> o.code().equals(code))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("콘텐츠에 없는 나들이: " + code));
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
  public List<String> reviewPhrases(String detail, boolean good) {
    return reviewPhrases(detail, good ? "good" : "bad");
  }

  @Override
  public List<String> reviewPhrases(String group, String key) {
    return phrases.review().getOrDefault(group, Map.of()).getOrDefault(key, List.of());
  }

  @Override
  public List<String> comfortPhrases(String situation, String who) {
    return phrases.comfort().getOrDefault(situation, Map.of()).getOrDefault(who, List.of());
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
  public TextBlock jobRetryText() {
    return phrases.jobRetry();
  }

  @Override
  public TextBlock jobRehireText() {
    return phrases.jobRehire();
  }

  @Override
  public String jobWaitLabel() {
    return phrases.jobWait();
  }

  @Override
  public String jobInvestLabel() {
    return phrases.jobInvest();
  }

  @Override
  public OfferText offerText() {
    return phrases.offer();
  }

  @Override
  public TextBlock housingText(String definition) {
    TextBlock text = phrases.housing().texts().get(definition);
    if (text == null) {
      throw new IllegalArgumentException("주거 문구가 없다: " + definition);
    }
    return text;
  }

  @Override
  public String housingLabel(String code) {
    String label = phrases.housing().labels().get(code);
    if (label == null) {
      throw new IllegalArgumentException("주거 선택지 문구가 없다: " + code);
    }
    return label;
  }

  @Override
  public LeverageText leverageText() {
    return phrases.leverage();
  }

  @Override
  public AnalysisText analysis() {
    return analysis;
  }

  /** 잘못된 콘텐츠는 서버 시작 단계에서 실패시킨다. 게임 중에 터지는 것보다 낫다. */
  private void validate() {
    require(!jobs.isEmpty(), "직업이 하나도 없다");
    require(jobs.stream().map(JobDefinition::code).distinct().count() == jobs.size(), "직업 코드가 겹친다");
    require(!shakes.isEmpty(), "흔들림 장면이 하나도 없다");
    require(
        shakes.stream().map(ShakeDefinition::code).distinct().count() == shakes.size(),
        "흔들림 장면 코드가 겹친다");
    for (ShakeDefinition shake : shakes) {
      require(shake.weight() > 0, "흔들림 장면의 가중치는 양수여야 한다: " + shake.code());
      require(
          (shake.title() + shake.body()).contains("{stock}"),
          "흔들림 장면에는 종목 자리표시 {stock}이 있어야 한다: " + shake.code());
      require(
          shake.requires() == null
              || ShakeDefinition.REQUIRES_DROP.equals(shake.requires())
              || ShakeDefinition.REQUIRES_FLAT.equals(shake.requires()),
          "흔들림 장면의 전제는 drop·flat 가운데 하나다: " + shake.code());
    }
    require(shakes.stream().anyMatch(sh -> sh.requires() == null), "전제 없는 흔들림 장면이 하나는 있어야 한다");
    require(!homeRegions.isEmpty(), "아파트 지역이 하나도 없다");
    for (HomeRegion region : homeRegions) {
      require(region.basePrice() > 0, "아파트 기준가는 양수여야 한다: " + region.code());
    }
    require(!crises.scenarios().isEmpty(), "시장 위기 갈래가 하나도 없다");
    for (CrisisDefinition crisis : crises.scenarios()) {
      require(!crisis.omens().isEmpty(), "시장 위기에 전조가 없다: " + crisis.code());
      require(
          sectorNames.keySet().containsAll(crisis.sectorPercent().keySet()),
          "시장 위기가 알 수 없는 섹터를 쓴다: " + crisis.code());
    }
    require(!careers.isEmpty(), "직장 장면이 하나도 없다");
    require(
        careers.stream().map(CareerDefinition::code).distinct().count() == careers.size(),
        "직장 장면 코드가 겹친다");
    Set<String> jobCodes = jobs.stream().map(JobDefinition::code).collect(Collectors.toSet());
    Set<String> careerJobs = new java.util.HashSet<>(jobCodes);
    careerJobs.add(CareerDefinition.FULL_TIME_INVESTOR);
    Map<String, CareerDefinition> careersByCode =
        careers.stream().collect(Collectors.toMap(CareerDefinition::code, c -> c, (a, b) -> a));
    for (CareerDefinition career : careers) {
      require(career.weight() > 0, "직장 장면의 가중치는 양수여야 한다: " + career.code());
      require(careerJobs.containsAll(career.jobs()), "직장 장면이 알 수 없는 직업을 쓴다: " + career.code());
      boolean forInvestor = career.jobs().contains(CareerDefinition.FULL_TIME_INVESTOR);
      require(
          !forInvestor || career.jobs().size() == 1, "전업투자자의 장면은 직장인과 같이 쓸 수 없다: " + career.code());
      require(
          career.minAge() == null || career.maxAge() == null || career.minAge() <= career.maxAge(),
          "직장 장면의 나이 범위가 거꾸로다: " + career.code());
      require(
          career.options().size() >= 2 && career.options().size() <= 4,
          "직장 장면의 선택지는 2~4개여야 한다: " + career.code());
      for (CareerDefinition.Option option : career.options()) {
        String where = career.code() + "/" + option.code();
        require(
            option.stat() == null || StatCodes.ALL.contains(option.stat()),
            "직장 장면의 판정 능력치가 아니다: " + where);
        require(
            !option.success().moveJob() || !option.success().quit(), "이직과 실직을 같이 둘 수 없다: " + where);
        for (CareerDefinition.Effect effect : List.of(option.success(), option.fail())) {
          // 전업투자자는 월급·직장이 없다. 회사를 세우는 것(becomeJob)만 직업을 바꾼다 (decisions.md 52번).
          require(
              !forInvestor || (effect.salaryPercent() == 0 && !effect.quit() && !effect.moveJob()),
              "전업투자자의 장면은 월급·실직·이직을 쓸 수 없다: " + where);
          require(
              !effect.becomeInvestor()
                  || (!forInvestor
                      && !effect.quit()
                      && !effect.moveJob()
                      && effect.followUp() == null
                      && effect.becomeJob() == null),
              "전업투자자 전향(becomeInvestor)은 직장인의 장면에서 단독으로만: " + where);
          require(
              effect.becomeJob() == null
                  || (forInvestor
                      && jobCodes.contains(effect.becomeJob())
                      && !job(effect.becomeJob()).offered()),
              "회사 세우기(becomeJob)는 전업투자자의 장면에서 제안되지 않는 직업으로만: " + where);
          CareerDefinition next =
              effect.followUp() == null ? null : careersByCode.get(effect.followUp());
          require(
              effect.followUp() == null
                  || (next != null
                      && next.followUpOnly()
                      && effect.followUpDays() > 0
                      && !effect.quit()
                      && !effect.moveJob()
                      && effect.becomeJob() == null),
              "후속 장면은 followUpOnly 장면이어야 하고 날 수가 있어야 하며 직장을 바꾸는 결과와 같이 둘 수 없다: " + where);
          require(
              effect.statDeltas().keySet().stream()
                  .allMatch(k -> StatCodes.ALL.contains(k) && !StatCodes.LUCK.equals(k)),
              "직장 장면의 능력치 변화는 운을 뺀 능력치 코드여야 한다: " + where);
        }
      }
    }
    for (String job : careerJobs) {
      // 연차·나이·순자산 조건에 다 걸려도 뽑을 장면이 남도록 직업마다 조건 없는 장면이 하나는 있어야 한다.
      require(
          careers.stream().anyMatch(c -> c.forJob(job) && !c.movesJob() && c.unconditional()),
          "조건 없는 직장 장면이 없는 직업: " + job);
    }
    require(
        phrases.jobRetry() != null
            && phrases.jobRehire() != null
            && phrases.jobWait() != null
            && phrases.jobInvest() != null
            && phrases.leverage() != null
            && phrases.housing() != null,
        "phrases.json에 jobRetry, jobRehire, jobWait, jobInvest가 있어야 한다");
    require(!traits.isEmpty(), "성향 이벤트가 하나도 없다");
    require(!traitStages.isEmpty(), "성장기 성향 장면(adult가 아닌 것)이 하나도 없다");
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
        for (TraitDefinition.Outcome outcome : option.outcomes()) {
          require(outcome.weight() > 0, "결과 가중치는 양수여야 한다: " + where);
          Map<String, Integer> merged = new java.util.HashMap<>(option.statDeltas());
          outcome.statDeltas().forEach((k, v) -> merged.merge(k, v, Integer::sum));
          validateStatDeltas(where, merged);
        }
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
      require(
          !reviewPhrases(detail.key(), true).isEmpty()
              && !reviewPhrases(detail.key(), false).isEmpty(),
          "결과 뒤 안목 문구가 없다: " + detail.key());
    }
    for (String key : List.of("kept-good", "kept-bad", "watched-good", "watched-bad")) {
      require(!reviewPhrases("hold", key).isEmpty(), "관망 뒤 안목 문구가 없다: " + key);
    }
    for (String key :
        List.of("hint-wrong-you-right", "hint-wrong-followed", "hint-right-ignored", "deviated")) {
      require(!reviewPhrases("extra", key).isEmpty(), "안목 덧붙임 문구가 없다: " + key);
    }
    for (String situation : List.of("layoff", "career-fail", "big-loss", "fraud")) {
      for (String who : List.of("spouse", "child", "parents", "friend")) {
        require(
            !comfortPhrases(situation, who).isEmpty(),
            "위로 문구가 없다: " + situation + "/" + who + " (decisions.md 85번)");
      }
    }
    validateStocks();
    validateLife();
    require(!swayPhrases("POS").isEmpty() && !swayPhrases("NEG").isEmpty(), "다른 뉴스 문구가 없다");
    validateAnalysis();
  }

  /** 해석은 어떤 안목·결론 조합에서도 문구를 골라야 하므로 모든 칸이 차 있어야 한다 (매매창 설계 4.4절). */
  private void validateAnalysis() {
    require(analysis != null && analysis.remarks() != null, "analysis.json이 비어 있다");
    for (String tier : AnalysisText.TEMPLATE_TIERS) {
      for (String reading : AnalysisText.TREND_READINGS) {
        require(
            !analysis
                .trend()
                .getOrDefault(tier, Map.of())
                .getOrDefault(reading, List.of())
                .isEmpty(),
            "추세 해석 문구가 없다: " + tier + "/" + reading);
      }
      for (String reading : AnalysisText.MACRO_READINGS) {
        require(
            !analysis
                .macro()
                .getOrDefault(tier, Map.of())
                .getOrDefault(reading, List.of())
                .isEmpty(),
            "시황 해석 문구가 없다: " + tier + "/" + reading);
      }
    }
    for (AnalysisText.Verdicts verdicts :
        List.of(analysis.remarks().trend(), analysis.remarks().macro())) {
      for (String tier : AnalysisText.REMARK_TIERS) {
        require(
            !verdicts.right().getOrDefault(tier, List.of()).isEmpty(), "맞혔을 때 한마디가 없다: " + tier);
        require(
            !verdicts.wrong().getOrDefault(tier, List.of()).isEmpty(), "틀렸을 때 한마디가 없다: " + tier);
      }
    }
    require(analysis.articles() != null && !analysis.articles().isEmpty(), "경제 기사가 없다");
    for (AnalysisText.Article article : analysis.articles()) {
      require(
          article.text() != null && AnalysisText.SENTIMENTS.contains(article.sentiment()),
          "경제 기사의 호재·악재 표시가 잘못되었다: " + article.text());
    }
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

  private void validateLife() {
    require(life.marriage() != null && life.child() != null, "결혼·자녀 문구가 없다");
    require(
        life.outings() != null
            && !life.outings().isEmpty()
            && life.outings().stream()
                .allMatch(
                    o ->
                        o.cost() > 0
                            && o.title().contains("{child}")
                            && o.luxuryText() != null
                            && o.noneText() != null),
        "나들이 문구가 비었다 (decisions.md 87번)");
    require(
        life.outings().stream().allMatch(o -> o.minAge() >= 1 && o.minAge() <= o.maxAge()),
        "나들이마다 아이 나이 구간(minAge ≤ maxAge, 1세부터)이 있어야 한다 (decisions.md 106번)");
    require(
        life.partTimes() != null
            && !life.partTimes().isEmpty()
            && life.partTimes().stream().allMatch(j -> !j.name().isBlank() && j.monthly() > 0),
        "아르바이트가 비었다 (decisions.md 96번)");
    require(
        life.spouse() != null
            && !life.spouse().personalities().isEmpty()
            && !life.spouse().economies().isEmpty()
            && !life.spouse().lives().isEmpty()
            && life.spouse().economies().stream().allMatch(e -> e.income() > 0),
        "결혼 상대 소개 재료가 비었다 (decisions.md 77번)");
    require(
        life.spouseRent() != null
            && !life.spouseRent().levels().isEmpty()
            && life.spouseRent().levels().stream().allMatch(l -> l.body().contains("{job}"))
            && life.spouseRent().moreChildren().contains("{count}")
            && !life.spouseRent().waitTexts().isEmpty()
            && !life.spouseRent().stayTexts().isEmpty()
            && life.spouseRent().movedText() != null
            && life.spouseRent().boughtText() != null
            && life.spouseRent().levels().size() >= 4
            && life.spouseRent().jobLines().containsKey("retired"),
        "배우자의 월세 불만 문구가 비었다 (#116)");
    require(
        life.spouse() != null
            && life.spouse().economies().stream()
                .allMatch(e -> life.spouseRent().jobLines().containsKey(e.job())),
        "배우자 직업마다 월세 불만 한 줄이 있어야 한다 (#116)");
    require(
        life.childWedding() != null
            && life.childWedding().title().contains("{child}")
            && !life.childWedding().bodies().isEmpty()
            && !life.childWedding().fullTexts().isEmpty()
            && !life.childWedding().halfTexts().isEmpty()
            && !life.childWedding().noneTexts().isEmpty()
            && !life.childWedding().noneRichTexts().isEmpty()
            && life.childWedding().fullLabel() != null
            && life.childWedding().halfLabel() != null
            && life.childWedding().noneLabel() != null,
        "자녀 결혼 문구가 없거나 {child} 자리가 없다");
    require(life.notices() != null && !life.notices().isEmpty(), "알림 이벤트가 없다");
    for (NoticeDefinition notice : life.notices()) {
      require(notice.weight() > 0, "알림 가중치는 0보다 커야 한다: " + notice.code());
      require(
          notice.amount() != 0 || notice.salaryPercent() != 0, "알림은 금액이 있어야 한다: " + notice.code());
      require(
          notice.assetPercent() == 0 || notice.amount() < 0,
          "순자산 비율은 최소 지출(음수 amount)이 있는 알림에만 쓴다: " + notice.code());
    }
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
      List<NamedCode> sectors,
      List<InvestorType> investorTypes) {}

  record Life(
      LifeText marriage,
      LifeText child,
      ChildWeddingText childWedding,
      FamilyTripText familyTrip,
      SpouseText spouse,
      SpouseRentText spouseRent,
      List<OutingText> outings,
      List<PartTimeJob> partTimes,
      List<NoticeDefinition> notices) {}

  record Crises(List<CrisisDefinition> scenarios, List<String> commonOmens) {}

  record Phrases(
      Map<String, Map<String, Map<String, List<String>>>> hints,
      Map<String, Map<String, List<String>>> review,
      Map<String, Map<String, List<String>>> comfort,
      Map<String, List<String>> sway,
      TextBlock job,
      TextBlock jobRetry,
      TextBlock jobRehire,
      String jobWait,
      String jobInvest,
      OfferText offer,
      LeverageText leverage,
      HousingPhrases housing) {}

  record HousingPhrases(Map<String, TextBlock> texts, Map<String, String> labels) {}
}
