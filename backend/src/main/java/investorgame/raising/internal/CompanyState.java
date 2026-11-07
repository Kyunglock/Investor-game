package investorgame.raising.internal;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 회사 하나의 모든 상태. raising_company.state에 JSON으로 둔다. 올해 시장 갈래는 숨은 값이라 화면에는 조짐만 나간다. */
// 3분 육성 시절의 칸(공채 판, 연봉, 열린 기능…)이 남은 옛 상태도 읽는다 (decisions.md 228번).
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonAutoDetect(
    fieldVisibility = Visibility.ANY,
    getterVisibility = Visibility.NONE,
    isGetterVisibility = Visibility.NONE)
class CompanyState {

  /** 지금 해(1부터). 결산할 때마다 하나 늘고 회사는 끝나지 않는다 (decisions.md 236번). turns 해마다 시대가 바뀐다 (250번). */
  int year = 1;

  /** 사장이 차린 몇 번째 회사인가(1부터). */
  int number = 1;

  /** 지금 분기(1~4). 턴 하나가 한 분기이고 4분기를 넘기면 연말 결산이다 (decisions.md 268번). 이 칸이 없던 회사는 1분기. */
  int quarter = 1;

  /** 폭락장인 해에 폭락이 터지는 분기(2~4). 숨은 값. 폭락장이 아니거나 이 칸이 없던 해면 null(옛 해는 네 분기에 고르게 빠진다). */
  Integer crashQuarter;

  /** 폭락 조짐(헛조짐 포함)을 거시경제 기사에 싣는 분기: 폭락이 터지기 바로 앞 분기. 조짐이 없으면 null. */
  Integer omenQuarter;

  /**
   * 올해 회사 등급과 자리 수를 정한 자본(연초 자본). 분기마다 자본이 바뀌어도 등급·건물·자리 수는 연말에만 바뀐다 (268번). 이 칸이 없던 회사면 null(지금
   * 자본으로 정한다).
   */
  Long gradedCapital;

  /**
   * 회사가 산 건물(회사 등급, decisions.md 296번). 이사 비용을 내고 올라가고, 자본이 그 띠 아래로 떨어지면 연말에 저절로 줄어든다. 이 칸이 없던 회사면
   * null(자본으로 정한다, 296번 전처럼).
   */
  String building;

  /** 지난 연말 업계 순위의 상위 몇 % (#351). 아직 매기지 않았으면 null. */
  Integer industryTop;

  /** 짓고 있는 건물의 회사 등급 (#347). 짓지 않으면 null. */
  String buildingTo;

  /** 공사 기간(해)과 남은 해 (#347). 연말 결산마다 한 해씩 줄고 0이 되면 옮긴다. */
  int buildYears;

  int buildLeft;

  /** 올해 낸 이사 비용 (296번). */
  long yearMoving;

  /**
   * 올해 판돈과 수수료를 정하는 자본: 1분기를 넘길 때의 자본 (268번). 분기마다 자본을 다시 걸면 이긴 분기가 겹겹이 불어나 한 해 합계가 예전 규칙과 달라진다.
   * 자본이 그 아래로 줄면 지금 자본만큼만 건다. 아직 1분기를 안 넘겼으면 null.
   */
  Long yearStake;

  /** 이번 분기를 시작할 때의 자본. 분기 실적의 앞 숫자다. */
  Long quarterStartCapital;

  /**
   * 자리마다 사장이 정한 팀장: 자리 코드 → 직원 번호 (decisions.md 269번). 정하지 않았거나 그 사람이 자리를 떠났으면 그 자리에서 종합 등급이 가장 높은
   * 사람이 팀장이다.
   */
  Map<String, Integer> leaders = new LinkedHashMap<>();

  /** 올해 넘긴 분기의 실적. 연말 결산에 모여 들어가고 해가 바뀌면 비운다 (268번). */
  List<Quarter> quarters = new ArrayList<>();

  /** 1년 차 1분기를 1로 센 분기 번호. 해를 건너도 이어진다(특급 인재가 떠나는 때, 290번). */
  int quarterIndex() {
    return (year - 1) * 4 + quarter;
  }

