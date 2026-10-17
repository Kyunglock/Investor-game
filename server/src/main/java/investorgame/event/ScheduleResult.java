package investorgame.event;

import java.util.Optional;
import java.util.OptionalInt;

/** pending은 이번에 만들어진 선택형 이벤트. nextEventDay는 아직 만들어지지 않은 다음 이벤트의 날이다. */
public record ScheduleResult(Optional<EventView> pending, OptionalInt nextEventDay) {}
