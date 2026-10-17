package investorgame.event.internal;

import investorgame.event.EventKind;
import java.util.List;
import java.util.UUID;

/** event_instance 한 행. 숨은 값을 포함하므로 internal 밖으로 내보내지 않는다. */
record EventRow(
    UUID id,
    int seq,
    EventKind kind,
    String definitionCode,
    String sectorCode,
    int occursDay,
    String status,
    String hiddenDirection,
    Integer hiddenMagnitudeBp,
    String hintCode,
    String swaySentiment,
    String swayCode,
    List<String> options) {

  static final String PENDING = "PENDING";
  static final String RESOLVED = "RESOLVED";

  boolean pending() {
    return PENDING.equals(status);
  }

  boolean resolved() {
    return RESOLVED.equals(status);
  }
}
