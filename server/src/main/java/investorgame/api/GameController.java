package investorgame.api;

import investorgame.progress.ChoiceOutcome;
import investorgame.progress.GameView;
import investorgame.progress.ProgressService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 요청을 진행 도메인에 넘기기만 한다. 응답은 진행의 화면용 타입을 그대로 쓰며, 그 타입에는 숨은 값이 없다. 계약은 contracts/openapi/game.yaml.
 */
@RestController
@RequestMapping("/api/games")
class GameController {

  private final ProgressService progress;
  private final SessionCookies cookies;

  GameController(ProgressService progress, SessionCookies cookies) {
    this.progress = progress;
    this.cookies = cookies;
  }

  @PostMapping
  ResponseEntity<GameView> start(
      @CookieValue(name = SessionCookies.NAME, required = false) String token) {
    UUID sessionId = cookies.requireSession(token);
    return ResponseEntity.status(HttpStatus.CREATED).body(progress.start(sessionId));
  }

  @GetMapping("/current")
  ResponseEntity<GameView> current(
      @CookieValue(name = SessionCookies.NAME, required = false) String token) {
    return ResponseEntity.of(progress.current(cookies.requireSession(token)));
  }

  @PostMapping("/{gameId}/advance")
  GameView advance(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID gameId,
      @Valid @RequestBody AdvanceRequest request) {
    return progress.advance(cookies.requireSession(token), gameId, request.day());
  }

  @PostMapping("/{gameId}/events/{eventId}/choose")
  ChoiceOutcome choose(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID gameId,
      @PathVariable UUID eventId,
      @Valid @RequestBody ChoiceRequest request) {
    return progress.choose(cookies.requireSession(token), gameId, eventId, request.option());
  }

  record AdvanceRequest(@Min(0) int day) {}

  record ChoiceRequest(@NotBlank String option) {}
}
