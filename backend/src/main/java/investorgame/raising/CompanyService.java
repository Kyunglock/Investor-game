package investorgame.raising;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 증권사 (증권사 육성 설계 4·6·9절). 사장의 사재로 회사를 차리고, 해마다 연초 회의 → 배치 → 결산을 돈다. 직원은 채용권으로 뽑는다 (decisions.md
 * 228·312번, 합성은 384번에서 뺐다).
 */
public interface CompanyService {

  /** 세션의 가장 최근 회사. 매각을 빼기 전에 시대가 끝나 멈췄던 회사면 다음 해부터 다시 돌린다 (decisions.md 236번). */
  Optional<CompanyView> current(UUID sessionId);

  /**
   * depth: how many walls the bullet had already gone through when it hit (0 = the wall the screen
   * was attacking). Null from an old screen: the distance from the saved front wall.
   */
  record IdleHit(long wall, String kind, int count, Double damage, Integer depth) {
    public IdleHit(long wall, String kind, int count) {
      this(wall, kind, count, null, null);
    }

    public IdleHit(long wall, String kind, int count, Double damage) {
      this(wall, kind, count, damage, null);
    }
  }

  CompanyView idleBeat(
      UUID sessionId, String runId, long sequence, String action, List<IdleHit> hits);

  /**
   * 사장의 사재로 회사를 차린다. 이미 회사가 있으면 400. 가장 최근 회사가 망했으면(자본 0) 그 회사를 닫고 다음 번호로 새로 차린다 (decisions.md
   * 247번).
   */
  CompanyView open(UUID sessionId);

  /**
   * 채용권으로 count명을 뽑는다 (decisions.md 312번). 지금까지 draws번 뽑았다는 요청이다: 이미 한 뽑기면 아무것도 하지 않고 지금 회사를 돌려주고,
   * 아직 오지 않은 것이면 400. 채용권이나 데리고 있을 자리가 모자라면 400.
   */
  CompanyView draw(UUID sessionId, int count, int draws);

  /** 이사 비용을 내고 다음 건물로 간다 (decisions.md 296번). 자본이 모자라거나 끝 등급이면 400. */
  CompanyView upgrade(UUID sessionId);

  /**
   * 올해 투자 회의를 연다: 지금 배치로 직원 한마디와 형광펜을 굳힌다. 그 뒤로 배치를 바꿔도 그대로다. 이미 열었으면 지금 회사를 그대로 돌려준다. 열 수 없으면(정했거나
   * 돈을 굴리는 자리에 아무도 없다) 400 (decisions.md 249번).
   */
  CompanyView convene(UUID sessionId);

  /**
   * 올해 투자 회의에서 고른다(BUY·SELL, 423번). 돈을 굴리는 직원마다 사장 말대로 하거나, 꼬드김에 넘어가거나, 제 판단대로 한다. 손익은 바로 자본에 들어간다.
   * 이미 했거나 돈을 굴리는 자리에 아무도 없으면 400 (decisions.md 229번).
   */
  CompanyView invest(UUID sessionId, String choice, boolean big);

  /**
   * 종목 회의 뒤 전투의 결과를 보낸다 (decisions.md 414번, #573): 틀린 쪽에 걸었으면 디펜스(DEFENSE), 맞힌 쪽이면 공격 판(ASSAULT).
   * 별에 따라 회의 손익이 바뀐다. 한 회의에 한 번, 그 분기 안에만.
   */
  CompanyView investBattle(UUID sessionId, String mode, int stars);

  /**
   * 가진 무기 가운데 하나를 든다 (decisions.md 346번). 없는 종류·등급이거나 안 가진 무기면 400. kind와 grade가 모두 null이면 사장냥이 무기를
   * 빼고 기본 권총을 쏜다 (585번).
   */
  CompanyView equipWeapon(UUID sessionId, String kind, String grade);

  /**
   * 멘탈 스테이지 한 판의 결과를 보낸다 (decisions.md 369번). 처음 깨면 자본과 무기 뽑기권, 별을 처음 얻으면 뽑기권을 더 준다. 아직 안 열린 스테이지면
   * 400.
   */
  CompanyView reportStage(UUID sessionId, int stage, boolean cleared, int stars);