  /** 분기마다 다른 난수 열쇠: 같은 해의 분기끼리 기사·한마디·판정이 겹치지 않게. */
  int turn() {
    return year * 10 + quarter;
  }

  /** 이 회사의 시대 코드 (9.4절). */
  String era;

  /** 팔렸는가. 팔린 회사는 끝난 채로 남는다. */
  boolean sold;

  /** 회사 연표: 큰 일만 해 번호와 함께 쌓는다 (decisions.md 263번). */
  List<Event> timeline = new ArrayList<>();

  /** 연 업적: 코드 → 연 해 (263번). */
  Map<String, Integer> achievements = new LinkedHashMap<>();

  /** 회사를 떠난 직원 (263번). */
  List<Alumnus> alumni = new ArrayList<>();

  /** 최근에 쓴 문구 틀 (#392): 회의 한마디·팀장 보고가 같은 줄로 이어 나오지 않게 고를 때 건너뛴다. 오래된 것부터 빠진다. */
  List<String> recentLines = new ArrayList<>();

  /** 증권사마다 우리에게 손을 뻗은 횟수 (#390). */
  Map<String, Integer> poachCounts = new HashMap<>();

  /** 투자 회의를 연달아 번 해 수 (263번). */
  int meetingStreak;

  /** 지금까지 한 해 자본 배수의 최고·최저(만분율). 연표의 "가장 크게 번 해"·"가장 아팠던 해"를 가린다 (263번). */
  int bestYearBp;

  int worstYearBp;

  /** 올해 결산 전에 일어난 사람 이야기(붙잡음·보냄). 결산 소식 줄에 붙고 해가 바뀌면 비운다 (262번). */
  List<String> yearLines = new ArrayList<>();

  /** 올해의 연봉 협상 (decisions.md 270번). 없으면 null. */
  Raise raise;

  /** 연봉 때문에 사표를 들고 온 직원 (decisions.md 282번). 붙잡거나 보내기 전이면 다음 분기를 넘길 때 떠난다. 없으면 null. */
  Resign resign;

  /** 올해의 이직 제안 (decisions.md 262번). 없으면 null. 답하지 않은 채 결산하면 그 직원이 떠난다. */
  Poach poach;

  /** 망해서 문을 닫았는가 (decisions.md 247번). 닫은 회사는 끝난 채로 남고 사장이 다음 회사를 차린다. */
  boolean closed;

  /** 랜드마크 타워에 올라 엔딩을 봤는가 (decisions.md 276번). 엔딩을 본 회사는 멈추고, 사장이 다음 회사를 차린다. */
  boolean finished;

  /** 엔딩을 본 해. */
  Integer finishedYear;

  /** 차릴 때의 한 줄(1호 직원·공동창업자). */
  String opening;

  long capital;
  List<Employee> employees = new ArrayList<>();
  int hired;

  /** 올해 시장: boom·normal·crash. 결산 전에는 화면에 나가지 않는다. */
  String phase;

  String omen;
  String wantedDesk;

  /** 다음 해 시장 갈래와 조짐(숨은 값). XX 경보·ZZZ 선견 직원이 있을 때만 화면에 나간다 (2.4절). */
  String nextPhase;

  String nextOmen;

  /**
   * 채용권 (decisions.md 312번). 채용 뽑기 한 번에 한 장. 회사를 차릴 때·분기를 넘길 때·연말 결산·업적·이사로 받는다. 다음 회사로 이어진다. 공채
   * 시장(지원자를 골라 계약금을 내고 뽑던 것, 228번)을 대신한다.
   */
  int tickets;

  /**
   * 채용 뽑기로 바뀐 뒤의 회사인가 (decisions.md 312번). 그 전에 차린 회사는 거짓으로 읽히고, 처음 불러올 때 채용권을 받고 지금 직원이 도감에 오른다.
   */
  boolean gachaReady;

  /** 지금까지 뽑은 횟수. 뽑기 난수의 열쇠이고, 뽑기 요청에 실어 같은 요청이 두 번 와도 한 번만 뽑는다. 다음 회사로 이어진다. */
  int draws;

  /** 도감 (312번): 등급 → 뽑거나 합성해서 얻은 사람 수. 사장의 것이라 다음 회사로 이어진다. */
  Map<String, Integer> collection = new LinkedHashMap<>();

