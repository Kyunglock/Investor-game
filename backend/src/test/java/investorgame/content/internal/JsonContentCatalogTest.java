package investorgame.content.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.common.StatCodes;
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
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

/** 저장소의 실제 콘텐츠(content/*.json)가 규칙을 지키는지 서버 없이 확인한다. 어긋나면 서버가 시작 단계에서 실패해야 한다. */
class JsonContentCatalogTest {

  private static final ContentProperties PROPERTIES =
      new ContentProperties(3, new ContentProperties.Range(3, 4), List.of("no-such-dir"));

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
                3, new ContentProperties.Range(3, 4), List.of("no-such-dir", dir.toString())));

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
  void 알_수_없는_유형_코드는_오류다() {
    assertThatThrownBy(() -> load().investorType("none-none-none"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void 성향_장면은_단계마다_있고_선택지가_3개에서_4개다() {
    JsonContentCatalog catalog = load();
    assertThat(catalog.traitStages()).hasSize(6);
    for (ContentCatalog.TraitStage stage : catalog.traitStages()) {
      assertThat(stage.scenes()).as("%d세 장면", stage.age()).hasSize(4);
    }
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
        assertThat(option.statDeltas().values()).as(where).allMatch(v -> Math.abs(v) <= 3);
        assertThat(option.label().length()).as(where).isLessThanOrEqualTo(18);
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
  void 생활_이벤트_문구와_알림이_있다() {
    JsonContentCatalog catalog = load();
    assertThat(catalog.lifeText("marriage").acceptLabel()).isNotBlank();
    assertThat(catalog.lifeText("child").declineLabel()).isNotBlank();
    assertThatThrownBy(() -> catalog.lifeText("divorce"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(catalog.notices())
        .hasSizeGreaterThanOrEqualTo(6)
        .allMatch(n -> n.weight() > 0 && (n.amount() != 0 || n.salaryPercent() != 0));
    assertThat(catalog.notices()).anyMatch(n -> n.requiresMarried());
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
}
