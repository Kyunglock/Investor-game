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
      People people,
      History history,
      List<Era> eras,
      Sale sale,
      Map<String, String> statNames,
      GradeLines gradeLines,
      Effects effects,
      Perks perks,
      Market market,
      Invest invest,
      Macro macro,
      Quarters quarters,
      Teams teams,
      Ending ending,
      Construction construction,
      Industry industry,
      Map<String, String> omenReveal,
      Mental mental,
      List<Quirk> quirks) {}

  /**
   * 직원 버릇 (decisions.md 349번). hello: 뽑혔을 때 첫인사({name}). proposals: 막판 제안({name}·{action}). again:
   * 지난 상벌(BONUS·RAISE·NOTHING·CUT·FORGIVE)에 이어지는 막판 제안. verdicts: 상벌 결과({name}·{bonus}). raiseAsk:
   * 연봉 협상({name}·{before}·{after}). resign: 사표(IGNORED·FROZEN, {name}). poachKept·poachLeft: 이직 제안에
   * 남거나 떠남({name}·{rival}).
   */
  public record Quirk(
      String code,
      String name,
      List<String> hello,
      List<String> proposals,
      Map<String, List<String>> again,
      Map<String, String> verdicts,
      List<String> raiseAsk,
      Map<String, String> resign,
      String poachKept,
      String poachLeft) {}

  /**
   * 업계 순위 소식 (#351). first: 처음 매긴 해, up·down·same: 지난해보다 상위 몇 %가
   * 올랐나·내렸나·그대로({year}·{rank}·{total}·{before}·{top}).
   */
  public record Industry(String first, String up, String down, String same) {}

  /** 건물 공사 (#347). started: 공사를 시작한 해의 소식({years}), done: 다 지어 옮긴 해의 소식. */
  public record Construction(String started, String done) {}

  /**
   * 멘탈 전투 (decisions.md 328번). headlines: 장르(ASSAULT·DEFENSE)마다 이벤트 머리글 여럿. cards: 카드 코드 → 이름.
   * line: 분기 실적 소식 줄({level}·{cards}·{kills}·{left}·{percent}). weapons: 무기 종류 → 이름, weaponGrades:
   * 무기 등급 → 이름 (346번).
   */
  public record Mental(
      Map<String, List<String>> headlines,
      Map<String, String> cards,
      String line,
      Map<String, String> weapons,
      Map<String, String> weaponGrades) {}

  /** 엔딩 (decisions.md 276번). line: 엔딩을 본 해의 결산 소식 줄({years}). */
  public record Ending(String line) {}

  /**
   * 팀장 보고 (decisions.md 269·291번). trading: 돈을 굴리는 팀의
   * 머리줄(bigUp·up·flat·down·bigDown·crashHeld·crashHit별 문구 여럿, {period}·{pnl}). stance: 그 기간
   * 태도(AGGRESSIVE·DEFENSIVE)가 손익(up·down)에 미친 한 줄. members: 팀이 둘 이상일 때 가장 많이 번 사람(best, 팀장 자신이면
   * bestSelf)이나 가장 크게 잃은 사람(worst·worstSelf, {name}·{pnl}). flips: 팀원이 손을 뒤집었을 때 덧붙이는 한 줄(능력치별,
   * {name}·{times}), selfFlips는 팀장 자신. flipTips: 가장 잦았던 뒤집힘의 능력치별 조언 한 줄. times: 횟수를 읽는 말(한 번·두
   * 번…), 그보다 많으면 timesMany({count}). support: 돕는 자리의 보고(자리 코드별, {period}·{swayed}). head:
   * 보고자({desk}·{name}). appointed: 팀장을 바꿨을 때 소식 줄({name}·{desk}).
   */
  public record Teams(
      Map<String, List<String>> trading,
      Map<String, Map<String, String>> stance,
      Map<String, String> members,
      Map<String, String> flips,
      Map<String, String> selfFlips,
      Map<String, String> flipTips,
      List<String> times,
      String timesMany,
      Map<String, String> support,
      String head,
      String appointed) {}

  /** 분기 결산 (decisions.md 268번). crash: 폭락이 터진 분기의 실적 줄. crashAt: 연말 결산서의 한 줄({quarter}). */
  public record Quarters(String crash, String crashAt) {}

  /**
   * 거시경제 회의 (decisions.md 266번). 해마다 연다: 기준금리·환율 같은 큰 흐름 하나를 놓고 사장이 올해 회사의 태도(AGGRESSIVE·NEUTRAL·
   * DEFENSIVE)를 고른다. 숨은 답은 올해 시장 갈래와 섹터 바람이다.
   *
   * @param stances 태도 버튼 이름
   * @param notes 태도마다 한 줄 설명
   * @param topics 주제. 해마다 하나를 뽑는다
   * @param remarks 직원 한마디. 투자 회의와 같은 꼴: 안목 구간 → 읽은 쪽(UP·DOWN·NEUTRAL) → 문구 여럿, {point}·{against}
   *     (272번)
   * @param scout 종목 발굴 (decisions.md 267번)
   * @param omenPoint 기사에 실린 폭락 조짐(266번) 문장의 요지. 조짐 문장은 위기 콘텐츠에서 와서 요지를 한 줄로 둔다
   */
  public record Macro(
      Map<String, String> stances,
      Map<String, String> notes,
      List<MacroTopic> topics,
      Map<String, Map<String, List<String>>> remarks,
      Scout scout,
      String omenPoint) {}

  /**
   * 거시경제 회의의 주제 하나. up·down·neutral은 기사 문장(오름은 시장에 좋은 쪽, 오름·내림에는 요지가 붙는다). winds는 숨은 방향(UP·DOWN)마다
   * 그해 순풍·역풍을 받는 자리와 결산 한 줄.
   */
  public record MacroTopic(
      String code,
      String name,
      String title,
      List<Clue> up,
      List<Clue> down,
      List<String> neutral,
      Map<String, Wind> winds) {}

  /** 섹터 바람: tail 자리는 맞혔을 때 더 벌고, head 자리는 덜 번다. line은 결산 소식 줄. */
  public record Wind(List<String> tail, List<String> head, String line) {}

  /**
   * 종목 발굴 (decisions.md 267번). pitch: 가져올 때 한마디, 안목 구간(low·mid·high)별 {stock}. none: 아무도 안 가져온 해.
   * credit: 종목 회의 뒤 가져온 사람을 칭찬하거나 탓하는 한 줄, UP·DOWN별 {name}·{stock}·{percent}.
   */
  public record Scout(Map<String, List<String>> pitch, String none, Map<String, String> credit) {}

  /**
   * 투자 회의 (decisions.md 229번). 고르는 것은 BUY·SELL·HOLD.
   *
   * @param options 사장이 고르는 버튼 이름
   * @param remarks 직원의 한마디. 안목 구간(low·mid·high·expert) → 읽은 쪽(UP·DOWN·NEUTRAL) → 문구 여럿. 기사 문장을 따오지
   *     않고 요지를 엮는다(272번): {point}(제 판단의 근거), {against}(반대쪽 근거, 모르겠다면 사자 쪽과 팔자 쪽)·{stock}. foggy는 가장
   *     흐린 기사에서 안목 높은 직원이 하는 말(UP·DOWN)
   * @param points 요지가 없는 문장(이 규칙 전에 지은 기사)일 때 대신 쓰는 요지. UP·DOWN
   * @param actions 직원이 한 일(샀다·팔았다·지켜봤다)
   * @param obey 사장 말대로 했다. {action}
   * @param rogue 제멋대로 했다. {action}
   * @param swayed 꼬드김에 넘어갔다. {who}·{action}
   * @param reveal 정한 뒤 드러난 결과. UP·DOWN별, {stock}·{percent}
   */
  public record Invest(
      Map<String, String> options,
      Map<String, Map<String, List<String>>> remarks,
      Map<String, String> points,
      Map<String, String> actions,
      String obey,
      String team,
      List<String> proposals,
      String rejected,
      Debate debate,
      Map<String, String> verdictAsk,
      Map<String, String> verdictOptions,
      Map<String, String> verdicts,
      String rogue,
      String swayed,
      Map<String, String> reveal) {}

  /**
   * "너희가 알아서 해"의 토론 (decisions.md 285·295번). lines: 매수파(BUY)·매도파(SELL)가 번갈아 하는 말({point}: 제 쪽 요지,
   * {against}: 상대 쪽 요지, {stock}). tally: 사회(안목이 가장 높은 팀장)가 표결을 부르는 말({buy}·{sell} 무게). win: 이긴 쪽이
   * 선언하는 말. lose: 진 쪽이 토를 달고 물러나는 말. bystanders: 한쪽이 비었을 때 끌려 나오는 사람.
   */
  public record Debate(
      Map<String, List<String>> lines,
      List<String> tally,
      Map<String, List<String>> win,
      List<String> lose,
      List<String> bystanders) {}

  /**
   * 시대가 바뀐다 (decisions.md 250번). ending: 시대의 마지막 해 연초 회의 한 줄({era}). changed: 시대가 바뀐 해의 결산 소식
   * 줄({from}·{to}· {description}).
   */
  public record EraTurn(String ending, String changed) {}

  /**
   * 사람 이야기 (decisions.md 262번). poacher: 손을 뻗는 곳(이름 없는 다른 증권사, 288번). poach: 그곳이 손을
   * 뻗었다({rival}·{name}). kept·left·ignored: 붙잡음·보냄·답 없이 떠남. settled: 같은 자리 세 해째({name}·{desk}).
   */
  public record People(
      String poacher,
      String poach,
      String kept,
      String left,
      String ignored,
      String settled,
      String raiseAsk,
      String raised,
      String frozen,
      String raiseIgnored,
      String raiseOdds,
      String raiseGrew,
      String raiseQuit,
      String frozenQuit,
      String resignIgnored,
      String resignFrozen,
      String resignKept,
      String resignLet,
      String moraleUp,
      String moraleDown,
      String meetingIgnored,
      String heard,
      String rested,
      List<String> poachers,
      String poachAgain,
      String keptRaise,
      String alumniGood,
      String alumniBad) {}

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
  /** 공채 시장 문구. star: 특급 인재 카드 한 줄(290번). starArrived·starLeft: 분기 실적 소식 줄({name}·{grade}·{fee}). */
  /**
   * 채용 뽑기의 문구 (decisions.md 312번).
   *
   * @param drawStar 특급이 나왔을 때 연표 한 줄. {name}·{grade}
   * @param merged 합성했을 때 연표 한 줄. {names}·{name}·{grade}
   * @param tickets 채용권을 받았을 때 분기 실적·결산 소식 한 줄. {count}·{reason}
   * @param ticketReasons 채용권을 받은 까닭: quarter·year·achievement·move·hr
   */
  public record Market(
      String drawStar, String merged, String tickets, Map<String, String> ticketReasons) {}

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
   * 등급 효과 (decisions.md 289번). names: 종합 등급(F~SSS)마다 이름. line: 효과 한 줄({gain}·{growth}). lineTop:
   * SSS 위(실전 경험으로 오른다, {gain}). grown: 한 해 일하며 자란 소식 줄({name}·{stat}·{before}·{after}).
   */
  public record Perks(
      Map<String, String> names,
      String line,
      String lineTop,
      String proposal,
      String grown,
      String promoted) {}

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

  /**
   * 자리 (4.2절). sector가 있으면 그 섹터 종목을 굴리는 섹터 데스크다: 관심 섹터가 같은 직원이 앉으면 조금 더 번다. 없으면 섹터를 가리지 않는다. roles가
   * 있으면 앉은 직원을 그 직함으로 부른다: 종합 등급이 C 아래·S 아래·S 이상 순서 (decisions.md 267번). 없으면 null.
   */
  public record Desk(
      String code,
      String name,
      String statCode,
      boolean trades,
      String sector,
      List<String> roles,
      String description) {}
}
