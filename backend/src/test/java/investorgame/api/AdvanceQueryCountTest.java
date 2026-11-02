package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import investorgame.TestcontainersConfiguration;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * 한 달치 보고(POST /advance) 한 번이 DB에 보내는 문장 수를 센다 (#194). 같은 조회를 되풀이하지 않도록 상한을 둔다. 부하 측정 대신 쿼리 수로
 * 비교한다.
 */
@SpringBootTest
@Import({TestcontainersConfiguration.class, AdvanceQueryCountTest.Counting.class})
class AdvanceQueryCountTest {

  /** 한 달 보고에 허용하는 문장 수. 고치기 전에는 330개 안팎, 고친 뒤 48개 안팎이다. 약간의 여유만 둔다. */
  private static final int MAX_STATEMENTS = 55;

  static final AtomicInteger STATEMENTS = new AtomicInteger();
  static final List<String> SQL = java.util.Collections.synchronizedList(new ArrayList<>());

  @TestConfiguration(proxyBeanMethods = false)
  static class Counting {
    @Bean
    static BeanPostProcessor countingDataSource() {
      return new BeanPostProcessor() {
        @Override
        public Object postProcessAfterInitialization(Object bean, String name) {
          if (bean instanceof DataSource ds) {
            return Proxy.newProxyInstance(
                DataSource.class.getClassLoader(),
                new Class<?>[] {DataSource.class},
                (p, m, args) -> {
                  Object result = invoke(ds, m, args);
                  if (result instanceof Connection c && m.getName().equals("getConnection")) {
                    return countingConnection(c);
                  }
                  return result;
                });
          }
          return bean;
        }
      };
    }

    private static Connection countingConnection(Connection c) {
      return (Connection)
          Proxy.newProxyInstance(
              Connection.class.getClassLoader(),
              new Class<?>[] {Connection.class},
              (p, m, args) -> {
                if (m.getName().startsWith("prepare")) {
                  STATEMENTS.incrementAndGet();
                  SQL.add(String.valueOf(args[0]).replaceAll("\s+", " ").trim());
                }
                return invoke(c, m, args);
              });
    }

    private static Object invoke(Object target, java.lang.reflect.Method m, Object[] args)
        throws Throwable {
      try {
        return m.invoke(target, args);
      } catch (InvocationTargetException e) {
        throw e.getCause();
      }
    }
  }

  @Autowired WebApplicationContext context;

  @Test
  void 투자기의_한_달_보고는_문장_수가_상한_아래다() throws Exception {
    MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).build();
    GameClient client = GameClient.newSession(mvc);
    DocumentContext game = client.startInvesting();
    String gameId = game.read("$.gameId");

    List<Integer> counts = new ArrayList<>();
    List<Long> millis = new ArrayList<>();
    for (int step = 0; step < 200 && counts.size() < 24; step++) {
      Map<String, Object> pending = game.read("$.pendingEvent");
      if (pending != null) {
        String kind = (String) pending.get("kind");
        String option =
            switch (kind) {
              case "NEWS" -> "BUY";
              case "LEVERAGE" -> "PASS";
              default -> GameClient.firstOpen(game);
            };
        Object chosen =
            client.choose(gameId, (String) pending.get("eventId"), option).read("$.game");
        game = JsonPath.parse(chosen);
        continue;
      }
      int day = game.read("$.day", Integer.class);
      Integer next = game.read("$.nextEventDay");
      int target = Math.min(day + 30 - day % 30, next == null ? Integer.MAX_VALUE : next);
      STATEMENTS.set(0);
      SQL.clear();
      long started = System.nanoTime();
      game = client.advance(gameId, target);
      if (target == day + 30 - day % 30) {
        counts.add(STATEMENTS.get());
        millis.add((System.nanoTime() - started) / 1_000_000);
      }
    }
    counts.sort(null);
    millis.sort(null);
    System.out.println("[#194] 한 달 보고 문장 수(정렬): " + counts);
    System.out.println("[#194] 한 달 보고 시간 ms(정렬): " + millis);
    // 넘치면 어떤 문장이 되풀이되는지 보인다(마지막 보고 기준).
    Map<String, Long> grouped = new TreeMap<>();
    SQL.forEach(q -> grouped.merge(q.length() > 110 ? q.substring(0, 110) : q, 1L, Long::sum));
    assertThat(counts).isNotEmpty();
    assertThat(counts.get(counts.size() / 2))
        .as("중앙값. 마지막 보고의 문장: %s", grouped)
        .isLessThanOrEqualTo(MAX_STATEMENTS);
  }
}
