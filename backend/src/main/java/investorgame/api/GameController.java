package investorgame.api;

import investorgame.common.Action;
import investorgame.progress.ChoiceOutcome;
import investorgame.progress.GameView;
import investorgame.progress.MarketOverview;
import investorgame.progress.ProgressService;
import investorgame.progress.StockAnalysis;
import investorgame.progress.StockHistory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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

/**
 * 요청을 진행 도메인에 넘기기만 한다. 응답은 진행의 화면용 타입을 그대로 쓰며, 그 타입에는 숨은 값이 없다. 계약은 contracts/openapi/game.yaml.
 */
@RestController
@RequestMapping("/api/games")
class GameController {

  /** 누가 어디까지 했는지 보는 플레이 로그: 시작, 첫 직업, 끝 (decisions.md 63번). */
  private static final Logger PLAY = LoggerFactory.getLogger("investorgame.play");

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
    GameView game = progress.start(sessionId);
    PLAY.info("start session={} game={} ip={}", sessionId, game.gameId(), ClientIp.current());
    return ResponseEntity.status(HttpStatus.CREATED).body(game);
  }

  /** 끝난 판이면 한 줄 남긴다. */
  private static void logIfEnded(UUID sessionId, GameView game) {
    if (game.status() == GameView.Status.ENDED) {
      PLAY.info(
          "end session={} game={} ip={} age={} totalAsset={}",
          sessionId,
          game.gameId(),
          ClientIp.current(),
          game.startAge() + game.day() / game.daysPerYear(),
          game.totalAsset());
    }
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
    UUID sessionId = cookies.requireSession(token);
    GameView game = progress.advance(sessionId, gameId, request.day());
    logIfEnded(sessionId, game);
    return game;
  }

  @PostMapping("/{gameId}/events/{eventId}/choose")
  ChoiceOutcome choose(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID gameId,
      @PathVariable UUID eventId,
      @Valid @RequestBody ChoiceRequest request) {
    UUID sessionId = cookies.requireSession(token);
    ChoiceOutcome result =
        progress.choose(sessionId, gameId, eventId, request.option(), request.quantity());
    // 중간 진행도는 직업을 가진 시점: 직업 선택 결과로 직업이 생겼을 때 (decisions.md 63번).
    if ("JOB".equals(result.outcome().kind()) && result.game().job() != null) {
      PLAY.info(
          "job session={} game={} ip={} job={} age={}",
          sessionId,
          gameId,
          ClientIp.current(),
          result.game().job().title(),
          result.game().startAge() + result.game().day() / result.game().daysPerYear());
    }
    logIfEnded(sessionId, result.game());
    return result;
  }

  /** 투자 인생을 여기서 끝낸다 (decisions.md 68번). */
  @PostMapping("/{gameId}/quit")
  GameView quit(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID gameId) {
    UUID sessionId = cookies.requireSession(token);
    GameView game = progress.quit(sessionId, gameId);
    logIfEnded(sessionId, game);
    return game;
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

  /** 주담대를 현금으로 일시 상환한다 (decisions.md 58번). */
  @PostMapping("/{gameId}/homes/{seq}/repay")
  GameView repayMortgage(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID gameId,
      @PathVariable int seq,
      @Valid @RequestBody RepayRequest request) {
    return progress.repayMortgage(cookies.requireSession(token), gameId, seq, request.amount());
  }

  @GetMapping("/{gameId}/stocks/{stockCode}/history")
  StockHistory history(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID gameId,
      @PathVariable String stockCode) {
    return progress.history(cookies.requireSession(token), gameId, stockCode);
  }

  /** 시황: 거시 지표·경제 신문·안목 해석. 이 달의 해석이 없으면 여기서 정해져 저장된다 (매매창 설계 2.2절). */
  @GetMapping("/{gameId}/market/overview")
  MarketOverview overview(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID gameId) {
    return progress.overview(cookies.requireSession(token), gameId);
  }

  /** 한 종목의 추세 사실과 안목 해석 (매매창 설계 2.1절). */
  @GetMapping("/{gameId}/stocks/{stockCode}/analysis")
  StockAnalysis analysis(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID gameId,
      @PathVariable String stockCode) {
    return progress.analysis(cookies.requireSession(token), gameId, stockCode);
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
  record RepayRequest(@Min(1) long amount) {}

  record ChoiceRequest(@NotBlank String option, @Min(1) @Max(MAX_TRADE_QUANTITY) Long quantity) {}
}
