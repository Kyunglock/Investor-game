package investorgame.raising.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.behavior.internal.TestBehavior;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.HashSeededRandom;
import investorgame.content.internal.TestContent;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 멘탈 전투 (decisions.md 328번, #420). 실제 콘텐츠와 application.yml 수치로 돌린다. */
class MentalEngineTest {

  private static final CompanyProperties PROPERTIES =
      TestBehavior.bind("raising.company", CompanyProperties.class);
  private static final CompanyEngine ENGINE =
      new CompanyEngine(TestContent.load(), TestBehavior.create(), PROPERTIES);

  private static Map<String, Integer> stats(int value) {
    return Map.of(
        "insight", value, "patience", value, "courage", value, "conviction", value, "luck", value);
  }

  private static CompanyState company(long seed) {
    CompanyState company = new CompanyState();
    company.number = 2;
    company.capital = 150_000_000L;
    company.era = "plain";
    ENGINE.startYear(company, new HashSeededRandom(seed));
    ENGINE.hire(company, stats(50));
    ENGINE.place(company, Map.of(1, "bio"));
    return company;
  }

  @Test
  void 분기마다_장르와_머리글이_오고_같은_시드면_같다() {
    for (int seed = 0; seed < 50; seed++) {
      CompanyState c = company(seed);
      assertThat(c.mental).isNotNull();
      assertThat(c.mental.genre).isIn(MentalEngine.GENRES);
      assertThat(c.mental.headline).isNotBlank();
      assertThat(c.mental.card).isNull();
      CompanyState again = company(seed);
      assertThat(again.mental.genre).isEqualTo(c.mental.genre);
      assertThat(again.mental.headline).isEqualTo(c.mental.headline);
      String first = c.mental.genre;
      ENGINE.settleQuarter(c, new HashSeededRandom(seed));
      assertThat(c.quarter).isEqualTo(2);
      assertThat(c.mental.card).as("새 분기면 새 전투").isNull();
      // 분기마다 다른 열쇠로 뽑으므로 늘 같은 장르가 나오지는 않는다(시드 50개 가운데 하나라도 바뀌면 된다).
      if (!first.equals(c.mental.genre)) {
        return;
      }
    }
    throw new AssertionError("분기가 바뀌어도 장르가 그대로다");
  }

  @Test
  void 폭락이_터지는_분기에는_디펜스가_잦다() {
    Map<String, Integer> burst = new HashMap<>();
    Map<String, Integer> calm = new HashMap<>();
    for (int seed = 0; seed < 600; seed++) {
      CompanyState c = company(seed);
      if (!CompanyEngine.CRASH.equals(c.phase)) {
        continue;
      }
      while (c.year == 1) {
        boolean bursting = c.crashQuarter != null && c.crashQuarter == c.quarter;
        (bursting ? burst : calm).merge(c.mental.genre, 1, Integer::sum);
        ENGINE.settleQuarter(c, new HashSeededRandom(seed));
      }
    }
    int burstTotal = burst.values().stream().mapToInt(Integer::intValue).sum();
    assertThat(burstTotal).isGreaterThan(50);
    assertThat(burst.getOrDefault(MentalEngine.DEFENSE, 0))
        .isGreaterThan(burst.getOrDefault(MentalEngine.ASSAULT, 0) * 3);
    // 터지는 분기에도 공격이, 터지지 않는 분기에도 디펜스가 나와서 장르만으로는 폭락을 알 수 없다.
    assertThat(burst.getOrDefault(MentalEngine.ASSAULT, 0)).isPositive();
    assertThat(calm.getOrDefault(MentalEngine.DEFENSE, 0)).isPositive();
  }

  @Test
  void 결과를_보내면_강화율을_매기고_상한으로_자르며_두_번_보내도_한_번이다() {
    CompanyState c = company(1);
    ENGINE.mental.report(c, 1, 1, "steel", 120, 80);
    assertThat(c.mental.card).isEqualTo("steel");
    assertThat(c.mental.bonusPercent).isEqualTo(12 + 8);
    ENGINE.mental.report(c, 1, 1, "hold", 500, 150);
    assertThat(c.mental.card).as("이미 보냈으면 그대로").isEqualTo("steel");
    assertThat(c.mental.bonusPercent).isEqualTo(20);

    CompanyState big = company(2);
    ENGINE.mental.report(big, 1, 1, "hold", 9_999, 9_999);
    assertThat(big.mental.kills).isEqualTo(PROPERTIES.mental().maxKills());
    assertThat(big.mental.mentalLeft).isEqualTo(PROPERTIES.mental().maxMental());
    assertThat(big.mental.bonusPercent).isEqualTo(PROPERTIES.mental().maxPercent());

    CompanyState none = company(3);
    ENGINE.mental.report(none, 1, 1, "calm", 0, 0);
    assertThat(none.mental.bonusPercent).isZero();
    assertThat(ENGINE.mental.line(none)).as("강화가 없으면 소식도 없다").isNull();
  }

  @Test
  void 멘탈_전투_전에_연_분기면_불러올_때_이번_분기의_전투를_만든다() {
    CompanyState c = company(7);
    c.mental = null;
    assertThat(ENGINE.mental.adopt(c, new HashSeededRandom(7))).isTrue();
    assertThat(c.mental.genre).isIn(MentalEngine.GENRES);
    assertThat(c.mental.card).isNull();
    assertThat(ENGINE.mental.adopt(c, new HashSeededRandom(7))).as("이미 있으면 그대로").isFalse();
  }

  @Test
  void 이번_분기가_아니거나_없는_카드면_400이다() {
    CompanyState c = company(1);
    assertThatThrownBy(() -> ENGINE.mental.report(c, 1, 2, "hold", 10, 10))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> ENGINE.mental.report(c, 2, 1, "hold", 10, 10))
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> ENGINE.mental.report(c, 1, 1, "yolo", 10, 10))
        .isInstanceOf(InvalidRequestException.class);
    assertThat(c.mental.card).isNull();
  }

  @Test
  void 강화율은_그_분기_결산에서_더_벌게_하고_소식_줄을_남긴다() {
    int compared = 0;
    for (int seed = 0; seed < 200; seed++) {
      CompanyState plain = company(seed);
      CompanyState trained = company(seed);
      ENGINE.mental.report(trained, 1, 1, "hold", 300, 150);
      assertThat(trained.mental.bonusPercent).isEqualTo(PROPERTIES.mental().maxPercent());
      CompanyState.Quarter p = ENGINE.settleQuarter(plain, new HashSeededRandom(seed));
      CompanyState.Quarter t = ENGINE.settleQuarter(trained, new HashSeededRandom(seed));
      assertThat(p.mentalBonusPercent).isNull();
      assertThat(t.mentalBonusPercent).isEqualTo(PROPERTIES.mental().maxPercent());
      assertThat(t.mentalCard).isEqualTo("hold");
      assertThat(t.lines).anyMatch(l -> l.contains("멘탈 전투(존버 정신)") && l.contains("+30%"));
      assertThat(p.lines).noneMatch(l -> l.contains("멘탈 전투"));
      CompanyState.Result pr = p.results.getFirst();
      CompanyState.Result tr = t.results.getFirst();
      // 둘 다 손이 뒤집히지 않고 맞힌 분기만 견준다: 같은 난수라 버는 몫만 다르다.
      if (pr.flips.isEmpty() && tr.flips.isEmpty() && pr.pnl > 0 && tr.pnl > 0) {
        assertThat(tr.pnl).isGreaterThan(pr.pnl);
        compared++;
      }
    }
    assertThat(compared).isGreaterThan(20);
  }
}
