package investorgame.housing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import investorgame.TestcontainersConfiguration;
import investorgame.common.error.InvalidRequestException;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** 주거 설계 3절의 규칙을 실제 Postgres에서 확인한다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class HousingServiceTest {

  private static final int YEAR = 360;
  private static final int RATE = 600;

  @Autowired HousingService housing;

  UUID gameId;

  @BeforeEach
  void setUp() {
    gameId = UUID.randomUUID();
    housing.create(gameId);
  }

  @Test
  void 처음에는_부모님_집이고_세를_들면_2년_만기다() {
    assertThat(housing.get(gameId).tenure()).isEqualTo(Tenure.PARENTS);

    Lease ended =
        housing.rent(gameId, Tenure.VILLA_JEONSE, null, 180_000_000, 0, 144_000_000, false, 3600);
    assertThat(ended.tenure()).isEqualTo(Tenure.PARENTS);
    HousingView view = housing.get(gameId);
    assertThat(view.tenure()).isEqualTo(Tenure.VILLA_JEONSE);
    assertThat(view.leaseEndDay()).isEqualTo(3600 + 2 * YEAR);

    Lease moved =
        housing.rent(gameId, Tenure.MONTHLY, null, 10_000_000, 600_000, 0, false, 3600 + 2 * YEAR);
    assertThat(moved.deposit()).as("끝난 세의 보증금을 돌려준다").isEqualTo(180_000_000);
    assertThat(moved.jeonseLoan()).isEqualTo(144_000_000);
  }

  @Test
  void 주담대는_원리금균등으로_달마다_원금이_줄고_전세대출은_이자만_낸다() {
    housing.buyResidence(gameId, "seoul", 1_000_000_000, 500_000_000, 3600);
    long payment = housing.monthlyPayment(500_000_000, RATE);
    // 5억, 연 6%, 30년: 월 약 300만 원
    assertThat(payment).isBetween(2_990_000L, 3_000_000L);

    MonthlyHousingCost first = housing.settleMonth(gameId, RATE, 3630);
    assertThat(first.mortgageInterest()).isEqualTo(2_500_000);
    assertThat(first.mortgagePrincipal()).isEqualTo(payment - 2_500_000);
    assertThat(housing.get(gameId).homes().getFirst().mortgage())
        .isEqualTo(500_000_000 - first.mortgagePrincipal());
    assertThat(housing.get(gameId).tenure()).isEqualTo(Tenure.OWN);
    assertThat(first.rent()).isZero();
  }

  @Test
  void 아파트는_두_채까지고_갭투자_집은_세입자_보증금을_안고_있다() {
    housing.buyResidence(gameId, "gyeonggi", 600_000_000, 300_000_000, 3600);
    housing.buyGap(gameId, "seoul", 1_000_000_000, 550_000_000, 3700);
    HousingView view = housing.get(gameId);
    assertThat(view.homes()).hasSize(2);
    assertThat(view.homes().get(1).residence()).isFalse();
    assertThat(view.homes().get(1).tenantDeposit()).isEqualTo(550_000_000);
    assertThatThrownBy(() -> housing.buyGap(gameId, "seoul", 1_000_000_000, 550_000_000, 3800))
        .isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void 살던_집이_팔리면_보증금_없는_월세로_옮기고_바로_만기라_살_곳을_고른다() {
    housing.buyResidence(gameId, "seoul", 1_000_000_000, 500_000_000, 3600);
    int seq = housing.get(gameId).homes().getFirst().seq();
    housing.setListed(gameId, seq, 4000);
    assertThat(housing.get(gameId).homes().getFirst().listedDay()).isEqualTo(4000);

    HomeSale sale = housing.sell(gameId, seq, 1_200_000_000, 4100);
    assertThat(sale.residence()).isTrue();
    assertThat(sale.mortgage()).isEqualTo(500_000_000);
    HousingView view = housing.get(gameId);
    assertThat(view.homes()).isEmpty();
    assertThat(view.tenure()).isEqualTo(Tenure.MONTHLY);
    assertThat(view.leaseEndDay()).isEqualTo(4100);
  }

  @Test
  void 연장하면_같은_집에_2년_더_산다() {
    housing.rent(gameId, Tenure.APT_JEONSE, "gyeonggi", 330_000_000, 0, 264_000_000, false, 3600);
    housing.renew(gameId, 346_500_000, 0, 277_000_000, 3600 + 2 * YEAR);
    HousingView view = housing.get(gameId);
    assertThat(view.deposit()).isEqualTo(346_500_000);
    assertThat(view.leaseEndDay()).isEqualTo(3600 + 4 * YEAR);
    assertThat(view.region()).isEqualTo("gyeonggi");
  }
}
