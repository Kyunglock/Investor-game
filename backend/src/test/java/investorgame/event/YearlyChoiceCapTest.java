package investorgame.event;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.TestcontainersConfiguration;
import investorgame.common.Hint;
import investorgame.common.Hint.HintDirection;
import investorgame.common.Hint.HintStrength;
import investorgame.common.Phase;
import investorgame.common.random.HashSeededRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** 선택 카드는 모두 합쳐 한 해에 두 장까지 (decisions.md 199번). 그중 한 장은 주식 이벤트 몫이고, 미룬 카드는 먼저 기다린 것부터 온다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class YearlyChoiceCapTest {

  private static final int YEAR = 360;
  private static final int START_AGE = 15;
  private static final int END_DAY = (65 - START_AGE) * YEAR;
  private static final int JOB_DAY = (25 - START_AGE) * YEAR;
  private static final int YEARS = 15;

  private static final HintProvider HINTS =
      (truth, seq) -> new Hint(HintDirection.NEUTRAL, HintStrength.MILD, Hint.Detail.LOW);

  @Autowired EventService events;

  @Test
  void 선택_카드는_한_해에_두_장까지이고_주식_이벤트는_해마다_오며_주거_카드도_밀려_사라지지_않는다() {
    int birth = JOB_DAY + 2 * YEAR;
    // 빌라 전세에 아이가 태어나 집이 좁다. 만기는 멀리 둔다.
    HousingFacts cramped =
        new HousingFacts(
            "VILLA_JEONSE",
            JOB_DAY + 30 * YEAR,
            0,
            false,
            false,
            birth,
            0,
            50,
            false,
            true,
            false,
            false,
            true,
            null);
    SchedulingContext family =
        new SchedulingContext(
            Phase.INVESTING,
            START_AGE,
            "long",
            "food",
            JOB_DAY + 30,
            true,
            JOB_DAY + 30,
            END_DAY,
            JOB_DAY,
            "office",
            JOB_DAY,
            false,
            null,
            true,
            JOB_DAY + YEAR,
            "공무원",
            1,
            List.of(),
            List.of(),
            List.of(),
            false,
            Map.of(),
            Map.of(),
            cramped,
            0L,
            50,
            Set.of());

    for (long seed = 1; seed <= 3; seed++) {
      List<EventView> shown = play(UUID.randomUUID(), family, seed);
      Map<Integer, List<EventKind>> perYear =
          shown.stream()
              .filter(v -> v.kind() != EventKind.NOTICE)
              .collect(
                  Collectors.groupingBy(
                      v -> v.occursDay() / YEAR,
                      Collectors.mapping(EventView::kind, Collectors.toList())));
      int first = (JOB_DAY + 30) / YEAR;
      for (int y = first; y < first + YEARS; y++) {
        List<EventKind> kinds = perYear.getOrDefault(y, List.of());
        assertThat(kinds).as("시드 %d, %d년째 카드", seed, y).hasSizeLessThanOrEqualTo(2);
        if (y > first) {
          assertThat(kinds)
              .as("시드 %d, %d년째에도 주식 이벤트가 한 장 온다", seed, y)
              .containsAnyOf(EventKind.NEWS, EventKind.SHAKE, EventKind.LEVERAGE);
        }
      }
      assertThat(shown)
          .as("시드 %d: 일상 장면에 밀려도 \"집이 좁다\"는 두 해 안에 온다", seed)
          .anySatisfy(
              v -> {
                assertThat(v.title()).isEqualTo("집이 좁다");
                assertThat(v.occursDay()).isLessThan(birth + 2 * YEAR);
              });
    }
  }

  /** 열다섯 해 동안 오는 카드를 모두 보고 넘긴다. */
  private List<EventView> play(UUID gameId, SchedulingContext context, long seed) {
    HashSeededRandom random = new HashSeededRandom(seed);
    List<EventView> shown = new ArrayList<>();
    int from = context.investingStartDay();
    int until = from + YEARS * YEAR;
    while (from < until) {
      var next = events.peekNextEventDay(gameId, context, from, random);
      if (next.isEmpty() || next.getAsInt() >= until) {
        break;
      }
      ScheduleResult result =
          events.schedule(gameId, context, from, next.getAsInt(), random, HINTS);
      if (result.pending().isPresent()) {
        EventView view = result.pending().get();
        shown.add(view);
        events.complete(gameId, view.eventId(), new Completion("HOLD", "HOLD", List.of()));
      }
      from = next.getAsInt();
    }
    return shown;
  }
}