  /** 마지막 뽑기의 결과. 화면이 카드를 뒤집어 보인다. 분기를 넘기면 비운다. */
  List<Drawn> lastDraw = new ArrayList<>();

  /** 올해 연초 회의 때의 자본. 연말 결산서의 연초 자본이다 (decisions.md 251번). 이 칸을 더하기 전의 해면 null. */
  Long yearStartCapital;

  /** 올해 인사에 쓴 돈(받은 이적료는 뺀다, 251번). 계약금은 채용 뽑기로 바뀌며 없어졌다 (312번). */
  long yearHiring;

  /** 지금까지 만난 사람 수. 뽑은 사람의 이름을 이것으로 붙인다. 다음 회사로 이어진다. */
  int met;

  /** 올해 종목 회의 (decisions.md 229번). 연초에 준비해 두지만 직원이 종목을 물어 와야(found) 열린다 (267번). 옛 회사면 null이다. */
  Invest invest;

  /** 올해 거시경제 회의 (decisions.md 266번). 이 칸을 더하기 전의 해면 null이다. */
  Macro macro;

  /** 이 회사에서 이미 나온 뉴스. 투자 회의에 같은 뉴스가 다시 나오지 않는다(다 쓰면 비운다). */
  List<String> usedNews = new ArrayList<>();

  List<Settlement> settlements = new ArrayList<>();

  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Employee {
    int id;
    String name;
    Map<String, Integer> stats = new LinkedHashMap<>();

    /** 앉은 자리 코드. 아직 안 앉혔으면 null. */
    String desk;

    /** 관심 섹터 코드. 같은 섹터 데스크에 앉으면 조금 더 번다. 섹터 데스크 전에 들어온 직원은 없다(null). */
    String sector;

    /** SSS 위의 단계: 0이면 없음, 1 X … 6 ZZZ (2.2·2.3절). 능력치가 아니라 종합 등급에만 붙는다. */
    int rank;

    /** 실전 경험. 위기를 버틸 때 쌓이고, SSS에서 다음 단계로 오르면 0이 된다 (2.3절). */
    int experience;

    /** 큰 손실로 내려간 능력치. 위기를 버티면 맨 뒤의 것부터 되찾는다 (6.4절). */
    List<String> dropped = new ArrayList<>();

    /**
     * dropped와 같은 순서로, 그때 내려간 점수 (decisions.md 252번). 되찾을 때 이만큼만 돌려준다. 이 칸을 더하기 전에 내려간 것은 없다(한 띠로
     * 본다).
     */
    List<Integer> droppedBy = new ArrayList<>();

    /** 같은 자리에서 결산을 맞은 해 수 (decisions.md 262번). 자리가 바뀌면 1부터 다시 센다. */
    int deskYears;

    /** 지난 결산 때 앉아 있던 자리. 근속을 세는 데 쓴다. */
    String lastDesk;

    /** 들어온 해 (decisions.md 263번). 이 칸을 더하기 전에 들어온 직원은 0. */
    int joinedYear;

    /** 이 회사에서 번 돈의 합(결산과 투자 회의). 명예의 전당이 쓴다 (263번). */
    long totalPnl;

    /** 연봉을 올려 준 횟수 (decisions.md 270번). 한 번마다 연봉이 raise-step-percent만큼 오른다. */
    int raises;

    /** 마지막으로 연봉을 올려 달라고 한 해. 아직 없으면 0. */
    int askedYear;

    /** 사기(−2~+2, 270번). 낮으면 손이 더 뒤집히고 높으면 덜 뒤집힌다. 해마다 0 쪽으로 한 칸 돌아온다. */
    int morale;

    /** 올해 한 번도 자리에 앉지 않았나: 연말에 쉬어서 사기가 오른다. 분기를 넘길 때마다 앉아 있었으면 거짓. */
    boolean restedAllYear = true;

    /** 연봉을 동결당해 다음 분기를 넘길 때 떠날지 굴린다 (decisions.md 280번). */
    boolean frozenPending;
  }

