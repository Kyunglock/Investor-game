package investorgame.event;

import java.util.List;
import java.util.UUID;

/** 화면에 보여도 안전한 값만 담는다. 숨은 방향, 변동 폭, 시드는 없다 (specs/event.md 3절). */
public record EventView(
    UUID eventId,
    EventKind kind,
    int occursDay,
    String sectorCode,
    String title,
    String body,
    String hintText,
    String swayText,
    List<Option> options) {

  public record Option(String code, String label) {}
}
