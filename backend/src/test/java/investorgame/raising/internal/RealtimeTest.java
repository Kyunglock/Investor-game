package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.offset;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import investorgame.raising.CompanyService.IdleHit;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * 실시간 구조 (decisions.md 523번): 분기·결산 없이 직원마다 초당 돈을 벌고, 자리를 비운 동안은 8시간까지 쌓이고, 종목회의는 1시간마다 생기는 기회로 연다.
 * 실제 콘텐츠와 application.yml 수치로 돌린다.
 */
class RealtimeTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final long HOUR = 3_600_000L;

  private final CompanyEngine company =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);
  private final IdleEngineTest.MutableClock clock = new IdleEngineTest.MutableClock();
  private final IdleEngine idle = new IdleEngine(clock, company);
  private final HashSeededRandom random = new HashSeededRandom(7);
  private long sequence;

  private static Map<String, Integer> all(int value) {
    return Map.of(
        "insight", value, "patience", value, "courage", value, "conviction", value, "luck", value);
  }

  private CompanyState opened() {
    CompanyState c = company.open(random, company.openingCapital());
    c.capital = 0;
    return c;
  }

  private void tick(CompanyState c, long millis) {
    clock.now += millis;
    idle.beat(c, "one", ++sequence, "tick", List.<IdleHit>of());
  }

  @Test
  void 직원의_초당_수입은_등급별_기본값에_능력치_합을_곱한다() {
    CompanyState c = opened();
    CompanyState.Employee low = company.hire(c, all(10));
    CompanyState.Employee high = company.hire(c, all(90));
    long lowBase = PROPERTIES.income().gradePerSecond().get(CompanyEngine.employeeGrade(low));
    long highBase = PROPERTIES.income().gradePerSecond().get(CompanyEngine.employeeGrade(high));
    assertThat(company.incomeOf(low)).isEqualTo(lowBase * (1 + 50 / 100.0));
    assertThat(company.incomeOf(high)).isEqualTo(highBase * (1 + 450 / 100.0));
    assertThat(highBase).as("높은 등급일수록 기본값이 크다").isGreaterThan(lowBase);
    assertThat(company.staffIncome(c))
        .isEqualTo(company.incomeOf(low) + company.incomeOf(high));
    // 자리는 수입과 상관없다: 앉혀도 같다.
    double before = company.staffIncome(c);
    company.place(c, Map.of(low.id, "day"));
    assertThat(company.staffIncome(c)).isEqualTo(before);
    // 등급표의 모든 등급에 기본값이 있고 위로 갈수록 커진다.
    long last = 0;
    for (String grade : CompanyEngine.LADDER) {
      long base = PROPERTIES.income().gradePerSecond().get(grade);
      assertThat(base).as(grade).isGreaterThan(last);
      last = base;
    }
  }

  @Test
  void 회사의_초당_수입은_매도벽_수입과_직원_수입의_합에_멘탈_보너스를_곱해_같은_틱에_들어온다() {
    CompanyState c = opened();
    idle.beat(c, "one", 0, "start");
    tick(c, 1000);
    // 직원이 없으면 매도벽 돌파의 시간 수입뿐이다: 게임 2초(2배속) × 20,000.
    assertThat(c.capital).isEqualTo(2 * 20_000);
    CompanyState.Employee e = company.hire(c, all(50));
    double staff = company.incomeOf(e);
    double before = c.capital;
    tick(c, 1000);
    assertThat(c.capital - before).isCloseTo(2 * (20_000 + staff), offset(1.0));
    // 화면의 초당 수입은 실제 1초에 버는 돈이고 직원의 몫이 따로 보인다.
    CompanyView.Idle view = idle.view(c);
    assertThat(view.income().perSecond().doubleValue()).isCloseTo(2 * (20_000 + staff), offset(1.0));
    assertThat(view.income().staffPerSecond().doubleValue()).isCloseTo(2 * staff, offset(1.0));
    assertThat(idle.incomeOf(c, e)).isCloseTo(2 * staff, offset(1e-6));
    // 멘탈 보호 보너스: 깬 스테이지만큼 회사 수입 전체에 곱한다.
    c.stageStars = new java.util.ArrayList<>(List.of(3, 3));
    int bonus = company.mental.bonusPercent(c);
    assertThat(bonus).isPositive();
    assertThat(idle.view(c).income().bonusPercent()).isEqualTo(bonus);
    before = c.capital;
    tick(c, 1000);
    assertThat(c.capital - before)
        .isCloseTo(2 * (20_000 + staff) * (1 + bonus / 100.0), offset(1.0));
  }

  @Test
  void 자리를_비운_동안의_수입은_화면의_초당_수입으로_쌓이고_8시간에서_멈춘다() {
    CompanyState c = opened();
    company.hire(c, all(50));
    idle.beat(c, "one", 0, "start");
    assertThat(c.capital).as("처음 접속에는 비운 시간이 없다").isZero();
    assertThat(idle.view(c).offline()).isNull();
    double perSecond = idle.view(c).income().perSecond().doubleValue();
    tick(c, 1000);
    idle.beat(c, "one", ++sequence, "stop");
    double before = c.capital;
    // 한 시간 뒤에 돌아온다.
    clock.now += HOUR;
    idle.beat(c, "two", 0, "start");
    assertThat(c.capital - before).isCloseTo(3600 * perSecond, offset(perSecond));
    CompanyView.Offline hour = idle.view(c).offline();
    assertThat(hour.seconds()).isEqualTo(3600);
    assertThat(hour.capped()).isFalse();
    assertThat(hour.earned().doubleValue()).isCloseTo(3600 * perSecond, offset(perSecond));
    assertThat(hour.at()).isEqualTo(clock.now);
    // 하루를 비워도 8시간분만 쌓인다.
    idle.beat(c, "two", 1, "stop");
    before = c.capital;
    clock.now += 24 * HOUR;
    idle.beat(c, "three", 0, "start");
    assertThat(PROPERTIES.income().offlineHours()).isEqualTo(8);
    assertThat(c.capital - before).isCloseTo(8 * 3600 * perSecond, offset(perSecond));
    CompanyView.Offline day = idle.view(c).offline();
    assertThat(day.seconds()).isEqualTo(8 * 3600);
    assertThat(day.capped()).isTrue();
    // 벽은 그동안 깨지지 않는다.
    assertThat(c.idle.wall).isEqualTo(1);
    // 같은 접속 신호를 다시 보내도 두 번 받지 않는다.
    before = c.capital;
    idle.beat(c, "three", 0, "start");
    assertThat(c.capital).isEqualTo(before);
    // 저장하고 다시 읽어도 그대로다.
    JsonMapper json = JsonMapper.builder().build();
    CompanyState saved = json.readValue(json.writeValueAsString(c), CompanyState.class);
    assertThat(idle.view(saved).offline()).isEqualTo(day);
  }

  @Test
  void 잠깐_끊긴_틈은_알림_없이_그만큼만_받는다() {
    CompanyState c = opened();
    idle.beat(c, "one", 0, "start");
    tick(c, 1000);
    double perSecond = idle.view(c).income().perSecond().doubleValue();
    double before = c.capital;
    // 30초 동안 신호가 끊겼다(잠든 화면): 전투는 돌지 않았지만 수입은 들어온다.
    tick(c, 30_000);
    assertThat(c.capital - before).isCloseTo(30 * perSecond, offset(perSecond));
    assertThat(idle.view(c).offline()).as("1분보다 짧으면 알리지 않는다").isNull();
  }

  @Test
  void 종목회의의_기회는_한_시간마다_하나씩_세_번까지_쌓인다() {
    CompanyState c = opened();
    long start = clock.now;
    company.accrueMeetings(c, start);
    assertThat(c.meetingChances).as("새 회사는 한 번을 가지고 시작한다").isEqualTo(1);
    assertThat(company.meetingWaitSeconds(c, start)).isEqualTo(3600);
    company.accrueMeetings(c, start + HOUR - 1);
    assertThat(c.meetingChances).isEqualTo(1);
    assertThat(company.meetingWaitSeconds(c, start + HOUR - 1000)).isEqualTo(1);
    company.accrueMeetings(c, start + HOUR);
    assertThat(c.meetingChances).isEqualTo(2);
    // 남은 시간은 버리지 않는다: 1시간 30분 뒤에 세면 다음 기회까지 30분이다.
    company.accrueMeetings(c, start + HOUR + HOUR / 2);
    assertThat(c.meetingChances).isEqualTo(2);
    assertThat(company.meetingWaitSeconds(c, start + HOUR + HOUR / 2)).isEqualTo(1800);
    // 오래 비워도 셋에서 멈춘다.
    company.accrueMeetings(c, start + 100 * HOUR);
    assertThat(c.meetingChances).isEqualTo(3);
    assertThat(company.meetingMax()).isEqualTo(3);
    assertThat(company.meetingWaitSeconds(c, start + 100 * HOUR)).isZero();
    // 상한에서 하나를 쓰면 그때부터 한 시간을 다시 센다.
    company.hire(c, all(60));
    company.place(c, Map.of(1, "day"));
    company.openMeeting(c, random, start + 100 * HOUR);
    assertThat(c.meetingChances).isEqualTo(2);
    assertThat(company.meetingWaitSeconds(c, start + 100 * HOUR)).isEqualTo(3600);
  }

  @Test
  void 기회를_쓰면_직원이_종목을_물어_와_회의가_꼭_열리고_정하면_바로_자본에_들어간다() {
    CompanyState c = opened();
    c.capital = 100_000_000;
    company.hire(c, all(60));
    // 돈을 굴리는 직원이 없으면 열 수 없고 기회도 쓰지 않는다.
    assertThatThrownBy(() -> company.openMeeting(c, random, clock.now))
        .isInstanceOf(InvalidRequestException.class);
    assertThat(c.meetingChances).isEqualTo(1);
    company.place(c, Map.of(1, "day"));
    company.openMeeting(c, random, clock.now);
    assertThat(c.meetingChances).isZero();
    assertThat(c.meetings).isEqualTo(1);
    assertThat(c.invest.found).isTrue();
    assertThat(c.invest.finderName).isNotNull();
    assertThat(company.invest.convened(c)).isTrue();
    // 정하지 않은 회의가 있으면 다시 열어도 그 회의다: 기회를 더 쓰지 않는다.
    String title = c.invest.title;
    company.openMeeting(c, random, clock.now);
    assertThat(c.invest.title).isEqualTo(title);
    assertThat(c.meetings).isEqualTo(1);
    double before = c.capital;
    company.invest.decide(c, InvestEngine.BUY, random);
    assertThat(c.capital).isEqualTo(before + c.invest.total);
    // 기회가 없으면 다음 회의는 열 수 없다. 한 시간 뒤에 다시 열린다.
    assertThatThrownBy(() -> company.openMeeting(c, random, clock.now))
        .isInstanceOf(InvalidRequestException.class)
        .hasMessageContaining("기회");
    company.openMeeting(c, random, clock.now + HOUR);
    assertThat(c.meetings).isEqualTo(2);
    assertThat(c.invest.choice).as("새 회의다").isNull();
  }

  @Test
  void 종목회의에서_잃어도_자본은_0_아래로_내려가지_않는다() {
    for (long seed = 0; seed < 40; seed++) {
      HashSeededRandom r = new HashSeededRandom(seed);
      CompanyState c = company.open(r, company.openingCapital());
      c.capital = 1_000;
      company.hire(c, all(30));
      company.place(c, Map.of(1, "day"));
      company.openMeeting(c, r, clock.now);
      company.invest.decide(c, InvestEngine.SELL, true, r);
      assertThat(c.capital).as("seed " + seed).isGreaterThanOrEqualTo(0);
    }
  }

  @Test
  void 분기가_있던_때의_저장은_자본과_직원과_진행도를_지키며_옮긴다() throws Exception {
    // 3년 차 2분기, 폭락장, 결산서·분기 실적·멘탈 전투·짓던 건물이 있던 저장.
    String old =
        """
        {"year":3,"quarter":2,"capital":5000000000,"building":"C","buildingTo":"B","buildYears":2,
         "buildLeft":1,"phase":"crash","omen":"수상한 소문","crashQuarter":3,"omenQuarter":2,
         "yearStake":4000000000,"quarterStartCapital":4500000000,"closed":false,"finished":true,
         "quarters":[{"year":3,"quarter":1,"capitalBefore":1,"capitalAfter":2}],
         "settlements":[{"year":2,"capitalBefore":1,"capitalAfter":2}],
         "mental":{"genre":"DEFENSE","headline":"x","exDone":true},
         "gachaReady":true,"tickets":3,"weaponTickets":2,"stageStars":[3,2],
         "idle":{"wall":42,"damage":5},
         "employees":[{"id":1,"name":"박한결","desk":"day","deskYears":2,
           "stats":{"insight":60,"patience":60,"courage":60,"conviction":60,"luck":60}}]}
        """;
    JsonMapper json = JsonMapper.builder().build();
    CompanyState c = json.readValue(old, CompanyState.class);
    assertThat(c.realtime).isFalse();
    assertThat(company.adoptRealtime(c)).isTrue();
    assertThat(company.adoptRealtime(c)).as("한 번만 옮긴다").isFalse();
    assertThat(c.capital).isEqualTo(5_000_000_000.0);
    assertThat(c.employees).hasSize(1);
    assertThat(c.employees.getFirst().desk).isEqualTo("day");
    assertThat(c.idle.wall).isEqualTo(42);
    assertThat(c.stageStars).containsExactly(3, 2);
    assertThat(c.tickets).isEqualTo(3);
    assertThat(c.building).as("짓던 건물은 바로 다 짓는다").isEqualTo("B");
    assertThat(c.buildingTo).isNull();
    assertThat(c.phase).as("폭락장은 없다").isEqualTo("normal");
    // 옮긴 저장에는 분기·결산의 흔적이 없다.
    String saved = json.writeValueAsString(c);
    assertThat(saved)
        .doesNotContain("\"quarter\"")
        .doesNotContain("quarters")
        .doesNotContain("settlements")
        .doesNotContain("crashQuarter")
        .doesNotContain("\"mental\"");
    // 옮긴 회사는 바로 돈을 벌고 회의 기회를 하나 가지고 시작한다.
    company.accrueMeetings(c, clock.now);
    assertThat(c.meetingChances).isEqualTo(1);
    assertThat(company.staffIncome(c)).isPositive();
    idle.beat(c, "one", 0, "start");
    double before = c.capital;
    tick(c, 1000);
    assertThat(c.capital).isGreaterThan(before);
  }

  @Test
  void 끝났던_회사도_되살려_이어서_한다() {
    CompanyState c = opened();
    c.closed = true;
    c.finished = true;
    c.sold = true;
    c.realtime = false;
    company.revive(c);
    assertThat(c.closed).isFalse();
    assertThat(c.finished).isFalse();
    assertThat(c.sold).isFalse();
    assertThat(c.realtime).isTrue();
  }

  @Test
  void EX_디펜스는_하루에_한_번이고_한국_시간_자정에_다시_열린다() {
    CompanyState c = opened();
    company.mental.initWeapons(c);
    // 2026-11-14 23:30 (한국 시간) = 14:30 UTC.
    clock.now = java.time.Instant.parse("2026-11-14T14:30:00Z").toEpochMilli();
    assertThat(idle.today()).isEqualTo("2026-11-14");
    assertThat(company.mental.stagesView(c, idle.today()).exAvailable()).isTrue();
    int tickets = c.weaponTickets;
    company.mental.reportEx(c, 80, idle.today());
    assertThat(c.weaponTickets).isGreaterThan(tickets);
    assertThat(company.mental.stagesView(c, idle.today()).exAvailable()).isFalse();
    tickets = c.weaponTickets;
    company.mental.reportEx(c, 80, idle.today());
    assertThat(c.weaponTickets).as("같은 날 또 해도 보상은 없다").isEqualTo(tickets);
    // 31분 뒤는 한국 시간으로 다음 날이다.
    clock.now += 31 * 60_000L;
    assertThat(idle.today()).isEqualTo("2026-11-15");
    assertThat(company.mental.stagesView(c, idle.today()).exAvailable()).isTrue();
    company.mental.reportEx(c, 80, idle.today());
    assertThat(c.weaponTickets).isGreaterThan(tickets);
  }
}
