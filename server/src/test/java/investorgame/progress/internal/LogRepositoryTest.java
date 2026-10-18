package investorgame.progress.internal;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.TestcontainersConfiguration;
import investorgame.progress.GameView;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** 인생 기록과 연간 자산 저장소. 실제 Postgres에서 확인한다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class LogRepositoryTest {

  @Autowired LogRepository logs;

  @Test
  void append_두_줄을_넣으면_seq_순으로_읽힌다() {
    UUID gameId = UUID.randomUUID();
    logs.append(gameId, 0, "BIRTH", Map.of("initialAsset", 100));
    logs.append(gameId, 360, "JOB", Map.of("jobCode", "dev"));

    List<GameView.LogEntry> all = logs.findAll(gameId);

    assertThat(all).hasSize(2);
    assertThat(all.get(0).kind()).isEqualTo("BIRTH");
    assertThat(all.get(0).seq()).isLessThan(all.get(1).seq());
    assertThat(all.get(1).payload().get("jobCode")).isEqualTo("dev");
  }

  @Test
  void upsertYear_같은_나이를_두_번_넣어도_한_줄이다() {
    UUID gameId = UUID.randomUUID();
    logs.upsertYear(gameId, 24, 100, 50);
    logs.upsertYear(gameId, 24, 999, 1);

    List<GameView.Yearly> years = logs.findYears(gameId);

    assertThat(years).hasSize(1);
    assertThat(years.get(0).totalAsset()).isEqualTo(100);
  }

  @Test
  void upsertMonth_같은_달을_두_번_넣어도_첫_값이_남고_없는_달은_비어_있다() {
    UUID gameId = UUID.randomUUID();
    logs.upsertMonth(gameId, 300, 1_000);
    logs.upsertMonth(gameId, 300, 2_000);

    assertThat(logs.findMonthTotal(gameId, 300)).hasValue(1_000);
    assertThat(logs.findMonthTotal(gameId, 299)).isEmpty();
  }

  @Test
  void findAll_다른_판의_기록은_섞이지_않는다() {
    UUID a = UUID.randomUUID();
    UUID b = UUID.randomUUID();
    logs.append(a, 0, "BIRTH", Map.of());
    logs.append(b, 0, "BIRTH", Map.of());
    logs.append(b, 10, "JOB", Map.of());

    assertThat(logs.findAll(a)).hasSize(1);
    assertThat(logs.findAll(b)).hasSize(2);
  }
}
