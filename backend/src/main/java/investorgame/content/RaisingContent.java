package investorgame.content;

import java.util.List;
import java.util.Map;

/**
 * 3분 육성 한 판의 카드 문구 (content/raising.json, 증권사 육성 설계 3절). 나이·학교·가족·직장이 나오지 않는다.
 *
 * @param traits 성향 카드. slot이 style이면 투자 스타일·위험·소신을, sector면 관심 섹터를 정한다
 * @param bigs 돈이 걸린 큰일 카드 (빚내서 사기는 leverage가 따로 맡는다)
 * @param tempters 판마다 다시 나오는 단골 꼬드김 인물 (투자 원칙 장치 설계 2.1절)
 * @param devices 투자 원칙 장치 셋 (투자 원칙 장치 설계 1.1절)
 * @param flipTips 처음 손이 뒤집혔을 때 한 줄 설명. 능력치 코드별 (증권사 육성 설계 11.1절)
 * @param unlockTips 처음 열리는 기능의 한 줄 설명. 기능 코드별
 * @param company 회사 화면의 문구 (증권사 육성 설계 4·6절)
 */
public record RaisingContent(
    List<Card> traits,
    List<Card> bigs,
    Leverage leverage,
    List<Tempter> tempters,
    List<Device> devices,
    Map<String, String> flipTips,
    Map<String, String> unlockTips,
    Exam exam,
    Company company) {

  public static final String SLOT_STYLE = "style";
  public static final String SLOT_SECTOR = "sector";

  public record Card(String code, String slot, String title, String body, List<Option> options) {}

  /**
   * @param traitDeltas 성향 점수 (style.·risk.·mind.·sector. 접두사). 없으면 비어 있다
   * @param statDeltas 능력치 변화. 운은 움직이지 않는다
   * @param outcomes 고른 뒤 굴리는 현금 결과. 비어 있으면 아무 일도 없다
   */
  public record Option(
      String code,
      String label,
      String note,
      Map<String, Integer> traitDeltas,
      Map<String, Integer> statDeltas,
      List<CashOutcome> outcomes) {

    public Option {
      traitDeltas = traitDeltas == null ? Map.of() : Map.copyOf(traitDeltas);
      statDeltas = statDeltas == null ? Map.of() : Map.copyOf(statDeltas);
      outcomes = outcomes == null ? List.of() : List.copyOf(outcomes);
    }
  }

  /** cashPercent: 지금 현금에 더하는 비율(%). 음수면 잃는다. */
  public record CashOutcome(int weight, int cashPercent, String note) {}

  /** 빚내서 사기 카드. 제목의 {stock}·{drop}에 가장 많이 빠진 종목과 낙폭이 들어간다. */
  public record Leverage(
      String title,
      String body,
      String borrowLabel,
      String passLabel,
      String borrowNote,
      String passNote) {}

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
   * @param statCode 이 장치가 막는 판정의 능력치
   * @param cost 대가 한 줄. 장치를 건 동안 화면에 늘 보인다
   */
  public record Device(
      String code,
      String statCode,
      String name,
      String cost,
      String offerTitle,
      String offerBody,
      String acceptLabel,
      String declineLabel,
      String acceptNote,
      String declineNote,
      String releaseTitle,
      String releaseBody,
      String releaseLabel,
      String keepLabel,
      String releaseNote) {}

  /** 입사 심사 카드. */
  public record Exam(String title, String body, String registerLabel) {}

  /**
   * @param names 직원 이름. 등록 순서대로 쓰고 다 쓰면 처음부터 번호를 붙인다
   * @param desks 자리 종류. trades가 거짓이면 돈을 굴리지 않고 다른 자리를 돕는다 (4.2절)
   * @param flipLines 결산 소식 줄. 뒤집힌 능력치별, {name}은 직원 이름
   * @param wanted 연초 회의의 "올해 필요한 인재". 자리 코드별
   * @param phases 결산의 한 해 시장 한 줄. boom·normal·crash
   * @param eras 회사마다 다른 시대. 첫 회사는 맨 앞 시대다 (9.4절)
   * @param sale 매각·재창업 문구 (9절)
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
      GradeLines gradeLines) {}

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