  /**
   * 투자 회의 한 번: 단서 기사를 놓고 직원들과 고민하고 사장이 정한다. 직원 몇 명은 "제가 알아서 할게요" 하고 제멋대로 한다. 숨은 방향(up)은 정하기 전에는 화면에
   * 나가지 않는다.
   */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Invest {
    String news;
    String stock;
    String title;
    boolean up;
    int magnitudeBp;
    List<Sentence> sentences = new ArrayList<>();

    /** 꼬드기는 단골 인물 코드와 그 말. 분위기는 POS(사라)·NEG(팔아라). */
    String tempter;

    String sway;
    String swaySentiment;

    /** 사장이 고른 것(BUY·SELL·HOLD). 아직 안 골랐으면 null. */
    String choice;

    /** 크게 했는가: 판돈 두 배, 고집 1.5배 (decisions.md 260번). */
    boolean big;

    /** 지켜봤을 때, 맞는 쪽으로 했으면 벌었을 돈(뒤집힘 없이). 지켜보지 않았으면 null (260번). */
    Long missed;

    /** 사장이 "너희가 알아서 해" 하고 맡겼다 (decisions.md 279번). choice는 직원들이 정한 쪽(BUY·SELL)이다. */
    boolean delegated;

    /** 막판 뒤집기 (decisions.md 283번): 반대로 하자고 나선 직원과 그 행동·한마디. 답할 때까지 회의는 정해지지 않는다. 없으면 null. */
    Integer proposalId;

    String proposalName;
    String proposalAction;
    String proposalLine;

    /** 제안이 나오기 전 사장의 결정. 제안을 거절하면 이대로 한다. */
    String pendingChoice;

    boolean pendingBig;
    boolean pendingDelegated;

    /** 제안을 따랐으면 그 직원. 결과를 보고 상이나 벌을 줄 차례가 온다(verdictPending). */
    Integer followedId;

    String followedName;
    boolean verdictPending;

    /** 상이나 벌을 준 한 줄. */
    String verdictLine;

    /** 맡겼을 때 매수 쪽·매도 쪽에 얹힌 무게(직원 안목). 불꽃 장면이 쓴다. */
    int teamBuy;

    int teamSell;

    /** 맡겼을 때 직원들이 매수파·매도파로 갈려 주고받은 말 (decisions.md 285번). 화면이 한 줄씩 띄운다. 맡기지 않았으면 비었다. */
    List<DebateLine> debate = new ArrayList<>();

    List<InvestResult> results = new ArrayList<>();
    long total;

    /** 기사가 얼마나 또렷한가(clear·murky·foggy, 241번). 이 칸을 더하기 전의 회의면 null(깎지 않는다). */
    String clarity;

    /**
     * 회의를 연 때 굳힌 직원 한마디 (decisions.md 249번). 아직 안 열었으면 null. 연 뒤에는 배치를 바꿔도 그대로라, 리서치 팀을 바꿔 가며 한마디가
     * 뒤집히는 것으로 정답을 알아낼 수 없다.
     */
    List<Remark> remarks;

    /** 회의를 연 때 굳힌 형광펜: 그은 문장 번호와 그은 사람. 긋지 않았으면 null. */
    Integer highlightIndex;

    String highlightBy;

    /**
     * 직원이 이 종목을 물어 왔는가 (decisions.md 267번). 거짓이면 아직 아무도 가져오지 않아 회의를 열 수 없다. 이 칸을 더하기 전의 회의면 null(늘
     * 열린다).
     */
    Boolean found;

    /** 물어 온 직원의 번호·이름·직함과 가져올 때 한마디. 아무도 안 가져왔거나 옛 회의면 null. */
    Integer finderId;

    String finderName;
    String finderRole;
    String finderDesk;
    String pitch;
  }

  /**
   * 거시경제 회의 한 번 (decisions.md 266번): 큰 흐름 하나(기준금리·환율…)를 놓고 사장이 올해 회사의 태도를 고른다. 숨은 방향 up은 시장에 좋은 쪽이고
   * 결산 전에는 화면에 나가지 않는다.
   */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Macro {
    String topic;
    boolean up;
    List<Sentence> sentences = new ArrayList<>();
    String clarity;

    /** 회의를 연 때 굳힌 한마디와 형광펜 (249번과 같다). 아직 안 열었으면 remarks가 null. */
    List<Remark> remarks;

    Integer highlightIndex;
    String highlightBy;

    /** 사장이 고른 태도(AGGRESSIVE·NEUTRAL·DEFENSIVE). 아직이면 null이고, 고르지 않고 결산하면 중립으로 본다. */
    String stance;
  }

