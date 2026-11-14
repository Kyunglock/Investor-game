package investorgame.api;

import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.raising.CompanyService;
import investorgame.raising.CompanyView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 테스트 체험판에 들어가고 나온다 (decisions.md 499번). 계약은 contracts/openapi/game.yaml. */
@RestController
@RequestMapping("/api/sandbox")
class SandboxController {

  private final Sandbox sandbox;
  private final SessionCookies cookies;
  private final CompanyService companies;

  SandboxController(Sandbox sandbox, SessionCookies cookies, CompanyService companies) {
    this.sandbox = sandbox;
    this.cookies = cookies;
    this.companies = companies;
  }

  /** 코드가 맞으면 체험판 쿠키를 심고 체험판 회사를 돌려준다. 꺼져 있으면 404, 코드가 틀리면 400. */
  @PostMapping
  ResponseEntity<CompanyView> enter(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody EnterRequest request) {
    if (!sandbox.enabled()) throw new NotFoundException("체험판이 꺼져 있다");
    UUID sessionId = cookies.requireSession(token);
    if (!sandbox.matches(request.code())) throw new InvalidRequestException("코드가 맞지 않다");
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, sandbox.enter(sessionId).toString())
        .body(companies.sandbox(sandbox.id(sessionId)));
  }

  /** 체험판 쿠키를 지운다: 다음 요청부터 본 게임의 회사다. 체험판 회사는 남아 다시 들어오면 이어진다. */
  @DeleteMapping
  ResponseEntity<Void> leave() {
    return ResponseEntity.noContent()
        .header(HttpHeaders.SET_COOKIE, sandbox.leave().toString())
        .build();
  }

  record EnterRequest(@NotBlank @Size(max = 100) String code) {}
}
