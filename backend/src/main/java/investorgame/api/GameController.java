package investorgame.api;

import investorgame.common.Action;
import investorgame.progress.ChoiceOutcome;
import investorgame.progress.GameView;
import investorgame.progress.ProgressService;
import investorgame.progress.StockHistory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
    return progress.choose(
        cookies.requireSession(token), gameId, eventId, request.option(), request.quantity());
  }

  @PostMapping("/{gameId}/trades")
  ChoiceOutcome trade(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID gameId,
      @Valid @RequestBody TradeRequest request) {
    return progress.trade(
        cookies.requireSession(token),
        gameId,
        request.stockCode(),
        request.side(),
        request.quantity());
  }

  /** 가진 아파트를 매물로 내놓거나 거둔다. 내놓아도 바로 팔리지 않고 매수자가 나와야 팔린다 (주거 설계 3절). */
  @PostMapping("/{gameId}/homes/{seq}/listing")
  GameView listHome(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID gameId,
      @PathVariable int seq,
      @Valid @RequestBody ListingRequest request) {
    return progress.listHome(cookies.requireSession(token), gameId, seq, request.listed());
  }

  @GetMapping("/{gameId}/stocks/{stockCode}/history")
  StockHistory history(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID gameId,
      @PathVariable String stockCode) {
    return progress.history(cookies.requireSession(token), gameId, stockCode);
  }

  record AdvanceRequest(@Min(0) int day) {}

  record ListingRequest(boolean listed) {}

  /** 한 번에 주문할 수 있는 최대 수량. 계약(TradeRequest.quantity.maximum)과 같은 값이다. */
  static final long MAX_TRADE_QUANTITY = 1_000_000_000L;

  /** side는 BUY 또는 SELL. HOLD는 진행이 400으로 거절한다. */
  record TradeRequest(
      @NotBlank String stockCode,
      @NotNull Action side,
      @Min(1) @Max(MAX_TRADE_QUANTITY) long quantity) {}

  /** quantity는 뉴스의 매수·매도 수량. 생략하면 서버 기본(매수는 현금의 일정 비율, 매도는 전량). */
  record ChoiceRequest(@NotBlank String option, @Min(1) @Max(MAX_TRADE_QUANTITY) Long quantity) {}
}
