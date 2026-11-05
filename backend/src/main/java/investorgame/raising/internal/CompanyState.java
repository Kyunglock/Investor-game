package investorgame.raising.internal;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.ArrayList;
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

  /** 지금 해(1부터). 결산할 때마다 하나 늘고 turns를 넘으면 시대가 끝나 회사를 판다. */
  int year = 1;

  /** 사장이 차린 몇 번째 회사인가(1부터). */
  int number = 1;

  /** 이 회사의 시대 코드 (9.4절). */
  String era;

  /** 팔렸는가. 팔린 회사는 끝난 채로 남는다. */
  boolean sold;

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

  /** 올해 공채 시장의 지원자 (오토배틀러의 상점). 해가 바뀌면 새로 온다. 뽑으면 빠진다. */
  List<Applicant> applicants = new ArrayList<>();

  /** 올해 지원자를 새로 받은 횟수. 같은 해에 새로 받을 때마다 다른 지원자가 온다. */
  int refreshes;

  /** 지금까지 만난 지원자 수. 지원자 이름과 번호를 이것으로 붙인다. 다음 회사로 이어진다. */
  int met;

  /** 올해 투자 회의 (decisions.md 229번). 옛 회사면 null이다. */
  Invest invest;

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

    List<InvestResult> results = new ArrayList<>();
    long total;
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Sentence {
    String text;

    /** UP·DOWN·NEUTRAL: 이 문장이 기운 쪽. */
    String sign;

    boolean decisive;
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

  /** 공채 시장의 지원자 한 명. 계약금을 내고 뽑으면 그대로 직원이 된다. */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Applicant {
    /** 회사 안에서 지원자를 가리키는 번호(만난 순서). */
    int id;

    String name;
    Map<String, Integer> stats = new LinkedHashMap<>();
    long fee;

    /** 지원자 카드의 한 줄(올해 필요한 인재, 사수가 붙음). 없으면 null. */
    String line;

    /** 관심 섹터 코드. 뽑으면 직원이 안고 들어온다. */
    String sector;
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
    String gradeBefore;
    String gradeAfter;
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
