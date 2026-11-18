package investorgame.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 다른 출처(외부 앱)가 세션 쿠키를 실어 API를 부를 수 있게 허용한다. 허용 출처가 비어 있으면 아무것도 열지 않는다. 쿠키를 싣는 요청이라 와일드카드 `*`는 쓸 수
 * 없고 출처를 하나씩 적는다.
 */
@Configuration(proxyBeanMethods = false)
class CorsConfig implements WebMvcConfigurer {

  private final List<String> allowedOrigins;

  CorsConfig(@Value("${cors.allowed-origins:}") List<String> allowedOrigins) {
    this.allowedOrigins =
        allowedOrigins.stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    if (allowedOrigins.isEmpty()) {
      return;
    }
    registry
        .addMapping("/api/**")
        .allowedOrigins(allowedOrigins.toArray(String[]::new))
        .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        .allowedHeaders("*")
        .allowCredentials(true)
        .maxAge(3600);
  }
}
