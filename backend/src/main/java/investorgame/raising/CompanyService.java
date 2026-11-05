package investorgame.raising;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * 아주 작은 회사 (증권사 육성 설계 4·6절). 첫 육성의 사람을 등록하면 회사가 열리고, 해마다 연초 회의 → 배치 → (공채 육성) → 결산을 돈다. 공채 육성은
 * RaisingService.start가 회사가 돌고 있으면 맡는다.
 */
public interface CompanyService {

  /** 세션의 가장 최근 회사(돌고 있거나 끝남). */
  Optional<CompanyView> current(UUID sessionId);

  /**
   * 끝난 육성 판의 사람을 등록하거나 돌려보낸다. 회사가 없으면 등록하며 회사가 열린다(돌려보낼 수 없다). 자리가 꽉 찼으면 replace의 직원과 바꾼다. 돌려보내도 그
   * 판의 돈은 회사 자본으로 들어간다 (6.3절).
   *
   * @param replace 바꿀 직원 ID. 자리가 남거나 돌려보내면 null
   */
  CompanyView hire(UUID sessionId, UUID runId, boolean register, Integer replace);

  /** 직원 ID → 자리 코드(쉬면 null). 자리 수를 넘으면 400. */
  CompanyView place(UUID sessionId, Map<Integer, String> placements);

  /** 올해 결산을 하고 다음 해 연초 회의로 간다. 마지막 해면 회사가 끝난다. 공채 판이 남아 있으면 400. */
  CompanyView settle(UUID sessionId);

  /**
   * 회사를 팔고 다음 회사를 F에서 차린다 (9절). 시대가 끝났거나 등급이 매각 조건 이상이어야 한다(400). cofounders는 데려갈 직원 ID로, 공동창업자 수를
   * 넘으면 400. 돌려주는 값은 새 회사다.
   */
  CompanyView sell(UUID sessionId, java.util.List<Integer> cofounders);
}
