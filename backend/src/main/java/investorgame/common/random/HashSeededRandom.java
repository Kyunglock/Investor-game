package investorgame.common.random;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.SplittableRandom;
import java.util.random.RandomGenerator;

/**
 * 시드와 키를 SHA-256으로 섞어 하위 시드를 만든다. 요청이 재시도되거나 순서가 바뀌어도 같은 키는 같은 결과를 낸다 (db.md 3.2절).
 * SplittableRandom은 알고리즘이 명세로 고정되어 있어 JVM이 달라도 같은 수열을 만든다.
 */
public final class HashSeededRandom implements SeededRandom {

  private final long seed;

  public HashSeededRandom(long seed) {
    this.seed = seed;
  }

  @Override
  public RandomGenerator forKey(Object... keyParts) {
    StringBuilder key = new StringBuilder().append(seed);
    for (Object part : keyParts) {
      key.append('|').append(part);
    }
    return new SplittableRandom(firstLong(sha256(key.toString())));
  }

  private static byte[] sha256(String text) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("모든 JVM은 SHA-256을 제공해야 한다", e);
    }
  }

  private static long firstLong(byte[] bytes) {
    return ByteBuffer.wrap(bytes, 0, Long.BYTES).getLong();
  }
}
