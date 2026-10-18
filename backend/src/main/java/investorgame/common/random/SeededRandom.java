package investorgame.common.random;

import java.util.random.RandomGenerator;

/** 판 시드에서 키별로 독립적인 난수 생성기를 유도한다. 같은 키는 항상 같은 수열을 만든다. */
public interface SeededRandom {

  RandomGenerator forKey(Object... keyParts);
}
