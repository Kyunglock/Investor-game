package investorgame.api;

import investorgame.raising.RaisingService;
import investorgame.raising.RunChoice;
import investorgame.raising.RunView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 3분 육성 한 판 (증권사 육성 설계 3절). 요청을 육성 도메인에 넘기기만 한다. 계약은 contracts/openapi/game.yaml. */
@RestController
@RequestMapping("/api/runs")
class RunController {

  private static final Logger PLAY = LoggerFactory.getLogger("investorgame.play");

  private final RaisingService raising;
  private final SessionCookies cookies;

  RunController(RaisingService raising, SessionCookies cookies) {
    this.raising = raising;
    this.cookies = cookies;
  }

  @PostMapping
  ResponseEntity<RunView> start(
      @CookieValue(name = SessionCookies.NAME, required = false) String token) {
    UUID sessionId = cookies.requireSession(token);
    RunView run = raising.start(sessionId);
    PLAY.info(
        "run-start session={} run={} scripted={} ip={}",
        sessionId,
        run.runId(),
        run.scripted(),
        ClientIp.current());
    return ResponseEntity.status(HttpStatus.CREATED).body(run);
  }

  @GetMapping("/current")
  ResponseEntity<RunView> current(
      @CookieValue(name = SessionCookies.NAME, required = false) String token) {
    return ResponseEntity.of(raising.current(cookies.requireSession(token)));
  }

  /** 어느 카드에서 많이 나가는지 보려고 카드마다 한 줄 남긴다 (증권사 육성 설계 11.5절). */
  @PostMapping("/{runId}/choose")
  RunChoice choose(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID runId,
      @Valid @RequestBody ChooseRequest request) {
    UUID sessionId = cookies.requireSession(token);
    RunChoice result = raising.choose(sessionId, runId, request.card(), request.option());
    PLAY.info(
        "run-card session={} run={} card={} kind={} chosen={} actual={} ip={}",
        sessionId,
        runId,
        request.card(),
        result.outcome().kind(),
        result.outcome().chosen(),
        result.outcome().actual(),
        ClientIp.current());
    if (result.run().status() == RunView.Status.ENDED) {
      PLAY.info(
          "run-end session={} run={} grade={} totalAsset={} ip={}",
          sessionId,
          runId,
          result.run().overallGrade(),
          result.run().totalAsset(),
          ClientIp.current());
    }
    return result;
  }

  record ChooseRequest(@Min(0) int card, @NotBlank String option) {}
}
