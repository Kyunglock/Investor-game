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
    return ResponseEntity.of(cookies.player(token).flatMap(companies::current));
  }

  @PostMapping("/idle")
  CompanyView idle(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody IdleRequest request) {
    return companies.idleBeat(
        cookies.requirePlayer(token),
        request.runId().toString(),
        request.sequence(),
        request.action(),
        request.hits() == null
            ? List.of()
            : request.hits().stream()
                .map(h -> new CompanyService.IdleHit(h.wall(), h.kind(), h.count(), h.damage()))
                .toList());
  }

  record IdleRequest(
      @NotNull UUID runId,
      @PositiveOrZero long sequence,
      @jakarta.validation.constraints.Pattern(regexp = "start|tick|stop") @NotNull String action,
      @jakarta.validation.constraints.Size(max = 18) List<@NotNull @Valid IdleHitRequest> hits) {}

  record IdleHitRequest(
      @Positive long wall,
      @NotNull @jakarta.validation.constraints.Pattern(regexp = "bullet|water|meteor|bolt|ram|barrage")
          String kind,
      @Min(1) @Max(1000) int count,
      @PositiveOrZero @jakarta.validation.constraints.DecimalMax("1000000000000") Double damage) {}

  /** 사장의 사재로 첫 회사를 차린다 (decisions.md 228번). 회사가 이미 있으면 400. */
  @PostMapping
  ResponseEntity<CompanyView> open(
      @CookieValue(name = SessionCookies.NAME, required = false) String token) {
    UUID sessionId = cookies.requirePlayer(token);
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
    UUID sessionId = cookies.requirePlayer(token);
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

  /** 직원을 내보낸다 (decisions.md 312번). */
  @PostMapping("/release")
  CompanyView release(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody ReleaseRequest request) {
    return companies.release(cookies.requirePlayer(token), request.employeeId());
  }

  record ReleaseRequest(@NotNull Integer employeeId) {}

  /** 올해 투자 회의를 연다: 직원 한마디와 형광펜을 굳힌다 (decisions.md 249번). */
  @PostMapping("/invest/open")
  CompanyView convene(@CookieValue(name = SessionCookies.NAME, required = false) String token) {
    return companies.convene(cookies.requirePlayer(token));
  }

  /** 올해 투자 회의에서 고른다: BUY·SELL (decisions.md 229·423번). */
  @PostMapping("/invest")
  CompanyView invest(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody InvestRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
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

  /** 종목 회의 뒤 전투의 결과 (decisions.md 414번, #573). 별에 따라 회의 손익이 바뀐다. */
  @PostMapping("/invest/battle")
  CompanyView investBattle(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody InvestBattleRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
    CompanyView company = companies.investBattle(sessionId, request.mode(), request.stars());
    PLAY.info(
        "company-invest-battle session={} company={} mode={} stars={} ip={}",
        sessionId,
        company.companyId(),
        request.mode(),
        request.stars(),
        ClientIp.current());
    return company;
  }

  record InvestBattleRequest(@NotBlank String mode, @Min(0) @Max(3) int stars) {}

  /** 분기 넘기기를 누르면 직원이 종목을 물어 온다 (decisions.md 267·382번). 물어 왔으면 종목 회의가 열린다. */
  @PostMapping("/scout")
  CompanyView scout(@CookieValue(name = SessionCookies.NAME, required = false) String token) {
    return companies.scout(cookies.requirePlayer(token));
  }

  /** 이번 분기 멘탈 전투의 결과를 보낸다 (decisions.md 328번). */
  @PostMapping("/mental")
  CompanyView mental(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody MentalRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
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
    UUID sessionId = cookies.requirePlayer(token);
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

  /** 멘탈 스테이지 한 판의 결과를 보낸다 (decisions.md 369번). */
  @PostMapping("/stage")
  CompanyView reportStage(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody StageRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
    CompanyView company =
        companies.reportStage(sessionId, request.stage(), request.cleared(), request.stars());
    PLAY.info(
        "company-stage session={} company={} stage={} cleared={} stars={} ip={}",
        sessionId,
        company.companyId(),
        request.stage(),
        request.cleared(),
        request.stars(),
        ClientIp.current());
    return company;
  }

  record StageRequest(@Positive int stage, boolean cleared, @Min(0) @Max(3) int stars) {}

  /** 매도벽 돌파 스테이지 한 판의 결과를 보낸다 (#698). 몸통은 멘탈 스테이지와 같다. */
  @PostMapping("/assault")
  CompanyView reportAssault(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody StageRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
    CompanyView company =
        companies.reportAssault(sessionId, request.stage(), request.cleared(), request.stars());
    PLAY.info(
        "company-assault session={} company={} stage={} cleared={} stars={} ip={}",
        sessionId,
        company.companyId(),
        request.stage(),
        request.cleared(),
        request.stars(),
        ClientIp.current());
    return company;
  }

  /** EX 디펜스 한 판의 결과를 보낸다 (decisions.md 369번). */
  @PostMapping("/ex")
  CompanyView reportEx(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody ExRequest request) {
    return companies.reportEx(cookies.requirePlayer(token), request.kills());
  }

  record ExRequest(@PositiveOrZero int kills) {}

  /** 자본으로 전투 강화를 levels단계까지(없으면 한 단계) 산다 (decisions.md 367·394번). 꾹 눌러 모은 단계를 묶어 보낸다. */
  @PostMapping("/battle-upgrade")
  CompanyView buyBattleUpgrade(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody BattleUpgradeRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
    int levels = request.levels() == null ? 1 : request.levels();
    CompanyView company = companies.buyBattleUpgrade(sessionId, request.kind(), levels);
    PLAY.info(
        "company-battle-upgrade session={} company={} kind={} levels={} ip={}",
        sessionId,
        company.companyId(),
        request.kind(),
        levels,
        ClientIp.current());
    return company;
  }

  record BattleUpgradeRequest(@NotBlank String kind, @Positive Integer levels) {}

  /** 무기 뽑기권 한 장으로 무기 하나를 뽑는다 (decisions.md 366번). */
  @PostMapping("/weapon/draw")
  CompanyView drawWeapon(@CookieValue(name = SessionCookies.NAME, required = false) String token) {
    UUID sessionId = cookies.requirePlayer(token);
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
    return companies.mergeWeapon(cookies.requirePlayer(token), request.kind(), request.grade());
  }

  /** 뽑기권 한 장으로 고양이 한 마리를 뽑는다 (decisions.md 488·493번). */
  @PostMapping("/cat/draw")
  CompanyView drawCat(@CookieValue(name = SessionCookies.NAME, required = false) String token) {
    UUID sessionId = cookies.requirePlayer(token);
    CompanyView company = companies.drawCat(sessionId);
    PLAY.info(
        "company-cat-draw session={} company={} ip={}",
        sessionId,
        company.companyId(),
        ClientIp.current());
    return company;
  }

  /** 가진 고양이를 출전시키거나 쉬게 한다 (decisions.md 488번). */
  /** 액티브 스킬을 쓴다 (decisions.md 503번). */
  @PostMapping("/idle/active")
  CompanyView useActive(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody ActiveRequest request) {
    return companies.useActive(cookies.requirePlayer(token), request.code());
  }

  record ActiveRequest(@NotBlank String code) {}

  @PostMapping("/cat/field")
  CompanyView fieldCat(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody CatFieldRequest request) {
    return companies.fieldCat(cookies.requirePlayer(token), request.code(), request.fielded());
  }

  record CatFieldRequest(@NotBlank String code, @NotNull Boolean fielded) {}

  /** 고양이에게 가진 무기 하나를 들린다. kind와 grade를 비우면 뺀다 (decisions.md 488번). */
  @PostMapping("/cat/weapon")
  CompanyView equipCat(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody CatWeaponRequest request) {
    if ((request.kind() == null) != (request.grade() == null)) {
      throw new InvalidRequestException("kind와 grade는 함께 보내거나 함께 비운다");
    }
    return companies.equipCat(
        cookies.requirePlayer(token), request.code(), request.kind(), request.grade());
  }

  record CatWeaponRequest(@NotBlank String code, String kind, String grade) {}

  /** 그 자리의 팀장을 정한다 (decisions.md 269번). */
  /** 이사 비용을 내고 다음 건물로 간다 (decisions.md 296번). */
  @PostMapping("/upgrade")
  CompanyView upgrade(@CookieValue(name = SessionCookies.NAME, required = false) String token) {
    return companies.upgrade(cookies.requirePlayer(token));
  }

  @PostMapping("/leader")
  CompanyView leader(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody LeaderRequest request) {
    return companies.leader(cookies.requirePlayer(token), request.desk(), request.employeeId());
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
    return companies.place(cookies.requirePlayer(token), placements);
  }

  /** 올해 결산. 요청에 결산할 해를 싣는다: 같은 결산이 두 번 와도 한 해만 넘어간다 (decisions.md 234번). */
  @PostMapping("/settle")
  CompanyView settle(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody SettleRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
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
