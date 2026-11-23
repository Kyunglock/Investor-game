package investorgame.api;

import investorgame.common.error.InvalidRequestException;
import investorgame.raising.CompanyService;
import investorgame.raising.CompanyView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;
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
                .map(
                    h ->
                        new CompanyService.IdleHit(
                            h.wall(), h.kind(), h.count(), h.damage(), h.depth()))
                .toList());
  }

  record IdleRequest(
      @NotNull UUID runId,
      @PositiveOrZero long sequence,
      @jakarta.validation.constraints.Pattern(regexp = "start|tick|stop") @NotNull String action,
      @jakarta.validation.constraints.Size(max = 60) List<@NotNull @Valid IdleHitRequest> hits) {}

  record IdleHitRequest(
      @Positive long wall,
      @NotNull
          @jakarta.validation.constraints.Pattern(
              regexp =
                  "bullet|water|meteor|bolt|ram|ice|wind|fire|poison|light|dark|sand|star|hail|blossom|bomb|auroraNight|barrage|buy|stoploss")
          String kind,
      @Min(1) @Max(1000) int count,
      @PositiveOrZero @jakarta.validation.constraints.DecimalMax("1000000000000") Double damage,
      @Min(0) @Max(2) Integer depth) {}

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

  /**
   * 종목회의를 연다 (decisions.md 249·523번): 기회 하나를 써서 직원이 종목을 물어 오고 한마디와 형광펜을 굳힌다. 정하지 않은 회의가 있으면 그 회의로
   * 돌아간다.
   */
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
        "company-invest session={} company={} choice={} big={} ip={}",
        sessionId,
        company.companyId(),
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

  /** 가진 무기 가운데 하나를 든다 (decisions.md 346번). kind와 grade를 비우면 사장냥의 무기를 뺀다 (585번). */
  @PostMapping("/weapon")
  CompanyView equipWeapon(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody EquipRequest request) {
    if ((request.kind() == null) != (request.grade() == null)) {
      throw new InvalidRequestException("kind와 grade는 함께 보내거나 함께 비운다");
    }
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

  record EquipRequest(String kind, String grade) {}

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

  /** 시즌패스의 단계 보상을 받는다 (decisions.md 529번). step이 없으면 받을 수 있는 것을 모두 받는다. */
  @PostMapping("/pass/claim")
  CompanyView claimPass(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody(required = false) PassClaimRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
    Integer step = request == null ? null : request.step();
    CompanyView company = companies.claimPass(sessionId, step);
    PLAY.info(
        "company-pass-claim session={} company={} step={} ip={}",
        sessionId,
        company.companyId(),
        step,
        ClientIp.current());
    return company;
  }

  record PassClaimRequest(@Min(1) @Max(1000) Integer step) {}

  /** 시즌패스 미션의 포인트를 받는다 (decisions.md 572번). code가 없으면 받을 수 있는 것을 모두 받는다. */
  @PostMapping("/pass/missions/claim")
  CompanyView claimPassMission(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody(required = false) PassMissionClaimRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
    String code = request == null ? null : request.code();
    CompanyView company = companies.claimPassMission(sessionId, code);
    PLAY.info(
        "company-pass-mission-claim session={} company={} code={} points={} ip={}",
        sessionId,
        company.companyId(),
        code,
        company.pass().points(),
        ClientIp.current());
    return company;
  }

  record PassMissionClaimRequest(String code) {}

  /** 오늘의 출석 보상을 받는다 (decisions.md 528번). 하루에 한 번이고 오늘 이미 받았으면 400. */
  @PostMapping("/attendance")
  CompanyView attend(@CookieValue(name = SessionCookies.NAME, required = false) String token) {
    UUID sessionId = cookies.requirePlayer(token);
    CompanyView company = companies.attend(sessionId);
    PLAY.info(
        "company-attendance session={} company={} day={} ip={}",
        sessionId,
        company.companyId(),
        company.attendance().today(),
        ClientIp.current());
    return company;
  }

  /** 상점에서 상품 하나를 산다 (decisions.md 541번). 하루 횟수를 다 썼거나 재화가 모자라면 400. */
  @PostMapping("/shop/{code}")
  CompanyView buyShop(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable String code) {
    UUID sessionId = cookies.requirePlayer(token);
    CompanyView company = companies.buyShop(sessionId, code);
    PLAY.info(
        "company-shop session={} company={} item={} ip={}",
        sessionId,
        company.companyId(),
        code,
        ClientIp.current());
    return company;
  }

  /** 금고 보스전의 결과 (decisions.md 641번): 넣은 피해량을 받아 기록을 고치고 새로 닿은 등급의 금괴를 준다. */
  @PostMapping("/vault/boss")
  CompanyView reportVaultBoss(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody VaultBossRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
    CompanyView company = companies.reportVaultBoss(sessionId, request.damage(), request.cats());
    PLAY.info(
        "company-vault-boss session={} company={} damage={} best={} tier={} gold={} ip={}",
        sessionId,
        company.companyId(),
        request.damage(),
        company.vault().boss().best(),
        company.vault().boss().tier(),
        company.vault().gold(),
        ClientIp.current());
    return company;
  }

  record VaultBossRequest(
      @NotNull @PositiveOrZero Double damage, @Size(max = 16) List<String> cats) {}

  /** 주간 던전의 한 층을 깼다 (641번). 차례가 아니거나 그 층의 카드를 고르지 않았으면 400. */
  @PostMapping("/vault/floor")
  CompanyView clearVaultFloor(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody VaultFloorRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
    CompanyView company = companies.clearVaultFloor(sessionId, request.floor());
    PLAY.info(
        "company-vault-floor session={} company={} floor={} gold={} ip={}",
        sessionId,
        company.companyId(),
        request.floor(),
        company.vault().gold(),
        ClientIp.current());
    return company;
  }

  record VaultFloorRequest(@NotNull @Positive Integer floor) {}

  /** 주간 던전의 다음 층에 들고 갈 카드를 고른다 (641번). */
  @PostMapping("/vault/card")
  CompanyView pickVaultCard(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody VaultCardRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
    CompanyView company = companies.pickVaultCard(sessionId, request.code());
    PLAY.info(
        "company-vault-card session={} company={} card={} ip={}",
        sessionId,
        company.companyId(),
        request.code(),
        ClientIp.current());
    return company;
  }

  record VaultCardRequest(@NotBlank String code) {}

  /** 금괴로 금고 상점의 상품을 산다 (641번). 이번 주 횟수를 다 썼거나 금괴가 모자라면 400. */
  @PostMapping("/vault/shop/{code}")
  CompanyView buyVaultItem(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable String code) {
    UUID sessionId = cookies.requirePlayer(token);
    CompanyView company = companies.buyVaultItem(sessionId, code);
    PLAY.info(
        "company-vault-shop session={} company={} item={} gold={} ip={}",
        sessionId,
        company.companyId(),
        code,
        company.vault().gold(),
        ClientIp.current());
    return company;
  }

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

  /** 다이아 또는 광고로 무기 하나를 뽑는다. */
  @PostMapping("/weapon/draw")
  CompanyView drawWeapon(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody(required = false) DrawCountRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
    int count = DrawCountRequest.countOf(request);
    CompanyView company =
        companies.drawWeapon(
            sessionId, count, request != null && Boolean.TRUE.equals(request.ad()));
    PLAY.info(
        "company-weapon-draw session={} company={} count={} ip={}",
        sessionId,
        company.companyId(),
        count,
        ClientIp.current());
    return company;
  }

  /** 뽑기 수: 1~10(연속 뽑기, 639·640번). 10회면 하나를 더 준다. ad는 보상형 광고를 끝까지 본 경우에만 참이고 한 번에 하나다. */
  record DrawCountRequest(@Min(1) @Max(10) Integer count, Boolean ad) {
    static int countOf(DrawCountRequest request) {
      return request == null || request.count() == null ? 1 : request.count();
    }
  }

  @PostMapping("/weapon/merge-all")
  CompanyView mergeAllWeapons(
      @CookieValue(name = SessionCookies.NAME, required = false) String token) {
    return companies.mergeAllWeapons(cookies.requirePlayer(token));
  }

  /** 같은 무기 여럿을 합쳐 한 등급 올린다 (decisions.md 366번). */
  @PostMapping("/weapon/merge")
  CompanyView mergeWeapon(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody WeaponRequest request) {
    return companies.mergeWeapon(cookies.requirePlayer(token), request.kind(), request.grade());
  }

  /** 다이아 또는 광고로 고양이 한 마리를 뽑는다. */
  @PostMapping("/cat/draw")
  CompanyView drawCat(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody(required = false) DrawCountRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
    int count = DrawCountRequest.countOf(request);
    CompanyView company =
        companies.drawCat(sessionId, count, request != null && Boolean.TRUE.equals(request.ad()));
    PLAY.info(
        "company-cat-draw session={} company={} count={} ip={}",
        sessionId,
        company.companyId(),
        count,
        ClientIp.current());
    return company;
  }

  /** 가진 고양이를 출전시키거나 쉬게 한다 (decisions.md 488번). */
  /** 액티브 스킬을 쓴다 (decisions.md 503번). 광고 스킬은 ad가 참이어야 한다 (588번). */
  @PostMapping("/idle/active")
  CompanyView useActive(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody ActiveRequest request) {
    return companies.useActive(
        cookies.requirePlayer(token), request.code(), Boolean.TRUE.equals(request.ad()));
  }

  record ActiveRequest(@NotBlank String code, Boolean ad) {}

  /** 고유 스킬을 장착하거나 뺀다 (decisions.md 587번). */
  @PostMapping("/idle/active/equip")
  CompanyView equipActive(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody ActiveEquipRequest request) {
    return companies.equipActive(cookies.requirePlayer(token), request.code(), request.equipped());
  }

  @PostMapping("/idle/tutorial")
  CompanyView tutorial(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody TutorialRequest request) {
    return companies.tutorial(cookies.requirePlayer(token), request.action(), request.step());
  }

  record TutorialRequest(@NotBlank String action, int step) {}

  record ActiveEquipRequest(@NotBlank String code, @NotNull Boolean equipped) {}

  /** 환생한다 (decisions.md 571번): 매도벽 1로 돌아가고 생선을 받는다. */
  @PostMapping("/rebirth")
  CompanyView rebirth(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @RequestBody(required = false) RebirthRequest request) {
    UUID sessionId = cookies.requirePlayer(token);
    // 광고를 보고 환생하면 생선이 3배다 (586번).
    boolean ad = request != null && Boolean.TRUE.equals(request.ad());
    CompanyView company = companies.rebirth(sessionId, ad);
    PLAY.info(
        "company-rebirth session={} company={} count={} fish={} ad={} ip={}",
        sessionId,
        company.companyId(),
        company.idle().rebirth().count(),
        company.idle().rebirth().fish(),
        ad,
        ClientIp.current());
    return company;
  }

  record RebirthRequest(Boolean ad) {}

  /** 생선으로 영구 강화를 levels단계까지(없으면 한 단계) 올린다 (600·663번). */
  @PostMapping("/rebirth/upgrade")
  CompanyView buyFishUpgrade(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody FishUpgradeRequest request) {
    int levels = request.levels() == null ? 1 : request.levels();
    return companies.buyFishUpgrade(cookies.requirePlayer(token), request.kind(), levels);
  }

  record FishUpgradeRequest(@NotBlank String kind, @Positive Integer levels) {}

  @PostMapping("/bread/sell")
  CompanyView sellBread(@CookieValue(name = SessionCookies.NAME, required = false) String token) {
    return companies.sellBread(cookies.requirePlayer(token));
  }

  @PostMapping("/cat/feed")
  CompanyView feedCat(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody CatFeedRequest request) {
    return companies.feedCat(cookies.requirePlayer(token), request.code());
  }

  record CatFeedRequest(@NotBlank String code) {}

  @PostMapping("/cat/field")
  CompanyView fieldCat(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @Valid @RequestBody CatFieldRequest request) {
    return companies.fieldCat(
        cookies.requirePlayer(token),
        request.code(),
        request.fielded(),
        request.replaceCode(),
        request.slot());
  }

  record CatFieldRequest(
      @NotBlank String code, @NotNull Boolean fielded, String replaceCode, Integer slot) {}

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
}
