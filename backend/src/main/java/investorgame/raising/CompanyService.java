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

  /** 세션의 가장 최근 회사(돌고 있거나 끝남). */
  Optional<CompanyView> current(UUID sessionId);

  /** 사장의 사재로 첫 회사를 차린다. 이미 회사가 있으면 400(다음 회사는 매각으로 차린다). */
  CompanyView open(UUID sessionId);

  /**
   * 계약금을 내고 올해 공채 시장의 지원자를 뽑는다. 자리가 꽉 찼으면 replace의 직원을 내보낸다. 없는 지원자, 모자란 돈, 꽉 찬 자리에 replace가 없으면
   * 400.
   */
  CompanyView hire(UUID sessionId, int applicantId, Integer replace);

  /** 값을 내고 올해 지원자를 새로 받는다. 돈이 모자라면 400. */
  CompanyView refreshApplicants(UUID sessionId);

  /** 직원 ID → 자리 코드(쉬면 null). 자리 수를 넘으면 400. */
  CompanyView place(UUID sessionId, Map<Integer, String> placements);

  /** 올해 결산을 하고 다음 해 연초 회의로 간다. 마지막 해면 회사가 끝난다. */
  CompanyView settle(UUID sessionId);

  /**
   * 회사를 팔고 다음 회사를 F에서 차린다 (9절). 시대가 끝났거나 등급이 매각 조건 이상이어야 한다(400). cofounders는 데려갈 직원 ID로, 공동창업자 수를
   * 넘으면 400. 돌려주는 값은 새 회사다.
   */
  CompanyView sell(UUID sessionId, List<Integer> cofounders);

  /** 최근에 차린 회사부터 limit개. 관리자 플레이 기록용이며 세션을 따지지 않는다. */
  List<CompanySummary> recent(int limit);
}
