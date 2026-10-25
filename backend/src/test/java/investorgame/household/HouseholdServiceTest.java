package investorgame.household;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import investorgame.TestcontainersConfiguration;
import investorgame.common.error.InvalidRequestException;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** 경제 개편 설계 7.2절의 가계 규칙. 나이 = 15 + day/360, 물가 기준 나이 25세. 설정값은 application.yml의 초기값을 그대로 쓴다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class HouseholdServiceTest {

  private static final int YEAR = 360;
  private static final int JOB_DAY = (25 - 15) * YEAR;

  @Autowired HouseholdService household;

  UUID gameId;

  @BeforeEach
  void setUp() {
    gameId = UUID.randomUUID();
    household.create(gameId);
  }

  @Test
  void 혼자일_때_생활비는_1인_금액이고_25세까지는_물가가_오르지_않는다() {
    assertThat(household.monthlyExpense(gameId, 0)).isEqualTo(900_000);
    assertThat(household.monthlyExpense(gameId, JOB_DAY)).isEqualTo(900_000);
    assertThat(household.monthlyExpense(gameId, JOB_DAY + YEAR))
        .as("26세, 2% 오름")
        .isEqualTo(918_000);
    assertThat(household.spouseIncome(gameId, JOB_DAY)).isZero();
    assertThat(household.get(gameId).married()).isFalse();
  }

  @Test
  void 결혼하면_부부_생활비와_배우자_소득이_생긴다() {
    household.marry(gameId, JOB_DAY);

    assertThat(household.get(gameId).married()).isTrue();
    assertThat(household.get(gameId).marriedDay()).isEqualTo(JOB_DAY);
    assertThat(household.monthlyExpense(gameId, JOB_DAY)).isEqualTo(1_500_000);
    assertThat(household.spouseIncome(gameId, JOB_DAY)).isEqualTo(1_800_000);
    assertThat(household.weddingCost(JOB_DAY)).isEqualTo(30_000_000);
    assertThat(household.weddingCost(JOB_DAY + YEAR)).isEqualTo(30_600_000);
  }

  @Test
  void 자녀는_나이_구간별로_비용이_붙는다() {
    household.marry(gameId, JOB_DAY);
    int birth = JOB_DAY;
    assertThat(household.addChild(gameId, birth, 27)).isEqualTo(1);
    long couple = 1_500_000;

    assertThat(household.monthlyExpense(gameId, birth)).isEqualTo(couple + 600_000);
    assertThat(deflated(household.monthlyExpense(gameId, birth + 7 * YEAR), 7))
        .isEqualTo(couple + 800_000);
    assertThat(deflated(household.monthlyExpense(gameId, birth + 13 * YEAR), 13))
        .isEqualTo(couple + 1_000_000);
    assertThat(deflated(household.monthlyExpense(gameId, birth + 19 * YEAR), 19))
        .isEqualTo(couple + 1_300_000);
    assertThat(deflated(household.monthlyExpense(gameId, birth + 23 * YEAR), 23))
        .as("23세부터 독립할 때까지는 어른 자녀 비용")
        .isEqualTo(couple + 700_000);
    assertThat(deflated(household.monthlyExpense(gameId, birth + 27 * YEAR), 27))
        .as("27세에 독립하면 비용이 없다")
        .isEqualTo(couple);
    assertThat(household.get(gameId).children())
        .containsExactly(new HouseholdView.Child(1, birth, birth + 27 * YEAR));
    assertThat(household.childbirthCost(birth)).isEqualTo(3_000_000);
  }

  @Test
  void 은퇴하면_배우자_소득이_끊긴다() {
    household.marry(gameId, JOB_DAY);
    int retireDay = (60 - 15) * YEAR;
    assertThat(household.retireMonth(retireDay)).isTrue();
    assertThat(household.retireMonth(retireDay + 30)).isFalse();
    assertThat(household.retireMonth(JOB_DAY)).isFalse();

    household.retire(gameId, retireDay);

    assertThat(household.get(gameId).retiredDay()).isEqualTo(retireDay);
    assertThat(household.spouseIncome(gameId, retireDay)).isZero();
    assertThat(household.monthlyExpense(gameId, retireDay)).as("생활비는 계속 나간다").isPositive();
  }

  @Test
  void 은퇴하지_않아도_은퇴_나이가_지나면_연금이_나온다() {
    int retireDay = (60 - 15) * YEAR;
    assertThat(household.pension(gameId, retireDay)).as("은퇴 나이 당월은 아직").isZero();
    assertThat(household.pension(gameId, retireDay + 30)).as("정년 없는 직업으로 일하는 중").isPositive();
  }

  @Test
  void 은퇴_뒤에는_연금이_나오고_부부면_더_많다() {
    int retireDay = (60 - 15) * YEAR;
    assertThat(household.pension(gameId, retireDay)).as("은퇴 전 0").isZero();

    household.retire(gameId, retireDay);

    // 1인 70만. 물가는 생활비와 같은 배율 (decisions.md 27번). 주거비가 따로 나가면서(주거 설계 2절) 생활비에 맞춰 낮췄다
    long single = household.pension(gameId, retireDay);
    assertThat(single)
        .as("700,000 × 1.02^35, 연 단위 정수 곱셈이라 끝자리는 조금 다를 수 있다")
        .isCloseTo(household.monthlyExpense(gameId, retireDay) * 700_000 / 900_000, within(100L));
    assertThat(single).isLessThan(household.monthlyExpense(gameId, retireDay));
    household.marry(gameId, retireDay);
    assertThat(household.pension(gameId, retireDay)).as("부부 110만").isGreaterThan(single);
    assertThat(household.pension(gameId, retireDay + YEAR))
        .as("물가 반영")
        .isGreaterThan(household.pension(gameId, retireDay));
  }

  @Test
  void 두_번_결혼하면_오류이고_자녀_seq는_1부터_오른다() {
    household.marry(gameId, JOB_DAY);
    assertThatThrownBy(() -> household.marry(gameId, JOB_DAY + YEAR))
        .isInstanceOf(InvalidRequestException.class);
    assertThat(household.addChild(gameId, JOB_DAY + YEAR, 25)).isEqualTo(1);
    assertThat(household.addChild(gameId, JOB_DAY + 3 * YEAR, 30)).isEqualTo(2);
    assertThat(household.get(gameId).childBirthDays())
        .containsExactly(JOB_DAY + YEAR, JOB_DAY + 3 * YEAR);
  }

  @Test
  void 다시_만들어도_상태가_지워지지_않는다() {
    household.marry(gameId, JOB_DAY);
    household.create(gameId);
    assertThat(household.get(gameId).married()).isTrue();
  }

  /** 물가 상승분(연 2% 복리, 25세 기준)을 되돌려 기준 금액으로 비교한다. 0 방향 버림이라 ±1원 오차를 허용한다. */
  private static long deflated(long amount, int yearsAfterJob) {
    double factor = Math.pow(1.02, yearsAfterJob);
    return Math.round(amount / factor / 1000.0) * 1000;
  }
}
