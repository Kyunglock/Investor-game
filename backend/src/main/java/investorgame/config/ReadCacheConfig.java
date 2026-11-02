package investorgame.config;

import investorgame.common.ReadCache;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.sql.DataSource;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DelegatingDataSource;

/**
 * DB 연결을 감싸 쓰기 문장(SELECT가 아닌 것)을 준비할 때마다 그 표의 트랜잭션 읽기 캐시를 비운다 (#194). 그래서 서비스는 쓰기 뒤에 무효화를 따로 챙기지
 * 않아도 된다.
 */
@Configuration(proxyBeanMethods = false)
class ReadCacheConfig {

  @Bean
  static BeanPostProcessor readCacheDataSource() {
    return new BeanPostProcessor() {
      @Override
      public Object postProcessAfterInitialization(Object bean, String name) {
        if (bean instanceof DataSource ds && !(bean instanceof WriteAwareDataSource)) {
          return new WriteAwareDataSource(ds);
        }
        return bean;
      }
    };
  }

  static final class WriteAwareDataSource extends DelegatingDataSource {

    WriteAwareDataSource(DataSource target) {
      super(target);
    }

    @Override
    public Connection getConnection() throws SQLException {
      return wrap(super.getConnection());
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
      return wrap(super.getConnection(username, password));
    }

    private static Connection wrap(Connection connection) {
      return (Connection)
          Proxy.newProxyInstance(
              Connection.class.getClassLoader(),
              new Class<?>[] {Connection.class},
              (proxy, method, args) -> {
                invalidate(method, args);
                return invoke(connection, method, args);
              });
    }

    private static final Pattern WRITE =
        Pattern.compile(
            "^(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+([a-z_]+)", Pattern.CASE_INSENSITIVE);

    /**
     * 문장을 준비할 때 쓰기면 캐시를 비운다. SELECT는 그대로, INSERT·UPDATE·DELETE는 그 표의 도메인만, 그 밖(WITH, 문장을 모르는
     * createStatement·prepareCall)은 전부 비운다.
     */
    static void invalidate(Method method, Object[] args) {
      String name = method.getName();
      if (name.equals("createStatement") || name.equals("prepareCall")) {
        ReadCache.clear();
        return;
      }
      if (!name.equals("prepareStatement") || args == null || args.length == 0) {
        return;
      }
      String sql = String.valueOf(args[0]).strip();
      String upper = sql.toUpperCase(Locale.ROOT);
      if (upper.startsWith("SELECT")) {
        return;
      }
      Matcher m = WRITE.matcher(sql);
      if (m.find()) {
        ReadCache.clearTable(m.group(1).toLowerCase(Locale.ROOT));
      } else {
        ReadCache.clear();
      }
    }

    private static Object invoke(Object target, Method method, Object[] args) throws Throwable {
      try {
        return method.invoke(target, args);
      } catch (InvocationTargetException e) {
        throw e.getCause();
      }
    }
  }
}
