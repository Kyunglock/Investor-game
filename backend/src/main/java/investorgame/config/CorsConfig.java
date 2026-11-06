package investorgame.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 다른 출처에서 /api를 부르도록 여는 CORS (decisions.md 306번, docs/app.md). 웹은 화면과 API가 같은 출처라 쓰지 않는다. 안드로이드 앱이
 * 화면을 앱 안에 담아 https://localhost 출처에서 부를 때만 {@code api.cors.origins}에 그 출처를 둔다. 세션 쿠키가 오가야 하므로 자격
 * 증명을 허용하고, 그래서 와일드카드(*)가 아닌 정확한 출처만 받는다.
 */
@Configuration(proxyBeanMethods = false)
class CorsConfig implements WebMvcConfigurer {

  private final List<String> origins;

  CorsConfig(@Value("${api.cors.origins:}") String origins) {
    this.origins =
        Arrays.stream(origins.split(",")).map(String::trim).filter(o -> !o.isEmpty()).toList();
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    if (origins.isEmpty()) {
      return;
    }
    registry
        .addMapping("/api/**")
        .allowedOrigins(origins.toArray(String[]::new))
        .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        .allowedHeaders("*")
        .allowCredentials(true)
        .maxAge(3600);
  }
}
