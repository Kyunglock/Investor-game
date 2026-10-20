package investorgame.market;

import java.util.List;

/**
 * 한 판의 경기 흐름 (decisions.md 38번). 판 시드로 정해지고 화면에는 절대 나가지 않는다. 진행은 달마다 전조(omens)를 기록하고, 위기가 회복까지 끝난 달
 * (revealMonth)이 되어서야 "그때가 위기였다"고 기록한다.
 *
 * <p>전조와 위기는 따로 굴린다. 전조가 나와도 아무 일 없이 지나가거나 잠깐 조정으로 끝날 수 있고, 전조 없이 위기가 오기도 한다. 그래서 전조만 보고 파는 것이 언제나
 * 옳지는 않다.
 */
public record MarketCycle(List<Omen> omens, List<Crisis> crises) {

  /** 대공황은 깊고 길게, 불황은 그보다 얕게, 조정은 잠깐 빠지고 끝난다(회복 구간 없음, 돌아봐도 기록하지 않음). */
  public enum Severity {
    DEPRESSION,
    RECESSION,
    CORRECTION
  }

  /** month에 흘러나오는 전조 한 줄. */
  public record Omen(int month, String text) {}

  /**
   * startMonth부터 fallMonths 동안 빠지고, 이어서 recoveryMonths 동안 되돌아온다.
   *
   * @param crisisCode 본뜬 갈래 (콘텐츠 crises.json)
   * @param fallBp 빠지는 동안 다달이 더해지는 하락(만분율, 양수). 섹터 비율을 곱해 쓴다
   * @param recoveryBp 회복하는 동안 다달이 더해지는 상승(만분율)
   * @param omens 이 위기 앞에 나온 전조. 전조 없이 온 위기면 비어 있다
   */
  public record Crisis(
      String crisisCode,
      Severity severity,
      int startMonth,
      int fallMonths,
      int fallBp,
      int recoveryMonths,
      int recoveryBp,
      List<String> omens) {

    public int bottomMonth() {
      return startMonth + fallMonths - 1;
    }

    /** 회복까지 끝난 달. 이 달이 지나야 위기였다고 알 수 있다. */
    public int revealMonth() {
      return bottomMonth() + recoveryMonths;
    }
  }
}
