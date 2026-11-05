package investorgame.api;

import investorgame.raising.CompanyService;
import investorgame.raising.CompanyView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 아주 작은 회사 (증권사 육성 설계 4·6절). 요청을 육성 도메인에 넘기기만 한다. 계약은 contracts/openapi/game.yaml. */
@RestController
@RequestMapping("/api/company")
class CompanyController {

  private static final Logger PLAY = LoggerFactory.getLogger("investorgame.play");

  private final CompanyService companies;
  private final SessionCookies cookies;

  CompanyController(CompanyService companies, SessionCookies cookies) {
    this.companies = companies;
    this.cookies = cookies;
  }

  @GetMapping
  ResponseEntity<CompanyView> current(
      @CookieValue(name = SessionCookies.NAME, required = false) String token) {
    return ResponseEntity.of(companies.current(cookies.requireSession(token)));
  }

  @PostMapping("/hires")
  CompanyView hire(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody HireRequest request) {
    UUID sessionId = cookies.requireSession(token);
    CompanyView company =
        companies.hire(sessionId, request.runId(), request.register(), request.replace());
    PLAY.info(
        "company-hire session={} company={} run={} register={} ip={}",
        sessionId,
        company.companyId(),
        request.runId(),
        request.register(),
        ClientIp.current());
    return company;
  }

  @PostMapping("/placement")
  CompanyView place(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody PlacementRequest request) {
    Map<Integer, String> placements = new HashMap<>();
    for (Seat seat : request.seats()) {
      placements.put(seat.employeeId(), seat.desk());
    }
    return companies.place(cookies.requireSession(token), placements);
  }

  @PostMapping("/settle")
  CompanyView settle(@CookieValue(name = SessionCookies.NAME, required = false) String token) {
    UUID sessionId = cookies.requireSession(token);
    CompanyView company = companies.settle(sessionId);
    PLAY.info(
        "company-settle session={} company={} year={} capital={} grade={} ip={}",
        sessionId,
        company.companyId(),
        company.year() - 1,
        company.capital(),
        company.grade(),
        ClientIp.current());
    return company;
  }

  /** 회사를 팔고 다음 회사를 차린다 (증권사 육성 설계 9절). 돌려주는 값은 새 회사다. */
  @PostMapping("/sale")
  CompanyView sell(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody SaleRequest request) {
    UUID sessionId = cookies.requireSession(token);
    CompanyView company = companies.sell(sessionId, request.cofounders());
    PLAY.info(
        "company-sale session={} next={} number={} fame={} ip={}",
        sessionId,
        company.companyId(),
        company.number(),
        company.owner().fameGrade(),
        ClientIp.current());
    return company;
  }

  /** 데려갈 공동창업자 직원 ID. */
  record SaleRequest(@NotNull List<@NotNull Integer> cofounders) {}

  /** register가 거짓이면 돌려보낸다. 자리가 꽉 찼으면 replace의 직원과 바꾼다. */
  record HireRequest(@NotNull UUID runId, boolean register, Integer replace) {}

  record PlacementRequest(@NotNull List<@Valid Seat> seats) {}

  /** desk가 null이면 쉰다. */
  record Seat(@NotNull Integer employeeId, String desk) {}
}
