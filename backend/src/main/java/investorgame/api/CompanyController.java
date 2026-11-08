package investorgame.api;

import investorgame.common.error.InvalidRequestException;
import investorgame.raising.CompanyService;
import investorgame.raising.CompanyView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
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
    // 세션이 없거나 만료된 첫 방문도 "회사가 없다"(404)다 (#346): 전에는 401이 콘솔과 운영 로그에 찍혔다.
    return ResponseEntity.of(cookies.session(token).flatMap(companies::current));
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

  /**
   * 채용권으로 count명을 뽑는다 (decisions.md 312번). 요청에 지금까지 뽑은 횟수(draws)를 싣는다: 이미 한 뽑기면 아무것도 하지 않고, 아직 오지
   * 않은 뽑기면 400. 두 번 눌리거나 끊긴 요청을 다시 보내도 한 번만 뽑는다 (254번과 같은 방식).
   */
  @PostMapping("/draws")
  CompanyView draw(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody DrawRequest request) {
    UUID sessionId = cookies.requireSession(token);
    CompanyView company = companies.draw(sessionId, request.count(), request.draws());
    PLAY.info(
        "company-draw session={} company={} count={} ip={}",
        sessionId,
        company.companyId(),
        request.count(),
        ClientIp.current());
    return company;
  }

  record DrawRequest(@NotNull @Positive Integer count, @NotNull @PositiveOrZero Integer draws) {}

  /** 같은 등급 직원을 합쳐 바탕 한 명을 한 단계 올린다 (decisions.md 312번). */
  @PostMapping("/merge")
  CompanyView merge(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody MergeRequest request) {
    return companies.merge(cookies.requireSession(token), request.baseId(), request.materialIds());
  }

  record MergeRequest(@NotNull Integer baseId, @NotNull List<Integer> materialIds) {}

  /** 직원을 내보낸다 (decisions.md 312번). */
  @PostMapping("/release")
  CompanyView release(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody ReleaseRequest request) {
    return companies.release(cookies.requireSession(token), request.employeeId());
  }

  record ReleaseRequest(@NotNull Integer employeeId) {}

  /** 올해 이직 제안에 답한다: keep이 참이면 남기고, 거짓이면 이적료를 받고 보낸다 (decisions.md 262·265번). */
  @PostMapping("/poach")
  CompanyView answerPoach(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody PoachRequest request) {
    return companies.answerPoach(cookies.requireSession(token), request.keep());
  }

  record PoachRequest(@NotNull Boolean keep) {}

  /** 올해 투자 회의를 연다: 직원 한마디와 형광펜을 굳힌다 (decisions.md 249번). */
  @PostMapping("/invest/open")
  CompanyView convene(@CookieValue(name = SessionCookies.NAME, required = false) String token) {
    return companies.convene(cookies.requireSession(token));
  }

  /** 올해 투자 회의에서 고른다: BUY·SELL·HOLD (decisions.md 229번). */
  @PostMapping("/invest")
  CompanyView invest(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody InvestRequest request) {
    UUID sessionId = cookies.requireSession(token);
    CompanyView company =
        companies.invest(sessionId, request.choice(), Boolean.TRUE.equals(request.big()));
    PLAY.info(
        "company-invest session={} company={} year={} choice={} big={} ip={}",
        sessionId,
        company.companyId(),
        company.year(),
        request.choice(),
        request.big(),
        ClientIp.current());
    return company;
  }

  /** big이 참이면 크게 한다: 판돈 두 배, 고집 1.5배 (decisions.md 260번). 없으면 거짓. */
  record InvestRequest(@NotBlank String choice, Boolean big) {}

  /** 올해 거시경제 회의를 연다: 직원 한마디와 형광펜을 굳힌다 (decisions.md 266번). */
  @PostMapping("/macro/open")
  CompanyView conveneMacro(
      @CookieValue(name = SessionCookies.NAME, required = false) String token) {
    return companies.conveneMacro(cookies.requireSession(token));
  }

  /** 올해 거시경제 회의에서 회사의 태도를 고른다: AGGRESSIVE·NEUTRAL·DEFENSIVE (266번). */
  @PostMapping("/macro")
  CompanyView macro(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody MacroRequest request) {
    UUID sessionId = cookies.requireSession(token);
    CompanyView company = companies.macro(sessionId, request.stance());
    PLAY.info(
        "company-macro session={} company={} year={} stance={} ip={}",
        sessionId,
        company.companyId(),
        company.year(),
        request.stance(),
        ClientIp.current());
    return company;
  }

  record MacroRequest(@NotBlank String stance) {}

  /** 이번 분기 멘탈 전투의 결과를 보낸다 (decisions.md 328번). */
  @PostMapping("/mental")
  CompanyView mental(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody MentalRequest request) {
    UUID sessionId = cookies.requireSession(token);
    CompanyView company =
        companies.mental(
            sessionId,
            request.year(),
            request.quarter(),
            request.cards(),
            request.kills(),
            request.mentalLeft());
    PLAY.info(
        "company-mental session={} company={} year={} quarter={} cards={} kills={} left={} ip={}",
        sessionId,
        company.companyId(),
        request.year(),
        request.quarter(),
        request.cards(),
        request.kills(),
        request.mentalLeft(),
        ClientIp.current());
    return company;
  }

  record MentalRequest(
      @Positive int year,
      @Min(1) @Max(4) int quarter,
      @NotEmpty List<@NotBlank String> cards,
      @PositiveOrZero int kills,
      @PositiveOrZero int mentalLeft) {}

  /** 가진 무기 가운데 하나를 든다 (decisions.md 346번). */
  @PostMapping("/weapon")
  CompanyView equipWeapon(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody WeaponRequest request) {
    UUID sessionId = cookies.requireSession(token);
    CompanyView company = companies.equipWeapon(sessionId, request.kind(), request.grade());
    PLAY.info(
        "company-weapon session={} company={} kind={} grade={} ip={}",
        sessionId,
        company.companyId(),
        request.kind(),
        request.grade(),
        ClientIp.current());
    return company;
  }

  record WeaponRequest(@NotBlank String kind, @NotBlank String grade) {}

  /** 무기 뽑기권 한 장으로 무기 하나를 뽑는다 (decisions.md 366번). */
  @PostMapping("/weapon/draw")
  CompanyView drawWeapon(@CookieValue(name = SessionCookies.NAME, required = false) String token) {
    UUID sessionId = cookies.requireSession(token);
    CompanyView company = companies.drawWeapon(sessionId);
    PLAY.info(
        "company-weapon-draw session={} company={} ip={}",
        sessionId,
        company.companyId(),
        ClientIp.current());
    return company;
  }

  /** 같은 무기 여럿을 합쳐 한 등급 올린다 (decisions.md 366번). */
  @PostMapping("/weapon/merge")
  CompanyView mergeWeapon(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody WeaponRequest request) {
    return companies.mergeWeapon(cookies.requireSession(token), request.kind(), request.grade());
  }

  /** 올해 연봉 협상에 답한다 (decisions.md 270번). */
  @PostMapping("/raise")
  CompanyView answerRaise(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody RaiseRequest request) {
    return companies.answerRaise(cookies.requireSession(token), request.accept());
  }

  record RaiseRequest(@NotNull Boolean accept) {}

  /** 사표를 들고 온 직원에게 답한다: 연봉을 올려 붙잡거나 보낸다 (decisions.md 282번). */
  @PostMapping("/resign")
  CompanyView answerResign(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody ResignRequest request) {
    return companies.answerResign(cookies.requireSession(token), request.keep());
  }

  record ResignRequest(@NotNull Boolean keep) {}

  /** 종목 회의의 막판 제안에 답한다 (decisions.md 283번). */
  @PostMapping("/invest/proposal")
  CompanyView answerProposal(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody ProposalRequest request) {
    return companies.answerProposal(cookies.requireSession(token), request.accept());
  }

  record ProposalRequest(@NotNull Boolean accept) {}

  /** 막판 제안을 따른 직원에게 상이나 벌을 준다 (283번). */
  @PostMapping("/invest/verdict")
  CompanyView verdict(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody VerdictRequest request) {
    return companies.verdict(cookies.requireSession(token), request.choice());
  }

  record VerdictRequest(@NotBlank String choice) {}

  /** 그 자리의 팀장을 정한다 (decisions.md 269번). */
  /** 이사 비용을 내고 다음 건물로 간다 (decisions.md 296번). */
  @PostMapping("/upgrade")
  CompanyView upgrade(@CookieValue(name = SessionCookies.NAME, required = false) String token) {
    return companies.upgrade(cookies.requireSession(token));
  }

  @PostMapping("/leader")
  CompanyView leader(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody LeaderRequest request) {
    return companies.leader(cookies.requireSession(token), request.desk(), request.employeeId());
  }

  record LeaderRequest(@NotBlank String desk, @NotNull Integer employeeId) {}

  /** 넘길 해와 분기 (decisions.md 234·268번). 이미 넘긴 분기면 아무것도 하지 않는다. */
  record SettleRequest(@NotNull @Positive Integer year, @NotNull @Min(1) @Max(4) Integer quarter) {}

  @PostMapping("/placement")
  CompanyView place(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody PlacementRequest request) {
    Map<Integer, String> placements = new HashMap<>();
    for (Seat seat : request.seats()) {
      // 같은 직원이 두 번 오면 어느 쪽인지 모르니 400 (254번). 전에는 뒤의 것이 조용히 덮었다.
      if (placements.containsKey(seat.employeeId())) {
        throw new InvalidRequestException("같은 직원이 두 번 왔다: " + seat.employeeId());
      }
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
    CompanyView company = companies.settle(sessionId, request.year(), request.quarter());
    PLAY.info(
        "company-settle session={} company={} year={} quarter={} capital={} grade={} ip={}",
        sessionId,
        company.companyId(),
        request.year(),
        request.quarter(),
        company.capital(),
        company.grade(),
        ClientIp.current());
    return company;
  }

  /** replace는 자리가 꽉 찼을 때 내보낼 직원 ID. */
  record PlacementRequest(@NotNull List<@Valid Seat> seats) {}

  /** desk가 null이면 쉰다. */
  record Seat(@NotNull Integer employeeId, String desk) {}
}
