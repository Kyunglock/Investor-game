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

  /** 지금 해(1부터). 결산할 때마다 하나 늘고 회사는 끝나지 않는다 (decisions.md 236번). turns 해마다 시대가 바뀐다 (250번). */
  int year = 1;

  Idle idle;

  /** null은 기존 유저: 강제 안내 없음. 회사는 계정당 하나이며 환생해도 이 상태는 유지한다. */
  Integer tutorialStep;

  boolean tutorialCatClaimed;
  boolean tutorialWeaponClaimed;
  boolean skillGuideSeen;
  boolean onboardingInitialized;

  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Idle {
    long wall = 1;
    double damage;
    double nextDamage;
    double afterNextDamage;

    /** Pierce damage on the walls after those two (530s: the screen breaks walls first, #781). */
    double[] farDamage;

    int hitVersion;
    double[] hitCredits = new double[5];
    double earned;
    double incomeRemainder;
    long bread;
    long bakingMillis;
    long bundleMillis;
    double activeSeconds;
    double circuitSeconds;

    /** 쓰지 않는다 (547번): 546번의 저장에 남은 칸이라 읽기만 한다. */
    boolean circuitFired;

    /** 부순 벽의 수 (546번): 화면이 앞에 선 벽이 새 벽인 줄 아는 데 쓴다. */
    long cleared;

    /** 벽을 부수지 않고 자리를 옮긴 횟수 (546번): 매수벽 붕괴로 돌아감·테스트판 건너뛰기. */
    long epoch;

    /**
     * 통과한 가장 높은 벽 (596번): 시즌패스의 벽 미션은 이 기록을 넘긴 벽만 센다. 환생해도 그대로다. 없던 저장은 0이고, 지금 선 벽의 앞 벽과 깬 보스로
     * 채운다.
     */
    long best;

    /** 보상을 준 가장 높은 보스 벽 (549번): 같은 보스의 클리어 보상은 한 번만 준다. 없던 저장은 0. */
    long bossCleared;

    /** 그 보스 클리어 보상으로 준 돈 (549번). 화면이 한 번 알려 준다. */
    double bossRewardMoney;

    long lastBeat;
    String runId;
    String serverId;
    long sequence;
    double dps;

    /** 가진 고양이의 레벨 (decisions.md 488번): 뽑으면 1, 또 뽑으면 하나씩 오른다. 이 칸이 없던 저장은 돌파한 벽으로 채운다. */
    Map<String, Integer> cats;

    /** 출전한 고양이, 줄 선 차례대로: 출전 칸(seats)의 번호순이다 (599번). */
    List<String> fielded = new ArrayList<>();

    /** 사장냥이 쉰다 (672번): 출전한 고양이가 한 마리라도 있을 때만 쉴 수 있다. 쉬면 사장냥의 총은 쏘지 않는다. */
    boolean bossBenched;

    /** 출전한 고양이가 선 출전 칸 (599번): 코드 → 칸 번호(0부터). 빈 칸을 사이에 둘 수 있다. 없던 저장은 줄 선 차례대로 앞에서부터 채운다. */
    Map<String, Integer> seats = new LinkedHashMap<>();

    /** 고양이가 든 무기. 가진 무기(weapons)의 한 개씩을 빌려 든다. */
    Map<String, Weapon> catWeapons = new LinkedHashMap<>();

    int catDraws;

    /** 마지막 고양이 뽑기(한 번 또는 10연속, 517번)에서 나온 고양이, 나온 차례대로. kind는 비고 grade 대신 level을 쓴다. */
    List<Pulled> lastDraws = new ArrayList<>();

    /** 액티브 스킬 (503번): 코드 → 다시 쓸 수 있게 되는 활성 시간(activeSeconds). */
    Map<String, Double> activeReady = new LinkedHashMap<>();

    /** 불장이 끝나는 활성 시간 (503번). */
    double rallyUntil;

    /** 쓰지 않는다 (667번): 사장냥의 고유 스킬은 스테이지의 레벨업 카드가 되었다. 장착 칸(587번)이 남은 저장을 읽기만 한다. */
    List<String> activeSlots;

    /** 광고 스킬 (588번): 코드 → 효과가 끝나는 활성 시간(activeSeconds). */
    Map<String, Double> activeUntil = new LinkedHashMap<>();

    /** 스킬이 고양이의 고유 능력이 된 뒤의 저장이다 (501번). 아니면 벽으로 얻었던 스킬을 그 스킬의 고양이로 한 번 바꿔 준다. */
    boolean catSkills;

    /** 최근 벽이 실제로 받은 피해(게임 초당, 492번). 화면의 실제 화력 표시에만 쓴다. */
    double wallDps;

    /** 마지막으로 접속 신호를 받은 때(서버 시각, ms). 자리를 비운 동안의 수입을 여기서부터 센다 (523번). 없던 저장은 0. */
    long lastSeen;

    /** 마지막으로 받은 자리 비운 동안의 수입 (523번): 받은 때·비운 시간(초, 상한까지)·번 돈·상한에 걸렸는가. 화면이 한 번 알려 준다. */
    long offlineAt;

    double offlineSeconds;
    double offlineEarned;
    boolean offlineCapped;
  }

  /** 사장이 차린 몇 번째 회사인가(1부터). */
  int number = 1;

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

  /** 짓고 있는 건물의 회사 등급 (#347). 짓지 않으면 null. 405번에서 공사 기간을 뺐다: 그 전에 시작한 공사만 남아 다음 연말 결산에 옮긴다. */
  String buildingTo;

  /** 공사 기간(해)과 남은 해 (#347). 연말 결산마다 한 해씩 줄고 0이 되면 옮긴다. */
  int buildYears;

  int buildLeft;

  /** 종목회의마다 다른 난수 열쇠 (523번): 회의끼리 기사·한마디·판정이 겹치지 않게. 분기가 있던 때의 열쇠(해 × 10 + 분기)와 겹치지 않는 자리에서 센다. */
  int turn() {
    return 1000 + meetings;
  }

  /** 지금까지 연 종목회의 수 (523번). */
  int meetings;

  /** 쌓인 종목회의 기회 (523번): 시간마다 하나씩, 상한까지. */
  int meetingChances;

  /** 기회를 마지막으로 센 때(서버 시각, ms). 0이면 아직 세지 않았다(새 회사·옛 저장): 처음 셀 때 시작 기회를 준다. */
  long meetingAt;

  /** EX 디펜스를 마지막으로 한 날(한국 시간, yyyy-MM-dd). 하루에 한 번이다 (523번, 전에는 분기에 한 번). */
  String exDay;

  /** 분기·결산을 없앤 뒤의 저장인가 (523번). 아니면 불러올 때 한 번 옮긴다. */
  boolean realtime;

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

  /** 망해서 문을 닫았는가 (decisions.md 247번). 닫은 회사는 끝난 채로 남고 사장이 다음 회사를 차린다. */
  boolean closed;

  /** 옛 엔딩 표시 (276번). 엔딩을 없애(374번) 쓰지 않는다. 옛 회사의 저장본을 읽으려고만 남기고, 열 때 false로 돌린다. */
  boolean finished;

  /** 옛 엔딩을 본 해. 쓰지 않는다 (374번). */
  Integer finishedYear;

  /** 차릴 때의 한 줄(1호 직원·공동창업자). */
  String opening;

  /**
   * 자본. 자동 전투의 물가(decisions.md 505번)로 long을 넘게 커지므로 실수로 둔다. 옛 저장의 정수는 그대로 읽힌다. 2^53(약 9e)보다 작은 동안은
   * 정수 계산이 정확하다.
   */
  double capital;

  /** 테스트판의 회사 (decisions.md 499번): 자본·채용권·뽑기권이 떨어지지 않고 업계 순위에 남지 않는다. */
  boolean sandbox;

  /** 테스트판의 무한 지갑을 껐다 (499번): 다시 채우지 않아, 그 벽에서 버는 돈과 강화 값을 그대로 겪는다. */
  boolean sandboxFinite;

  List<Employee> employees = new ArrayList<>();
  int hired;

  /** 올해 시장: boom·normal·crash. 결산 전에는 화면에 나가지 않는다. */
  String phase;

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

  /** 도감 (312번): 등급 → 뽑아서 얻은 사람 수. 사장의 것이라 다음 회사로 이어진다. */
  Map<String, Integer> collection = new LinkedHashMap<>();

  /** 마지막 뽑기의 결과. 화면이 카드를 뒤집어 보인다. 분기를 넘기면 비운다. */
  List<Drawn> lastDraw = new ArrayList<>();

  /** 지금까지 만난 사람 수. 뽑은 사람의 이름을 이것으로 붙인다. 다음 회사로 이어진다. */
  int met;

  /** 올해 종목 회의 (decisions.md 229번). 연초에 준비해 두지만 직원이 종목을 물어 와야(found) 열린다 (267번). 옛 회사면 null이다. */
  Invest invest;

  /** 가진 무기 (decisions.md 346번). 종류+등급으로 하나씩. 처음엔 일반 권총 하나. 이 칸을 더하기 전의 회사면 null이다. */
  List<Weapon> weapons;

  /** 든 무기. weapons 가운데 하나. */
  Weapon weapon;

  /** 사장냥이 무기를 뺐다 (decisions.md 585번): weapon이 비어 있어도 다시 들리지 않고 기본 권총을 쏜다. */
  boolean weaponOff;

  /** 무기 뽑기권 (decisions.md 366번). */
  int weaponTickets;

  /** 다이아 (decisions.md 526번): 직원·고양이·무기 뽑기에 쓴다. 뽑기권(tickets·weaponTickets)을 대신한다. */
  long diamonds;

  /** 시즌패스 (529번): 지금 진행 중인 시즌 번호. 시즌이 바뀌면 진행도를 비운다. 없던 저장은 0이라 처음 볼 때 지금 시즌으로 맞춘다. */
  int passSeason;

  /** 이번 시즌에 모은 시즌패스 포인트 (570번). 저장 이름은 옛 경험치 때의 것을 그대로 쓴다. */
  long passExp;

  /** 이번 시즌에 보상을 받은 단계. */
  List<Integer> passClaimed = new ArrayList<>();

  /** 이번 주기에 퀘스트마다 센 수 (570·643번): 미션 코드 → 수. 주기(오늘·이번 주)나 시즌이 바뀌면 비운다. */
  Map<String, Long> passMissions = new LinkedHashMap<>();

  /** 이번 주기에 퀘스트의 포인트를 받았는지 (572·643번): 미션 코드 → 1. 닿았지만 아직 받지 않은 포인트는 눌러서 받는다. */
  Map<String, Long> passMissionTaken = new LinkedHashMap<>();

  /** 퀘스트마다 센 수가 속한 주기 번호 (643번): 미션 코드 → 날 또는 주. 지금 주기와 다르면 센 수와 받은 표시를 비운다. */
  Map<String, Long> passMissionPeriod = new LinkedHashMap<>();

  /**
   * 시즌패스 규칙의 판 (570·572번): 2보다 작으면 단계에 100이 들던 때의 저장이라 처음 볼 때 포인트를 새 단계 값에 맞춰 늘리고, 3보다 작으면 미션 포인트가
   * 저절로 들어오던 때의 저장이라 지금까지 닿은 문턱을 받은 것으로 적었고, 4보다 작으면 미션이 시즌 내내 되풀이되던 때의 저장이라 센 수를 비운다(643번).
   */
  int passRules;

  /** 생선 (571번): 환생하면 얻고, 고양이의 레벨을 올리는 데 쓴다. */
  long fish;

  /** 생선으로 올린 영구 강화의 단계 (600번): 종류(damage·hp·buy) → 단계. 환생해도 남는다. */
  Map<String, Integer> fishLevels = new LinkedHashMap<>();

  /** 환생한 횟수 (571번). */
  int rebirths;

  /** 테스트판에서 넘긴 시즌 수. */
  int passSeasonOffset;

  /** 마지막으로 받은 시즌패스 보상들. 화면이 획득 연출에 쓴다. */
  List<PassReward> lastPass = new ArrayList<>();

  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class PassReward {
    int step;
    long diamonds;
    String weaponKind;
    String weaponGrade;
    String cat;
  }

  /** 상점에서 산 횟수를 센 날(한국 시간, yyyy-MM-dd). 날이 바뀌면 shopBought를 비운다 (541번). */
  String shopDay;

  /** 그날 상품마다 산 횟수 (541번). */
  java.util.Map<String, Integer> shopBought = new java.util.HashMap<>();

  /** 마지막으로 산 상품. 화면이 "받았어요"에 쓴다. */
  ShopReceipt lastShop;

  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class ShopReceipt {
    String code;
    long diamonds;
    double money;
  }

  /** 마지막으로 출석 보상을 받은 날(한국 시간, yyyy-MM-dd). 받은 적이 없으면 null (528번). */
  String attendDay;

  /** 지금까지 받은 출석 보상의 수 (528번). 출석판의 다음 칸 = 이 수를 칸 수로 나눈 나머지. 없던 저장은 0: 1일 차부터다. */
  int attendCount;

  /** 마지막으로 받은 출석 보상. 화면이 획득 연출에 쓴다. */
  AttendReward lastAttend;

  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class AttendReward {
    int day;
    long diamonds;
    double money;
  }

  /** 뽑기권을 다이아로 바꾼 뒤의 저장인가 (526번). 아니면 불러올 때 남은 뽑기권을 한 번 바꿔 준다. */
  boolean diamondsReady;

  /**
   * 자본으로 산 전투 강화의 단계 (decisions.md 367·394번): damage·fire. 없으면 0단계. 394번에서 끝없이 올리게 바꾸며 옛
   * 칸(battleUpgrades)을 버리고 새 이름으로 둬서, 출시 전 옛 회사의 강화는 돌려주지 않고 0단계로 돌아간다.
   */
  Map<String, Integer> battleLevels = new LinkedHashMap<>();

  /**
   * 전투 강화의 단계가 어느 곡선으로 산 것인가 (648번). 0이면 옛 곡선(한 단계 1%·매수 20주)이고, 불러올 때 지금 곡선(0.2%·4주)으로
   * 바꾼다(MentalEngine.adoptUpgradeCurve). 새 회사는 지금 곡선으로 시작한다.
   */
  int upgradeCurve;

  /** 깬 스테이지의 별 (decisions.md 369번): 1번 스테이지부터 차례로. 길이가 곧 깬 최고 스테이지다. */
  List<Integer> stageStars = new ArrayList<>();

  /** 마지막으로 보낸 스테이지·EX 결과와 받은 보상. 없으면 null. */
  StageResult lastStage;

  /** 깬 매도벽 돌파 스테이지의 별 (#698): 1번부터 차례로. 길이가 곧 깬 최고 스테이지다. 옛 회사는 비어 있다. */
  List<Integer> assaultStars = new ArrayList<>();

  /** 마지막으로 보낸 매도벽 돌파 스테이지 결과와 받은 보상 (#698). 없으면 null. */
  StageResult lastAssault;

  /** 무기 뽑기로 바뀐 뒤의 회사인가 (366번). 그 전에 차린 회사는 거짓으로 읽히고, 처음 불러올 때 처음 뽑기권을 받는다. */
  boolean weaponGachaReady;

  /** 무기를 뽑은 횟수. 뽑기 난수의 열쇠. */
  int weaponDraws;

  /** 마지막으로 뽑은 무기와 그것이 새것이었나. 뽑은 적이 없으면 null. */
  Weapon lastWeaponDraw;

  boolean lastWeaponDrawNew;

  /** 마지막 뽑기(한 번 또는 10연속, 517번)에서 나온 무기, 나온 차례대로. 옛 저장은 비어 있다. */
  List<Pulled> lastWeaponDraws = new ArrayList<>();

  /** 이 회사에서 이미 나온 뉴스. 투자 회의에 같은 뉴스가 다시 나오지 않는다(다 쓰면 비운다). */
  List<String> usedNews = new ArrayList<>();

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

    /**
     * SSS 위의 단계: 0이면 없음, 1 X … 6 ZZZ (2.2·2.3절). 능력치가 아니라 종합 등급에만 붙는다. 뽑을 때 정해지고 바뀌지 않는다(421번). 그
     * 전에 쌓던 실전 경험·내려간 능력치 칸은 지웠다(저장된 회사의 그 칸은 읽을 때 버린다).
     */
    int rank;

    /** 들어온 해 (decisions.md 263번). 이 칸을 더하기 전에 들어온 직원은 0. */
    int joinedYear;

    /** 이 회사에서 번 돈의 합(결산과 투자 회의). 명예의 전당이 쓴다 (263번). */
    long totalPnl;

    /** 옛 합성으로 이어받은 버릇 (350번, 384번에서 합성을 뺐다). 없으면 번호로 정한 버릇(349번). */
    String quirk;
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

    /** 사장이 고른 것(BUY·SELL, 423번 전의 옛 회의는 HOLD일 수 있다). 아직 안 골랐으면 null. */
    String choice;

    /** 크게 했는가: 판돈 두 배, 고집 1.5배 (decisions.md 260번). */
    boolean big;

    /** 이번 분기에 종목 발굴을 굴렸는가 (267·382번): 분기 넘기기를 누르면 한 번 굴린다. 옛 저장은 거짓이라 다시 굴린다. */
    boolean scouted;

    /** 사장이 "너희가 알아서 해" 하고 맡겼다 (decisions.md 279번). choice는 직원들이 정한 쪽(BUY·SELL)이다. */
    boolean delegated;

    /** 맡겼을 때 매수 쪽·매도 쪽에 얹힌 무게(직원 안목). 불꽃 장면이 쓴다. */
    /** 토론 뒤 직원들이 기운 쪽(BUY·SELL, 352번). 회의를 열 때 정해지고 사장은 그 뒤에 고른다. 토론 전에 연 회의면 null. */
    String teamCall;

    int teamBuy;

    int teamSell;

    /** 맡겼을 때 직원들이 매수파·매도파로 갈려 주고받은 말 (decisions.md 285번). 화면이 한 줄씩 띄운다. 맡기지 않았으면 비었다. */
    List<DebateLine> debate = new ArrayList<>();

    /** 결과가 드러난 뒤 양쪽의 반응 (358번): 맞힌 쪽과 틀린 쪽이 한마디씩. */
    List<DebateLine> reactions = new ArrayList<>();

    List<InvestResult> results = new ArrayList<>();
    long total;

    /** 회의 뒤 전투에서 얻은 별 (414번, #573). 아직 안 했으면 null. */
    Integer battleStars;

    /** 회의 뒤 전투로 바뀐 손익(막은 손실 + 더 번 몫, 0 이상). 회의 손익(total)과 따로 자본에 들어갔다. 안 했으면 null. */
    Long battleBonus;

    /** 회의 뒤 전투를 더 할 수 없다: 했거나 그 분기를 넘겼다(받지 못한 전투는 배율 1로 끝난다). */
    boolean battleClosed;

    /**
     * 돈을 굴린 직원 모두의 판돈을 더한 것 (decisions.md 388번): 회의 수익률 = total ÷ stake. 이 칸을 더하기 전에 정한 회의면 null.
     */
    Long stake;

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

  /** 스테이지·EX 한 판의 결과와 보상 (decisions.md 369번). EX면 stage가 0. */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class StageResult {
    int stage;
    boolean cleared;
    int stars;
    boolean firstClear;
    long capital;

    /** 받은 다이아 (526번). 뽑기권을 주던 때의 저장에는 없다. */
    long diamonds;
  }

  /** 금고 도전 (decisions.md 641번). 없던 저장은 null이라 처음 볼 때 만든다. */
  Vault vault;

  /** 금고 도전의 상태 (641번): 금괴와 훈련은 남고, 나머지는 주(한국 시간 월요일 0시)가 바뀌면 비운다. */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Vault {
    /** 금괴: 금고 도전에서만 얻고 금고 상점에서만 쓴다. */
    long gold;

    /** 금고 훈련의 단계: 금고 전투의 공격력을 올린다. 주가 바뀌어도 남는다. */
    int training;

    /** 보스전 피해량의 역대 최고 기록. */
    double bossRecord;

    /** 아래 칸들이 속한 주. */
    long week = Long.MIN_VALUE;

    /** 이번 주 보스전의 최고 피해량과 금괴를 받은 등급. */
    double bossBest;

    int bossTier;

    /** 이번 주에 돌파한 던전 층과 고른 카드(층마다 한 장, 입장 전에 고른다). */
    int floors;

    List<String> cards = new ArrayList<>();

    /** 이번 주에 금고 상점에서 산 횟수: 상품 코드 → 횟수. */
    Map<String, Integer> bought = new LinkedHashMap<>();

    /** 마지막으로 받은 것 한 줄. 화면이 한 번 알려 준다. */
    String lastNote;
  }

  /** 뽑기에서 나온 것 하나 (517번): 무기면 종류·등급, 고양이면 코드(kind)와 그때의 레벨. 새로 얻었으면 isNew. */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Pulled {
    String kind;
    String grade;
    int level;
    boolean isNew;

    Pulled() {}

    Pulled(String kind, String grade, int level, boolean isNew) {
      this.kind = kind;
      this.grade = grade;
      this.level = level;
      this.isNew = isNew;
    }
  }

  /** 무기 하나 (decisions.md 346번): 종류(pistol·revolver·smg·shotgun·rifle)와 등급(F·E·D·C·B·A·S). */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Weapon {
    String kind;
    String grade;

    /** 가진 수 (366번): 같은 무기를 또 뽑으면 늘고, 무기 합성에 쓰면 준다. 이 칸이 생기기 전의 무기는 하나다. */
    int count = 1;

    Weapon() {}

    Weapon(String kind, String grade) {
      this.kind = kind;
      this.grade = grade;
    }

    boolean same(String kind, String grade) {
      return this.kind.equals(kind) && this.grade.equals(grade);
    }
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

    /** 첫인사 (349번): 버릇대로 한마디. 이 칸을 더하기 전의 뽑기면 null. */
    String hello;
  }
}
