package investorgame.progress.internal;

import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 안목 해석(progress_analysis). 대상·달마다 한 줄이고 한 번 쓰면 바뀌지 않는다 (매매창 설계 4.3절). */
@Repository
class AnalysisRepository {

  private static final String COLUMNS =
      "game_id, target, month, insight, tier, truth, reading, confident, text, prev_correct, remark";

  private final JdbcClient jdbc;

  AnalysisRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  Optional<AnalysisRow> find(UUID gameId, String target, int month) {
    return jdbc.sql(
            "SELECT "
                + COLUMNS
                + " FROM progress_analysis WHERE game_id = :gameId AND target = :target AND month = :month")
        .param("gameId", gameId)
        .param("target", target)
        .param("month", month)
        .query(AnalysisRow.class)
        .optional();
  }

  /** 그 달보다 앞선 가장 최근 해석. 지난 해석이 맞았는지 드러낼 때 쓴다. */
  Optional<AnalysisRow> findLatestBefore(UUID gameId, String target, int month) {
    return jdbc.sql(
            "SELECT "
                + COLUMNS
                + """
                 FROM progress_analysis
                WHERE game_id = :gameId AND target = :target AND month < :month
                ORDER BY month DESC LIMIT 1
                """)
        .param("gameId", gameId)
        .param("target", target)
        .param("month", month)
        .query(AnalysisRow.class)
        .optional();
  }

  /** 같은 대상·달이 이미 있으면 그대로 둔다. 같은 달에 두 번 열어도 해석은 하나다. */
  void insertIfAbsent(AnalysisRow row) {
    jdbc.sql(
            """
            INSERT INTO progress_analysis
              (game_id, target, month, insight, tier, truth, reading, confident, text, prev_correct, remark)
            VALUES
              (:gameId, :target, :month, :insight, :tier, :truth, :reading, :confident, :text, :prevCorrect, :remark)
            ON CONFLICT (game_id, target, month) DO NOTHING
            """)
        .param("gameId", row.gameId())
        .param("target", row.target())
        .param("month", row.month())
        .param("insight", row.insight())
        .param("tier", row.tier())
        .param("truth", row.truth())
        .param("reading", row.reading())
        .param("confident", row.confident())
        .param("text", row.text())
        .param("prevCorrect", row.prevCorrect())
        .param("remark", row.remark())
        .update();
  }

  /** target은 종목 코드 또는 시황의 "macro". truth는 화면에 내보내지 않는다. */
  record AnalysisRow(
      UUID gameId,
      String target,
      int month,
      int insight,
      String tier,
      String truth,
      String reading,
      boolean confident,
      String text,
      Boolean prevCorrect,
      String remark) {}
}
