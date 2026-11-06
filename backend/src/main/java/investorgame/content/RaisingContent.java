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
   * @param hotLine 연초 회의의 "이번 시대에 뜨는 섹터" 한 줄. {desks}는 시대 보너스가 붙은 자리 이름
   * @param phases 결산의 한 해 시장 한 줄. boom·normal·crash
   * @param eras 회사마다 다른 시대. 첫 회사는 맨 앞 시대다 (9.4절)
   * @param sale 매각·재창업 문구 (9절)
   * @param market 공채 시장 지원자 카드의 한 줄 (decisions.md 228번)
   * @param invest 투자 회의 문구 (decisions.md 229번)
   */
  /**
   * @param surnames 직원 이름의 성
   * @param names 직원 이름(성 뒤에 붙는다). 성 × 이름 조합을 겹치지 않게 돌려 쓴다. 직함은 이름에 넣지 않는다: 종합 등급으로 화면이 붙인다
   *     (decisions.md 256번)
   */
  public record Company(
      List<String> surnames,
      List<String> names,
      List<Desk> desks,
      Map<String, String> flipLines,
      Map<String, String> wanted,
      String hotLine,
      EraTurn eraTurn,
      Map<String, String> phases,
      String falseOmenNote,
      String seatsCut,
      String opening,
      Bankrupt bankrupt,
      Rivals rivals,
      People people,
      History history,
      List<Era> eras,
      Sale sale,
      Map<String, String> statNames,
      GradeLines gradeLines,
      Effects effects,
      Market market,
      Invest invest) {}

  /**
   * 투자 회의 (decisions.md 229번). 고르는 것은 BUY·SELL·HOLD.
   *
   * @param options 사장이 고르는 버튼 이름
   * @param remarks 직원의 한마디. 안목 구간(low·mid·high·expert) → 읽은 쪽(UP·DOWN·NEUTRAL) → 문구 여럿. {quote}(따온
   *     기사 문장)·{stock}. foggy는 가장 흐린 기사에서 안목 높은 직원이 하는 말(UP·DOWN)
   * @param actions 직원이 한 일(샀다·팔았다·지켜봤다)
   * @param obey 사장 말대로 했다. {action}
   * @param rogue 제멋대로 했다. {action}
   * @param swayed 꼬드김에 넘어갔다. {who}·{action}
   * @param reveal 정한 뒤 드러난 결과. UP·DOWN별, {stock}·{percent}
   */
  public record Invest(
      Map<String, String> options,
      Map<String, Map<String, List<String>>> remarks,
      Map<String, String> actions,
      String obey,
      String rogue,
      String swayed,
      Map<String, String> reveal) {}

  /**
   * 시대가 바뀐다 (decisions.md 250번). ending: 시대의 마지막 해 연초 회의 한 줄({era}). changed: 시대가 바뀐 해의 결산 소식
   * 줄({from}·{to}· {description}).
   */
  public record EraTurn(String ending, String changed) {}

  /**
   * 라이벌 증권사 (decisions.md 261번). companies: 이름과 시작 자본(작은 곳부터). overtook·fell: 결산에서 순위가 바뀐 해의 소식
   * 줄({name}·{rank}).
   */
  public record Rivals(List<Rival> companies, String overtook, String fell) {}

  public record Rival(String name, long capital) {}

  /**
   * 사람 이야기 (decisions.md 262번). poach: 라이벌이 손을 뻗었다({rival}·{name}). kept·left·ignored: 붙잡음·보냄·답 없이
   * 떠남. settled: 같은 자리 세 해째({name}·{desk}).
   */
  public record People(String poach, String kept, String left, String ignored, String settled) {}

  /**
   * 회사 연표와 업적 (decisions.md 263번). events: 연표 한 줄(open {number} · rise {name}·{grade} · left {name}
   * · best {ratio} · worst {percent} · overtake {name}). achievements: 업적 코드·이름·설명.
   */
  public record History(Map<String, String> events, List<Achievement> achievements) {}

  public record Achievement(String code, String name, String description) {}

  /**
   * 망한 회사 (decisions.md 247번). notice: 회사 화면에 뜨는 한 줄. emptied: 결산에서 자본이 0이 된 해의 소식 줄. opening: 다시
   * 차린 회사의 한 줄({number}·{next}·{capital}).
   */
  public record Bankrupt(String notice, String emptied, String opening) {}

  /**
   * 공채 시장 지원자 카드의 한 줄. wanted: 올해 필요한 인재({desk}·{stat}). hr: 인사팀이 데려온 지원자({name}). veteran:
   * 경력직({grade}, decisions.md 258번).
   */
  public record Market(String wanted, String hr, String veteran) {}

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

  /** 자리 (4.2절). sector가 있으면 그 섹터 종목을 굴리는 섹터 데스크다: 관심 섹터가 같은 직원이 앉으면 조금 더 번다. 없으면 섹터를 가리지 않는다. */
  public record Desk(
      String code,
      String name,
      String statCode,
      boolean trades,
      String sector,
      String description) {}
}
