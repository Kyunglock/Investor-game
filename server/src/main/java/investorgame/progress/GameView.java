package investorgame.progress;

import investorgame.common.Phase;
import investorgame.common.Stats;
import java.util.UUID;

/** 화면에 보여도 되는 값만 담는다. 시드와 숨은 값은 없다. */
public record GameView(
    UUID gameId,
    Phase phase,
    int lastReportedDay,
    int startAge,
    int endAge,
    int daysPerYear,
    Stats stats,
    long cash) {}
