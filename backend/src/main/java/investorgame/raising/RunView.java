package investorgame.raising;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 육성 한 판의 화면 값 (contracts/openapi/game.yaml의 Run). 능력치는 등급만 담는다: 속 계산은 0~100이지만 화면에는 등급만 보인다 (증권사
 * 육성 설계 2.2절). 뉴스의 숨은 방향과 결정적 문장은 담지 않는다.
 *
 * @param card 지금 카드 번호(0부터)
 * @param scripted 처음 온 사람의 짜인 첫 판인가 (11.2절)
 * @param fund 이 판의 운용금
 * @param grades 능력치 코드 → 등급(F~SSS)
 * @param overallGrade 다섯 능력치 평균의 등급. 입사 심사가 매기는 종합 등급이다 (2.3절)
 * @param unlocked 처음 온 사람에게 하나씩 열리는 기능 (11.1절)
 * @param current 펼쳐진 카드. 끝났으면 null
 * @param result 입사 심사 결과. 끝나기 전이면 null
 */
public record RunView(
    UUID runId,
    Status status,
    int card,
    int cardCount,
    boolean scripted,
    long fund,
    long cash,
    long debt,
    long totalAsset,
    List<Holding> holdings,
    Map<String, String> grades,
    String overallGrade,
    Named style,
    Named sector,
    List<Device> devices,
    List<String> unlocked,
    CardView current,
    Result result) {

  public enum Status {
    ACTIVE,
    ENDED
  }

  public record Named(String code, String name) {}

  public record Holding(
      String stockCode,
      String stockName,
      String sectorName,
      long quantity,
      long avgCost,
      long price,
      long value,
      long pnl,
      int pnlBp) {}

  /** 걸어 둔 투자 원칙 장치. cost는 장치를 건 동안 늘 보이는 대가 한 줄이다. */
  public record Device(String code, String statCode, String name, String cost) {}

  /**
   * @param stock 뉴스·빚내서 사기 카드의 종목. 아니면 null
   * @param sentences 단서 기사 문장. 뉴스가 아니면 비어 있다
   * @param memo 형광펜 옆 여백의 캐릭터 메모. 형광펜이 열리기 전이면 null
   * @param sway 단골 인물의 꼬드김. 없으면 null
   * @param omen 폭락 조짐(빨간 글씨). 없으면 null
   * @param tips 이 카드에서 처음 열린 기능의 한 줄 설명
   */
  public record CardView(
      CardKind kind,
      String title,
      String body,
      Stock stock,
      List<Sentence> sentences,
      String memo,
      Sway sway,
      String omen,
      List<Option> options,
      List<String> tips) {}

  /** changeBp는 판 시작 가격 대비. */
  public record Stock(
      String code, String name, String sectorName, long price, int changeBp, long held) {}

  public record Sentence(String text, boolean highlighted) {}

  public record Sway(String who, String text) {}

  /** detail은 버튼 아래 한 줄(드는 돈 등). 없으면 null. */
  public record Option(String code, String label, String detail) {}

  /**
   * @param returnBp 운용금 대비 수익률(만분율)
   * @param flips 이 판에서 손이 뒤집힌 횟수
   * @param highlights 결과 화면의 한 판 요약 줄
   */
  public record Result(
      String overallGrade,
      long fund,
      long totalAsset,
      int returnBp,
      int flips,
      List<String> highlights) {}
}
