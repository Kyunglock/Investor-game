package investorgame.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 기록용 시각(created_at, 세션 만료)에만 쓴다. 게임 시각은 클라이언트가 보고한 값으로 계산한다. */
@Configuration(proxyBeanMethods = false)
class TimeConfig {

  @Bean
  Clock clock() {
    return Clock.systemUTC();
  }
}
