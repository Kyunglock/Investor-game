package investorgame.character;

import java.util.UUID;

/** 능력치 성장의 원인. eventId는 원인 이벤트이며 없으면 null이다. */
public sealed interface GrowthSource {

  String statCode();

  UUID eventId();

  /** 해당 능력치 때문에 이탈을 겪었다. 행동의 Deviation과 이름이 겹치지 않게 DeviationGrowth라고 부른다. */
  record DeviationGrowth(String statCode, UUID eventId) implements GrowthSource {}

  /** 자기계발 이벤트의 결과. */
  record Training(String statCode, int expAmount, UUID eventId) implements GrowthSource {}
}
