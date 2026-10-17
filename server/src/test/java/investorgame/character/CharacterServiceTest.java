package investorgame.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.TestcontainersConfiguration;
import investorgame.common.error.InvalidRequestException;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** specs/character.md 7절의 시나리오를 실제 Postgres에서 확인한다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CharacterServiceTest {

  @Autowired CharacterService characters;

  UUID gameId;

  @BeforeEach
  void setUp() {
    gameId = UUID.randomUUID();
    characters.create(gameId, new SplittableRandom(1));
  }

  @Test
  void 같은_시드면_같은_능력치다() {
    UUID other = UUID.randomUUID();
    assertThat(characters.create(other, new SplittableRandom(1)).stats())
        .isEqualTo(characters.get(gameId).stats());
  }

  @Test
  void 직업은_한_번만_정할_수_있고_연차는_360일_단위다() {
    characters.assignJob(gameId, "developer", 0);

    assertThatThrownBy(() -> characters.assignJob(gameId, "farmer", 10))
        .isInstanceOf(InvalidRequestException.class);
    assertThat(characters.tenureYears(gameId, 359)).isZero();
    assertThat(characters.tenureYears(gameId, 360)).isEqualTo(1);
    assertThat(characters.tenureYears(gameId, 720)).isEqualTo(2);
  }

  @Test
  void 성향_점수가_가장_높은_스타일과_섹터로_확정된다() {
    characters.recordTraitChoice(gameId, Map.of("style.long", 2, "sector.bio", 1));
    characters.recordTraitChoice(gameId, Map.of("style.short", 1, "sector.bio", 2));
    characters.recordTraitChoice(gameId, Map.of("style.long", 1, "sector.energy", 2));

    TraitResult result = characters.finalizeTraits(gameId, new SplittableRandom(1));

    assertThat(result).isEqualTo(new TraitResult("long", "bio"));
    assertThat(characters.finalizeTraits(gameId, new SplittableRandom(2)))
        .as("두 번째 확정은 이미 정해진 값을 돌려준다")
        .isEqualTo(result);
  }

  @Test
  void 점수가_없으면_확정할_수_없다() {
    assertThatThrownBy(() -> characters.finalizeTraits(gameId, new SplittableRandom(1)))
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 이탈_두_번이면_경험치_6이라_능력치가_1_오르고_1이_남는다() {
    int before = characters.get(gameId).stats().patience();
    List<GrowthSource> twice =
        List.of(
            new GrowthSource.DeviationGrowth("patience", null),
            new GrowthSource.DeviationGrowth("patience", null));

    List<StatChange> changes = characters.grow(gameId, twice, 100);

    assertThat(changes).containsExactly(new StatChange("patience", 6, before, before + 1));
    List<StatChange> next =
        characters.grow(gameId, List.of(new GrowthSource.DeviationGrowth("patience", null)), 101);
    assertThat(next.getFirst().valueAfter()).as("남은 1 + 3 = 4라 아직 오르지 않는다").isEqualTo(before + 1);
  }

  @Test
  void 운은_성장하지_않는다() {
    int luck = characters.get(gameId).stats().luck();
    List<StatChange> changes =
        characters.grow(gameId, List.of(new GrowthSource.Training("luck", 50, null)), 10);

    assertThat(changes).isEmpty();
    assertThat(characters.get(gameId).stats().luck()).isEqualTo(luck);
  }

  @Test
  void 능력치는_95를_넘지_않는다() {
    characters.grow(gameId, List.of(new GrowthSource.Training("insight", 1_000, null)), 10);
    assertThat(characters.get(gameId).stats().insight()).isEqualTo(95);
  }
}
