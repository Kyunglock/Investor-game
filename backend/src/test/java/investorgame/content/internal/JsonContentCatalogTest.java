package investorgame.content.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.common.Sex;
import investorgame.common.StatCodes;
import investorgame.content.AnalysisText;
import investorgame.content.CareerDefinition;
import investorgame.content.ContentCatalog;
import investorgame.content.InvestorType;
import investorgame.content.NewsDefinition;
import investorgame.content.StockDefinition;
import investorgame.content.TraitDefinition;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

/** 저장소의 실제 콘텐츠(content/*.json)가 규칙을 지키는지 서버 없이 확인한다. 어긋나면 서버가 시작 단계에서 실패해야 한다. */
class JsonContentCatalogTest {

  private static final ContentProperties PROPERTIES =
      new ContentProperties(8, new ContentProperties.Range(3, 4), List.of("no-such-dir"));

  private static JsonContentCatalog load() {
    return new JsonContentCatalog(JsonMapper.builder().build(), PROPERTIES);
  }

  /**
   * IDE에서 바로 실행하면 Gradle의 processResources가 돌지 않아 클래스 경로에 content/가 없다. 그때는 content.dir의 파일을 읽는다.
   */
  @Test
  void 콘텐츠_디렉터리가_있으면_클래스_경로보다_먼저_읽는다(@TempDir Path dir) throws IOException {
    Path source = Path.of("..", "content");
    for (String file : JsonContentCatalog.FILES) {
      Files.copy(source.resolve(file), dir.resolve(file));
    }
    String meta = Files.readString(dir.resolve("meta.json"), StandardCharsets.UTF_8);
    Files.writeString(
        dir.resolve("meta.json"),
        meta.replace("\"version\": \"0.1.0\"", "\"version\": \"dir-9.9.9\""),
        StandardCharsets.UTF_8);

    JsonContentCatalog fromDir =
        new JsonContentCatalog(
            JsonMapper.builder().build(),
            new ContentProperties(
                8, new ContentProperties.Range(3, 4), List.of("no-such-dir", dir.toString())));

    assertThat(fromDir.version()).isEqualTo("dir-9.9.9");
    assertThat(load().version()).as("디렉터리가 없으면 클래스 경로").isEqualTo("0.1.0");
  }

  @Test
  void 투자자_유형은_기간_위험_소신_조합_8개가_모두_있다() {
    JsonContentCatalog catalog = load();
    for (ContentCatalog.NamedCode style : catalog.styles()) {
      for (ContentCatalog.NamedCode risk : catalog.risks()) {
        for (ContentCatalog.NamedCode mind : catalog.minds()) {
          InvestorType type =
              catalog.investorType(style.code() + "-" + risk.code() + "-" + mind.code());
          assertThat(type.name()).isNotBlank();
          assertThat(type.description()).isNotBlank();
        }
      }
    }
    assertThat(catalog.investorTypes()).hasSize(8);
  }

  @Test
  void 직장_장면은_선택지가_3에서_4개이고_판정_능력치와_변화가_규칙_안이다() {
    JsonContentCatalog catalog = load();
    assertThat(catalog.shakes()).hasSizeGreaterThanOrEqualTo(3);
    assertThat(catalog.shakes()).allMatch(x -> (x.title() + x.body()).contains("{stock}"));
    assertThat(catalog.careers()).hasSizeGreaterThanOrEqualTo(4);
    assertThat(catalog.careers()).anyMatch(c -> c.movesJob());
    assertThat(catalog.careers())
        .anyMatch(c -> c.options().stream().anyMatch(o -> o.success().quit() || o.fail().quit()));
    for (var career : catalog.careers()) {
      assertThat(career.options()).as(career.code()).hasSizeBetween(3, 4);
      for (var option : career.options()) {
        if (option.rolls()) {
          assertThat(StatCodes.ALL).contains(option.stat());
          assertThat(option.baseBp() + 100 * option.perPointBp()).isLessThanOrEqualTo(10_000);
        }
        assertThat(option.success().text()).as(career.code() + "/" + option.code()).isNotBlank();
      }
    }
    assertThat(catalog.jobs()).hasSizeGreaterThanOrEqualTo(10);
    assertThat(catalog.jobWaitLabel()).isNotBlank();
    assertThat(catalog.jobRetryText().title()).isNotBlank();
    assertThat(catalog.jobRehireText().title()).isNotBlank();
  }

