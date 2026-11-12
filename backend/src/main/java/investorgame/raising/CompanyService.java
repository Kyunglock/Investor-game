package investorgame.raising;

import java.util.List;
import java.util.Map;
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
   * 사장의 사재로 회사를 차린다. 이미 회사가 있으면 400. 가장 최근 회사가 망했으면(자본 0) 그 회사를 닫고 다음 번호로 새로 차린다 (decisions.md
   * 247번).
   */
  CompanyView open(UUID sessionId);

  /**
   * 채용권으로 count명을 뽑는다 (decisions.md 312번). 지금까지 draws번 뽑았다는 요청이다: 이미 한 뽑기면 아무것도 하지 않고 지금 회사를 돌려주고,
   * 아직 오지 않은 것이면 400. 채용권이나 데리고 있을 자리가 모자라면 400.
   */
  CompanyView draw(UUID sessionId, int count, int draws);

  /** 직원을 내보낸다 (312번). */
  CompanyView release(UUID sessionId, int employeeId);

  /** 그 자리의 팀장을 정한다 (decisions.md 269번). 그 자리에 앉은 직원이 아니면 400. */
  CompanyView leader(UUID sessionId, String desk, int employeeId);

  /** 이사 비용을 내고 다음 건물로 간다 (decisions.md 296번). 자본이 모자라거나 끝 등급이면 400. */
  CompanyView upgrade(UUID sessionId);

  /** 직원 ID → 자리 코드(쉬면 null). 자리 수를 넘으면 400. */
  CompanyView place(UUID sessionId, Map<Integer, String> placements);

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
   * 분기 넘기기를 누르면 직원이 종목을 물어 온다 (decisions.md 267·382번): 지금 배치로 한 분기에 한 번 굴린다. 물어 왔으면 invest.ready가
   * 참이 되고 종목 회의를 열 수 있다. 이미 굴렸거나 돈을 굴리는 직원이 없으면 아무것도 하지 않는다.
   */
  CompanyView scout(UUID sessionId);

  /**
   * 한 분기를 넘긴다 (decisions.md 268번). 4분기면 연말 결산을 하고 다음 해 1분기로 간다. 넘길 해와 분기를 싣는다: 이미 넘긴 분기면 아무것도 하지 않고
   * 지금 회사를 돌려준다(버튼 두 번, 끊긴 요청 다시 보내기, 234번). 아직 오지 않은 분기거나, 이번 분기에 열 수 있는 종목 회의를 안 했으면 400.
   */
  CompanyView settle(UUID sessionId, int year, int quarter);

  /**
   * 이번 분기 멘탈 전투의 결과를 보낸다 (decisions.md 328번). 고른 카드 목록(처음 한 장 + 레벨마다 한 장)과 결과를 받아 서버가 상한으로 자르고 강화율을
   * 매겨 그 분기 결산에 건다. 이미 보냈으면 그대로 돌려준다. 이번 분기가 아니거나 없는 카드면 400.
   */
  CompanyView mental(
      UUID sessionId, int year, int quarter, List<String> cards, int kills, int mentalLeft);

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

  /**
   * 자본으로 전투 강화(damage·fire)를 levels단계까지 산다 (decisions.md 367·394번). 자본이 닿는 데까지 사고, 한 단계도 못 사면 400.
   * 최대 단계는 없다.
   */
  CompanyView buyBattleUpgrade(UUID sessionId, String kind, int levels);

  /** 무기 뽑기권 한 장으로 무기 하나를 뽑는다 (decisions.md 366번). 뽑기권이 없으면 400. */
  CompanyView drawWeapon(UUID sessionId);

  /** 같은 무기 여럿을 합쳐 한 등급 올린다 (decisions.md 366번). 모자라거나 가장 높은 등급이면 400. */
  CompanyView mergeWeapon(UUID sessionId, String kind, String grade);

  /** 최근에 차린 회사부터 limit개. 관리자 플레이 기록용이며 세션을 따지지 않는다. */
  List<CompanySummary> recent(int limit);
}
