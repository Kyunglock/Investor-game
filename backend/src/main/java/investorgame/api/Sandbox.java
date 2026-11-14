package investorgame.api;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.util.WebUtils;

/**
 * 테스트판 (decisions.md 499번). 코드를 넣은 플레이어는 본 게임과 따로 테스트판 회사를 가진다: 테스트판 쿠키가 있는 동안 회사 요청은 세션 ID에서 만든 다른
 * ID로 가서, 본 게임의 회사는 건드리지 않는다. 쿠키 값은 코드로 서명한 세션 ID라 코드를 모르면 만들 수 없고 다른 세션에는 통하지 않는다.
 */
@Component
class Sandbox {

  static final String COOKIE = "IG_SANDBOX";

  private final SandboxProperties properties;
  private final investorgame.session.SessionProperties session;

  Sandbox(SandboxProperties properties, investorgame.session.SessionProperties session) {
    this.properties = properties;
    this.session = session;
  }

  boolean enabled() {
    return properties.code() != null && !properties.code().isBlank();
  }

  boolean matches(String code) {
    return enabled()
        && code != null
        && MessageDigest.isEqual(
            properties.code().getBytes(StandardCharsets.UTF_8),
            code.getBytes(StandardCharsets.UTF_8));
  }

  /** 회사 요청이 쓸 ID: 이 요청에 이 세션의 테스트판 쿠키가 있으면 테스트판 ID, 아니면 세션 ID 그대로. */
  UUID player(UUID sessionId) {
    if (!enabled()
        || !(RequestContextHolder.getRequestAttributes()
            instanceof ServletRequestAttributes attrs)) {
      return sessionId;
    }
    var cookie = WebUtils.getCookie(attrs.getRequest(), COOKIE);
    if (cookie == null || cookie.getValue() == null) return sessionId;
    boolean signed =
        MessageDigest.isEqual(
            sign(sessionId).getBytes(StandardCharsets.UTF_8),
            cookie.getValue().getBytes(StandardCharsets.UTF_8));
    if (!signed) return sessionId;
    // 세션 쿠키처럼 쓸 때마다 만료를 새로 건다: 테스트판 앱을 매일 열어도 코드를 다시 묻지 않는다.
    if (attrs.getResponse() != null) {
      attrs.getResponse().addHeader(HttpHeaders.SET_COOKIE, enter(sessionId).toString());
    }
    return id(sessionId);
  }

  /** 테스트판 회사가 매달리는 ID. 세션마다 하나로 정해진다. */
  UUID id(UUID sessionId) {
    return UUID.nameUUIDFromBytes(("sandbox:" + sessionId).getBytes(StandardCharsets.UTF_8));
  }

  ResponseCookie enter(UUID sessionId) {
    return cookie(sign(sessionId), session.ttl().toSeconds());
  }

  ResponseCookie leave() {
    return cookie("", 0);
  }

  private ResponseCookie cookie(String value, long seconds) {
    return ResponseCookie.from(COOKIE, value)
        .httpOnly(true)
        .secure(session.cookieSecure())
        .sameSite(session.cookieSameSite())
        .path("/")
        .maxAge(seconds)
        .build();
  }

  private String sign(UUID sessionId) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(properties.code().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return HexFormat.of()
          .formatHex(mac.doFinal(sessionId.toString().getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.GeneralSecurityException e) {
      throw new IllegalStateException(e);
    }
  }
}
