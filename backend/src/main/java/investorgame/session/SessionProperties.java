package investorgame.session;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param ttl 마지막 접속 후 세션이 유지되는 시간
 * @param cookieSecure 쿠키에 Secure를 붙일지. 운영은 항상 true
 */
@ConfigurationProperties("session")
public record SessionProperties(Duration ttl, boolean cookieSecure) {}