  /** decisions.md 162번: 선택과 반대로 움직였을 때의 한마디는 경우마다 여러 줄이라 매번 같은 말이 나오지 않는다. */
  @Test
  void 손이_뒤집힌_한마디는_경우마다_세_줄_이상이다() {
    JsonContentCatalog catalog = load();
    for (String pair :
        List.of("HOLD-BUY", "HOLD-SELL", "BUY-HOLD", "SELL-HOLD", "BUY-SELL", "SELL-BUY")) {
      for (String truth : List.of("UP", "DOWN")) {
        assertThat(catalog.reviewPhrases("swerve", pair + "-" + truth))
            .as(pair + "-" + truth)
            .hasSizeGreaterThanOrEqualTo(3)
            .allMatch(text -> !text.isBlank());
      }
    }
  }

  /** #230 (decisions.md 166번): 행복도는 장면마다 다르게 움직인다. 직장 결과와 일상 선택지는 거의 모두 제 값을 가진다. */
  @Test
  void 직장_결과와_일상_선택지는_저마다_행복도_값을_가진다() {
    JsonContentCatalog catalog = load();
    int careerEffects = 0;
    int careerValued = 0;
    for (var career : catalog.careers()) {
      for (var option : career.options()) {
        List<CareerDefinition.Effect> effects =
            option.rolls() ? List.of(option.success(), option.fail()) : List.of(option.success());
        for (var effect : effects) {
          careerEffects++;
          careerValued += effect.happiness() != null ? 1 : 0;
        }
      }
    }
    assertThat(careerValued * 10).as("직장 결과의 행복도 값").isGreaterThanOrEqualTo(careerEffects * 9);
    long dailyOptions = 0;
    long dailyValued = 0;
    for (var trait : catalog.adultTraits()) {
      for (var option : trait.options()) {
        dailyOptions++;
        dailyValued += option.happinessDelta() != 0 ? 1 : 0;
      }
    }
    assertThat(dailyValued * 10).as("일상 선택지의 행복도 값").isGreaterThanOrEqualTo(dailyOptions * 9);
  }

  /** #232: 결과 문구가 월급·보수를 말하며 적은 %는 실제 인상분(salaryPercent·moveSalaryPercent)과 같다. */
  @Test
  void 직장_결과_문구의_월급_퍼센트는_실제_인상분과_같다() {
    java.util.regex.Pattern pay = java.util.regex.Pattern.compile("월급|연봉|보수|수입|인상|급여|수당|임금");
    java.util.regex.Pattern percent = java.util.regex.Pattern.compile("([0-9]+) *%");
    List<String> wrong = new ArrayList<>();
    for (var career : load().careers()) {
      for (var option : career.options()) {
        for (var effect : List.of(option.success(), option.fail())) {
          for (String text : new String[] {effect.text(), effect.textFamily()}) {
            if (text == null) {
              continue;
            }
            for (String sentence : text.split("(?<=[.!?])")) {
              if (!pay.matcher(sentence).find() || effect.salaryPercent() == 0) {
                continue;
              }
              var m = percent.matcher(sentence);
              while (m.find()) {
                int n = Integer.parseInt(m.group(1));
                if (n != Math.abs(effect.salaryPercent())
                    && n != Math.abs(effect.moveSalaryPercent())) {
                  wrong.add(career.code() + "/" + option.code() + ": " + sentence.strip());
                }
              }
            }
          }
        }
      }
    }
    assertThat(wrong).isEmpty();
  }

