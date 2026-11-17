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

  /** 가진 무기 가운데 하나를 든다 (decisions.md 346번). 없는 종류·등급이거나 안 가진 무기면 400. */
  CompanyView equipWeapon(UUID sessionId, String kind, String grade);

  /**
   * 멘탈 스테이지 한 판의 결과를 보낸다 (decisions.md 369번). 처음 깨면 자본과 무기 뽑기권, 별을 처음 얻으면 뽑기권을 더 준다. 아직 안 열린 스테이지면
   * 400.
   */
  CompanyView reportStage(UUID sessionId, int stage, boolean cleared, int stars);

  /** 매도벽 돌파 스테이지 한 판의 결과를 보낸다 (#698). 처음 깨면 자본과 무기 뽑기권, 별을 처음 얻으면 뽑기권을 더 준다. 아직 안 열린 스테이지면 400. */
  CompanyView reportAssault(UUID sessionId, int stage, boolean cleared, int stars);

  /** EX 디펜스 한 판의 결과를 보낸다 (decisions.md 369번). 분기에 한 번 무기 뽑기권을 준다. */
  CompanyView reportEx(UUID sessionId, int kills);

  /** 오늘의 출석 보상을 받는다 (decisions.md 528번). 하루에 한 번, 한국 시간 자정 기준. 오늘 이미 받았으면 400. */
  CompanyView attend(UUID sessionId);

  /** 상점에서 상품 하나를 산다 (decisions.md 541번). 하루 횟수를 다 썼거나 재화가 모자라면 400. */
  CompanyView buyShop(UUID sessionId, String code);

  /**
   * 시즌패스의 단계 보상을 받는다 (decisions.md 529번). step이 null이면 받을 수 있는 것을 모두 받는다. 도달하지 않았거나 이미 받았으면 400.
   */
  CompanyView claimPass(UUID sessionId, Integer step);

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

  /** 무기 뽑기권 count장으로 무기 count개를 뽑는다 (decisions.md 366·517번). 뽑기권이 모자라면 하나도 뽑지 않고 400. */
  CompanyView drawWeapon(UUID sessionId, int count);

  /** 같은 무기 여럿을 합쳐 한 등급 올린다 (decisions.md 366번). 모자라거나 가장 높은 등급이면 400. */
  CompanyView mergeWeapon(UUID sessionId, String kind, String grade);

  /**
   * 고양이 뽑기 (decisions.md 488·493·517번): 뽑기권 한 장에 한 마리, count마리를 한꺼번에. 이미 가진 고양이면 레벨이 오른다. 뽑기권이 모자라면
   * 하나도 뽑지 않고 400.
   */
  CompanyView drawCat(UUID sessionId, int count);

  /** 액티브 스킬을 쓴다 (decisions.md 503번). 없는 스킬이거나 재사용 대기 중이면 400. */
  CompanyView useActive(UUID sessionId, String code);

  /** 매수벽이 무너졌다 (decisions.md 546번): 열 벽 앞으로 돌아간다. 쌓인 피해와 거래 정지는 지운다. */
  CompanyView retreatIdle(UUID sessionId);

  /** 환생한다 (decisions.md 570번): 매도벽 1로 돌아가 전투 강화와 돈이 처음으로 돌아가고 생선을 받는다. 첫 보스를 깨기 전이면 400. */
  CompanyView rebirth(UUID sessionId);

  /** 생선으로 가진 고양이의 레벨을 하나 올린다 (570번). 생선이 모자라거나 가지지 않은 고양이면 400. */
  CompanyView feedCat(UUID sessionId, String code);

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
  CompanyView fieldCat(UUID sessionId, String code, boolean fielded, String replaceCode);

  /** 고양이에게 가진 무기 하나를 들린다 (488번). kind와 grade가 null이면 뺀다. */
  CompanyView equipCat(UUID sessionId, String code, String kind, String grade);

  /** 최근에 차린 회사부터 limit개. 관리자 플레이 기록용이며 세션을 따지지 않는다. */
  List<CompanySummary> recent(int limit);
}
