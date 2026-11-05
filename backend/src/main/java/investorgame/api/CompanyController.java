package investorgame.api;

import investorgame.raising.CompanyService;
import investorgame.raising.CompanyView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 증권사 (증권사 육성 설계 4·6·9절, decisions.md 228번). 요청을 육성 도메인에 넘기기만 한다. 계약은 contracts/openapi/game.yaml.
 */
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

  /** 사장의 사재로 첫 회사를 차린다 (decisions.md 228번). 회사가 이미 있으면 400. */
  @PostMapping
  ResponseEntity<CompanyView> open(
      @CookieValue(name = SessionCookies.NAME, required = false) String token) {
    UUID sessionId = cookies.requireSession(token);
    CompanyView company = companies.open(sessionId);
    PLAY.info(
        "company-open session={} company={} ip={}",
        sessionId,
        company.companyId(),
        ClientIp.current());
    return ResponseEntity.status(HttpStatus.CREATED).body(company);
  }

  /** 계약금을 내고 공채 시장의 지원자를 뽑는다. 자리가 꽉 찼으면 replace의 직원을 내보낸다. */
  @PostMapping("/hires")
  CompanyView hire(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody HireRequest request) {
    UUID sessionId = cookies.requireSession(token);
    CompanyView company = companies.hire(sessionId, request.applicantId(), request.replace());
    PLAY.info(
        "company-hire session={} company={} applicant={} replace={} ip={}",
        sessionId,
        company.companyId(),
        request.applicantId(),
        request.replace(),
        ClientIp.current());
    return company;
  }

  /** 값을 내고 올해 지원자를 새로 받는다. */
  @PostMapping("/applicants/refresh")
  CompanyView refreshApplicants(
      @CookieValue(name = SessionCookies.NAME, required = false) String token) {
    return companies.refreshApplicants(cookies.requireSession(token));
  }

  /** 올해 투자 회의에서 고른다: BUY·SELL·HOLD (decisions.md 229번). */
  @PostMapping("/invest")
  CompanyView invest(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody InvestRequest request) {
    UUID sessionId = cookies.requireSession(token);
    CompanyView company = companies.invest(sessionId, request.choice());
    PLAY.info(
        "company-invest session={} company={} year={} choice={} ip={}",
        sessionId,
        company.companyId(),
        company.year(),
        request.choice(),
        ClientIp.current());
    return company;
  }

  record InvestRequest(@NotBlank String choice) {}

  record SettleRequest(@NotNull @Positive Integer year) {}

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

  /** 올해 결산. 요청에 결산할 해를 싣는다: 같은 결산이 두 번 와도 한 해만 넘어간다 (decisions.md 234번). */
  @PostMapping("/settle")
  CompanyView settle(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody SettleRequest request) {
    UUID sessionId = cookies.requireSession(token);
    CompanyView company = companies.settle(sessionId, request.year());
    PLAY.info(
        "company-settle session={} company={} year={} capital={} grade={} ip={}",
        sessionId,
        company.companyId(),
        request.year(),
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

  /** replace는 자리가 꽉 찼을 때 내보낼 직원 ID. */
  record HireRequest(@NotNull Integer applicantId, Integer replace) {}

  record PlacementRequest(@NotNull List<@Valid Seat> seats) {}

  /** desk가 null이면 쉰다. */
  record Seat(@NotNull Integer employeeId, String desk) {}
}
