package investorgame.common.random;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.random.RandomGenerator;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class HashSeededRandomTest {

  @Test
  void 같은_시드와_같은_키는_같은_수열을_만든다() {
    assertThat(draw(new HashSeededRandom(42), "event", "news", 3))
        .containsExactly(draw(new HashSeededRandom(42), "event", "news", 3));
  }

  @Test
  void 키가_다르면_수열이_다르다() {
    HashSeededRandom random = new HashSeededRandom(42);
    assertThat(draw(random, "event", "news", 3)).isNotEqualTo(draw(random, "event", "news", 4));
  }

  @Test
  void 시드가_다르면_수열이_다르다() {
    assertThat(draw(new HashSeededRandom(1), "character"))
        .isNotEqualTo(draw(new HashSeededRandom(2), "character"));
  }

  @Test
  void 같은_키로_여러_번_유도해도_서로_영향을_주지_않는다() {
    HashSeededRandom random = new HashSeededRandom(7);
    RandomGenerator first = random.forKey("a");
    first.nextInt();
    first.nextInt();
    assertThat(draw(random, "a")).containsExactly(draw(new HashSeededRandom(7), "a"));
  }

  private static int[] draw(HashSeededRandom random, Object... key) {
    RandomGenerator rng = random.forKey(key);
    return IntStream.range(0, 10).map(i -> rng.nextInt(10_000)).toArray();
  }
}
