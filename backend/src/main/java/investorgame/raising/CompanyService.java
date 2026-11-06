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

  /** 올해 이직 제안에 답한다: 남기거나 보낸다(이적료를 받는다). 직원은 보낼 때만 떠난다. 제안이 없으면 400 (decisions.md 262·265번). */
  CompanyView answerPoach(UUID sessionId, boolean keep);

  /** 올해 연봉 협상에 답한다: 올려 주거나 동결한다 (decisions.md 270번). 협상이 없으면 400. */
  CompanyView answerRaise(UUID sessionId, boolean accept);

  /** 연초 회의에서 올해의 라이벌을 고른다: EASY·MEDIUM·HARD (decisions.md 275번). 후보가 아니거나 1분기를 넘겼으면 400. */
  CompanyView pickTarget(UUID sessionId, String difficulty);

  /** 연봉 때문에 사표를 들고 온 직원에게 답한다: 붙잡거나 보낸다 (decisions.md 282번). 사표가 없으면 400. */
  CompanyView answerResign(UUID sessionId, boolean keep);

  /** 종목 회의의 막판 제안에 답한다: 따르거나 원래대로 한다 (decisions.md 283번). 제안이 없으면 400. */
  CompanyView answerProposal(UUID sessionId, boolean accept);

  /** 막판 제안을 따른 직원에게 상이나 벌을 준다 (283번). 차례가 아니거나 고를 수 없는 것이면 400. */
  CompanyView verdict(UUID sessionId, String choice);

  /** 그 자리의 팀장을 정한다 (decisions.md 269번). 그 자리에 앉은 직원이 아니면 400. */
  CompanyView leader(UUID sessionId, String desk, int employeeId);

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

  /** 올해 거시경제 회의를 연다: 직원 한마디와 형광펜을 굳힌다 (decisions.md 266번). 열 수 없으면 400. */
  CompanyView conveneMacro(UUID sessionId);

  /**
   * 올해 거시경제 회의에서 회사의 태도를 고른다: AGGRESSIVE·NEUTRAL·DEFENSIVE (266번). 고르면 직원이 종목을 물어 올 수 있다(267번). 이미
   * 골랐으면 400.
   */
  CompanyView macro(UUID sessionId, String stance);

  /**
   * 한 분기를 넘긴다 (decisions.md 268번). 4분기면 연말 결산을 하고 다음 해 1분기로 간다. 넘길 해와 분기를 싣는다: 이미 넘긴 분기면 아무것도 하지 않고
   * 지금 회사를 돌려준다(버튼 두 번, 끊긴 요청 다시 보내기, 234번). 아직 오지 않은 분기거나, 이번 분기에 열 수 있는 종목 회의를 안 했으면 400.
   */
  CompanyView settle(UUID sessionId, int year, int quarter);

  /** 최근에 차린 회사부터 limit개. 관리자 플레이 기록용이며 세션을 따지지 않는다. */
  List<CompanySummary> recent(int limit);
}