  /**
   * 매도벽 돌파 스테이지 한 판의 결과를 보낸다 (#698). 별을 처음 얻으면 다이아 (697번: 별 하나 100 · 둘 150 · 셋 200). 전에는: 처음 깨면 자본과
   * 무기 뽑기권, 별을 처음 얻으면 뽑기권을 더 준다. 아직 안 열린 스테이지면 400.
   */
  CompanyView reportAssault(UUID sessionId, int stage, boolean cleared, int stars);

  /** EX 디펜스 한 판의 결과를 보낸다 (decisions.md 369번). 분기에 한 번 무기 뽑기권을 준다. */
  CompanyView reportEx(UUID sessionId, int kills);

  /** 오늘의 출석 보상을 받는다 (decisions.md 528번). 하루에 한 번, 한국 시간 자정 기준. 오늘 이미 받았으면 400. */
  CompanyView attend(UUID sessionId);

  /** 상점에서 상품 하나를 산다 (decisions.md 541번). 하루 횟수를 다 썼거나 재화가 모자라면 400. */
  CompanyView buyShop(UUID sessionId, String code);

  /** 금고 보스전을 마쳤다 (decisions.md 641번): 넣은 피해량을 받아 기록을 고치고 새로 닿은 등급의 금괴를 준다. */
  default CompanyView reportVaultBoss(UUID sessionId, double damage) {
    return reportVaultBoss(sessionId, damage, null);
  }

  /** 저장한 파티로 싸운 보스전 (654번): cats(null이면 지금 출전한 팀)가 낼 수 있는 상한까지 받아 준다. */
  CompanyView reportVaultBoss(UUID sessionId, double damage, java.util.List<String> cats);

  /** 주간 던전의 floor층을 깼다 (641번): 차례가 아니거나 그 층의 카드를 고르지 않았으면 400. */
  CompanyView clearVaultFloor(UUID sessionId, int floor);

  /** 주간 던전의 다음 층에 들고 갈 카드를 고른다 (641번). */
  CompanyView pickVaultCard(UUID sessionId, String code);

  /** 금괴로 금고 상점의 상품을 산다 (641번). */
  CompanyView buyVaultItem(UUID sessionId, String code);

  /**
   * 시즌패스의 단계 보상을 받는다 (decisions.md 529번). step이 null이면 받을 수 있는 것을 모두 받는다. 도달하지 않았거나 이미 받았으면 400.
   */
  CompanyView claimPass(UUID sessionId, Integer step);

  /** 시즌패스 미션의 포인트를 받는다 (572번). code가 null이면 받을 수 있는 것을 모두 받는다. */
  CompanyView claimPassMission(UUID sessionId, String code);

  /** 업적 보상을 받는다 (decisions.md 708번). code가 null이면 받을 수 있는 것을 모두 받는다. 받을 것이 없으면 400. */
  CompanyView claimAchievement(UUID sessionId, String code);

  /** 테스트판: 패스 경험치를 더한다 (529번). 테스트판 회사가 아니면 400. */
  CompanyView sandboxPassExp(UUID sessionId, long exp);

  /** 테스트판: 다음 시즌으로 넘긴다 (529번). 테스트판 회사가 아니면 400. */
  CompanyView sandboxNextSeason(UUID sessionId);

  /** 테스트판: 하루가 지난 셈 쳐서 출석 보상을 다시 받을 수 있게 한다 (528번). 테스트판 회사가 아니면 400. */
  CompanyView sandboxNextDay(UUID sessionId);

  /**
   * 자본으로 전투 강화(damage·fire)를 levels단계까지 산다 (decisions.md 367·394번). 자본이 닿는 데까지 사고, 한 단계도 못 사면 400.
   * 최대 단계는 없다.
   */
  CompanyView buyBattleUpgrade(UUID sessionId, String kind, int levels);

