package investorgame.progress;

import investorgame.common.Action;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 진행 도메인의 입구. 한 판의 조율을 맡고, 다른 게임 규칙 도메인을 호출하는 유일한 도메인이다 (domains.md 3절). 요청마다 판을 잠그고 한 트랜잭션에서 처리한다
 * (db.md 5절).
 */
public interface ProgressService {

  /** 새 판을 시작한다. 진행 중인 판이 있으면 버리고(ABANDONED) 새로 만든다. 판 시작과 함께 직업 선택 이벤트가 뜬다. */
  GameView start(UUID sessionId);

  /** 세션의 가장 최근 판(진행 중 또는 종료). 재접속 시 이어하기와 최종 결과 보기에 쓴다. */
  Optional<GameView> current(UUID sessionId);

  /**
   * 클라이언트가 보고한 게임 일수로 판을 진행한다. 그 사이의 월급을 넣고, 다음 이벤트가 생기면 만든다. 시각은 거꾸로 갈 수 없고, 대기 중인 이벤트를 지나칠 수 없다.
   */
  GameView advance(UUID sessionId, UUID gameId, int day);

  /**
   * 대기 중인 이벤트에 선택을 제출한다. 뉴스이면 판정·매매·주가 변동·성장을 거친 결과를 돌려준다. quantity는 뉴스의 매수·매도 수량이며, 없으면(null) 매수는
   * 현금의 일정 비율, 매도는 전량이다. 뉴스가 아니면 무시한다.
   */
  ChoiceOutcome choose(UUID sessionId, UUID gameId, UUID eventId, String option, Long quantity);

  /**
   * 자유 매매. 투자 단계에서 현재가로 사고판다. 용기 판정만 거친다 (경제 개편 설계 8절). 대기 중인 선택이 있어도 된다: 매매창을 연 순간 도착한 이벤트가 매매를 막지
   * 않는다 (매매창 설계 2절). side는 BUY 또는 SELL.
   */
  ChoiceOutcome trade(UUID sessionId, UUID gameId, String stockCode, Action side, long quantity);

  /** 시황: 거시 지표, 경제 신문, 안목 해석. 이 달의 해석이 없으면 정해서 저장한다 (매매창 설계 2.2절). */
  MarketOverview overview(UUID sessionId, UUID gameId);

  /** 한 종목의 추세 사실과 안목 해석. 이 달의 해석이 없으면 정해서 저장한다 (매매창 설계 2.1절). */
  StockAnalysis analysis(UUID sessionId, UUID gameId, String stockCode);

  /** 가진 아파트를 매물로 내놓거나(listed) 거둔다. 대기 중인 선택이 있으면 먼저 선택해야 한다. */
  GameView listHome(UUID sessionId, UUID gameId, int seq, boolean listed);

  /** 주담대를 현금으로 일시 상환한다. 남은 원금·현금을 넘으면 400. 대기 중인 선택이 있으면 먼저 선택해야 한다 (decisions.md 58번). */
  GameView repayMortgage(UUID sessionId, UUID gameId, int seq, long amount);

  /** 한 종목의 월별 가격 이력. */
  StockHistory history(UUID sessionId, UUID gameId, String stockCode);

  /**
   * 투자 인생을 여기서 끝낸다 (decisions.md 68번). 마지막으로 보고된 시각에서 판이 끝나고(QUIT) 결과는 그때의 자산이다. 대기 중인 선택이 있으면 먼저
   * 선택해야 한다.
   */
  GameView quit(UUID sessionId, UUID gameId);

  /** 캐릭터 이름을 정한다 (decisions.md 135번). 앞뒤 공백을 잘라 1~8자여야 한다(400). 진행 중인 판이면 언제든 바꿀 수 있다. */
  GameView rename(UUID sessionId, UUID gameId, String name);

  /** 최근에 시작한 판부터 limit개. 버려진 판도 포함한다. 관리자 플레이 기록용이며 세션을 따지지 않는다. */
  List<GameSummary> recentGames(int limit);

  /**
   * 끝난 판을 이름과 함께 최종 자산 순위표에 올린다 (decisions.md 141번). 세션의 가장 최근 판이 그 판이고 끝나 있어야 하며(404), 판마다 한 번만 올릴
   * 수 있다(400). 이름 규칙은 캐릭터 이름과 같다(1~8자). 돌려주는 판의 result.rank에 순위가 실린다.
   */
  GameView enterRanking(UUID sessionId, UUID gameId, String name);

  /** 최종 자산 순위표의 앞쪽과 전체 인원. 세션을 따지지 않는다. */
  RankingView ranking();
}
