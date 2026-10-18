package investorgame.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.TestcontainersConfiguration;
import investorgame.common.Stats;
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

  private static final TraitAxes AXES =
      new TraitAxes(List.of("bold", "safe"), List.of("crowd", "own"));

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
    record(Map.of("style.long", 2, "risk.safe", 2, "mind.own", 1, "sector.bio", 1));
    record(Map.of("style.short", 1, "risk.bold", 1, "mind.own", 1, "sector.bio", 2));
    record(Map.of("style.long", 1, "sector.energy", 2));

    TraitResult result = characters.finalizeTraits(gameId, AXES, new SplittableRandom(1));

    assertThat(result).isEqualTo(new TraitResult("long", "safe", "own", "bio", "long-safe-own"));
    assertThat(characters.get(gameId).investorType()).isEqualTo("long-safe-own");
    assertThat(characters.get(gameId).riskProfile()).isEqualTo("safe");
    assertThat(characters.finalizeTraits(gameId, AXES, new SplittableRandom(2)))
        .as("두 번째 확정은 이미 정해진 값을 돌려준다")
        .isEqualTo(result);
  }

  @Test
  void 점수가_없으면_확정할_수_없다() {
    assertThatThrownBy(() -> characters.finalizeTraits(gameId, AXES, new SplittableRandom(1)))
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 위험_소신_점수가_없으면_난수로_정하되_같은_시드면_같다() {
    UUID other = UUID.randomUUID();
    characters.create(other, new SplittableRandom(1));
    for (UUID id : List.of(gameId, other)) {
      characters.recordTraitChoice(id, Map.of("style.long", 1, "sector.food", 1), Map.of(), 1800);
    }

    TraitResult a = characters.finalizeTraits(gameId, AXES, new SplittableRandom(5));
    TraitResult b = characters.finalizeTraits(other, AXES, new SplittableRandom(5));

    assertThat(a).isEqualTo(b);
    assertThat(a.riskProfile()).isIn("bold", "safe");
    assertThat(a.mindProfile()).isIn("crowd", "own");
    assertThat(a.investorTypeCode()).isEqualTo("long-" + a.riskProfile() + "-" + a.mindProfile());
  }

  @Test
  void 성향_선택이_능력치를_즉시_움직이고_운과_초기값은_그대로다() {
    Stats before = characters.get(gameId).stats();

    List<StatChange> changes =
        characters.recordTraitChoice(
            gameId,
            Map.of("style.long", 1, "sector.food", 1),
            Map.of("courage", 2, "luck", 3),
            1800);

    assertThat(changes)
        .containsExactly(new StatChange("courage", 0, before.courage(), before.courage() + 2));
    Stats after = characters.get(gameId).stats();
    assertThat(after.courage()).isEqualTo(before.courage() + 2);
    assertThat(after.luck()).isEqualTo(before.luck());
    assertThat(characters.get(gameId).initialStats()).isEqualTo(before);
  }

  @Test
  void 성향으로_움직인_능력치는_하한_5와_상한_95에서_멈춘다() {
    for (int i = 0; i < 40; i++) {
      characters.recordTraitChoice(
          gameId,
          Map.of("style.long", 1, "sector.food", 1),
          Map.of("courage", -3, "insight", 3),
          1);
    }
    assertThat(characters.get(gameId).stats().courage()).isEqualTo(5);
    assertThat(characters.get(gameId).stats().insight()).isEqualTo(95);

    List<StatChange> unchanged =
        characters.recordTraitChoice(
            gameId, Map.of("style.long", 1, "sector.food", 1), Map.of("courage", -3), 2);
    assertThat(unchanged).as("더 내려갈 수 없으면 변화가 없다").isEmpty();
  }

  private void record(Map<String, Integer> traitDeltas) {
    characters.recordTraitChoice(gameId, traitDeltas, Map.of(), 1800);
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
