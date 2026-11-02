package investorgame.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** 트랜잭션 읽기 캐시 (#194): 같은 조회는 한 번만, 그 표의 도메인에 쓰면 다시 읽는다. */
class ReadCacheTest {

  private final AtomicInteger reads = new AtomicInteger();

  @AfterEach
  void endTransaction() {
    if (TransactionSynchronizationManager.isSynchronizationActive()) {
      TransactionSynchronizationManager.getSynchronizations()
          .forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));
      TransactionSynchronizationManager.clearSynchronization();
    }
  }

  private Integer load() {
    return reads.incrementAndGet();
  }

  @Test
  void 트랜잭션_밖에서는_매번_읽는다() {
    ReadCache.get("asset.get", "g", this::load);
    ReadCache.get("asset.get", "g", this::load);
    assertThat(reads).hasValue(2);
  }

  @Test
  void 트랜잭션_안에서는_한_번만_읽고_그_도메인의_표에_쓰면_다시_읽는다() {
    TransactionSynchronizationManager.initSynchronization();
    ReadCache.get("asset.get", "g", this::load);
    ReadCache.get("market.prices", "g", this::load);
    ReadCache.get("asset.get", "g", this::load);
    assertThat(reads).hasValue(2);

    // 시장 표에 써도 자산은 그대로다.
    ReadCache.clearTable("market_price");
    ReadCache.get("asset.get", "g", this::load);
    assertThat(reads).hasValue(2);
    ReadCache.get("market.prices", "g", this::load);
    assertThat(reads).hasValue(3);

    // 자산 표에 쓰면 자산만 다시 읽는다.
    ReadCache.clearTable("asset_account");
    ReadCache.get("asset.get", "g", this::load);
    ReadCache.get("market.prices", "g", this::load);
    assertThat(reads).hasValue(4);

    // 어느 표인지 모르면 전부 버린다.
    ReadCache.clear();
    ReadCache.get("asset.get", "g", this::load);
    ReadCache.get("market.prices", "g", this::load);
    assertThat(reads).hasValue(6);
  }

  @Test
  void 트랜잭션이_끝나면_버린다() {
    TransactionSynchronizationManager.initSynchronization();
    ReadCache.get("asset.get", "g", this::load);
    endTransaction();
    TransactionSynchronizationManager.initSynchronization();
    ReadCache.get("asset.get", "g", this::load);
    assertThat(reads).hasValue(2);
  }
}
