package investorgame.event;

import investorgame.common.random.SeededRandom;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.UUID;

/**
 * 이벤트 운영 도메인의 입구 (specs/event.md). 이번 구현은 직업·성향·투자 시작 제안·뉴스까지다. 뉴스 연결, 자기계발, 알림성 이벤트는 아직 없다. 콘텐츠만
 * 직접 읽고, 힌트는 진행이 넘겨 주는 HintProvider로 받는다.
 */
public interface EventService {

  /**
   * [fromDay, toDay] 구간에서 다음 이벤트가 생기면 만든다. 선택형 이벤트를 만나면 거기서 멈추므로 대기 중인 이벤트는 한 판에 최대 하나다. 이미 대기 중인
   * 이벤트가 있으면 아무것도 만들지 않는다.
   */
  ScheduleResult schedule(
      UUID gameId,
      SchedulingContext context,
      int fromDay,
      int toDay,
      SeededRandom random,
      HintProvider hints);

  /** 현재 상태에서 다음 이벤트가 생길 게임 일수. 클라이언트는 이 시각까지만 시계를 보낸다. */
  OptionalInt peekNextEventDay(
      UUID gameId, SchedulingContext context, int fromDay, SeededRandom random);

  /** 대기 중인 선택형 이벤트. 재접속 시에 쓴다. */
  Optional<EventView> pending(UUID gameId);

  /** 선택을 검증하고 진행이 반영할 효과와 숨은 값을 돌려준다. 상태는 바꾸지 않는다. */
  ChoiceTicket prepareChoice(UUID gameId, UUID eventId, String optionCode);

  /** 선택형 이벤트를 해결로 기록한다. 같은 이벤트로 다시 부르면 중복 기록하지 않는다. */
  CompleteResult complete(UUID gameId, UUID eventId, Completion completion);

  /** 능력치별 이탈 횟수. 결과 요약용. */
  Map<String, Integer> deviationCounts(UUID gameId);
}
