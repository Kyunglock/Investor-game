package investorgame.api;

import investorgame.progress.GameSummary;
import investorgame.progress.ProgressService;
import investorgame.session.SessionService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 누가 언제 플레이했는지 보는 관리자 플레이 기록. 계정이 없으므로 "누구"는 익명 세션이다 (decisions.md 46번). 판과 결과는 진행이 합쳐 주고, 세션은 세션
 * 도메인에서 읽는다. 계약은 contracts/openapi/game.yaml.
 */
@RestController
@RequestMapping("/api/admin")
class AdminController {

  static final String TOKEN_HEADER = "X-Admin-Token";
  private static final int LIMIT = 500;

  private final AdminProperties properties;
  private final SessionService sessions;
  private final ProgressService progress;

  AdminController(AdminProperties properties, SessionService sessions, ProgressService progress) {
    this.properties = properties;
    this.sessions = sessions;
    this.progress = progress;
  }

  @GetMapping("/plays")
  PlayLog plays(@RequestHeader(name = TOKEN_HEADER, required = false) String token) {
    requireAdmin(token);
    List<GameSummary> games = progress.recentGames(LIMIT);
    Map<UUID, Long> gamesBySession =
        games.stream()
            .collect(Collectors.groupingBy(GameSummary::sessionId, Collectors.counting()));
    List<SessionLine> sessionLines =
        sessions.recent(LIMIT).stream()
            .map(
                s ->
                    new SessionLine(
                        s.id(),
                        s.createdAt(),
                        s.lastSeenAt(),
                        gamesBySession.getOrDefault(s.id(), 0L)))
            .toList();
    return new PlayLog(sessionLines, games);
  }

  private void requireAdmin(String token) {
    String expected = properties.token();
    if (expected == null || expected.isBlank() || token == null) {
      throw new AdminForbiddenException();
    }
    // 응답 시간 차로 토큰을 한 글자씩 알아낼 수 없게 상수 시간으로 비교한다.
    if (!MessageDigest.isEqual(
        expected.getBytes(StandardCharsets.UTF_8), token.getBytes(StandardCharsets.UTF_8))) {
      throw new AdminForbiddenException();
    }
  }

  record PlayLog(List<SessionLine> sessions, List<GameSummary> plays) {}

  /** games는 최근 판 목록(최대 500판) 안에서 센 수다. */
  record SessionLine(
      UUID sessionId, OffsetDateTime createdAt, OffsetDateTime lastSeenAt, long games) {}
}
