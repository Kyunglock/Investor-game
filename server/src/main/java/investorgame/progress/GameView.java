package investorgame.progress;

import investorgame.common.Phase;
import investorgame.common.Stats;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 화면에 보여도 되는 값만 담는다. 시드, 숨은 방향, 확률은 없다. API 응답으로 그대로 나간다 (contracts/openapi/game.yaml의 Game).
 *
 * @param day 서버가 마지막으로 확인한 게임 일수
 * @param initialStats 태어날 때의 능력치. 별명은 이 값으로 정해서 게임 중에 바뀌지 않는다
 * @param nextEventDay 다음 이벤트가 생길 게임 일수. 클라이언트는 이 시각까지만 시계를 보낸다. 대기 중인 이벤트가 있거나 끝났으면 null
 */
public record GameView(
    UUID gameId,
    Status status,
    Phase phase,
    int day,
    int startAge,
    int endAge,
    int daysPerYear,
    Stats stats,
    Stats initialStats,
    long cash,
    long totalAsset,
    long initialAsset,
    List<Holding> holdings,
    Job job,
    Named investmentStyle,
    Named interestSector,
    PendingEvent pendingEvent,
    Integer nextEventDay,
    Result result,
    List<LogEntry> log,
    List<Yearly> yearly) {

  public enum Status {
    ACTIVE,
    ENDED
  }

  public record Holding(String sectorCode, String sectorName, long amount) {}

  public record Job(String code, String title, long monthlySalary) {}

  public record Named(String code, String name) {}

  /** kind: JOB, TRAIT, OFFER, NEWS. 뉴스가 아니면 sector, hint, sway는 null이다. */
  public record PendingEvent(
      UUID eventId,
      String kind,
      int occursDay,
      String sectorCode,
      String sectorName,
      String title,
      String body,
      String hint,
      String sway,
      List<Option> options) {}

  public record Option(String code, String label) {}

  /** 인생 기록 한 줄. kind: BIRTH, TRAIT, JOB, STYLE, OFFER, NEWS, PRICE, GROWTH, END. 문구는 클라이언트가 만든다. */
  public record LogEntry(long seq, int day, String kind, Map<String, Object> payload) {}

  /** 한 해를 마친 시점의 자산. */
  public record Yearly(int age, long totalAsset, long cash) {}

  /** returnBp는 수익률(만분율). deviationCounts는 능력치별 이탈 횟수다. */
  public record Result(
      long initialAsset,
      long finalAsset,
      int returnBp,
      int finalAge,
      Map<String, Integer> deviationCounts) {}
}
