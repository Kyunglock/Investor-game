package investorgame.behavior;

import investorgame.common.Action;
import investorgame.common.Deviation;
import java.util.List;

/** 실제 행동과 이탈 원인. 이탈이 없으면 deviations는 비어 있다. 원인은 적용된 순서대로다. */
public record Resolution(Action actual, List<Deviation> deviations) {}
