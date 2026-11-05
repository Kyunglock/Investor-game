package investorgame.content;

import java.util.List;
import java.util.Map;

/**
 * 증권사 육성의 문구 (content/raising.json, 증권사 육성 설계). 3분 육성 판은 없앴다 (decisions.md 228번).
 *
 * @param tempters 단골 꼬드김 인물 (투자 원칙 장치 설계 2.1절)
 * @param flipTips 처음 손이 뒤집혔을 때 한 줄 설명. 능력치 코드별 (증권사 육성 설계 11.1절)
 * @param company 회사 화면의 문구 (증권사 육성 설계 4·6절)
 */
public record RaisingContent(
    List<Tempter> tempters, Map<String, String> flipTips, Company company) {

  /**
   * 단골 인물. 문구의 {stock}은 종목 이름.
   *
   * @param first 처음 꼬드김에 넘어갔을 때
   * @param again 두 번째
   * @param repeat 세 번째부터
   * @param won 꼬드김 덕에 벌었을 때
   * @param chatLeft 단톡방을 나간 뒤 한 줄
   */
  public record Tempter(
      String code,
      String name,
      String first,
      String again,
      String repeat,
      String won,
      String chatLeft) {}

  /**
   * @param names 직원 이름. 등록 순서대로 쓰고 다 쓰면 처음부터 번호를 붙인다
   * @param desks 자리 종류. trades가 거짓이면 돈을 굴리지 않고 다른 자리를 돕는다 (4.2절)
   * @param flipLines 결산 소식 줄. 뒤집힌 능력치별, {name}은 직원 이름
   * @param wanted 연초 회의의 "올해 필요한 인재". 자리 코드별
   * @param phases 결산의 한 해 시장 한 줄. boom·normal·crash
   * @param eras 회사마다 다른 시대. 첫 회사는 맨 앞 시대다 (9.4절)
   * @param sale 매각·재창업 문구 (9절)
   * @param market 공채 시장 지원자 카드의 한 줄 (decisions.md 228번)
   */
  public record Company(
      List<String> names,
      List<Desk> desks,
      Map<String, String> flipLines,
      Map<String, String> wanted,
      Map<String, String> phases,
      String falseOmenNote,
      String opening,
      List<Era> eras,
      Sale sale,
      Map<String, String> statNames,
      GradeLines gradeLines,
      Effects effects,
      Market market) {}

  /** 공채 시장 지원자 카드의 한 줄. wanted: 올해 필요한 인재({desk}·{stat}). hr: 인사팀이 데려온 지원자({name}). */
  public record Market(String wanted, String hr) {}

  /**
   * X 이상 등급의 효과 (2.4절). 효과는 쌓인다: XX 직원은 X 효과도 가진다.
   *
   * @param list X·XX·XXX·Z·ZZ·ZZZ 순서
   * @param mentorTip 사수가 붙은 공채 지원자 카드의 한 줄. {name}·{stat}
   * @param earlyOmen 연초 회의의 경보 한 줄. {name}·{omen}
   * @param forecast 연초 회의의 선견 한 줄. 내년 시장 갈래(boom·normal·crash)별, {name}
   */
  public record Effects(
      List<Effect> list, String mentorTip, String earlyOmen, Map<String, String> forecast) {}

  public record Effect(String grade, String name, String description) {}

  /**
   * 직원 등급이 바뀌는 결산 소식 (6.4·2.3절). {name}·{before}·{after}·{stat} 자리표시를 쓴다.
   *
   * @param drop X 이상 직원의 종합 등급이 내려갔다
   * @param statDrop 원인이 된 능력치가 한 띠 내려갔다
   * @param rise 실전 경험으로 종합 등급이 X 이상으로 올랐다
   * @param recover 위기를 버텨 내려갔던 능력치를 되찾았다
   * @param experience 위기를 버텨 실전 경험이 쌓였다(아직 오르지는 않음)
   */
  public record GradeLines(
      String drop, String statDrop, String rise, String recover, String experience) {}

  /** 시대 (9.4절). 한 해 시장 갈래의 가중치와 자리별 손익 보너스(맞혔을 때 더하는 만분율)가 다르다. */
  public record Era(
      String code,
      String name,
      String description,
      Map<String, Integer> phaseWeights,
      Map<String, Integer> deskBonusBp) {}

  /** {era}·{grade}·{name}·{price}·{before}·{after}·{names}·{capital} 자리표시를 쓴다. */
  public record Sale(
      String eraEnd, String voluntary, String sold, String opening, String openingAlone) {}

  public record Desk(
      String code, String name, String statCode, boolean trades, String description) {}
}
