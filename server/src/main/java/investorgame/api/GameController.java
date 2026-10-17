package investorgame.api;

import investorgame.common.Stats;
import investorgame.progress.GameView;
import investorgame.progress.ProgressService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
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

/** 요청·응답 변환만 한다. 규칙 판단은 진행 도메인에 있다. 계약은 contracts/openapi/game.yaml. */
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
  ResponseEntity<GameResponse> start(
      @CookieValue(name = SessionCookies.NAME, required = false) String token) {
    UUID sessionId = cookies.requireSession(token);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(GameResponse.from(progress.start(sessionId)));
  }

  @GetMapping("/current")
  ResponseEntity<GameResponse> current(
      @CookieValue(name = SessionCookies.NAME, required = false) String token) {
    UUID sessionId = cookies.requireSession(token);
    return ResponseEntity.of(progress.current(sessionId).map(GameResponse::from));
  }

  @PostMapping("/{gameId}/advance")
  GameResponse advance(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID gameId,
      @Valid @RequestBody AdvanceRequest request) {
    UUID sessionId = cookies.requireSession(token);
    return GameResponse.from(progress.advance(sessionId, gameId, request.day()));
  }

  record AdvanceRequest(@Min(0) int day) {}

  record StatsResponse(int insight, int patience, int courage, int conviction, int luck) {
    static StatsResponse from(Stats stats) {
      return new StatsResponse(
          stats.insight(), stats.patience(), stats.courage(), stats.conviction(), stats.luck());
    }
  }

  record GameResponse(
      UUID gameId,
      String phase,
      int lastReportedDay,
      int startAge,
      int endAge,
      int daysPerYear,
      StatsResponse stats,
      long cash) {
    static GameResponse from(GameView view) {
      return new GameResponse(
          view.gameId(),
          view.phase().name(),
          view.lastReportedDay(),
          view.startAge(),
          view.endAge(),
          view.daysPerYear(),
          StatsResponse.from(view.stats()),
          view.cash());
    }
  }
}
