package investorgame.content;

/**
 * 보유 종목이 흔들리는 장면 (decisions.md 33번). "{stock}" 자리표시에 종목 이름이 들어간다. 선택지는 버틴다·판다로 고정이고, 실제 행동은 인내심·용기
 * 판정으로 뒤집힐 수 있다. requires는 장면의 전제(drop·flat, 없으면 null)로, 전제가 맞는 종목에만 그 장면이 온다 (decisions.md 109번).
 */
public record ShakeDefinition(String code, String title, String body, int weight, String requires) {

  /** 그 종목이 12달 고점보다 크게 빠져 있을 때만 (급락 알림). */
  public static final String REQUIRES_DROP = "drop";

  /** 그 종목이 최근 반년 제자리걸음일 때만 (석 달째 제자리걸음·지루한 보유). */
  public static final String REQUIRES_FLAT = "flat";
}
