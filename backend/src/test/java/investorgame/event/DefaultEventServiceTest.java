package investorgame.event;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.TestcontainersConfiguration;
import investorgame.common.Hint;
import investorgame.common.Hint.HintDirection;
import investorgame.common.Hint.HintStrength;
import investorgame.common.Phase;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.StockDefinition;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** 경제 개편 설계 5.4절(종목 뉴스)과 7.3절(결혼·자녀·알림)의 시점 규칙을 실제 콘텐츠·Postgres로 확인한다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class DefaultEventServiceTest {

  private static final int YEAR = 360;
  private static final int START_AGE = 15;
  private static final int END_DAY = (65 - START_AGE) * YEAR;
  private static final int JOB_DAY = (25 - START_AGE) * YEAR;
  private static final HintProvider HINTS =
      (truth, seq) -> new Hint(HintDirection.NEUTRAL, HintStrength.MILD);

  @Autowired EventService events;
  @Autowired ContentCatalog content;

  @Test
  void 투자기의_뉴스는_종목_하나를_가지고_같은_시드면_같은_종목이다() {
    SchedulingContext investing =
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
            false,
            null,
            0);
    EventView a = firstOf(UUID.randomUUID(), investing, JOB_DAY + 30, EventKind.NEWS, 42L);
    EventView b = firstOf(UUID.randomUUID(), investing, JOB_DAY + 30, EventKind.NEWS, 42L);

    assertThat(a.stockCode()).isNotNull();
    assertThat(content.stocksOf(a.sectorCode()))
        .extracting(StockDefinition::code)
        .contains(a.stockCode());
    assertThat(a.title()).doesNotContain("{stock}");
    assertThat(a.stockCode()).isEqualTo(b.stockCode());
    assertThat(a.options())
        .extracting(EventView.Option::code)
        .containsExactly("BUY", "SELL", "HOLD");
  }

  @Test
  void 미혼_직장인에게_27세에서_31세_사이에_결혼_이벤트가_온다() {
    // OFFER(salaryStartDay null)와 NEWS(investingStartDay null) 후보를 빼면 LIFE·NOTICE만 남는다.
    SchedulingContext single = lifeOnly(false, null, 0);
    EventView marriage = firstOf(UUID.randomUUID(), single, JOB_DAY, EventKind.LIFE, 3L);

    int age = START_AGE + marriage.occursDay() / YEAR;
    assertThat(age).isBetween(27, 31);
    assertThat(marriage.options())
        .extracting(EventView.Option::code)
        .containsExactly("accept", "decline");
    assertThat(marriage.title()).isEqualTo(content.lifeText("marriage").title());
  }

  @Test
  void 결혼을_거절하면_2년_뒤_다시_묻고_35세를_넘기면_묻지_않는다() {
    UUID gameId = UUID.randomUUID();
    SchedulingContext single = lifeOnly(false, null, 0);
    List<Integer> askedAt = new ArrayList<>();
    int from = JOB_DAY;
    for (int i = 0; i < 10; i++) {
      Optional<EventView> life = nextOf(gameId, single, from, EventKind.LIFE, 3L);
      if (life.isEmpty()) {
        break;
      }
      askedAt.add(START_AGE + life.get().occursDay() / YEAR);
      events.prepareChoice(gameId, life.get().eventId(), "decline");
      events.complete(
          gameId, life.get().eventId(), new Completion("decline", "decline", List.of()));
      from = life.get().occursDay();
    }
    assertThat(askedAt).hasSizeGreaterThanOrEqualTo(2);
    for (int i = 1; i < askedAt.size(); i++) {
      assertThat(askedAt.get(i) - askedAt.get(i - 1)).isEqualTo(2);
    }
    assertThat(askedAt.getLast()).isLessThanOrEqualTo(35);
  }

  @Test
  void 결혼_뒤_자녀_이벤트는_1에서_2년_뒤에_오고_셋을_넘기지_않는다() {
    UUID gameId = UUID.randomUUID();
    int marriedDay = (30 - START_AGE) * YEAR;
    int children = 0;
    List<Integer> askedAt = new ArrayList<>();
    int from = marriedDay;
    while (true) {
      SchedulingContext married = lifeOnly(true, marriedDay, children);
      Optional<EventView> life = nextOf(gameId, married, from, EventKind.LIFE, 5L);
      if (life.isEmpty()) {
        break;
      }
      askedAt.add(life.get().occursDay());
      events.complete(gameId, life.get().eventId(), new Completion("accept", "accept", List.of()));
      children++;
      from = life.get().occursDay();
    }
    assertThat(children).isEqualTo(3);
    assertThat(askedAt.getFirst() - marriedDay).isBetween(1 * YEAR, 2 * YEAR);
    for (int i = 1; i < askedAt.size(); i++) {
      assertThat(askedAt.get(i) - askedAt.get(i - 1)).isBetween(2 * YEAR, 3 * YEAR);
    }
  }

  @Test
  void 알림은_멈추지_않고_바로_해결되며_다음_이벤트_시각은_그_뒤다() {
    UUID gameId = UUID.randomUUID();
    SchedulingContext noLife = lifeOnly(false, null, 0);
    HashSeededRandom random = new HashSeededRandom(9L);
    // 결혼 후보는 27세 이후라 24세부터 3년 안에는 알림만 온다.
    int next = events.peekNextEventDay(gameId, noLife, JOB_DAY, random).orElseThrow();
    ScheduleResult result = events.schedule(gameId, noLife, JOB_DAY, next, random, HINTS);

    assertThat(result.notice()).isPresent();
    assertThat(result.pending()).isEmpty();
    assertThat(events.pending(gameId)).isEmpty();
    Notice notice = result.notice().get();
    assertThat(notice.occursDay()).isEqualTo(next);
    assertThat(notice.amount() != 0 || notice.salaryPercent() != 0).isTrue();
    assertThat(events.peekNextEventDay(gameId, noLife, next, random).orElseThrow())
        .isGreaterThan(next);
  }

  @Test
  void 결혼_뒤에만_나오는_알림은_미혼에게_나오지_않는다() {
    UUID gameId = UUID.randomUUID();
    SchedulingContext single = lifeOnly(false, null, 0);
    HashSeededRandom random = new HashSeededRandom(1L);
    int from = JOB_DAY;
    int notices = 0;
    for (int i = 0; i < 40 && from < (27 - START_AGE) * YEAR; i++) {
      int next = events.peekNextEventDay(gameId, single, from, random).orElseThrow();
      ScheduleResult result = events.schedule(gameId, single, from, next, random, HINTS);
      if (result.notice().isPresent()) {
        notices++;
        assertThat(result.notice().get().code()).isNotEqualTo("family-trip");
      }
      from = next;
    }
    assertThat(notices).isPositive();
  }

  @Test
  void LIFE_선택은_판정_없이_수락_여부만_돌려준다() {
    UUID gameId = UUID.randomUUID();
    EventView marriage = firstOf(gameId, lifeOnly(false, null, 0), JOB_DAY, EventKind.LIFE, 3L);
    ChoiceTicket ticket = events.prepareChoice(gameId, marriage.eventId(), "accept");
    assertThat(ticket.effect())
        .isEqualTo(new ChoiceTicket.Life(ChoiceTicket.LifeKind.MARRIAGE, true));
    assertThat(ticket.stockCode()).isNull();
  }

  private static SchedulingContext lifeOnly(boolean married, Integer marriedDay, int children) {
    return new SchedulingContext(
        Phase.SAVING,
        START_AGE,
        "long",
        "food",
        null,
        true,
        null,
        END_DAY,
        JOB_DAY,
        married,
        marriedDay,
        children);
  }

  /** fromDay부터 알림을 건너뛰며 kind의 선택형 이벤트가 PENDING으로 나올 때까지 진행한다. */
  private Optional<EventView> nextOf(
      UUID gameId, SchedulingContext context, int fromDay, EventKind kind, long seed) {
    HashSeededRandom random = new HashSeededRandom(seed);
    int from = fromDay;
    for (int i = 0; i < 200; i++) {
      var next = events.peekNextEventDay(gameId, context, from, random);
      if (next.isEmpty()) {
        return Optional.empty();
      }
      ScheduleResult result =
          events.schedule(gameId, context, from, next.getAsInt(), random, HINTS);
      if (result.pending().isPresent()) {
        EventView view = result.pending().get();
        if (view.kind() == kind) {
          return Optional.of(view);
        }
        events.complete(gameId, view.eventId(), new Completion("HOLD", "HOLD", List.of()));
      }
      from = next.getAsInt();
    }
    return Optional.empty();
  }

  private EventView firstOf(
      UUID gameId, SchedulingContext context, int fromDay, EventKind kind, long seed) {
    return nextOf(gameId, context, fromDay, kind, seed).orElseThrow();
  }
}
