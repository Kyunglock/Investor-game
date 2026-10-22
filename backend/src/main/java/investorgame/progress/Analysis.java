package investorgame.progress;

/**
 * 안목 해석 (매매창 설계 4절). 화면에는 안목 점수와 문구만 나가고 확률·정답은 나가지 않는다.
 *
 * @param month 해석한 달. 같은 달에는 다시 열어도 같다
 * @param insight 해석한 때의 안목
 * @param reading 읽은 결론. 추세는 UP·DOWN·FLAT, 시황은 HOT·STABLE·COLD
 * @param remark 지난 해석이 드러나며 붙는 한마디. 지난 해석이 없으면 null
 */
public record Analysis(int month, int insight, String reading, String text, Remark remark) {

  public record Remark(boolean correct, String text) {}
}