  /** #236: 신분이 보장된 공무원·교사와 알바에게는 "나가 달라"는 권고사직이 없고, 그들만의 번아웃 장면이 있다. */
  @Test
  void 권고사직은_공무원_교사_알바에게_없고_대신_그들만의_번아웃이_있다() {
    JsonContentCatalog catalog = load();
    for (String code : List.of("burnout", "burnout-layoff")) {
      assertThat(
              catalog.careers().stream()
                  .filter(c -> c.code().equals(code))
                  .findFirst()
                  .orElseThrow()
                  .jobs())
          .as(code)
          .doesNotContain("civil-servant", "teacher", "parttime");
    }
    assertThat(catalog.careers())
        .extracting(CareerDefinition::code)
        .contains("burnout-public", "burnout-shop");
    assertThat(catalog.job("parttime").retires()).isFalse();
  }

  /** #239: 본문이 신입·막내를 말하는 장면은 나이 상한이 있어, 이직·재취업으로 연차가 초기화된 베테랑에게 오지 않는다. 명예퇴직 장면은 20년차부터다. */
  @Test
  void 신입_장면은_나이_상한이_있고_명예퇴직은_20년차부터다() {
    // 내가 신입·막내인 장면. 남이 신입인 장면(쉰 넘은 개발자 등)은 빼려고 표현을 좁힌다.
    java.util.regex.Pattern rookie =
        java.util.regex.Pattern.compile("막내인 나|신입 영업사원|신입 배치|첫 기능|포괄임금");
    List<String> wrong = new ArrayList<>();
    for (var career : load().careers()) {
      if (rookie.matcher(career.body()).find() && !career.followUpOnly()) {
        if (career.maxAge() == null || career.maxAge() > 39) {
          wrong.add(career.code() + ": maxAge " + career.maxAge());
        }
      }
      if (career.body().contains("명예퇴직") && career.minTenureYears() < 20) {
        wrong.add(career.code() + ": minTenureYears " + career.minTenureYears());
      }
    }
    assertThat(wrong).isEmpty();
  }

