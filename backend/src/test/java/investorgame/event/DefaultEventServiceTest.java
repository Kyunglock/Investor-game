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

  /** 주거 이벤트가 끼어들지 않는 상태: 내 집 포함 2채, 세 만기 없음. 주거 검사는 따로 한다. */
  private static final HousingFacts SETTLED =
      new HousingFacts("OWN", null, 2, true, false, null, 0, 50);

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
            "office",
            JOB_DAY,
            false,
            false,
            null,
            0,
            List.of(),
            false,
            Map.of(),
            SETTLED,
            0L);
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
            0,
            List.of(),
            false,
            Map.of(),
            SETTLED,
            0L);
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
        "office",
        JOB_DAY,
        false,
        married,
        marriedDay,
        children,
        List.of(),
        false,
        Map.of(),
        SETTLED,
        0L);
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
            0,
            List.of(),
            false,
            Map.of(),
            SETTLED,
            0L);
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
            0,
            List.of(),
            false,
            Map.of(),
            SETTLED,
            0L);
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
            0,
            List.of(),
            true,
            Map.of(),
            SETTLED,
            0L);
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
            0,
            List.of(),
            false,
            Map.of(),
            SETTLED,
            0L);
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
            0,
            List.of(),
            false,
            Map.of(),
            SETTLED,
            0L);
    List<String> seen = new ArrayList<>();
    int from = JOB_DAY;
    for (Optional<EventView> trait = nextOf(gameId, retired, from, EventKind.TRAIT, 5L);
        trait.isPresent();
        trait = nextOf(gameId, retired, from, EventKind.TRAIT, 5L)) {
      seen.add(trait.get().title());
      events.complete(gameId, trait.get().eventId(), new Completion("x", "x", List.of()));
      from = trait.get().occursDay();
    }
    assertThat(seen)
        .containsExactlyInAnyOrderElementsOf(
            content.adultTraits().stream()
                .filter(t -> !t.job())
                .map(TraitDefinition::title)
                .toList());
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
        0,
        List.of(),
        false,
        Map.of(),
        SETTLED,
        0L);
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

  /** decisions.md 43번: 직업마다 장면이 다르고, 나이가 차면 그 나이의 장면이 온다. */
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

  /** decisions.md 44번: 권고사직을 거절했다가 판정에 지면 대기발령이 이어서 온다. */
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

  /** decisions.md 44번: 여의도 증권사 설립은 순자산 10억부터, 직접 세운 회사는 직업 선택에 나오지 않는다. */
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
        0,
        List.of(),
        fullTimeInvestor,
        Map.of(),
        SETTLED,
        netWorth);
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
        new HousingFacts("APT_JEONSE", JOB_DAY + YEAR, 0, false, false, null, 0, 50);
    EventView leaseEnd =
        firstOf(UUID.randomUUID(), housed(renting, null), JOB_DAY, EventKind.HOUSING, 3L);
    assertThat(leaseEnd.occursDay()).isEqualTo(JOB_DAY + YEAR);
    assertThat(leaseEnd.options())
        .extracting(EventView.Option::code)
        .startsWith("KEEP")
        .contains("BUY_SEOUL", "BUY_GYEONGGI");

    // 1주택이면 청약이 없고, 결혼·출산·집값 급등이 없으면 "집 살까?"도 없다.
    HousingFacts settled = new HousingFacts("APT_JEONSE", null, 1, false, false, null, 0, 50);
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

  /** 전세사기는 보증보험 없는 빌라 전세의 만기에만, 확률로 숨어 있다. */
  @Test
  void 전세사기는_보증보험_없는_빌라_만기에만_가끔_있다() {
    int frauds = 0;
    int insuredFrauds = 0;
    for (long seed = 1; seed <= 200; seed++) {
      HousingFacts villa = new HousingFacts("VILLA_JEONSE", JOB_DAY, 0, false, true, null, 0, 50);
      HousingFacts insured =
          new HousingFacts("VILLA_JEONSE", JOB_DAY, 0, false, false, null, 0, 50);
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
      if (refusedAt(new HousingFacts("APT_JEONSE", JOB_DAY, 0, false, false, null, 0, 0), seed)) {
        unlucky++;
      }
      if (refusedAt(new HousingFacts("APT_JEONSE", JOB_DAY, 0, false, false, null, 0, 100), seed)) {
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

  private static SchedulingContext housed(HousingFacts facts, Integer marriedDay) {
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
        true,
        marriedDay != null,
        marriedDay,
        0,
        List.of(),
        false,
        Map.of(),
        facts,
        0L);
  }

  private static SchedulingContext investing(List<String> held, Map<String, Integer> drops) {
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
        0,
        held,
        false,
        drops,
        SETTLED,
        0L);
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
            0,
            List.of(held),
            false,
            Map.of(),
            SETTLED,
            0L);
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
