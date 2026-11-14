package investorgame.api;

import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.raising.CompanyService;
import investorgame.raising.CompanyView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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

/** 테스트판에 들어가고 나온다 (decisions.md 499번). 계약은 contracts/openapi/game.yaml. */
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

  /** 코드가 맞으면 테스트판 쿠키를 심고 테스트판 회사를 돌려준다. 꺼져 있으면 404, 코드가 틀리면 400. */
  @PostMapping
  ResponseEntity<CompanyView> enter(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody EnterRequest request) {
    if (!sandbox.enabled()) throw new NotFoundException("테스트판이 꺼져 있다");
    UUID sessionId = cookies.requireSession(token);
    if (!sandbox.tryCode(request.code())) throw new InvalidRequestException("코드가 맞지 않다");
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, sandbox.enter(sessionId).toString())
        .body(companies.sandbox(sandbox.id(sessionId)));
  }

  /** 테스트판 쿠키를 지운다: 다음 요청부터 본 게임의 회사다. 테스트판 회사는 남아 다시 들어오면 이어진다. */
  @DeleteMapping
  ResponseEntity<Void> leave() {
    return ResponseEntity.noContent()
        .header(HttpHeaders.SET_COOKIE, sandbox.leave().toString())
        .build();
  }

  /** 테스트판 회사를 고른 매도벽 앞으로 옮긴다. 테스트판에 들어와 있지 않으면 400. */
  @PostMapping("/wall")
  CompanyView wall(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody WallRequest request) {
    return companies.sandboxWall(cookies.requirePlayer(token), request.wall());
  }

  /** 테스트판 회사를 처음부터 새로 차린다. 테스트판에 들어와 있지 않으면 400. */
  @PostMapping("/reset")
  CompanyView reset(@CookieValue(name = SessionCookies.NAME, required = false) String token) {
    return companies.sandboxReset(cookies.requirePlayer(token));
  }

  /** 무한 지갑을 켜고 끈다. */
  @PostMapping("/wallet")
  CompanyView wallet(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody WalletRequest request) {
    return companies.sandboxWallet(cookies.requirePlayer(token), request.infinite());
  }

  /** 고양이 여섯을 모두 그 레벨로 준다. */
  @PostMapping("/cats")
  CompanyView cats(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody CatsRequest request) {
    return companies.sandboxCats(cookies.requirePlayer(token), request.level());
  }

  /** 그 등급의 무기를 주고 사장냥이 든다. */
  @PostMapping("/weapon")
  CompanyView weapon(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody WeaponRequest request) {
    return companies.sandboxWeapon(cookies.requirePlayer(token), request.grade());
  }

  record WalletRequest(boolean infinite) {}

  record CatsRequest(@Min(1) @Max(1000) int level) {}

  record WeaponRequest(@NotBlank @Size(max = 4) String grade) {}

  record WallRequest(@Min(1) @Max(100_000) long wall) {}

  record EnterRequest(@NotBlank @Size(max = 100) String code) {}
}
