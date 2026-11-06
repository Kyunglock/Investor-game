package investorgame.session;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param ttl 마지막 접속 후 세션이 유지되는 시간
 * @param cookieSecure 쿠키에 Secure를 붙일지. 운영은 항상 true
 * @param cookieSameSite 쿠키의 SameSite. 웹은 Lax. 안드로이드 앱이 화면을 앱 안에 담아 다른 출처에서 API를 부를 때만 None
 *     (decisions.md 306번, docs/app.md). None이면 Secure도 켜야 브라우저가 받는다
 */
@ConfigurationProperties("session")
public record SessionProperties(Duration ttl, boolean cookieSecure, String cookieSameSite) {}