  /** 맡긴 회의의 토론 한 줄 (285번). side는 BUY·SELL, last면 결판을 내는 마지막 두 줄(이긴 쪽·진 쪽)이다. */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class DebateLine {
    String name;
    String side;
    String text;

    /** 결판의 세 박자(표결·선언·승복)면 참 (295번). */
    boolean last;

    /** TALK(토론) · TALLY(사회가 표결을 부름) · WIN(이긴 쪽 선언) · LOSE(진 쪽 승복). 옛 저장은 null이라 last로 읽는다. */
    String kind;
  }

  /** 투자 회의를 연 때 굳힌 직원 한마디 한 줄. read는 정할 때 "제 판단"으로도 쓴다. */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Remark {
    int employeeId;
    String name;
    String desk;
    String read;
    String text;
    Integer stubbornBp;
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Sentence {
    String text;

    /** 직원이 줄여 말하는 요지 (decisions.md 272번). 중립 문장과 이 규칙 전에 지은 기사의 문장에는 없다. */
    String point;

    /** UP·DOWN·NEUTRAL: 이 문장이 기운 쪽. */
    String sign;

    boolean decisive;

    /** 연초 회의의 폭락 조짐을 거시경제 기사로 옮긴 문장 (266번). 헛조짐일 수도 있다. */
    boolean omen;
  }

  /** 투자 회의에서 직원 한 명이 한 일. follow: BOSS(사장 말대로)·OWN(제멋대로)·SWAY(꼬드김). */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class InvestResult {
    int employeeId;
    String name;
    String desk;
    String action;
    String follow;
    long pnl;
    String line;

    /**
     * 사장이 고른 것과 맞붙은 행동: 꼬드김(단골 인물 말) 또는 제 판단 중 사장과 다른 것. 둘 다 사장과 같으면 null. 화면의 맞대결 막대가
     * 쓴다(decisions.md 235번). 그 전에 정한 회의에는 없다.
     */
    String rival;

    /** rival이 어디서 왔나: SWAY(꼬드김)·OWN(제 판단). rival이 없으면 null. */
    String rivalKind;

    /** 사장 쪽을 지킨 능력치: 꼬드김이면 줏대, 제 판단이면 자리가 원하는 능력치(폭락장이면 인내심). rival이 없으면 null. */
    String guard;
  }

  /**
   * 연표 한 줄 (263번). kind: open·grow·shrink·era·rise·left·best·worst·ending(276번). 라이벌을 걷어내기 전(288번)의
   * 옛 회사에는 overtake·target도 남아 있다. grade는 grow·shrink의 새 등급.
   */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Event {
    int year;
    String kind;
    String text;
    String grade;
  }

  /** 분기 하나의 실적 (decisions.md 268번). 분기 실적 창과 연말 결산서의 분기별 막대가 쓴다. */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Quarter {
    int year;
    int quarter;
    long capitalBefore;
    long capitalAfter;
    long fee;

    /** 직원들이 이 분기에 굴린 몫. */
    long staff;

    /** 이 분기에 낸 인사 비용(계약금·새로 받기 값 − 받은 이적료). */
    long hiring;

    /** 이 분기에 낸 이사 비용 (296번). */
    long moving;

    /** 이 분기에 나간 연봉(인건비, 270번). */
    long salary;

    /** 이 분기 종목 회의의 기사 제목과 손익. 안 열렸으면 null. */
    String investTitle;

    Long investTotal;

    /** 이 분기 거시경제 회의의 주제 이름과 태도. 회의가 없던 분기면 null. */
    String macroTopic;

    String macroStance;

    /** 이 분기에 폭락이 터졌다. */
    boolean crash;

    /** 리서치 팀 보고 (decisions.md 278번): 형광펜을 그을 회의 수, 그은 수, 결정적 문장을 짚은 수. */
    int highlightChances;

    int highlights;
    int highlightHits;

    /** 종목 발굴팀이 가져와 회의한 종목(278번). 없으면 null. */
    String scoutStock;

    Boolean scoutUp;
    Integer scoutPercent;

    List<Result> results = new ArrayList<>();
    List<String> lines = new ArrayList<>();

    /** 팀장 보고: 사람이 앉은 자리마다 한 줄 (269번). */
    List<Report> reports = new ArrayList<>();
  }

  /** 팀장 보고 한 줄 (decisions.md 269번). pnl은 돈을 굴리는 자리의 팀 손익, 돕는 자리면 null. */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Report {
    String desk;
    int leaderId;
    String leader;
    Long pnl;
    String text;
  }

  /** 회사를 떠난 직원 (263번). */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Alumnus {
    String name;
    int from;
    int to;
    long totalPnl;
    String grade;

    /** 데려간 증권사 (#390). 이직 제안으로 떠난 사람만 있다. */
    String rival;

    /** 그 뒤 소식을 전했나 (#390). */
    boolean reported;
  }

  /** 연봉 때문에 사표를 들고 온 직원 (decisions.md 282번). */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Resign {
    int employeeId;

    /** IGNORED(연봉 답을 기다리다 지쳤다)·FROZEN(동결에 실망했다) */
    String reason;

    /** 사표를 들고 온 해·분기. 그다음 분기를 넘기면 떠난다. */
    int year;

    int quarter;
  }

  /** 올해의 연봉 협상 (decisions.md 270번). 답하지 않고 연말이 오면 흐지부지되고 사기가 조금 내린다. */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Raise {
    int employeeId;
    long before;
    long after;

    /** 답하지 않은 채 넘긴 분기 수 (decisions.md 280번). */
    int quarters;
  }

  /** 다른 증권사가 우리 직원에게 손을 뻗었다 (262·288번). */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Poach {
    int employeeId;
    long transferFee;

    /** 손을 뻗은 증권사 (#390). 옛 제안이면 null(이름 없는 다른 증권사). */
    String rival;

    /** 그 증권사가 우리에게 손을 뻗은 몇 번째인가 (#390). */
    int count;
  }

  /** 채용 뽑기로 온 사람 한 명 (decisions.md 312번). 화면이 카드를 뒤집어 보인다. */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Drawn {
    int employeeId;
    String name;
    String grade;

    /** 특급: 확률표의 맨 끝 칸(회사 등급보다 훨씬 위)에서 나왔다. */
    boolean star;

    /** 도감에 처음 오른 등급이다. */
    boolean fresh;
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Settlement {
    int year;
    String phase;
    String omen;
    long capitalBefore;
    long capitalAfter;
    long fee;

    /** 그해 채용에 쓴 돈(계약금·새로 받기 값, 251번). 이 칸을 더하기 전의 결산이면 0. */
    long hiring;

    /** 그해 낸 이사 비용 (296번). */
    long moving;

    /** 그해 나간 연봉의 합(인건비, 270번). */
    long salary;

    /** 그해 투자 회의의 기사 제목과 손익. 회의를 안 했거나 이 칸을 더하기 전(240번)의 결산이면 null. */
    String investTitle;

    Long investTotal;

    /** 그해 네 분기의 실적 (268번). 분기 결산이 생기기 전의 결산이면 비어 있다. */
    List<Quarter> quarters = new ArrayList<>();

    /** 팀장들의 한 해 보고 (269번). */
    List<Report> reports = new ArrayList<>();

    String gradeBefore;
    String gradeAfter;

    /**
     * 올해 조짐을 사장이 어떻게 읽었나 (#394): falseKept(헛조짐에 안 속음)·falseDefended(헛조짐에 방어)·trueDefended(진짜 조짐에
     * 방어)·trueIgnored(진짜 조짐을 보고도 버팀). 조짐이 없었으면 null.
     */
    String omenCall;

    /** 이 결산으로 랜드마크 타워에 올라 엔딩을 봤다 (276번). */
    boolean finished;

    /** 그해 연 업적 이름 (263번). */
    List<String> achieved = new ArrayList<>();

    List<Result> results = new ArrayList<>();
    List<String> lines = new ArrayList<>();
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Result {
    int employeeId;
    String name;
    String desk;
    long stake;
    long pnl;
    Map<String, Integer> flips = new LinkedHashMap<>();
  }
}
