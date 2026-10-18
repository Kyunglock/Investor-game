package investorgame.content.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.common.StatCodes;
import investorgame.content.ContentCatalog;
import investorgame.content.InvestorType;
import investorgame.content.TraitDefinition;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 저장소의 실제 콘텐츠(content/*.json)가 규칙을 지키는지 서버 없이 확인한다. 어긋나면 서버가 시작 단계에서 실패해야 한다. */
class JsonContentCatalogTest {

  private static final ContentProperties PROPERTIES =
      new ContentProperties(3, new ContentProperties.Range(3, 4));

  private static JsonContentCatalog load() {
    return new JsonContentCatalog(JsonMapper.builder().build(), PROPERTIES);
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
