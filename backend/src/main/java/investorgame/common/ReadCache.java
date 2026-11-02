package investorgame.common;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * 한 트랜잭션 안에서 같은 조회를 되풀이하지 않게 결과를 잠깐 들고 있는다 (#194). 쓰기 문장이 하나라도 나가면 통째로 비운다({@link #clear()}, DB 연결
 * 감싸개가 부른다). 트랜잭션 밖에서는 늘 새로 읽는다. 담는 값은 바꾸지 않는 값(record, 복사한 컬렉션)이어야 한다.
 */
public final class ReadCache {

  private static final Object KEY = ReadCache.class;
  private static final Object NULL = new Object();

  private ReadCache() {}

  /** {@code name}과 {@code key}로 찾고, 없으면 {@code loader}로 읽어 담는다. */
  @SuppressWarnings("unchecked")
  public static <T> T get(String name, Object key, Supplier<T> loader) {
    Map<Object, Object> cache = current(true);
    if (cache == null) {
      return loader.get();
    }
    Object k = List.of(name, key);
    Object hit = cache.get(k);
    if (hit != null) {
      return hit == NULL ? null : (T) hit;
    }
    T value = loader.get();
    // 읽는 도중 쓰기가 끼어들었을 수 있으니 지금 들고 있는 맵에 담는다(비워졌다면 새 값만 남는다).
    cache.put(k, value == null ? NULL : value);
    return value;
  }

  /** 방금 쓴 값을 그대로 담아 다시 읽지 않게 한다. 반드시 DB에 쓴 값과 같아야 한다. */
  public static void put(String name, Object key, Object value) {
    Map<Object, Object> cache = current(true);
    if (cache != null) {
      cache.put(List.of(name, key), value == null ? NULL : value);
    }
  }

  /** 어느 표에 쓰는지 모르는 쓰기가 나가면 이 트랜잭션에서 읽어 둔 것을 모두 버린다. */
  public static void clear() {
    Map<Object, Object> cache = current(false);
    if (cache != null) {
      cache.clear();
    }
  }

  /**
   * {@code table}에 쓰면 그 표를 가진 도메인(표 이름의 첫 마디, 예: asset_account → asset)이 읽어 둔 것만 버린다. 도메인은 자기 표만 읽고
   * 쓰므로 (경계 규칙) 다른 도메인이 읽어 둔 값은 그대로 맞다.
   */
  public static void clearTable(String table) {
    Map<Object, Object> cache = current(false);
    if (cache == null) {
      return;
    }
    int cut = table.indexOf('_');
    String prefix = (cut < 0 ? table : table.substring(0, cut)) + ".";
    cache.keySet().removeIf(k -> ((String) ((List<?>) k).getFirst()).startsWith(prefix));
  }

  @SuppressWarnings("unchecked")
  private static Map<Object, Object> current(boolean create) {
    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
      return null;
    }
    Object bound = TransactionSynchronizationManager.getResource(KEY);
    if (bound != null) {
      return (Map<Object, Object>) bound;
    }
    if (!create) {
      return null;
    }
    Map<Object, Object> cache = new HashMap<>();
    TransactionSynchronizationManager.bindResource(KEY, cache);
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCompletion(int status) {
            TransactionSynchronizationManager.unbindResourceIfPossible(KEY);
          }
        });
    return cache;
  }
}
