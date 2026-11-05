package investorgame.api;

import investorgame.raising.CompanyService;
import investorgame.raising.CompanySummary;
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
 * 누가 언제 플레이했는지 보는 관리자 플레이 기록. 계정이 없으므로 "누구"는 익명 세션이다 (decisions.md 46번). 회사는 육성 도메인이, 세션은 세션 도메인이
 * 준다. 계약은 contracts/openapi/game.yaml.
 */
@RestController
@RequestMapping("/api/admin")
class AdminController {

  static final String TOKEN_HEADER = "X-Admin-Token";
  private static final int LIMIT = 500;

  private final AdminProperties properties;
  private final SessionService sessions;
  private final CompanyService companies;

  AdminController(AdminProperties properties, SessionService sessions, CompanyService companies) {
    this.properties = properties;
    this.sessions = sessions;
    this.companies = companies;
  }

  @GetMapping("/plays")
  PlayLog plays(@RequestHeader(name = TOKEN_HEADER, required = false) String token) {
    requireAdmin(token);
    // 회사 (decisions.md 228번): 어느 해에서 많이 나가는지 본다.
    List<CompanySummary> companyLines = companies.recent(LIMIT);
    Map<UUID, Long> companiesBySession =
        companyLines.stream()
            .collect(Collectors.groupingBy(CompanySummary::sessionId, Collectors.counting()));
    List<SessionLine> sessionLines =
        sessions.recent(LIMIT).stream()
            .map(
                s ->
                    new SessionLine(
                        s.id(),
                        s.createdAt(),
                        s.lastSeenAt(),
                        companiesBySession.getOrDefault(s.id(), 0L),
                        s.firstIp(),
                        s.lastIp()))
            .toList();
    return new PlayLog(sessionLines, companyLines);
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

  record PlayLog(List<SessionLine> sessions, List<CompanySummary> companies) {}

  /** companies는 최근 회사 목록(최대 500곳) 안에서 센 수다. */
  record SessionLine(
      UUID sessionId,
      OffsetDateTime createdAt,
      OffsetDateTime lastSeenAt,
      long companies,
      String firstIp,
      String lastIp) {}
}