  /** 무기 1회 뽑기. 다이아를 쓰거나 종류별 하루 3회의 광고 보상을 받는다. count는 1만 허용한다. */
  CompanyView drawWeapon(UUID sessionId, int count, boolean ad);

  /** 같은 무기 여럿을 합쳐 한 등급 올린다 (decisions.md 366번). 모자라거나 가장 높은 등급이면 400. */
  CompanyView mergeAllWeapons(UUID sessionId);

  CompanyView mergeWeapon(UUID sessionId, String kind, String grade);

  /** 고양이 1회 뽑기. 다이아 또는 하루 3회의 광고 보상. 이미 가진 고양이면 레벨이 오른다. */
  CompanyView drawCat(UUID sessionId, int count, boolean ad);

  /**
   * 광고 스킬을 쓴다 (decisions.md 503·588번). 없는 스킬이거나 재사용 대기 중이면 400. 광고를 본 뒤(ad)에만 쓴다. 사장냥의 고유 스킬은 레벨업
   * 카드로만 켠다 (667번).
   */
  CompanyView useActive(UUID sessionId, String code, boolean ad);

  CompanyView tutorial(UUID sessionId, String action, int step);

  /**
   * 환생한다 (decisions.md 571번): 매도벽 1로 돌아가 전투 강화와 돈이 처음으로 돌아가고 생선을 받는다. 첫 보스를 깨기 전이면 400. ad가 참이면 광고를
   * 본 것으로 보고 생선을 3배로 준다 (586번).
   */
  CompanyView rebirth(UUID sessionId, boolean ad);

  /** 생선으로 영구 강화(damage·hp·buy)를 한 단계 올린다 (600번). 환생해도 남는다. 생선이 모자라거나 없는 강화면 400. */
  CompanyView buyFishUpgrade(UUID sessionId, String kind, int levels);

  /**
   * 테스트판 (decisions.md 499번): 이 세션의 테스트판 회사를 돌려준다. 없으면 차리고, 자본·채용권·뽑기권을 채운다. 테스트판 회사는 무엇을 하든 그 전에
   * 다시 채워지고 업계 순위에 남지 않는다.
   */
  CompanyView sandbox(UUID sessionId);

  /** 테스트판 회사를 고른 매도벽 앞으로 옮긴다 (499번). 테스트판 회사가 아니면 400. */
  CompanyView sandboxWall(UUID sessionId, long wall);

  /** 테스트판 회사를 닫고 처음부터 새로 차린다 (499번). 테스트판 회사가 아니면 400. */
  CompanyView sandboxReset(UUID sessionId);

  /** 테스트판의 무한 지갑을 켜고 끈다 (499번). 끄면 자본은 회사를 차릴 때의 돈, 채용권·뽑기권은 0에서 시작해 그 벽에서 버는 대로만 쓴다. 켜면 다시 채운다. */
  CompanyView sandboxWallet(UUID sessionId, boolean infinite);

  /** 테스트판: 고양이 여섯을 모두 그 레벨로 주고 빈 출전 칸을 채운다 (499번). */
  CompanyView sandboxCats(UUID sessionId, int level);

  /** 테스트판: 그 등급의 무기를 여섯 개 주고 사장냥이 든다 (499번). 없는 등급이면 400. */
  CompanyView sandboxWeapon(UUID sessionId, String grade);

  /** 가진 고양이를 출전시키거나 쉬게 한다 (488번). */
  CompanyView fieldCat(
      UUID sessionId, String code, boolean fielded, String replaceCode, Integer slot);

  /** 사장냥을 쉬게 하거나 다시 내보낸다 (672번). 출전한 고양이가 없으면 쉴 수 없다. */
  CompanyView fieldBoss(UUID sessionId, boolean fielded);

  /** 고양이에게 가진 무기 하나를 들린다 (488번). kind와 grade가 null이면 뺀다. */
  CompanyView equipCat(UUID sessionId, String code, String kind, String grade);

  /** 최근에 차린 회사부터 limit개. 관리자 플레이 기록용이며 세션을 따지지 않는다. */
  List<CompanySummary> recent(int limit);
}
