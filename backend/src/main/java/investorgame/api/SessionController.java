package investorgame.api;

import investorgame.session.IssuedSession;
import investorgame.session.SessionService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sessions")
class SessionController {

  private final SessionService sessions;
  private final SessionCookies cookies;

  SessionController(SessionService sessions, SessionCookies cookies) {
    this.sessions = sessions;
    this.cookies = cookies;
  }

  /** 유효한 세션 쿠키가 있으면 그대로 두고, 없으면 새 세션을 발급한다. */
  @PostMapping
  ResponseEntity<Void> ensure(
      @CookieValue(name = SessionCookies.NAME, required = false) String token) {
    String ip = ClientIp.current();
    if (token != null && sessions.resolve(token, ip).isPresent()) {
      return ResponseEntity.noContent().build();
    }
    IssuedSession issued = sessions.issue(ip);
    return ResponseEntity.noContent()
        .header(HttpHeaders.SET_COOKIE, cookies.create(issued.token()).toString())
        .build();
  }
}
