package investorgame.api;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** 지금 요청을 보낸 클라이언트 IP. 프록시 뒤면 X-Forwarded-For의 첫 주소 (decisions.md 63번). 요청 밖(테스트 등)이면 null. */
final class ClientIp {

  private ClientIp() {}

  static String current() {
    if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) {
      return null;
    }
    return of(attrs.getRequest());
  }

  static String of(HttpServletRequest request) {
    String forwarded = request.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) {
      return forwarded.split(",")[0].trim();
    }
    return request.getRemoteAddr();
  }
}