  @Test
  void 알_수_없는_유형_코드는_오류다() {
    assertThatThrownBy(() -> load().investorType("none-none-none"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void 성향_장면은_단계마다_있고_선택지가_3개에서_4개다() {
    JsonContentCatalog catalog = load();
    // 성장기 15~24세 10단계(단계마다 2~3장면)와 취업 뒤 일상 장면 8개 (decisions.md 23번)
    assertThat(catalog.traitStages())
        .extracting(ContentCatalog.TraitStage::age)
        .containsExactly(15, 16, 17, 18, 19, 20, 21, 22, 23, 24);
    for (ContentCatalog.TraitStage stage : catalog.traitStages()) {
      // 무작위로 뽑는 장면이 단계마다 둘 이상 있다. 이어지는 장면(followUpOnly)은 따로 센다 (#196).
      assertThat(stage.scenes().stream().filter(t -> !t.followUpOnly()))
          .as("%d세 장면", stage.age())
          .hasSizeGreaterThanOrEqualTo(2);
    }
    // 취업 뒤 일상 장면은 daily.json에 있고 모두 adult다. 양가 부모 장면은 결혼한 뒤에만 (decisions.md 76번).
    assertThat(catalog.adultTraits())
        .hasSizeGreaterThanOrEqualTo(13)
        .allMatch(TraitDefinition::adult);
    assertThat(catalog.adultTraits().stream().filter(TraitDefinition::married))
        .hasSizeGreaterThanOrEqualTo(6);
    // 동료에게 빌려준 돈은 1년 뒤 이어지는 장면에서 돌려받기도, 떼이기도 한다 (decisions.md 41번 → #195).
    TraitDefinition.Option lend =
        catalog.adultTraits().stream()
            .filter(t -> t.code().equals("a-loan"))
            .findFirst()
            .orElseThrow()
            .options()
            .stream()
            .filter(o -> o.code().equals("lend"))
            .findFirst()
            .orElseThrow();
    // 돈 이야기를 하는 성인 장면은 선택지 대부분에서 실제로 돈이 오간다 (decisions.md 75번).
    for (String code : List.of("a-bonus", "a-parents", "a-sidejob", "a-pension", "a-crash")) {
      TraitDefinition money =
          catalog.adultTraits().stream()
              .filter(t -> t.code().equals(code))
              .findFirst()
              .orElseThrow();
      long moving =
          money.options().stream().filter(o -> o.amount() != 0 || !o.outcomes().isEmpty()).count();
      assertThat(moving).as(code).isGreaterThanOrEqualTo(money.options().size() / 2L);
    }
    assertThat(lend.amount()).isEqualTo(-5_000_000);
    assertThat(lend.followUpDays()).isEqualTo(360);
    assertThat(lend.followUps())
        .extracting(TraitDefinition.FollowUp::code)
        .containsExactlyInAnyOrder("a-loan-repaid", "a-loan-slow", "a-loan-gone");
    for (TraitDefinition trait : catalog.traits()) {
      assertThat(trait.options()).as(trait.code()).hasSizeBetween(3, 4);
    }
  }

  @Test
  void 모든_선택지는_기간과_관심을_드러내고_statDeltas는_허용_키와_범위_안이다() {
    for (TraitDefinition trait : load().traits()) {
      for (TraitDefinition.Option option : trait.options()) {
        String where = trait.code() + "/" + option.code();
        assertThat(option.traitDeltas().keySet())
            .as(where)
            .anyMatch(k -> k.startsWith("style."))
            .anyMatch(k -> k.startsWith("sector."));
        assertThat(option.statDeltas()).as(where).isNotNull();
        assertThat(option.statDeltas().keySet())
            .as(where)
            .doesNotContain(StatCodes.LUCK)
            .allMatch(StatCodes.ALL::contains);
        assertThat(option.statDeltas().values()).as(where).allMatch(v -> Math.abs(v) <= 8);
        assertThat(option.label().length()).as(where).isLessThanOrEqualTo(18);
      }
    }
  }

  /** #221: 성별로 가린 장면(군대)이 빠져도 단계마다 남자·여자 모두 무작위로 뽑을 장면이 넉넉하다. */
  @Test
  void 성장_단계마다_남녀_모두_뽑을_장면이_넉넉하다() {
    for (ContentCatalog.TraitStage stage : load().traitStages()) {
      for (Sex sex : Sex.values()) {
        assertThat(stage.scenes())
            .as("%d세 %s", stage.age(), sex)
            .filteredOn(t -> !t.followUpOnly() && t.fitsSex(sex))
            .hasSizeGreaterThanOrEqualTo(10);
      }
    }
  }

  @Test
  void 단계마다_네_축의_양쪽_값이_적어도_한_번씩_나온다() {
    for (ContentCatalog.TraitStage stage : load().traitStages()) {
      List<String> keys = new ArrayList<>();
      for (TraitDefinition scene : stage.scenes()) {
        for (TraitDefinition.Option option : scene.options()) {
          keys.addAll(option.traitDeltas().keySet());
        }
      }
      assertThat(keys)
          .as("%d세", stage.age())
          .contains(
              "style.short", "style.long", "risk.bold", "risk.safe", "mind.own", "mind.crowd");
    }
  }

  @Test
  void 종목은_섹터마다_셋이고_코드와_이름이_겹치지_않는다() {
    JsonContentCatalog catalog = load();
    for (ContentCatalog.NamedCode sector : catalog.sectors()) {
      assertThat(catalog.stocksOf(sector.code())).as(sector.code()).hasSize(3);
    }
    assertThat(catalog.stocks()).extracting(StockDefinition::code).doesNotHaveDuplicates();
    assertThat(catalog.stocks())
        .extracting(StockDefinition::name)
        .doesNotHaveDuplicates()
        .noneMatch(
            n ->
                Set.of(
                        "삼성전자",
                        "SK하이닉스",
                        "셀트리온",
                        "카카오",
                        "네이버",
                        "크래프톤",
                        "농심",
                        "오리온",
                        "KB금융",
                        "한국전력",
                        "두산에너빌리티",
                        "한화솔루션",
                        "엔씨소프트",
                        "넥슨게임즈",
                        "CJ제일제당",
                        "카카오뱅크",
                        "삼성화재",
                        "삼성바이오로직스",
                        "알테오젠",
                        "한미반도체")
                    .contains(n));
    assertThat(catalog.stocks())
        .allMatch(s -> s.basePrice() > 0 && Set.of("low", "mid", "high").contains(s.volatility()));
    assertThat(catalog.stock("ssj").name()).isNotBlank();
    assertThatThrownBy(() -> catalog.stock("nope")).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void 뉴스_제목의_stock_자리표시는_닫혀_있고_섹터_전체_뉴스가_둘_이상이다() {
    JsonContentCatalog catalog = load();
    assertThat(catalog.news())
        .filteredOn(NewsDefinition::sectorWide)
        .hasSizeGreaterThanOrEqualTo(2);
    assertThat(catalog.news()).filteredOn(n -> !n.sectorWide()).isNotEmpty();
    for (NewsDefinition n : catalog.news()) {
      long open = n.title().chars().filter(ch -> ch == '{').count();
      long close = n.title().chars().filter(ch -> ch == '}').count();
      assertThat(open).as(n.code()).isEqualTo(close);
    }
  }

  @Test
  void 번아웃은_가족_문구와_전업투자자_전향이_있고_못_버티면_여섯_달_안에_권고사직이_따라온다() {
    JsonContentCatalog catalog = load();
    CareerDefinition burnout =
        catalog.careers().stream()
            .filter(c -> c.code().equals("burnout"))
            .findFirst()
            .orElseThrow();
    CareerDefinition.Option push =
        burnout.options().stream().filter(o -> o.code().equals("push")).findFirst().orElseThrow();
    assertThat(push.success().textFor(true)).contains("가족");
    assertThat(push.success().textFor(false)).contains("불안");
    assertThat(push.fail().followUp()).isEqualTo("burnout-layoff");
    assertThat(push.fail().followUpDays()).isBetween(1, 180);
    assertThat(burnout.options()).anyMatch(o -> o.success().becomeInvestor());
    CareerDefinition layoff =
        catalog.careers().stream()
            .filter(c -> c.code().equals("burnout-layoff"))
            .findFirst()
            .orElseThrow();
    assertThat(layoff.followUpOnly()).isTrue();
    assertThat(layoff.options()).allMatch(o -> o.success().quit() || o.success().becomeInvestor());
  }

  @Test
  void 생활_이벤트_문구와_알림이_있다() {
    JsonContentCatalog catalog = load();
    assertThat(catalog.lifeText("marriage").acceptLabel()).isNotBlank();
    assertThat(catalog.lifeText("child").declineLabel()).isNotBlank();
    assertThatThrownBy(() -> catalog.lifeText("divorce"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(catalog.notices())
        .hasSizeGreaterThanOrEqualTo(6)
        .allMatch(n -> n.weight() > 0 && (n.amount() != 0 || n.salaryPercent() != 0));
    assertThat(catalog.familyTripText().luxuryLabel()).isNotBlank();
    assertThat(catalog.spouseText().profile("0-0-0").intro()).startsWith("성격은").contains("월");
    // 이름이 있던 옛 카드의 코드도 이름 자리를 버리고 읽는다 (decisions.md 90번).
    assertThat(catalog.spouseText().profile("3-0-0-0"))
        .isEqualTo(catalog.spouseText().profile("0-0-0"));
    assertThat(catalog.spouseText().economies()).allMatch(e -> e.income() > 0);
    // 배우자의 월세 불만 (#116): 단계별 문구, 아이 수와 배우자 직업에 따라 한 줄이 붙는다.
    assertThat(catalog.spouseRentText().levels()).hasSize(4);
    assertThat(catalog.spouseRentText().body(1, 0, "은행원")).contains("금리표").doesNotContain("{");
    assertThat(catalog.spouseRentText().body(2, 2, null)).contains("아이가 2인데").doesNotContain("{");
    assertThat(catalog.spouseRentText().level(3).title()).isEqualTo("집 때문에 부부 싸움이 났다");
    assertThat(catalog.spouseRentText().level(9).title()).isEqualTo("배우자가 계약서를 들고 왔다");
    assertThat(catalog.spouseRentText().stayText(3)).contains("끝내 월세를 고집했다");
    assertThat(catalog.housingLabel("WAIT")).isNotBlank();
    assertThat(catalog.housingLabel("STAY")).isNotBlank();
    // 집이 좁다 (#117): 아이 이름 자리가 있고, 좁아도 그냥 산다 선택지가 있다.
    assertThat(catalog.housingText("cramped-child").body()).contains("{child}");
    assertThat(catalog.housingText("cramped-marriage").title()).isNotBlank();
    assertThat(catalog.housingLabel("ENDURE")).isNotBlank();
    assertThat(catalog.comfortPhrases("layoff", "spouse")).isNotEmpty();
    assertThat(catalog.outings()).hasSizeGreaterThanOrEqualTo(4);
    assertThat(catalog.outing("park").normalText()).contains("{child}");
    // 운동회 말고도 학예회·생일 파티 같은 아이 행사가 있다 (decisions.md 99번).
    assertThat(catalog.outings())
        .extracting(o -> o.code())
        .contains("sports-day", "school-play", "open-class", "birthday", "recital", "graduation");
    // 자녀 결혼 문구는 여러 벌이고 아이 이름·성별·금액 자리가 있다 (decisions.md 86번).
    assertThat(catalog.childWeddingText().bodies()).hasSizeGreaterThanOrEqualTo(2);
    assertThat(catalog.childWeddingText().bodyAt(5)).contains("{child}");
    assertThat(catalog.childWeddingText().fullTexts()).allMatch(t -> t.contains("{word}"));
    assertThat(catalog.childWeddingText().noneRichTexts()).isNotEmpty();
    assertThat(catalog.comfortPhrases("fraud", "friend")).isNotEmpty();
    assertThat(catalog.familyTripText().title()).contains("{who}");
  }

  /** 매매창 설계 4.4절·부록: 안목 구간 × 결론마다 문구 틀이 있고, 확신 말투와 그렇지 않은 말투가 둘 다 있으며, 한마디와 기사가 있다. */
  @Test
  void 해석_문구_틀은_모든_구간과_결론에_있고_확신_여부가_섞여_있다() {
    AnalysisText analysis = load().analysis();
    for (String tier : AnalysisText.TEMPLATE_TIERS) {
      for (String reading : AnalysisText.TREND_READINGS) {
        List<AnalysisText.Template> templates = analysis.trend().get(tier).get(reading);
        assertThat(templates).as(tier + "/" + reading).isNotEmpty();
        assertThat(templates).anyMatch(AnalysisText.Template::confident);
        assertThat(templates).anyMatch(t -> !t.confident());
      }
      for (String reading : AnalysisText.MACRO_READINGS) {
        assertThat(analysis.macro().get(tier).get(reading)).as(tier + "/" + reading).isNotEmpty();
      }
    }
    for (String tier : AnalysisText.REMARK_TIERS) {
      assertThat(analysis.remarks().trend().right().get(tier)).isNotEmpty();
      assertThat(analysis.remarks().trend().wrong().get(tier)).isNotEmpty();
      assertThat(analysis.remarks().macro().right().get(tier)).isNotEmpty();
      assertThat(analysis.remarks().macro().wrong().get(tier)).isNotEmpty();
    }
    assertThat(analysis.articles()).hasSizeGreaterThanOrEqualTo(30);
    // 뉴스 카드의 세상사는 거시경제 기사만 보인다. 거시 기사도, 생활·회사 기사도 섞여 있어야 한다 (decisions.md 97번).
    assertThat(analysis.articles()).anyMatch(AnalysisText.Article::macro).anyMatch(x -> !x.macro());
    assertThat(AnalysisText.templateTier(29)).isEqualTo("low");
    assertThat(AnalysisText.templateTier(79)).isEqualTo("high");
    assertThat(AnalysisText.templateTier(80)).isEqualTo("expert");
    assertThat(AnalysisText.remarkTier(60)).isEqualTo("high");
  }

  @Test
  void 유형이_하나_빠진_콘텐츠는_로드에_실패한다() {
    JsonContentCatalog catalog = load();
    List<InvestorType> missingOne = catalog.investorTypes().subList(1, 8);
    assertThatThrownBy(
            () ->
                JsonContentCatalog.validateInvestorTypes(
                    catalog.styles(), catalog.risks(), catalog.minds(), missingOne))
        .isInstanceOf(IllegalStateException.class);
  }

  /** decisions.md 154번(#198): 직종마다 장면이 넉넉하고, 연차 구간마다 그 직종만의 장면이 있으며, 후속 장면은 모두 어딘가에서 이어진다. */
  @Test
  void 직장_장면은_직종마다_넉넉하고_연차마다_있으며_후속이_끊기지_않는다() {
    JsonContentCatalog catalog = load();
    Set<String> reached = new HashSet<>();
    for (var career : catalog.careers()) {
      for (var option : career.options()) {
        for (var effect : List.of(option.success(), option.fail())) {
          if (effect.followUp() != null) {
            reached.add(effect.followUp());
          }
        }
      }
    }
    for (var career : catalog.careers()) {
      // 정년퇴직은 진행이 직접 예약한다.
      if (career.followUpOnly() && !career.code().equals("retirement")) {
        assertThat(reached).as("도달할 수 없는 후속 장면").contains(career.code());
      }
    }
    assertThat(catalog.careers()).hasSizeGreaterThanOrEqualTo(300);
    // 화면과 기록에는 제목이 남는다. 직종이 달라도 같은 제목이면 어느 장면인지 헷갈린다.
    assertThat(catalog.careers()).extracting(CareerDefinition::title).doesNotHaveDuplicates();
    List<String> jobCodes = new ArrayList<>();
    catalog.jobs().forEach(j -> jobCodes.add(j.code()));
    jobCodes.add(CareerDefinition.FULL_TIME_INVESTOR);
    for (String job : jobCodes) {
      List<CareerDefinition> own =
          catalog.careers().stream().filter(c -> c.jobs().equals(List.of(job))).toList();
      assertThat(own).as(job).hasSizeGreaterThanOrEqualTo(12);
      assertThat(own)
          .as(job + " 후속")
          .filteredOn(CareerDefinition::followUpOnly)
          .hasSizeGreaterThanOrEqualTo(3);
      // 신입·실무·관리자·은퇴 직전
      for (int tenure : List.of(1, 6, 15, 25)) {
        assertThat(own)
            .as("%s %d년차", job, tenure)
            .anyMatch(c -> !c.followUpOnly() && c.fitsTenure(tenure));
      }
    }
  }

  /** decisions.md 130번: 이직 장면이 나오는 직업마다 옮겨 갈 같은 직종이 있고, 알바에게는 이직 제안이 없다. */
  @Test
  void 이직_장면이_나오는_직업은_같은_직종으로만_옮긴다() {
    JsonContentCatalog catalog = load();
    for (var career : catalog.careers()) {
      if (!career.movesJob()) {
        continue;
      }
      assertThat(career.jobs()).as(career.code()).isNotEmpty().doesNotContain("parttime");
      for (String jobCode : career.jobs()) {
        assertThat(catalog.job(jobCode).movesTo()).as("%s/%s", career.code(), jobCode).isNotEmpty();
      }
    }
    assertThat(catalog.job("office").movesTo()).containsExactly("office", "bigcorp");
    assertThat(catalog.job("developer").movesTo()).containsExactly("developer");
    assertThat(catalog.job("parttime").movesTo()).isEmpty();
  }

  /** decisions.md 134번: 회사가 전제인 일상 장면·알림은 직업을, 학원·입학 알림은 아이 나이를 가린다. */
  @Test
  void 일상_장면과_알림은_직업과_아이_나이를_가린다() {
    JsonContentCatalog catalog = load();
    var byCode =
        catalog.adultTraits().stream()
            .collect(java.util.stream.Collectors.toMap(t -> t.code(), t -> t));
    assertThat(byCode.get("a-bonus").excludeJobs())
        .contains("parttime", "farmer", "securities-ceo");
    assertThat(byCode.get("a-promotion").excludeJobs()).contains("civil-servant", "teacher");
    assertThat(byCode.get("a-pension").fitsJob("office")).isTrue();
    assertThat(byCode.get("a-pension").fitsJob("farmer")).isFalse();
    assertThat(byCode.get("a-pension").fitsJob(null)).isTrue();
    var notices =
        catalog.notices().stream()
            .collect(java.util.stream.Collectors.toMap(n -> n.code(), n -> n));
    assertThat(notices.get("bonus").fitsJob("farmer")).isFalse();
    assertThat(notices.get("academy").fitsChildAge(3)).isFalse();
    assertThat(notices.get("academy").fitsChildAge(10)).isTrue();
    assertThat(notices.get("school").childAgeBound()).isTrue();
    assertThat(notices.get("condolence").childAgeBound()).isFalse();
  }

  /** #195·#196: 이어지는 장면은 모두 앞 선택에서 닿고, 처지 조건은 adult 장면에만 있다. */
  @Test
  void 이어지는_장면은_끊기지_않고_처지_조건은_일상_장면에만_있다() {
    JsonContentCatalog catalog = load();
    java.util.Set<String> reached = new java.util.HashSet<>();
    for (TraitDefinition trait : catalog.traits()) {
      for (TraitDefinition.Option option : trait.options()) {
        option.followUps().forEach(f -> reached.add(f.code()));
      }
      if (!trait.adult()) {
        assertThat(trait.works()).as(trait.code()).isEmpty();
        assertThat(trait.homes()).as(trait.code()).isEmpty();
      }
    }
    for (TraitDefinition trait : catalog.traits()) {
      if (trait.followUpOnly()) {
        assertThat(reached).as("닿지 않는 이어지는 장면 %s", trait.code()).contains(trait.code());
      }
    }
    assertThat(reached).isNotEmpty();
  }

  @Test
  void 없는_장면으로_이어지면_로드에_실패한다(@TempDir Path dir) throws IOException {
    Path source = Path.of("..", "content");
    for (String file : JsonContentCatalog.FILES) {
      Files.copy(source.resolve(file), dir.resolve(file));
    }
    String daily = Files.readString(dir.resolve("daily.json"), StandardCharsets.UTF_8);
    Files.writeString(
        dir.resolve("daily.json"),
        daily.replaceFirst("\"code\": \"a-loan-gone\"", "\"code\": \"no-such\""),
        StandardCharsets.UTF_8);
    assertThatThrownBy(
            () ->
                new JsonContentCatalog(
                    JsonMapper.builder().build(),
                    new ContentProperties(
                        8, new ContentProperties.Range(3, 4), List.of(dir.toString()))))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("no-such");
  }

  /** #195: 일상 장면은 300개 안팎이고 나이대·처지마다 고르게 있다. 빈도는 그대로라 풀만 넓다. */
  @Test
  void 일상_장면은_나이대와_처지마다_고르게_있다() {
    List<TraitDefinition> random =
        load().adultTraits().stream().filter(t -> !t.followUpOnly()).toList();
    assertThat(load().adultTraits()).hasSizeGreaterThanOrEqualTo(300);
    assertThat(random).hasSizeGreaterThanOrEqualTo(230);
    for (int age : List.of(27, 35, 45, 55, 65)) {
      assertThat(random.stream().filter(t -> t.fitsAge(age)))
          .as("%d세", age)
          .hasSizeGreaterThan(100);
    }
    assertThat(random.stream().filter(TraitDefinition::married)).hasSizeGreaterThanOrEqualTo(15);
    assertThat(random.stream().filter(TraitDefinition::single)).hasSizeGreaterThanOrEqualTo(3);
    assertThat(random.stream().filter(TraitDefinition::wantsChild)).hasSizeGreaterThanOrEqualTo(25);
    assertThat(random.stream().filter(t -> !t.homes().isEmpty())).hasSizeGreaterThanOrEqualTo(10);
    for (String work :
        List.of(TraitDefinition.RETIRED, TraitDefinition.JOBLESS, TraitDefinition.INVESTOR)) {
      assertThat(random.stream().filter(t -> t.works().contains(work)))
          .as(work)
          .hasSizeGreaterThanOrEqualTo(3);
    }
    assertThat(load().adultTraits().stream().filter(TraitDefinition::followUpOnly))
        .hasSizeGreaterThanOrEqualTo(60);
  }
}
