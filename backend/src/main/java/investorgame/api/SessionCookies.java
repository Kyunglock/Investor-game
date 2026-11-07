package investorgame.api;

import investorgame.session.SessionProperties;
import investorgame.session.SessionService;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

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

  /**
   * 쿠키가 없거나 만료되었으면 401로 바뀌는 예외를 던진다. 유효하면 쿠키를 다시 내려 마지막 접속부터 ttl이 새로 흐르게 한다 (decisions.md 311번).
   * 전에는 처음 발급할 때만 쿠키를 심어 매일 들어와도 첫 발급 하루 뒤에 브라우저가 쿠키를 지웠다.
   */
  UUID requireSession(String token) {
    if (token == null || token.isBlank()) {
      throw new UnauthorizedException();
    }
    UUID id = sessions.resolve(token, ClientIp.current()).orElseThrow(UnauthorizedException::new);
    renew(token);
    return id;
  }

  /** 세션이 있으면 그 ID, 쿠키가 없거나 만료되었으면 빈 값. 유효하면 쿠키를 다시 내린다 (#346: 회사가 없는 첫 방문은 401이 아니다). */
  Optional<UUID> session(String token) {
    if (token == null || token.isBlank()) {
      return Optional.empty();
    }
    Optional<UUID> id = sessions.resolve(token, ClientIp.current());
    id.ifPresent(x -> renew(token));
    return id;
  }

  /** 지금 응답에 같은 토큰의 쿠키를 새 만료로 다시 싣는다. 요청 밖(테스트 등)이면 아무것도 하지 않는다. */
  void renew(String token) {
    if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs
        && attrs.getResponse() != null) {
      attrs.getResponse().addHeader(HttpHeaders.SET_COOKIE, create(token).toString());
    }
  }

  ResponseCookie create(String token) {
    return ResponseCookie.from(NAME, token)
        .httpOnly(true)
        .secure(properties.cookieSecure())
        .sameSite(properties.cookieSameSite())
        .path("/")
        .maxAge(properties.ttl())
        .build();
  }
}
