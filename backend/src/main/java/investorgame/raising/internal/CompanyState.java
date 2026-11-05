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

  /** 지금 해(1부터). 결산할 때마다 하나 늘고 turns를 넘으면 회사가 끝난다. */
  int year = 1;

  long capital;
  List<Employee> employees = new ArrayList<>();
  int hired;

  /** 올해 시장: boom·normal·crash. 결산 전에는 화면에 나가지 않는다. */
  String phase;

  String omen;
  String wantedDesk;
  boolean recruited;

  /** 공채 육성 중인 판과 회사가 내준 운용금. 판이 끝나 등록을 정하면 비운다. */
  UUID recruitRun;

  long recruitFund;

  /** 끝났지만 등록을 아직 정하지 않은 판. */
  UUID pendingRun;

  List<Settlement> settlements = new ArrayList<>();

  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Employee {
    int id;
    String name;
    Map<String, Integer> stats = new LinkedHashMap<>();

    /** 앉은 자리 코드. 아직 안 앉혔으면 null. */
    String desk;
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
