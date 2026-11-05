package investorgame.behavior.internal;

import investorgame.behavior.BehaviorService;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

/** 다른 도메인의 단위 테스트가 application.yml의 실제 판정 규칙을 쓰게 한다. */
public final class TestBehavior {

  private TestBehavior() {}

  public static BehaviorService create() {
    return new DefaultBehaviorService(bind("behavior", BehaviorProperties.class));
  }

  /** application.yml의 한 갈래를 설정 record로 묶는다. */
  public static <T> T bind(String prefix, Class<T> type) {
    try {
      StandardEnvironment env = new StandardEnvironment();
      new YamlPropertySourceLoader()
          .load("application", new ClassPathResource("application.yml"))
          .forEach(env.getPropertySources()::addLast);
      return Binder.get(env).bind(prefix, type).get();
    } catch (java.io.IOException e) {
      throw new java.io.UncheckedIOException(e);
    }
  }
}
