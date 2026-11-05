package investorgame.raising;

import java.util.List;

/**
 * 카드 한 장을 고른 결과 (contracts/openapi/game.yaml의 RunOutcome).
 *
 * @param chosen 누른 선택 코드
 * @param actual 판정을 거친 실제 선택 코드. 같으면 손이 뒤집히지 않았다
 * @param flips 뒤집힌 판정. 적용 순서대로
 * @param trade 체결된 매매. 없으면 null
 * @param price 이 카드 동안 그 종목 가격이 움직인 폭. 뉴스가 아니면 null
 * @param ifChosen 고른 대로 했다면 이 카드에서 그 종목으로 생겼을 손익. 뒤집히지 않았으면 null (투자 원칙 장치 설계 2.2절)
 * @param actualPnl 실제로 그 종목에서 생긴 손익. 뉴스가 아니면 null
 * @param decisive 복기: 결정적 문장. 뉴스가 아니면 null (3.1절)
 * @param lines 결과 문구(단골 인물, 위기, 큰일의 결과 등) 순서대로
 * @param tip 처음 손이 뒤집혔을 때의 한 줄 설명. 이미 봤으면 null (증권사 육성 설계 11.1절)
 */
public record CardOutcome(
    CardKind kind,
    String chosen,
    String actual,
    List<Flip> flips,
    Trade trade,
    PriceMove price,
    Long ifChosen,
    Long actualPnl,
    String decisive,
    List<String> lines,
    List<Growth> growth,
    String tip) {

  /** who는 꼬드긴 단골 인물의 이름. 줏대가 아니면 null. */
  public record Flip(String statCode, String from, String to, String who) {}

  /** deferred: 증권 앱을 지워 다음 장 가격으로 체결됐다. */
  public record Trade(String side, long quantity, long price, long amount, boolean deferred) {}

  public record PriceMove(int changeBp, boolean up) {}

  /** 능력치가 올랐다(또는 내렸다). 숫자 대신 등급을 보인다. */
  public record Growth(String statCode, int delta, String before, String after) {}
}
