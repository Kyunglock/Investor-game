package investorgame.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import investorgame.TestcontainersConfiguration;
import investorgame.common.Hint;
import investorgame.common.Hint.HintDirection;
import investorgame.common.Hint.HintStrength;
import investorgame.common.Phase;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.CareerDefinition;
import investorgame.content.ContentCatalog;
import investorgame.content.StockDefinition;
import investorgame.content.TraitDefinition;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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

  /** 주거 이벤트가 끼어들지 않는 상태: 내 집 포함 2채, 세 만기 없음. 주거 검사는 따로 한다. */
  private static final HousingFacts SETTLED =
      new HousingFacts("OWN", null, 2, true, false, null, 0, 50, true, false, false, false, true);

  private static final HintProvider HINTS =
      (truth, seq) -> new Hint(HintDirection.NEUTRAL, HintStrength.MILD, Hint.Detail.LOW);

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
            "office",
            JOB_DAY,
            false,
            false,
            null,
            null,
            0,
            List.of(),
            List.of(),
            List.of(),
            false,
            Map.of(),
            Map.of(),
            SETTLED,
            0L,
            50,
            Set.of());
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
    // 결혼 상대 소개 (decisions.md 77번): 본문에 성격·직업·월급이 있다. 이름은 없다 (90번).
    assertThat(marriage.title()).isEqualTo("결혼할까?");
    assertThat(marriage.body()).startsWith("성격은").contains("직업은").contains("월");
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
      if (isTrip(life.get())) {
        // 가족 여행 제안(decisions.md 71번)은 자녀 제안이 아니다. 셋째 뒤에는 여행만 남는다.
        if (children == 3) {
          break;
        }
        events.complete(gameId, life.get().eventId(), new Completion("none", "none", List.of()));
        from = life.get().occursDay();
        continue;
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

  /** 무직이면 명절 보너스·연말정산이, 자녀가 없으면 학원·입학 알림이 나오지 않는다. */
  @Test
  void 직장과_자녀가_있어야_말이_되는_알림은_그때만_나온다() {
    UUID gameId = UUID.randomUUID();
    SchedulingContext jobless =
        new SchedulingContext(
            Phase.SAVING,
            START_AGE,
            "long",
            "food",
            null,
            true,
            null,
            END_DAY,
            null,
            null,
            JOB_DAY,
            true,
            false,
            null,
            null,
            0,
            List.of(),
            List.of(),
            List.of(),
            false,
            Map.of(),
            Map.of(),
            SETTLED,
            0L,
            50,
            Set.of());
    HashSeededRandom random = new HashSeededRandom(2L);
    int from = JOB_DAY;
    int notices = 0;
    for (int i = 0; i < 60; i++) {
      var next = events.peekNextEventDay(gameId, jobless, from, random);
      if (next.isEmpty()) {
        break;
      }
      ScheduleResult result =
          events.schedule(gameId, jobless, from, next.getAsInt(), random, HINTS);
      result
          .pending()
          .ifPresent(
              v -> events.complete(gameId, v.eventId(), new Completion("x", "x", List.of())));
      if (result.notice().isPresent()) {
        notices++;
        assertThat(result.notice().get().code())
            .isNotIn("bonus", "tax-refund", "academy", "school", "family-trip");
      }
      from = next.getAsInt();
    }
    assertThat(notices).isPositive();
  }

  @Test
  void LIFE_선택은_판정_없이_수락_여부만_돌려준다() {
    UUID gameId = UUID.randomUUID();
    EventView marriage = firstOf(gameId, lifeOnly(false, null, 0), JOB_DAY, EventKind.LIFE, 3L);
    ChoiceTicket ticket = events.prepareChoice(gameId, marriage.eventId(), "accept");
    assertThat(ticket.effect()).isInstanceOf(ChoiceTicket.Marriage.class);
    assertThat(((ChoiceTicket.Marriage) ticket.effect()).accepted()).isTrue();
    assertThat(
            content
                .spouseText()
                .profile(((ChoiceTicket.Marriage) ticket.effect()).spouseCode())
                .job())
        .isNotBlank();
    assertThat(ticket.stockCode()).isNull();
  }

  /** 자녀 결혼 (decisions.md 68번): 독립한 아이마다 2~5년 뒤에 한 번, 선택지는 전부·절반·안 대줌. */
  @Test
  void 자녀가_독립하면_2에서_5년_뒤에_그_아이의_결혼_선택이_한_번_온다() {
    UUID gameId = UUID.randomUUID();
    int marriedDay = (30 - START_AGE) * YEAR;
    int firstLeave = (58 - START_AGE) * YEAR;
    int secondLeave = (61 - START_AGE) * YEAR;
    // 셋째는 68세에 나가 결혼 선택이 70세 종료를 넘으므로 오지 않는다.
    int thirdLeave = (68 - START_AGE) * YEAR;
    SchedulingContext context =
        lifeWith(marriedDay, List.of(firstLeave, secondLeave, thirdLeave), (70 - START_AGE) * YEAR);

    // 가족 여행 제안(decisions.md 71번)은 건너뛰고 자녀 결혼만 본다.
    EventView first = nextNonTrip(gameId, context, firstLeave, 7L).orElseThrow();
    assertThat(first.occursDay() - firstLeave).isBetween(2 * YEAR, 5 * YEAR);
    assertThat(first.title()).isEqualTo("첫째가 결혼한다");
    assertThat(first.options())
        .extracting(EventView.Option::code)
        .containsExactly("full", "half", "none");
    events.complete(gameId, first.eventId(), new Completion("half", "half", List.of()));

    EventView second = nextNonTrip(gameId, context, first.occursDay(), 7L).orElseThrow();
    assertThat(second.title()).isEqualTo("둘째가 결혼한다");
    assertThat(second.occursDay() - secondLeave).isBetween(2 * YEAR, 5 * YEAR);
    events.complete(gameId, second.eventId(), new Completion("none", "none", List.of()));

    assertThat(nextNonTrip(gameId, context, second.occursDay(), 7L)).as("아이마다 한 번만 묻는다").isEmpty();
  }

  /** 다음 생활 선택 가운데 가족 여행 제안은 '안 간다'로 넘기고, 그 밖의 것(결혼·자녀·자녀 결혼)을 돌려준다. */
  private Optional<EventView> nextNonTrip(
      UUID gameId, SchedulingContext context, int fromDay, long seed) {
    int from = fromDay;
    for (int i = 0; i < 30; i++) {
      Optional<EventView> life = nextOf(gameId, context, from, EventKind.LIFE, seed);
      if (life.isEmpty() || !isTrip(life.get())) {
        return life;
      }
      events.complete(gameId, life.get().eventId(), new Completion("none", "none", List.of()));
      from = life.get().occursDay();
    }
    throw new AssertionError("가족 여행 제안이 끝없이 이어진다");
  }

  @Test
  void 결혼하면_3에서_6년마다_가족_여행_제안이_오고_누가_제안했는지와_네_선택지가_있다() {
    UUID gameId = UUID.randomUUID();
    int marriedDay = (30 - START_AGE) * YEAR;
    // 자녀 셋(더 묻지 않음), 독립한 날 없음(자녀 결혼 없음) → 생활 선택은 가족 여행뿐.
    SchedulingContext married = lifeOnly(true, marriedDay, 3);

    EventView trip = nextOf(gameId, married, marriedDay, EventKind.LIFE, 11L).orElseThrow();
    assertThat(trip.occursDay() - marriedDay).isBetween(3 * YEAR, 6 * YEAR);
    assertThat(trip.title()).contains("가족 여행 제안");
    assertThat(trip.title()).containsAnyOf("배우자", "부모님");
    assertThat(trip.options())
        .extracting(EventView.Option::code)
        .containsExactly("luxury", "normal", "cheap", "none");
    events.complete(gameId, trip.eventId(), new Completion("none", "none", List.of()));

    EventView again = nextOf(gameId, married, trip.occursDay(), EventKind.LIFE, 11L).orElseThrow();
    assertThat(isTrip(again)).isTrue();
    assertThat(again.occursDay() - trip.occursDay()).isBetween(3 * YEAR, 6 * YEAR);

    // 미혼이면 오지 않는다.
    assertThat(
            nextOf(
                    UUID.randomUUID(),
                    lifeOnly(false, null, 0),
                    (36 - START_AGE) * YEAR,
                    EventKind.LIFE,
                    11L)
                .filter(DefaultEventServiceTest::isTrip))
        .isEmpty();
  }

  @Test
  void 어린_아이가_집에_있으면_1에서_2년마다_나이에_맞는_나들이를_조른다() {
    UUID gameId = UUID.randomUUID();
    int marriedDay = (30 - START_AGE) * YEAR;
    // 첫째가 32세에 태어나 58세에 독립한다 → 33~45세 사이에는 어린 아이가 집에 있다.
    SchedulingContext family = lifeWith(marriedDay, List.of((58 - START_AGE) * YEAR), END_DAY);
    int firstBirth = (32 - START_AGE) * YEAR;
    int from = (33 - START_AGE) * YEAR;
    List<EventView> outings = new ArrayList<>();
    for (int i = 0; i < 12 && outings.size() < 2; i++) {
      Optional<EventView> life = nextOf(gameId, family, from, EventKind.LIFE, 13L);
      if (life.isEmpty()) {
        break;
      }
      // 첫째가 제안한 가족 여행(outing 없음)은 나들이가 아니다.
      ChoiceTicket.FamilyTrip trip =
          life.get().options().stream().anyMatch(o -> o.code().equals("luxury"))
                  && life.get().title().contains("첫째")
              ? (ChoiceTicket.FamilyTrip)
                  events.prepareChoice(gameId, life.get().eventId(), "normal").effect()
              : null;
      if (trip != null && trip.outing() != null) {
        outings.add(life.get());
        // 나들이는 그 아이의 나이에 맞는 것만 온다 (decisions.md 106번): 두 살이 캠핑을 가자고 하지 않는다.
        int age = (life.get().occursDay() - firstBirth) / YEAR;
        assertThat(content.outing(trip.outing()).fits(age))
            .as("%d세 아이에게 %s", age, trip.outing())
            .isTrue();
      }
      events.complete(gameId, life.get().eventId(), new Completion("none", "none", List.of()));
      from = life.get().occursDay();
    }
    assertThat(outings).as("나들이 제안이 온다 (decisions.md 87번)").isNotEmpty();
    assertThat(outings.get(0).options())
        .extracting(EventView.Option::code)
        .containsExactly("luxury", "normal", "cheap", "none");
    // 아이가 두 살이면 맞는 나들이가 없어 아직 오지 않는다. 세 살(동물원)부터다.
    UUID toddler = UUID.randomUUID();
    Optional<EventView> first =
        nextOf(toddler, family, firstBirth + YEAR, EventKind.LIFE, 13L)
            .filter(v -> v.title().contains("첫째"));
    first.ifPresent(v -> assertThat((v.occursDay() - firstBirth) / YEAR).isGreaterThanOrEqualTo(3));
  }

  private static boolean isTrip(EventView view) {
    return view.options().stream().anyMatch(o -> o.code().equals("luxury"));
  }

  /** 자녀 셋(더 묻지 않음)에 독립한 날이 정해진 가정. 생활 선택 가운데 자녀 결혼만 남는다. 자녀 수는 셋이어야 자녀 제안이 끼지 않는다. */
  private static SchedulingContext lifeWith(int marriedDay, List<Integer> leaveDays, int endDay) {
    return new SchedulingContext(
        Phase.SAVING,
        START_AGE,
        "long",
        "food",
        null,
        true,
        null,
        endDay,
        JOB_DAY,
        "office",
        JOB_DAY,
        false,
        true,
        marriedDay,
        null,
        leaveDays.size(),
        leaveDays.stream().map(d -> d - 26 * YEAR).toList(),
        leaveDays,
        List.of(),
        false,
        Map.of(),
        Map.of(),
        SETTLED,
        0L,
        50,
        Set.of());
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
        "office",
        JOB_DAY,
        false,
        married,
        marriedDay,
        null,
        children,
        List.of(),
        List.of(),
        List.of(),
        false,
        Map.of(),
        Map.of(),
        SETTLED,
        0L,
        50,
        Set.of());
  }

  /** 직장 체계 (decisions.md 26번): 직업이 있으면 직장 장면이, 실직 중이면 재취업 선택이 온다. */
  @Test
  void 직업이_있으면_직장_장면이_오고_실직_중이면_재취업_선택이_온다() {
    UUID employed = UUID.randomUUID();
    SchedulingContext working = lifeOnly(false, null, 0);
    // 540~1080일 간격이라 JOB_DAY + 1080 전에는 반드시 하나 있다. 그 전에 일상·결혼·알림이 끼어들 수 있으니 CAREER가 나올 때까지 민다.
    EventView career = firstOf(employed, working, JOB_DAY, EventKind.CAREER, 7L);
    assertThat(career.options()).hasSizeBetween(2, 4);
    assertThat(content.career(careerCode(career))).isNotNull();

    UUID jobless = UUID.randomUUID();
    SchedulingContext unemployed =
        new SchedulingContext(
            Phase.SAVING,
            START_AGE,
            "long",
            "food",
            null,
            true,
            null,
            END_DAY,
            null,
            null,
            JOB_DAY,
            false,
            false,
            null,
            null,
            0,
            List.of(),
            List.of(),
            List.of(),
            false,
            Map.of(),
            Map.of(),
            SETTLED,
            0L,
            50,
            Set.of());
    EventView rehire = firstOf(jobless, unemployed, JOB_DAY + 30, EventKind.JOB, 7L);
    assertThat(rehire.title()).isEqualTo(content.jobRehireText().title());
    assertThat(rehire.options()).extracting(EventView.Option::code).contains("WAIT");
  }

  @Test
  void 직업_선택에는_언제나_전업투자자가_있고_전업투자자에게는_직업_선택_대신_투자자의_장면이_온다() {
    SchedulingContext jobless =
        new SchedulingContext(
            Phase.SAVING,
            START_AGE,
            "long",
            "food",
            null,
            true,
            null,
            END_DAY,
            null,
            null,
            JOB_DAY,
            false,
            false,
            null,
            null,
            0,
            List.of(),
            List.of(),
            List.of(),
            false,
            Map.of(),
            Map.of(),
            SETTLED,
            0L,
            50,
            Set.of());
    EventView rehire = firstOf(UUID.randomUUID(), jobless, JOB_DAY + 30, EventKind.JOB, 7L);
    assertThat(rehire.options())
        .last()
        .isEqualTo(new EventView.Option("INVEST", content.jobInvestLabel()));

    SchedulingContext investor =
        new SchedulingContext(
            Phase.INVESTING,
            START_AGE,
            "long",
            "food",
            null,
            true,
            JOB_DAY,
            END_DAY,
            null,
            null,
            JOB_DAY,
            false,
            false,
            null,
            null,
            0,
            List.of(),
            List.of(),
            List.of(),
            true,
            Map.of(),
            Map.of(),
            SETTLED,
            0L,
            50,
            Set.of());
    assertThat(nextOf(UUID.randomUUID(), investor, JOB_DAY, EventKind.JOB, 3L)).isEmpty();
    EventView scene = firstOf(UUID.randomUUID(), investor, JOB_DAY, EventKind.CAREER, 3L);
    assertThat(careerOf(scene).jobs()).containsExactly("INVEST");
  }

  @Test
  void 은퇴했으면_직업과_직장_이벤트가_없다() {
    UUID gameId = UUID.randomUUID();
    SchedulingContext retired =
        new SchedulingContext(
            Phase.INVESTING,
            START_AGE,
            "long",
            "food",
            JOB_DAY + 30,
            true,
            JOB_DAY + 30,
            END_DAY,
            null,
            null,
            JOB_DAY,
            true,
            true,
            JOB_DAY + YEAR,
            null,
            0,
            List.of(),
            List.of(),
            List.of(),
            false,
            Map.of(),
            Map.of(),
            SETTLED,
            0L,
            50,
            Set.of());
    int from = (60 - START_AGE) * YEAR;
    assertThat(nextOf(gameId, retired, from, EventKind.JOB, 3L)).isEmpty();
    assertThat(nextOf(UUID.randomUUID(), retired, from, EventKind.CAREER, 3L)).isEmpty();
  }

  @Test
  void 직장이_배경인_일상_장면은_직장이_없으면_나오지_않는다() {
    UUID gameId = UUID.randomUUID();
    SchedulingContext retired =
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
            true,
            false,
            null,
            null,
            0,
            List.of(),
            List.of(),
            List.of(),
            false,
            Map.of(),
            Map.of(),
            SETTLED,
            0L,
            50,
            Set.of());
    List<String> seen = new ArrayList<>();
    int from = JOB_DAY;
    for (Optional<EventView> trait = nextOf(gameId, retired, from, EventKind.TRAIT, 5L);
        trait.isPresent();
        trait = nextOf(gameId, retired, from, EventKind.TRAIT, 5L)) {
      seen.add(trait.get().title());
      events.complete(gameId, trait.get().eventId(), new Completion("x", "x", List.of()));
      from = trait.get().occursDay();
    }
    // 보유 주식이 전제인 장면은 든 종목이 없으면 나오지 않는다 (decisions.md 115번).
    assertThat(seen)
        .containsExactlyInAnyOrderElementsOf(
            content.adultTraits().stream()
                .filter(t -> !t.job() && !t.married() && !t.holdings())
                .map(TraitDefinition::title)
                .toList());
    assertThat(content.adultTraits()).filteredOn(TraitDefinition::holdings).isNotEmpty();
  }

  @Test
  void 양가_부모_장면은_결혼한_뒤에만_나온다() {
    UUID gameId = UUID.randomUUID();
    SchedulingContext married = lifeOnly(true, JOB_DAY + YEAR, 3);
    List<String> seen = new ArrayList<>();
    int from = JOB_DAY;
    for (Optional<EventView> trait = nextOf(gameId, married, from, EventKind.TRAIT, 5L);
        trait.isPresent();
        trait = nextOf(gameId, married, from, EventKind.TRAIT, 5L)) {
      seen.add(trait.get().title());
      events.complete(gameId, trait.get().eventId(), new Completion("x", "x", List.of()));
      from = trait.get().occursDay();
    }
    List<String> inLaw =
        content.adultTraits().stream()
            .filter(TraitDefinition::married)
            .map(TraitDefinition::title)
            .toList();
    assertThat(inLaw).hasSizeGreaterThanOrEqualTo(5);
    assertThat(seen).containsAll(inLaw);
  }

  private String careerCode(EventView view) {
    // 렌더링된 뷰에는 정의 코드가 없으므로 제목으로 찾는다.
    return careerOf(view).code();
  }

  private CareerDefinition careerOf(EventView view) {
    return content.careers().stream()
        .filter(c -> c.title().equals(view.title()))
        .findFirst()
        .orElseThrow();
  }

  private SchedulingContext workingAs(String jobCode) {
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
        jobCode,
        JOB_DAY,
        false,
        false,
        null,
        null,
        0,
        List.of(),
        List.of(),
        List.of(),
        false,
        Map.of(),
        Map.of(),
        SETTLED,
        0L,
        50,
        Set.of());
  }

  /** 직장 생활 내내 나온 직장 장면을 (나이, 장면) 순서로 모은다. 다른 이벤트는 넘긴다. */
  private List<Map.Entry<Integer, CareerDefinition>> careerLife(String jobCode, long seed) {
    return careerLife(workingAs(jobCode), seed);
  }

  private List<Map.Entry<Integer, CareerDefinition>> careerLife(
      SchedulingContext context, long seed) {
    UUID gameId = UUID.randomUUID();
    List<Map.Entry<Integer, CareerDefinition>> seen = new ArrayList<>();
    int from = JOB_DAY;
    while (true) {
      Optional<EventView> next = nextOf(gameId, context, from, EventKind.CAREER, seed);
      if (next.isEmpty()) {
        return seen;
      }
      EventView view = next.get();
      seen.add(Map.entry(START_AGE + view.occursDay() / YEAR, careerOf(view)));
      events.complete(gameId, view.eventId(), new Completion("HOLD", "HOLD", List.of()));
      from = view.occursDay();
    }
  }

  /** decisions.md 51번: 직업마다 장면이 다르고, 나이가 차면 그 나이의 장면이 온다. */
  @Test
  void 직장_장면은_그_직업과_나이에_맞는_것만_나온다() {
    for (var job : content.jobs()) {
      for (long seed = 1; seed <= 3; seed++) {
        for (var entry : careerLife(job.code(), seed)) {
          assertThat(entry.getValue().fits(job.code(), entry.getKey(), 0L))
              .as("%s %d세 %s", job.code(), entry.getKey(), entry.getValue().code())
              .isTrue();
        }
      }
    }
  }

  @Test
  void 대기업은_40대에_실적_압박이_50대에_권고사직이_자주_온다() {
    int pressure40s = 0;
    int all40s = 0;
    int exit50s = 0;
    int all50s = 0;
    for (long seed = 1; seed <= 20; seed++) {
      for (var entry : careerLife("bigcorp", seed)) {
        int age = entry.getKey();
        String code = entry.getValue().code();
        if (age >= 40 && age <= 49) {
          all40s++;
          pressure40s += code.equals("big-pressure") ? 1 : 0;
        } else if (age >= 50) {
          all50s++;
          exit50s += code.equals("big-exit") ? 1 : 0;
        }
        assertThat(code).as("대기업에는 공무원 장면이 없다").doesNotStartWith("cs-");
      }
    }
    // 직전 장면은 다시 안 나오므로 많아야 절반 남짓이다. 그래도 그 나이대의 가장 흔한 장면이어야 한다.
    assertThat(pressure40s * 3).isGreaterThan(all40s);
    assertThat(exit50s * 3).isGreaterThan(all50s);
  }

  /** decisions.md 52번: 권고사직을 거절했다가 판정에 지면 대기발령이 이어서 온다. */
  @Test
  void 권고사직을_거절했다가_밀리면_대기발령이_이어진다() {
    UUID gameId = UUID.randomUUID();
    SchedulingContext context = workingAs("bigcorp");
    int from = (50 - START_AGE) * YEAR;
    EventView exit = null;
    for (int i = 0; i < 20 && exit == null; i++) {
      EventView next = firstOf(gameId, context, from, EventKind.CAREER, 5L);
      if (careerCode(next).equals("big-exit")) {
        exit = next;
      } else {
        events.complete(gameId, next.eventId(), new Completion("HOLD", "HOLD", List.of()));
        from = next.occursDay();
      }
    }
    assertThat(exit).isNotNull();
    events.complete(gameId, exit.eventId(), new Completion("hold", "hold!fail", List.of()));
    EventView standby = firstOf(gameId, context, exit.occursDay(), EventKind.CAREER, 5L);
    assertThat(careerCode(standby)).isEqualTo("big-standby");
    assertThat(standby.occursDay()).isEqualTo(exit.occursDay() + 120);
  }

  /** decisions.md 52번: 여의도 증권사 설립은 순자산 10억부터, 직접 세운 회사는 직업 선택에 나오지 않는다. */
  @Test
  void 전업투자자는_자산이_받쳐_줄_때만_증권사를_세울_수_있다() {
    SchedulingContext poor = investorWith(0L);
    SchedulingContext rich = investorWith(1_500_000_000L);
    boolean richFounds = false;
    for (long seed = 1; seed <= 5; seed++) {
      assertThat(careerLife(poor, seed))
          .extracting(e -> e.getValue().code())
          .isNotEmpty()
          .doesNotContain("inv-yeouido", "inv-fund", "inv-book");
      for (var entry : careerLife(rich, seed)) {
        assertThat(entry.getValue().jobs()).containsExactly("INVEST");
        richFounds |= entry.getValue().code().equals("inv-yeouido");
      }
    }
    assertThat(richFounds).isTrue();
    for (long seed = 1; seed <= 10; seed++) {
      EventView offer =
          firstOf(UUID.randomUUID(), investorWith(0L, false), JOB_DAY + 30, EventKind.JOB, seed);
      assertThat(offer.options())
          .extracting(EventView.Option::code)
          .doesNotContain("securities-ceo");
    }
  }

  private SchedulingContext investorWith(long netWorth) {
    return investorWith(netWorth, true);
  }

  /** fullTimeInvestor가 false면 직업이 없는 구직자다(재취업 선택이 온다). */
  private SchedulingContext investorWith(long netWorth, boolean fullTimeInvestor) {
    return new SchedulingContext(
        Phase.INVESTING,
        START_AGE,
        "long",
        "food",
        null,
        true,
        JOB_DAY,
        END_DAY,
        null,
        null,
        JOB_DAY,
        false,
        false,
        null,
        null,
        0,
        List.of(),
        List.of(),
        List.of(),
        fullTimeInvestor,
        Map.of(),
        Map.of(),
        SETTLED,
        netWorth,
        50,
        Set.of());
  }

  @Test
  void 공무원에게는_구조조정이_오지_않는다() {
    for (long seed = 1; seed <= 10; seed++) {
      assertThat(careerLife("civil-servant", seed))
          .extracting(e -> e.getValue().code())
          .doesNotContain("layoff", "headhunt", "raise");
    }
  }

  /** fromDay부터 알림을 건너뛰며 kind의 선택형 이벤트가 PENDING으로 나올 때까지 진행한다. */
  /** 빚투 (decisions.md 39번): 든 종목이 12달 고점보다 30% 넘게 빠졌을 때만, 가장 많이 빠진 종목으로 묻는다. */
  @Test
  void 든_종목이_크게_빠지면_빚투를_묻는다() {
    String fallen = content.stocks().get(0).code();
    String other = content.stocks().get(1).code();
    SchedulingContext calm = investing(List.of(fallen, other), Map.of(fallen, 2_900, other, 1_000));
    assertThat(nextOf(UUID.randomUUID(), calm, JOB_DAY + 30, EventKind.LEVERAGE, 7L)).isEmpty();

    SchedulingContext plunged =
        investing(List.of(fallen, other), Map.of(fallen, 4_500, other, 3_200));
    EventView ask = firstOf(UUID.randomUUID(), plunged, JOB_DAY + 30, EventKind.LEVERAGE, 7L);
    assertThat(ask.stockCode()).isEqualTo(fallen);
    assertThat(ask.title()).contains(content.stock(fallen).name()).contains("45%");
    assertThat(ask.options()).extracting(EventView.Option::code).containsExactly("BORROW", "PASS");
  }

  /** 주거 설계 4절: 일을 시작하면 독립, 세 만기마다 연장·이사·매수, 결혼하면 "집 살까?". */
  @Test
  void 독립하면_세를_고르고_만기와_결혼_뒤에는_집을_묻는다() {
    EventView moveOut =
        firstOf(
            UUID.randomUUID(), housed(HousingFacts.PARENTS, null), JOB_DAY, EventKind.HOUSING, 3L);
    assertThat(moveOut.options())
        .extracting(EventView.Option::code)
        .containsExactly("MONTHLY", "VILLA", "VILLA_INSURED", "APT_JEONSE");

    HousingFacts renting =
        new HousingFacts(
            "APT_JEONSE",
            JOB_DAY + YEAR,
            0,
            false,
            false,
            null,
            0,
            50,
            true,
            false,
            false,
            false,
            true);
    EventView leaseEnd =
        firstOf(UUID.randomUUID(), housed(renting, null), JOB_DAY, EventKind.HOUSING, 3L);
    assertThat(leaseEnd.occursDay()).isEqualTo(JOB_DAY + YEAR);
    assertThat(leaseEnd.options())
        .extracting(EventView.Option::code)
        .startsWith("KEEP")
        .contains("BUY_SEOUL", "BUY_GYEONGGI");

    // 1주택이면 청약이 없고, 결혼·출산·집값 급등이 없으면 "집 살까?"도 없다.
    HousingFacts settled =
        new HousingFacts(
            "APT_JEONSE", null, 1, false, false, null, 0, 50, true, false, false, false, true);
    assertThat(nextOf(UUID.randomUUID(), housed(settled, null), JOB_DAY, EventKind.HOUSING, 3L))
        .as("결혼·출산·집값 급등이 없으면 묻지 않는다")
        .isEmpty();
    EventView buy =
        firstOf(UUID.randomUUID(), housed(settled, JOB_DAY + YEAR), JOB_DAY, EventKind.HOUSING, 3L);
    assertThat(buy.occursDay()).isEqualTo(JOB_DAY + YEAR);
    assertThat(buy.options())
        .extracting(EventView.Option::code)
        .contains("BUY_SEOUL", "GAP", "PASS");
  }

  /**
   * 배우자의 월세 불만 (#116): 결혼 뒤 월세에 살면 1년 뒤 "언제까지 월세 살 거야?"가 온다. 월세 그대로는 선택지가 아니고, 미루면 1년 반 뒤 더 세게 다시
   * 묻는다. 문구는 배우자 직업과 아이 수에 따라 다르다. 결혼하지 않았거나 전세면 오지 않는다.
   */
  @Test
  void 결혼_뒤_월세에_살면_배우자가_월세살이를_그만하자고_한다() {
    int marriedDay = JOB_DAY + YEAR;
    HousingFacts monthly =
        new HousingFacts(
            "MONTHLY",
            JOB_DAY + 30 * YEAR,
            0,
            false,
            false,
            null,
            0,
            50,
            false,
            false,
            false,
            false,
            true);
    UUID gameId = UUID.randomUUID();
    SchedulingContext family = housed(monthly, marriedDay, "은행원", 0);
    EventView buy = firstOf(gameId, family, JOB_DAY, EventKind.HOUSING, 3L);
    assertThat(buy.title()).as("결혼 직후엔 '집 살까?'").isEqualTo("집을 살까?");
    events.complete(gameId, buy.eventId(), new Completion("PASS", "PASS", List.of()));

    EventView ask = firstOf(gameId, family, marriedDay, EventKind.HOUSING, 3L);
    assertThat(ask.occursDay()).isEqualTo(marriedDay + YEAR);
    assertThat(ask.title()).isEqualTo("언제까지 월세 살 거야?");
    assertThat(ask.body()).as("은행원 배우자는 금리표를 들고 온다").contains("금리표").doesNotContain("아이");
    assertThat(ask.options())
        .extracting(EventView.Option::code)
        .containsExactly(
            "VILLA", "VILLA_INSURED", "APT_JEONSE", "BUY_SEOUL", "BUY_GYEONGGI", "WAIT", "STAY");
    ChoiceTicket ticket = events.prepareChoice(gameId, ask.eventId(), "WAIT");
    assertThat(((ChoiceTicket.Housing) ticket.effect()).definition())
        .isEqualTo("spouse-rent:1:0:은행원");
    events.complete(gameId, ask.eventId(), new Completion("WAIT", "WAIT", List.of()));

    // 미루면 1년 반 뒤 다시, 더 세게. 그사이 아이가 태어났으면 문구에 아이가 들어간다.
    HousingFacts withChild =
        new HousingFacts(
            "MONTHLY",
            JOB_DAY + 30 * YEAR,
            0,
            false,
            false,
            ask.occursDay() + 100,
            0,
            50,
            false,
            false,
            false,
            false,
            true);
    EventView again =
        firstOf(
            gameId,
            housed(withChild, marriedDay, "은행원", 1),
            ask.occursDay(),
            EventKind.HOUSING,
            3L);
    assertThat(again.occursDay()).as("아이가 태어나면 반년 뒤로 앞당긴다").isEqualTo(ask.occursDay() + 100 + 180);
    assertThat(again.title()).isEqualTo("배우자가 다시 집 이야기를 꺼냈다");
    assertThat(again.body()).contains("아이까지 있는데");
    assertThat(
            ((ChoiceTicket.Housing) events.prepareChoice(gameId, again.eventId(), "STAY").effect())
                .definition())
        .isEqualTo("spouse-rent:2:1:은행원");

    // 미혼이거나 전세면 묻지 않는다: 다음 주거 이벤트는 멀리 있는 만기다.
    EventView single =
        firstOf(UUID.randomUUID(), housed(monthly, null), JOB_DAY, EventKind.HOUSING, 3L);
    assertThat(single.title()).isEqualTo("계약 만기가 다가온다");
    HousingFacts jeonse =
        new HousingFacts(
            "APT_JEONSE",
            JOB_DAY + 30 * YEAR,
            0,
            false,
            false,
            null,
            0,
            50,
            false,
            false,
            false,
            false,
            true);
    UUID jeonseGame = UUID.randomUUID();
    EventView jeonseBuy =
        firstOf(jeonseGame, housed(jeonse, marriedDay, "공무원", 0), JOB_DAY, EventKind.HOUSING, 3L);
    events.complete(jeonseGame, jeonseBuy.eventId(), new Completion("PASS", "PASS", List.of()));
    assertThat(
            firstOf(
                    jeonseGame,
                    housed(jeonse, marriedDay, "공무원", 0),
                    marriedDay,
                    EventKind.HOUSING,
                    3L)
                .title())
        .isEqualTo("계약 만기가 다가온다");
  }

  /**
   * 집이 좁다 (#117): 아이가 태어나 세집이 좁아지면 두 달 뒤 옮길지 묻고(같은 출산으로 "집 살까?"는 따로 오지 않는다), 그냥 살면 다음 출산·만기까지 다시 묻지
   * 않는다. 만기가 반년 안이면 띄우지 않는다.
   */
  @Test
  void 아이가_태어나_집이_좁아지면_두_달_뒤_옮길지_묻는다() {
    int marriedDay = JOB_DAY + YEAR;
    int birth = JOB_DAY + 2 * YEAR;
    // 빌라 전세라 배우자의 월세 불만(#116)은 없고, 좁은 집만 문제다.
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
            true);
    UUID gameId = UUID.randomUUID();
    SchedulingContext family = housed(cramped, marriedDay, "공무원", 1);
    EventView ask = firstOf(gameId, family, birth, EventKind.HOUSING, 3L);
    assertThat(ask.occursDay()).isEqualTo(birth + 60);
    assertThat(ask.title()).isEqualTo("집이 좁다");
    assertThat(ask.body()).contains("첫째가 태어나자");
    assertThat(ask.options())
        .extracting(EventView.Option::code)
        .containsExactly(
            "MONTHLY",
            "VILLA",
            "VILLA_INSURED",
            "APT_JEONSE",
            "BUY_SEOUL",
            "BUY_GYEONGGI",
            "ENDURE");
    assertThat(
            ((ChoiceTicket.Housing) events.prepareChoice(gameId, ask.eventId(), "ENDURE").effect())
                .definition())
        .isEqualTo("cramped:child:1");
    events.complete(gameId, ask.eventId(), new Completion("ENDURE", "ENDURE", List.of()));
    // 그냥 살기로 했으면 다음 주거 이벤트는 배우자의 월세 불만이나 만기다. "집이 좁다"는 다시 오지 않는다.
    assertThat(nextOf(gameId, family, ask.occursDay(), EventKind.HOUSING, 3L).map(EventView::title))
        .isNotEqualTo(Optional.of("집이 좁다"));

    // 만기가 반년 안이면 만기에 옮기면 되니 따로 띄우지 않는다.
    HousingFacts soon =
        new HousingFacts(
            "VILLA_JEONSE",
            birth + 150,
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
            true);
    UUID soonGame = UUID.randomUUID();
    SchedulingContext soonFamily = housed(soon, marriedDay, "공무원", 1);
    // "집이 좁다"가 없으니 결혼·출산의 "집 살까?"는 그대로 온다. 넘기면 바로 만기다.
    EventView buy = firstOf(soonGame, soonFamily, birth, EventKind.HOUSING, 3L);
    assertThat(buy.title()).isEqualTo("집을 살까?");
    events.complete(soonGame, buy.eventId(), new Completion("PASS", "PASS", List.of()));
    EventView leaseEnd = firstOf(soonGame, soonFamily, buy.occursDay(), EventKind.HOUSING, 3L);
    assertThat(leaseEnd.title()).isEqualTo("계약 만기가 다가온다");
    assertThat(leaseEnd.occursDay()).isEqualTo(birth + 150);

    // 결혼해서 좁아졌으면 결혼 두 달 뒤, 문구는 둘이 살기엔 좁다.
    HousingFacts newlywed =
        new HousingFacts(
            "MONTHLY",
            JOB_DAY + 30 * YEAR,
            0,
            false,
            false,
            null,
            0,
            50,
            false,
            true,
            false,
            false,
            true);
    EventView couple =
        firstOf(
            UUID.randomUUID(),
            housed(newlywed, marriedDay, "공무원", 0),
            JOB_DAY,
            EventKind.HOUSING,
            3L);
    assertThat(couple.occursDay()).isEqualTo(marriedDay + 60);
    assertThat(couple.title()).isEqualTo("둘이 살기엔 좁다");
  }

  /** 돈이 안 돼 '넘긴다'밖에 못 고를 분양 공고는 아예 오지 않는다 (#26). 영끌이 되면 독립 1년 반 뒤, 세 만기보다 먼저 온다. */
  @Test
  void 영끌이_안_되면_분양_공고가_오지_않는다() {
    HousingFacts broke =
        new HousingFacts(
            "MONTHLY",
            JOB_DAY + 20 * YEAR,
            0,
            false,
            false,
            null,
            0,
            50,
            false,
            false,
            false,
            false,
            true);
    HousingFacts able =
        new HousingFacts(
            "MONTHLY",
            JOB_DAY + 20 * YEAR,
            0,
            false,
            false,
            null,
            0,
            50,
            true,
            false,
            false,
            false,
            true);
    EventView first =
        firstOf(UUID.randomUUID(), housed(broke, null), JOB_DAY, EventKind.HOUSING, 3L);
    assertThat(first.title()).as("영끌이 안 되면 공고 없이 만기만 온다").isEqualTo("계약 만기가 다가온다");
    EventView notice =
        firstOf(UUID.randomUUID(), housed(able, null), JOB_DAY, EventKind.HOUSING, 3L);
    assertThat(notice.title()).isEqualTo("서울 아파트 분양 공고가 떴다");
    assertThat(notice.options())
        .extracting(EventView.Option::code)
        .containsExactly("APPLY", "PASS", "NEVER");
  }

  /** 전세사기는 보증보험 없는 빌라 전세의 만기에만, 확률로 숨어 있다. */
  /**
   * 주거 장면은 하루에 하나, 사이는 넉 달 (decisions.md 110번): 결혼 당일이 만기면 만기만 오고 같은 날 "집 살까?"는 오지 않는다(만기에 매수 선택지가
   * 있었다). 배우자의 월세 불만은 그 뒤 제 날에 오며, 집주인 거절 뒤에는 반년 미룬다.
   */
  @Test
  void 주거_장면은_하루에_하나만_오고_사이를_둔다() {
    int marriedDay = JOB_DAY + YEAR;
    HousingFacts monthly =
        new HousingFacts(
            "MONTHLY", marriedDay, 0, false, false, null, 0, 100, false, false, false, false, true);
    UUID gameId = UUID.randomUUID();
    EventView leaseEnd =
        firstOf(gameId, housed(monthly, marriedDay, "은행원", 0), JOB_DAY, EventKind.HOUSING, 3L);
    assertThat(leaseEnd.occursDay()).isEqualTo(marriedDay);
    assertThat(leaseEnd.title()).isEqualTo("계약 만기가 다가온다");
    events.complete(gameId, leaseEnd.eventId(), new Completion("KEEP", "KEEP", List.of()));

    HousingFacts renewed =
        new HousingFacts(
            "MONTHLY",
            marriedDay + 2 * YEAR,
            0,
            false,
            false,
            null,
            0,
            100,
            false,
            false,
            false,
            false,
            true);
    EventView next =
        firstOf(gameId, housed(renewed, marriedDay, "은행원", 0), marriedDay, EventKind.HOUSING, 3L);
    assertThat(next.title()).as("같은 날 '집 살까?'가 따라붙지 않는다").isEqualTo("언제까지 월세 살 거야?");
    assertThat(next.occursDay()).isEqualTo(marriedDay + YEAR);

    // 운이 나쁜 세입자: 집주인이 거절한 뒤 월세로 밀리면 배우자의 불만은 반년 뒤에 온다.
    for (long seed = 1; seed <= 30; seed++) {
      UUID unlucky = UUID.randomUUID();
      HousingFacts villa =
          new HousingFacts(
              "VILLA_JEONSE",
              marriedDay,
              0,
              false,
              false,
              null,
              0,
              0,
              false,
              false,
              false,
              false,
              true);
      EventView end =
          firstOf(unlucky, housed(villa, marriedDay, "은행원", 0), JOB_DAY, EventKind.HOUSING, seed);
      if (!end.title().equals("집주인이 재계약을 거절했다")) {
        continue;
      }
      events.complete(unlucky, end.eventId(), new Completion("MONTHLY", "MONTHLY", List.of()));
      HousingFacts pushed =
          new HousingFacts(
              "MONTHLY",
              marriedDay + 2 * YEAR,
              0,
              false,
              false,
              null,
              0,
              0,
              false,
              false,
              false,
              false,
              true);
      EventView ask =
          firstOf(
              unlucky, housed(pushed, marriedDay, "은행원", 0), marriedDay, EventKind.HOUSING, seed);
      assertThat(ask.title()).isEqualTo("언제까지 월세 살 거야?");
      assertThat(ask.occursDay()).isGreaterThanOrEqualTo(marriedDay + 180);
      return;
    }
    throw new AssertionError("운 0으로 30판을 돌려도 거절이 한 번도 없다");
  }

  /**
   * 배우자의 월세 불만은 네 번째에 끝난다 (decisions.md 111번): 네 번째면 배우자가 계약서를 들고 와 미루기·거스르기가 없고, 그 뒤로는 더 묻지 않는다.
   * 감당할 수 없으면 네 번째가 오지 않고 월세로 굳어진다. 현금이 넉넉하면 "조금만 더 모으자"가 빠지고, 은퇴 뒤에는 은퇴 문구다.
   */
  @Test
  void 배우자_월세_불만은_네_번째에_계약서를_들고_오고_그_뒤로는_묻지_않는다() {
    int marriedDay = JOB_DAY + YEAR;
    int farLease = JOB_DAY + 30 * YEAR;
    HousingFacts canMove =
        new HousingFacts(
            "MONTHLY", farLease, 0, false, false, null, 0, 50, false, false, true, false, true);
    UUID gameId = UUID.randomUUID();
    SchedulingContext family = housed(canMove, marriedDay, "은행원", 0);
    EventView buy = firstOf(gameId, family, JOB_DAY, EventKind.HOUSING, 3L);
    events.complete(gameId, buy.eventId(), new Completion("PASS", "PASS", List.of()));
    int from = marriedDay;
    for (int level = 1; level <= 3; level++) {
      EventView ask = firstOf(gameId, family, from, EventKind.HOUSING, 3L);
      assertThat(ask.options()).extracting(EventView.Option::code).contains("WAIT", "STAY");
      events.complete(gameId, ask.eventId(), new Completion("WAIT", "WAIT", List.of()));
      from = ask.occursDay();
    }
    EventView last = firstOf(gameId, family, from, EventKind.HOUSING, 3L);
    assertThat(last.title()).isEqualTo("배우자가 계약서를 들고 왔다");
    assertThat(last.options())
        .extracting(EventView.Option::code)
        .containsExactly("VILLA", "VILLA_INSURED", "APT_JEONSE", "BUY_SEOUL", "BUY_GYEONGGI");
    events.complete(gameId, last.eventId(), new Completion("APT_JEONSE", "APT_JEONSE", List.of()));
    assertThat(firstOf(gameId, family, last.occursDay(), EventKind.HOUSING, 3L).title())
        .as("네 번째 뒤로는 더 묻지 않는다: 다음 주거 장면은 멀리 있는 만기다")
        .isEqualTo("계약 만기가 다가온다");

    // 감당할 수 없으면 세 번째 뒤 네 번째가 오지 않고 월세로 굳어진다.
    HousingFacts stuck =
        new HousingFacts(
            "MONTHLY", farLease, 0, false, false, null, 0, 50, false, false, false, false, true);
    UUID poor = UUID.randomUUID();
    SchedulingContext poorFamily = housed(stuck, marriedDay, "은행원", 0);
    EventView poorBuy = firstOf(poor, poorFamily, JOB_DAY, EventKind.HOUSING, 3L);
    events.complete(poor, poorBuy.eventId(), new Completion("PASS", "PASS", List.of()));
    from = marriedDay;
    for (int level = 1; level <= 3; level++) {
      EventView ask = firstOf(poor, poorFamily, from, EventKind.HOUSING, 3L);
      events.complete(poor, ask.eventId(), new Completion("WAIT", "WAIT", List.of()));
      from = ask.occursDay();
    }
    assertThat(firstOf(poor, poorFamily, from, EventKind.HOUSING, 3L).title())
        .isEqualTo("계약 만기가 다가온다");

    // 현금이 넉넉하면 "조금만 더 모으자"가 빠진다. 은퇴 뒤에는 직장 문구 대신 은퇴 문구.
    HousingFacts rich =
        new HousingFacts(
            "MONTHLY", farLease, 0, false, false, null, 0, 50, false, false, true, true, true);
    UUID richGame = UUID.randomUUID();
    SchedulingContext richFamily = withRetired(housed(rich, marriedDay, "은행원", 0));
    EventView richBuy = firstOf(richGame, richFamily, JOB_DAY, EventKind.HOUSING, 3L);
    events.complete(richGame, richBuy.eventId(), new Completion("PASS", "PASS", List.of()));
    EventView richAsk = firstOf(richGame, richFamily, marriedDay, EventKind.HOUSING, 3L);
    assertThat(richAsk.options())
        .extracting(EventView.Option::code)
        .doesNotContain("WAIT")
        .contains("STAY");
    assertThat(richAsk.body()).contains("은퇴").doesNotContain("금리표");
  }

  /** 가족 점수가 바닥이면 여행·나들이 제안이 끊긴다 (decisions.md 111번). */
  @Test
  void 가족_점수가_바닥이면_가족_여행_제안이_오지_않는다() {
    int marriedDay = (30 - START_AGE) * YEAR;
    SchedulingContext cold = withFamily(lifeOnly(true, marriedDay, 3), 10);
    assertThat(
            nextOf(UUID.randomUUID(), cold, marriedDay, EventKind.LIFE, 11L)
                .filter(DefaultEventServiceTest::isTrip))
        .isEmpty();
  }

  /**
   * "집 살까?"는 매수·갭투자 가운데 하나라도 감당될 때만 온다 (decisions.md 118번). 전부 막혔으면 결혼 트리거가 남아 있어도 다음 주거 장면은 만기다.
   */
  @Test
  void 집_살까는_감당할_수_있을_때만_온다() {
    int marriedDay = JOB_DAY + YEAR;
    HousingFacts broke =
        new HousingFacts(
            "APT_JEONSE",
            JOB_DAY + 5 * YEAR,
            0,
            false,
            false,
            null,
            0,
            50,
            false,
            false,
            false,
            false,
            false);
    EventView next =
        firstOf(
            UUID.randomUUID(), housed(broke, marriedDay, "공무원", 0), JOB_DAY, EventKind.HOUSING, 3L);
    assertThat(next.title()).isEqualTo("계약 만기가 다가온다");
    assertThat(next.occursDay()).isEqualTo(JOB_DAY + 5 * YEAR);
  }

  /** 분양 공고 (decisions.md 123번): 볼수록 간격이 늘고(1.5년 → 3년), "관심 없다"고 하면 더 오지 않으며, 은퇴 뒤에도 오지 않는다. */
  @Test
  void 분양_공고는_볼수록_뜸해지고_관심_없다고_하면_끝난다() {
    HousingFacts eligible =
        new HousingFacts(
            "APT_JEONSE",
            JOB_DAY + 30 * YEAR,
            0,
            false,
            false,
            null,
            0,
            50,
            true,
            false,
            false,
            false,
            false);
    UUID gameId = UUID.randomUUID();
    SchedulingContext ctx = housed(eligible, null);
    EventView first = firstOf(gameId, ctx, JOB_DAY, EventKind.HOUSING, 3L);
    assertThat(first.options())
        .extracting(EventView.Option::code)
        .containsExactly("APPLY", "PASS", "NEVER");
    assertThat(first.occursDay()).isEqualTo(JOB_DAY + 540);
    events.complete(gameId, first.eventId(), new Completion("PASS", "PASS", List.of()));
    EventView second = firstOf(gameId, ctx, first.occursDay(), EventKind.HOUSING, 3L);
    assertThat(second.occursDay()).as("두 번째는 3년 뒤").isEqualTo(first.occursDay() + 1080);
    events.complete(gameId, second.eventId(), new Completion("NEVER", "NEVER", List.of()));
    assertThat(firstOf(gameId, ctx, second.occursDay(), EventKind.HOUSING, 3L).title())
        .as("관심 없다고 하면 다음 주거 장면은 멀리 있는 만기다")
        .isEqualTo("계약 만기가 다가온다");

    assertThat(firstOf(UUID.randomUUID(), withRetired(ctx), JOB_DAY, EventKind.HOUSING, 3L).title())
        .as("은퇴 뒤에는 공고가 없다")
        .isEqualTo("계약 만기가 다가온다");
  }

  @Test
  void 전세사기는_보증보험_없는_빌라_만기에만_가끔_있다() {
    int frauds = 0;
    int insuredFrauds = 0;
    for (long seed = 1; seed <= 200; seed++) {
      HousingFacts villa =
          new HousingFacts(
              "VILLA_JEONSE",
              JOB_DAY,
              0,
              false,
              true,
              null,
              0,
              50,
              true,
              false,
              false,
              false,
              true);
      HousingFacts insured =
          new HousingFacts(
              "VILLA_JEONSE",
              JOB_DAY,
              0,
              false,
              false,
              null,
              0,
              50,
              true,
              false,
              false,
              false,
              true);
      if (fraudAt(villa, seed)) {
        frauds++;
      }
      if (fraudAt(insured, seed)) {
        insuredFrauds++;
      }
    }
    assertThat(frauds).as("200번 중 7%%쯤").isBetween(3, 35);
    assertThat(insuredFrauds).isZero();
  }

  /** 집주인 거절은 운에 따라: 운 0이면 35%, 100이면 5% (#25). 거절되면 '2년 더 살기'가 없다. */
  @Test
  void 운이_나쁠수록_집주인이_재계약을_자주_거절한다() {
    int unlucky = 0;
    int lucky = 0;
    for (long seed = 1; seed <= 200; seed++) {
      if (refusedAt(
          new HousingFacts(
              "APT_JEONSE", JOB_DAY, 0, false, false, null, 0, 0, true, false, false, false, true),
          seed)) {
        unlucky++;
      }
      if (refusedAt(
          new HousingFacts(
              "APT_JEONSE",
              JOB_DAY,
              0,
              false,
              false,
              null,
              0,
              100,
              true,
              false,
              false,
              false,
              true),
          seed)) {
        lucky++;
      }
    }
    assertThat(unlucky).as("200번 중 35%%쯤").isBetween(45, 100);
    assertThat(lucky).as("200번 중 5%%쯤").isBetween(1, 25);
  }

  private boolean refusedAt(HousingFacts facts, long seed) {
    EventView leaseEnd =
        firstOf(UUID.randomUUID(), housed(facts, null), JOB_DAY, EventKind.HOUSING, seed);
    List<String> codes = leaseEnd.options().stream().map(EventView.Option::code).toList();
    assertThat(codes).contains("MONTHLY", "BUY_SEOUL");
    boolean refused = !codes.contains("KEEP");
    assertThat(leaseEnd.title()).isEqualTo(refused ? "집주인이 재계약을 거절했다" : "계약 만기가 다가온다");
    return refused;
  }

  private boolean fraudAt(HousingFacts facts, long seed) {
    UUID gameId = UUID.randomUUID();
    EventView leaseEnd = firstOf(gameId, housed(facts, null), JOB_DAY, EventKind.HOUSING, seed);
    ChoiceTicket ticket = events.prepareChoice(gameId, leaseEnd.eventId(), "MONTHLY");
    return ((ChoiceTicket.Housing) ticket.effect()).fraud();
  }

  /** 안목이 높은 힌트는 종목·섹터·이 뉴스가 보통 움직이는 폭을 짚어 말한다 (decisions.md 53번). 자리표시는 전부 채워진다. */
  @Test
  void 전문가_힌트는_종목과_폭을_짚고_자리표시가_남지_않는다() {
    HintProvider expert =
        (truth, seq) -> new Hint(HintDirection.UP, HintStrength.STRONG, Hint.Detail.EXPERT);
    SchedulingContext investing = investing(List.of(), Map.of());
    EventView news =
        nextOf(UUID.randomUUID(), investing, JOB_DAY + 30, EventKind.NEWS, 7L, expert)
            .orElseThrow();
    String stockName = content.stock(news.stockCode()).name();
    assertThat(news.hintText()).isNotNull().doesNotContain("{");
    assertThat(news.hintText())
        .satisfiesAnyOf(
            t -> assertThat(t).contains(stockName).contains("%"),
            t -> assertThat(t).contains(content.sectorName(news.sectorCode())));

    EventView vague =
        nextOf(UUID.randomUUID(), investing, JOB_DAY + 30, EventKind.NEWS, 7L).orElseThrow();
    assertThat(vague.hintText()).isIn("글쎄…", "잘 모르겠다");
  }

  /** 살 돈도 없고 든 것도 없으면 뉴스가 오지 않고, 든 종목이 있으면 그 종목의 뉴스가 온다 (decisions.md 59번). */
  /** 뉴스는 어울리는 종목에만 붙는다 (decisions.md 113번): 요금 조정안은 한국전륵, 증설은 메모리 제조사, 보험료 조정은 삼송화재. */
  @Test
  void 뉴스는_어울리는_종목에만_붙는다() {
    int seen = 0;
    for (long seed = 1; seed <= 60; seed++) {
      UUID gameId = UUID.randomUUID();
      int from = JOB_DAY + 30;
      for (int i = 0; i < 6; i++) {
        Optional<EventView> next =
            nextOf(gameId, investing(List.of(), Map.of()), from, EventKind.NEWS, seed);
        if (next.isEmpty()) {
          break;
        }
        EventView news = next.get();
        if (news.title().contains("요금 조정안")) {
          assertThat(news.stockCode()).isEqualTo("kep");
          seen++;
        } else if (news.title().contains("증설")) {
          assertThat(news.stockCode()).isIn("ssj", "sqh");
          seen++;
        } else if (news.title().contains("보험료") || news.title().contains("보험금")) {
          assertThat(news.stockCode()).isEqualTo("ssf");
          seen++;
        } else if (news.title().contains("충당금") || news.title().contains("분기 실적")) {
          assertThat(news.stockCode()).isIn("kbf", "kkb");
          seen++;
        }
        events.complete(gameId, news.eventId(), new Completion("HOLD", "HOLD", List.of()));
        from = news.occursDay();
      }
    }
    assertThat(seen).as("종목을 가리는 뉴스가 한 번은 나와야 검사가 의미 있다").isPositive();
  }

  /** 전업투자자에게는 뉴스가 해마다 세 번 온다 (decisions.md 121번). 직장인은 0~1번. */
  @Test
  void 전업투자자에게는_뉴스가_해마다_여러_번_온다() {
    SchedulingContext worker = investing(List.of(), Map.of());
    SchedulingContext investor =
        new SchedulingContext(
            worker.phase(),
            worker.startAge(),
            worker.investmentStyle(),
            worker.interestSector(),
            null,
            true,
            worker.investingStartDay(),
            worker.endDay(),
            null,
            null,
            JOB_DAY,
            false,
            false,
            null,
            null,
            0,
            List.of(),
            List.of(),
            List.of(),
            true,
            Map.of(),
            Map.of(),
            SETTLED,
            0L,
            50,
            Set.of());
    int investorNews = 0;
    for (long seed = 1; seed <= 5; seed++) {
      UUID gameId = UUID.randomUUID();
      int from = JOB_DAY + 30;
      int until = from + 3 * YEAR;
      while (true) {
        Optional<EventView> next = nextOf(gameId, investor, from, EventKind.NEWS, seed);
        if (next.isEmpty() || next.get().occursDay() > until) {
          break;
        }
        investorNews++;
        events.complete(gameId, next.get().eventId(), new Completion("HOLD", "HOLD", List.of()));
        from = next.get().occursDay();
      }
    }
    // 5판 × 3년 × 3번 = 45번 안팎. 직장인(0~1번/년)이면 15번을 넘기 어렵다.
    assertThat(investorNews).isGreaterThan(30);
  }

  @Test
  void 살_수도_팔_수도_없으면_뉴스가_오지_않는다() {
    Set<String> all =
        content.stocks().stream().map(StockDefinition::code).collect(Collectors.toSet());
    SchedulingContext broke = withUnaffordable(investing(List.of(), Map.of()), all);
    assertThat(nextOf(UUID.randomUUID(), broke, JOB_DAY + 30, EventKind.NEWS, 42L)).isEmpty();

    String held = content.stocks().getFirst().code();
    SchedulingContext holding = withUnaffordable(investing(List.of(held), Map.of()), all);
    EventView news = firstOf(UUID.randomUUID(), holding, JOB_DAY + 30, EventKind.NEWS, 42L);
    assertThat(news.stockCode()).as("든 종목의 뉴스만 온다").isEqualTo(held);
  }

  private static SchedulingContext withRetired(SchedulingContext c) {
    return new SchedulingContext(
        c.phase(),
        c.startAge(),
        c.investmentStyle(),
        c.interestSector(),
        c.salaryStartDay(),
        c.traitsFinalized(),
        c.investingStartDay(),
        c.endDay(),
        c.jobStartDay(),
        c.jobCode(),
        c.careerStartDay(),
        true,
        c.married(),
        c.marriedDay(),
        c.spouseJob(),
        c.childrenCount(),
        c.childBirthDays(),
        c.childLeaveDays(),
        c.heldStockCodes(),
        c.fullTimeInvestor(),
        c.heldDropBp(),
        c.heldStocks(),
        c.housing(),
        c.netWorth(),
        c.family(),
        c.unaffordableStockCodes());
  }

  private static SchedulingContext withFamily(SchedulingContext c, int family) {
    return new SchedulingContext(
        c.phase(),
        c.startAge(),
        c.investmentStyle(),
        c.interestSector(),
        c.salaryStartDay(),
        c.traitsFinalized(),
        c.investingStartDay(),
        c.endDay(),
        c.jobStartDay(),
        c.jobCode(),
        c.careerStartDay(),
        c.retired(),
        c.married(),
        c.marriedDay(),
        c.spouseJob(),
        c.childrenCount(),
        c.childBirthDays(),
        c.childLeaveDays(),
        c.heldStockCodes(),
        c.fullTimeInvestor(),
        c.heldDropBp(),
        c.heldStocks(),
        c.housing(),
        c.netWorth(),
        family,
        c.unaffordableStockCodes());
  }

  private static SchedulingContext withUnaffordable(SchedulingContext c, Set<String> codes) {
    return new SchedulingContext(
        c.phase(),
        c.startAge(),
        c.investmentStyle(),
        c.interestSector(),
        c.salaryStartDay(),
        c.traitsFinalized(),
        c.investingStartDay(),
        c.endDay(),
        c.jobStartDay(),
        c.jobCode(),
        c.careerStartDay(),
        c.retired(),
        c.married(),
        c.marriedDay(),
        c.spouseJob(),
        c.childrenCount(),
        c.childBirthDays(),
        List.of(),
        c.heldStockCodes(),
        c.fullTimeInvestor(),
        c.heldDropBp(),
        c.heldStocks(),
        c.housing(),
        c.netWorth(),
        50,
        codes);
  }

  private static SchedulingContext housed(HousingFacts facts, Integer marriedDay) {
    return housed(facts, marriedDay, null, 0);
  }

  /** 결혼한 가족: 배우자 직업과 자녀 수까지 (#116). */
  private static SchedulingContext housed(
      HousingFacts facts, Integer marriedDay, String spouseJob, int children) {
    return new SchedulingContext(
        Phase.SAVING,
        START_AGE,
        "long",
        "food",
        JOB_DAY + 30,
        true,
        null,
        END_DAY,
        JOB_DAY,
        "office",
        JOB_DAY,
        false,
        marriedDay != null,
        marriedDay,
        spouseJob,
        children,
        List.of(),
        List.of(),
        List.of(),
        false,
        Map.of(),
        Map.of(),
        facts,
        0L,
        50,
        Set.of());
  }

  private static SchedulingContext investing(List<String> held, Map<String, Integer> drops) {
    return investing(held, drops, Map.of());
  }

  private static SchedulingContext investing(
      List<String> held,
      Map<String, Integer> drops,
      Map<String, SchedulingContext.HeldStock> facts) {
    return new SchedulingContext(
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
        false,
        null,
        null,
        0,
        List.of(),
        List.of(),
        held,
        false,
        drops,
        facts,
        SETTLED,
        0L,
        50,
        Set.of());
  }

  /** 보유가 있으면 투자기에 흔들림이 오고, 흔들리는 종목은 보유 중 하나이며 선택지는 버틴다·판다다 (decisions.md 33번). */
  @Test
  void 보유_종목이_있으면_흔들림이_오고_선택지는_버틴다_판다다() {
    String held = content.stocks().get(0).code();
    SchedulingContext holding =
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
            false,
            null,
            null,
            0,
            List.of(),
            List.of(),
            List.of(held),
            false,
            Map.of(),
            Map.of(),
            SETTLED,
            0L,
            50,
            Set.of());
    EventView shake = firstOf(UUID.randomUUID(), holding, JOB_DAY + 30, EventKind.SHAKE, 7L);

    assertThat(shake.stockCode()).isEqualTo(held);
    assertThat(shake.sectorCode()).isEqualTo(content.stock(held).sector());
    assertThat(shake.title() + shake.body())
        .doesNotContain("{stock}")
        .contains(content.stock(held).name());
    assertThat(shake.hintText()).isNull();
    assertThat(shake.options())
        .extracting(EventView.Option::code, EventView.Option::label)
        .containsExactly(tuple("HOLD", "버틴다"), tuple("SELL", "판다"));
    assertThat(shake.occursDay()).isBetween(JOB_DAY + 30 + 300, JOB_DAY + 30 + 600);
  }

  /** 산 지 반년이 안 된 종목만 들고 있으면 흔들림은 그 날이 될 때까지 미뤄지고, 뉴스와 한 달 안에 붙지 않는다 (decisions.md 109번). */
  @Test
  void 흔들림은_산_지_반년_지난_종목에만_오고_뉴스와_붙지_않는다() {
    String fresh = content.stocks().get(0).code();
    int bought = JOB_DAY + 30 + 500;
    SchedulingContext justBought =
        investing(
            List.of(fresh), Map.of(), Map.of(fresh, new SchedulingContext.HeldStock(bought, 0)));
    for (long seed = 1; seed <= 5; seed++) {
      EventView shake = firstOf(UUID.randomUUID(), justBought, JOB_DAY + 30, EventKind.SHAKE, seed);
      assertThat(shake.occursDay()).isGreaterThanOrEqualTo(bought + 180);
    }

    // 뉴스와 같은 날이 되면 뉴스 한 달 뒤로 밀린다.
    UUID gameId = UUID.randomUUID();
    SchedulingContext seasoned =
        investing(List.of(fresh), Map.of(), Map.of(fresh, new SchedulingContext.HeldStock(0, 0)));
    for (long seed = 1; seed <= 8; seed++) {
      Optional<EventView> first = nextOf(gameId, seasoned, JOB_DAY + 30, EventKind.NEWS, seed);
      if (first.isEmpty()) {
        continue;
      }
      EventView news = first.get();
      events.complete(gameId, news.eventId(), new Completion("HOLD", "HOLD", List.of()));
      EventView shake = firstOf(gameId, seasoned, news.occursDay(), EventKind.SHAKE, seed);
      assertThat(shake.occursDay()).isGreaterThanOrEqualTo(news.occursDay() + 30);
    }
  }

  /** 급락 알림은 크게 빠진 종목에만, 제자리걸음은 반년 폭이 작은 종목에만 온다 (decisions.md 109번). */
  @Test
  void 흔들림_장면은_종목_상태에_맞는_것만_고른다() {
    String calm = content.stocks().get(0).code();
    // 빠지지도 않았고 많이 움직인 종목: 급락·제자리걸음 장면이 올 수 없다.
    SchedulingContext lively =
        investing(
            List.of(calm),
            Map.of(calm, 300),
            Map.of(calm, new SchedulingContext.HeldStock(0, 4_000)));
    for (long seed = 1; seed <= 12; seed++) {
      EventView shake = firstOf(UUID.randomUUID(), lively, JOB_DAY + 30, EventKind.SHAKE, seed);
      assertThat(shake.title()).doesNotContain("급락").doesNotContain("제자리걸음");
      assertThat(shake.body()).doesNotContain("반년째 큰 움직임이 없다");
    }
  }

  private Optional<EventView> nextOf(
      UUID gameId, SchedulingContext context, int fromDay, EventKind kind, long seed) {
    return nextOf(gameId, context, fromDay, kind, seed, HINTS);
  }

  private Optional<EventView> nextOf(
      UUID gameId,
      SchedulingContext context,
      int fromDay,
      EventKind kind,
      long seed,
      HintProvider hints) {
    HashSeededRandom random = new HashSeededRandom(seed);
    int from = fromDay;
    for (int i = 0; i < 200; i++) {
      var next = events.peekNextEventDay(gameId, context, from, random);
      if (next.isEmpty()) {
        return Optional.empty();
      }
      ScheduleResult result =
          events.schedule(gameId, context, from, next.getAsInt(), random, hints);
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
