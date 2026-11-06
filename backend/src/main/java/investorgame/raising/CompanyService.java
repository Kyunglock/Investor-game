package investorgame.raising;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * 증권사 (증권사 육성 설계 4·6·9절). 사장의 사재로 회사를 차리고, 해마다 연초 회의(공채 시장) → 배치 → 결산을 돈다. 직원은 공채 시장에서 계약금을 내고 뽑는다
 * (decisions.md 228번).
 */
public interface CompanyService {

  /** 세션의 가장 최근 회사. 매각을 빼기 전에 시대가 끝나 멈췄던 회사면 다음 해부터 다시 돌린다 (decisions.md 236번). */
  Optional<CompanyView> current(UUID sessionId);

  /**
   * 사장의 사재로 회사를 차린다. 이미 회사가 있으면 400. 가장 최근 회사가 망했으면(자본 0, 또는 직원 없이 가장 싼 계약금도 못 냄) 그 회사를 닫고 다음 번호로
   * 새로 차린다 (decisions.md 247번).
   */
  CompanyView open(UUID sessionId);

  /**
   * 계약금을 내고 올해 공채 시장의 지원자를 뽑는다. 자리가 꽉 찼으면 replace의 직원을 내보낸다. 없는 지원자, 모자란 돈, 꽉 찬 자리에 replace가 없으면
   * 400.
   */
  CompanyView hire(UUID sessionId, int applicantId, Integer replace);

  /**
   * 값을 내고 올해 지원자를 새로 받는다. year 해에 이미 refreshes번 새로 받았다는 요청이다: 이미 한 것이면 아무것도 하지 않고 지금 회사를 돌려주고(같은
   * 요청이 두 번 와도 한 번만 낸다), 아직 오지 않은 것이면 400. 돈이 모자라면 400 (decisions.md 254번).
   */
  CompanyView refreshApplicants(UUID sessionId, int year, int refreshes);

  /** 올해 이직 제안에 답한다: 붙잡거나(값을 낸다) 보낸다(이적료를 받는다). 제안이 없거나 돈이 모자라면 400 (decisions.md 262번). */
  CompanyView answerPoach(UUID sessionId, boolean keep);

  /** 직원 ID → 자리 코드(쉬면 null). 자리 수를 넘으면 400. */
  CompanyView place(UUID sessionId, Map<Integer, String> placements);

  /**
   * 올해 투자 회의를 연다: 지금 배치로 직원 한마디와 형광펜을 굳힌다. 그 뒤로 배치를 바꿔도 그대로다. 이미 열었으면 지금 회사를 그대로 돌려준다. 열 수 없으면(정했거나
   * 돈을 굴리는 자리에 아무도 없다) 400 (decisions.md 249번).
   */
  CompanyView convene(UUID sessionId);

  /**
   * 올해 투자 회의에서 고른다(BUY·SELL·HOLD). 돈을 굴리는 직원마다 사장 말대로 하거나, 꼬드김에 넘어가거나, 제 판단대로 한다. 손익은 바로 자본에 들어간다.
   * 이미 했거나 돈을 굴리는 자리에 아무도 없으면 400 (decisions.md 229번).
   */
  CompanyView invest(UUID sessionId, String choice, boolean big);

  /**
   * year 해의 결산을 하고 다음 해 연초 회의로 간다. 회사는 끝나지 않는다(236번). 투자 회의를 열 수 있는데 안 했으면 400. 이미 결산한 해면 아무것도 하지
   * 않고 지금 회사를 돌려주고(같은 요청이 두 번 와도 한 해만 넘어간다), 아직 오지 않은 해면 400 (decisions.md 234번).
   */
  CompanyView settle(UUID sessionId, int year);

  /** 최근에 차린 회사부터 limit개. 관리자 플레이 기록용이며 세션을 따지지 않는다. */
  List<CompanySummary> recent(int limit);
}
