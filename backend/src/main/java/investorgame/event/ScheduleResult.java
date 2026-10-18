package investorgame.event;

import java.util.Optional;
import java.util.OptionalInt;

/**
 * pending은 이번에 만들어진 선택형 이벤트, notice는 이번에 만들어져 바로 해결된 알림이다. 둘 중 하나만 있거나 둘 다 없다. nextEventDay는 아직
 * 만들어지지 않은 다음 이벤트의 날이다.
 */
public record ScheduleResult(
    Optional<EventView> pending, Optional<Notice> notice, OptionalInt nextEventDay) {}
