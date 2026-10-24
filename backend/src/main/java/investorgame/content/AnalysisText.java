package investorgame.content;

import investorgame.common.Hint;
import java.util.List;
import java.util.Map;

/**
 * 안목 해석의 문구 (매매창 설계 4절, content/analysis.json). 문구 틀은 안목 구간(low·mid·high·expert) → 읽은 결론(추세
 * UP·DOWN·FLAT, 시황 HOT·STABLE·COLD) → 틀 목록이고, {drop} 같은 자리표시를 진행이 사실로 채운다. 한마디는 맞혔을 때(right)·틀렸을
 * 때(wrong) → 구간(low·mid·high) → 목록이다. 기사는 전조·헛소문과 구분 없이 섞여 나오는 평범한 경제 소식이다.
 */
public record AnalysisText(
    Map<String, Map<String, List<Template>>> trend,
    Map<String, Map<String, List<Template>>> macro,
    Remarks remarks,
    List<Article> articles) {

  /**
   * 평범한 경제 기사. sentiment는 시장에 플러스(POS)·마이너스(NEG)·중립(NEUTRAL)인지 — 매매창 경제 신문의 +/− 표시 (decisions.md
   * 56번).
   */
  public record Article(String text, String sentiment) {}

  public static final List<String> SENTIMENTS = List.of("POS", "NEG", "NEUTRAL");

  /** confident면 확신에 찬 말투. 말투는 맞았는지와 무관하다. */
  public record Template(String text, boolean confident) {}

  public record Remarks(Verdicts trend, Verdicts macro) {}

  public record Verdicts(Map<String, List<String>> right, Map<String, List<String>> wrong) {}

  /** 문구 틀의 안목 구간. 순서대로 0~29, 30~59, 60~79, 80~100. */
  public static final List<String> TEMPLATE_TIERS = List.of("low", "mid", "high", "expert");

  /** 한마디의 안목 구간. 순서대로 0~29, 30~59, 60~100. */
  public static final List<String> REMARK_TIERS = List.of("low", "mid", "high");

  public static final List<String> TREND_READINGS = List.of("UP", "DOWN", "FLAT");

  public static final List<String> MACRO_READINGS = List.of("HOT", "STABLE", "COLD");

  public static String templateTier(int insight) {
    return Hint.Detail.of(insight).key();
  }

  public static String remarkTier(int insight) {
    return insight < 30 ? "low" : insight < 60 ? "mid" : "high";
  }
}
