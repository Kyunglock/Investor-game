package investorgame.event;

import investorgame.common.Deviation;
import java.util.List;

/** actualOption은 판정을 거친 실제 행동이다. 뉴스가 아니면 chosenOption과 같다. */
public record Completion(String chosenOption, String actualOption, List<Deviation> deviations) {}
