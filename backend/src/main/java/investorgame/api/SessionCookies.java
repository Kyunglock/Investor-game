package investorgame.api;

import investorgame.session.SessionProperties;
import investorgame.session.SessionService;
import java.util.UUID;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/** 세션 토큰은 HttpOnly 쿠키로만 주고받는다 (decisions.md 9번). */
@Component
class SessionCookies {

  static final String NAME = "IG_SESSION";

  private final SessionService sessions;
  private final SessionProperties properties;

  SessionCookies(SessionService sessions, SessionProperties properties) {
    this.sessions = sessions;
    this.properties = properties;
  }

  /** 쿠키가 없거나 만료되었으면 401로 바뀌는 예외를 던진다. */
  UUID requireSession(String token) {
    if (token == null || token.isBlank()) {
      throw new UnauthorizedException();
    }
    return sessions.resolve(token, ClientIp.current()).orElseThrow(UnauthorizedException::new);
  }

  ResponseCookie create(String token) {
    return ResponseCookie.from(NAME, token)
        .httpOnly(true)
        .secure(properties.cookieSecure())
        .sameSite("Lax")
        .path("/")
        .maxAge(properties.ttl())
        .build();
  }
}
