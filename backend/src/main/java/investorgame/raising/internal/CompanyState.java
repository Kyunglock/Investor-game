package investorgame.raising.internal;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** 회사 하나의 모든 상태. raising_company.state에 JSON으로 둔다. 올해 시장 갈래는 숨은 값이라 화면에는 조짐만 나간다. */
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
  boolean recruited;

  /** 공채 육성 중인 판과 회사가 내준 운용금. 판이 끝나 등록을 정하면 비운다. */
  UUID recruitRun;

  long recruitFund;

  /** 끝났지만 등록을 아직 정하지 않은 판. */
  UUID pendingRun;

  /** 인사 직원이 데려와 등록을 기다리는 신입의 능력치. 없으면 null (6.3절). */
  Map<String, Integer> candidate;

  List<Settlement> settlements = new ArrayList<>();

  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Employee {
    int id;
    String name;
    Map<String, Integer> stats = new LinkedHashMap<>();

    /** 앉은 자리 코드. 아직 안 앉혔으면 null. */
    String desk;

    /** 육성의 성향 카드로 정해진 관심 섹터 코드. 같은 섹터 데스크에 앉으면 조금 더 번다. 인사팀이 뽑은 신입은 없다(null). */
    String sector;

    /** SSS 위의 단계: 0이면 없음, 1 X … 6 ZZZ (2.2·2.3절). 능력치가 아니라 종합 등급에만 붙는다. */
    int rank;

    /** 실전 경험. 위기를 버틸 때 쌓이고, SSS에서 다음 단계로 오르면 0이 된다 (2.3절). */
    int experience;

    /** 연봉. 인사 직원이 뽑은 신입만 받는다: 회사 자본을 가져오지 않은 대신이다 (6.3절). */
    long salary;

    /** 큰 손실로 내려간 능력치. 위기를 버티면 맨 뒤의 것부터 되찾는다 (6.4절). */
    List<String> dropped = new ArrayList<>();
  }

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
