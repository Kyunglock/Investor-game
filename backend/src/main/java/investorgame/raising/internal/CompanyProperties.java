package investorgame.raising.internal;

import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 아주 작은 회사의 수치 (증권사 육성 설계 4·6절, 2단계). (제안)으로 적힌 값을 구현하며 정한 초기값이다.
 *
 * @param baseCapital 사장의 사재: 회사를 차릴 때의 시작 자본 (decisions.md 228·247번)
 * @param turns 한 시대의 길이(해). 이만큼 지나면 다른 시대가 온다 (decisions.md 250번). 회사는 끝나지 않는다(236번)
 * @param gradeCapital 회사 등급의 자본 띠(원). F부터 차례로, 자본만 본다 (4.5절)
 * @param seats 등급별 자리 수. F부터 차례로 (4.5절)
 * @param scale 규모의 벽: 회사 등급이 오를수록 맞혀서 버는 몫은 줄고 틀리거나 폭락장에 잃는 몫은 커진다 (decisions.md 244번)
 * @param feeBp 수수료 매출 = 자본 × 이 비율. 시장이 나빠도 들어오는 바닥 수입
 * @param stakePercent 돈을 굴리는 자리가 나눠 맡는 판돈 = 자본 × 이 비율 (자본을 넘지 않는다)
 * @param decisions 직원 한 명이 한 해에 내리는 매매 판단 수
 * @param omenPercent 폭락장 앞에 연초 회의에서 조짐이 보일 확률 (나머지는 조짐 없이 온다)
 * @param falseOmenPercent 폭락장이 아닌 해에 헛조짐이 보일 확률
 * @param desks 돈을 굴리는 자리의 손익(만분율): 맞히면 gain, 틀리면 miss, 손이 뒤집히면 flip. 폭락장의 시장 손익에는 crash-percent를
 *     곱한다
 * @param interestBonusBp 직원의 관심 섹터와 같은 섹터 데스크에 앉으면 맞혔을 때 더하는 몫(만분율)
 * @param phaseBp 한 해 시장이 판단 하나마다 더하는 손익(만분율)
 * @param swayPercent 꼬드김 판정이 다른 판정보다 덜 일어나는 비율. 리스크 관리 팀이 없을 때
 * @param experience 실전 경험과 큰 손실의 등급 하락 (2.3·6.4절)
 * @param effects X 이상 등급의 효과 수치 (2.4절)
 * @param hr 인사팀이 채용 뽑기를 돕는다 (6.3절)
 * @param market 뽑은 사람의 능력치와 계약금(연봉·이적료의 바탕) (decisions.md 228번)
 * @param gacha 채용 뽑기: 채용권으로 뽑고, 같은 등급 둘을 합쳐 한 단계 위로 (decisions.md 312·315번)
 * @param invest 투자 회의: 해마다 한 번 단서 기사를 놓고 직원들과 고민한다 (decisions.md 229번)
 * @param people 이직 제안과 근속 (decisions.md 262번)
 * @param macro 거시경제 회의: 올해 회사의 태도가 그해 결산 전체에 걸린다 (decisions.md 266번)
 * @param scout 종목 발굴: 종목 회의는 직원이 종목을 물어 올 때만 열린다 (decisions.md 267번)
 * @param sale 매각과 재창업 (9절). 매각을 뺀 뒤(236번)로는 API가 부르지 않는다. 다시 붙일 때를 위해 남겼다 (264번)
 */
@ConfigurationProperties("raising.company")
public record CompanyProperties(
    long baseCapital,
    int turns,
    List<Long> gradeCapital,
    Upgrade upgrade,
    List<Integer> seats,
    Scale scale,
    int feeBp,
    int stakePercent,
    int decisions,
    int omenPercent,
    int falseOmenPercent,
    Map<String, DeskReturn> desks,
    int interestBonusBp,
    Map<String, Integer> phaseBp,
    int swayPercent,
    int crashFlipPercent,
    Experience experience,
    Effects effects,
    Perks perks,
    Hr hr,
    Market market,
    Gacha gacha,
    Invest invest,
    People people,
    Macro macro,
    Scout scout,
    Sale sale,
    String endingGrade,
    Mental mental) {

  /**
   * 멘탈 전투 (decisions.md 328번). 강화율(%) = min(maxPercent, 물리친 적 ÷ killsPerPercent + 남은 멘탈 ÷
   * mentalPerPercent). 보고 값은 maxKills·maxMental로 자른다. genreWeights: 시장
   * 갈래(boom·normal·crash·burst)마다 장르별 가중치.
   */
  public record Mental(
      int killsPerPercent,
      int mentalPerPercent,
      int maxPercent,
      int maxKills,
      int maxMental,
      Map<String, Map<String, Integer>> genreWeights,
      Map<String, Weapon> weapons,
      Map<String, WeaponGrade> weaponGrades,
      WeaponGacha weaponGacha,
      Upgrades upgrades,
      Stages stages) {}

  /**
   * 스테이지 (decisions.md 369번).
   *
   * @param perChapter 한 챕터의 스테이지 수. 지금은 챕터 하나라 이것이 마지막 스테이지다. 챕터 마지막은 보스
   * @param capitalPerStage 처음 깰 때 주는 자본 = 스테이지 번호 × 이것
   * @param clearTickets 처음 깰 때 주는 무기 뽑기권
   * @param bossTickets 보스 스테이지를 처음 깰 때 주는 무기 뽑기권
   * @param starTickets 별을 처음 얻을 때마다 주는 무기 뽑기권
   * @param bonusPerStage 분기 강화율: 깬 최고 스테이지 하나에 이만큼(%)
   * @param maxBonus 분기 강화율 상한(%)
   * @param exKillsPerTicket EX 디펜스: 물리친 적 이만큼마다 뽑기권 한 장 더
   * @param exMaxTickets EX 디펜스가 주는 뽑기권 상한
   */
  public record Stages(
      int perChapter,
      long capitalPerStage,
      int clearTickets,
      int bossTickets,
      int starTickets,
      int bonusPerStage,
      int maxBonus,
      int exKillsPerTicket,
      int exMaxTickets) {}

  /** 무기 종류 하나의 바탕 수치 (346번). damagePercent 100이 탄 하나에 적 체력 1. power는 탄 강화 단계(362번). */
  public record Weapon(int damagePercent, int fireMs, int power, int bulletSpeed) {}

  /** 무기 등급(N·R·SR·UR)이 더하는 공격력(%)과 줄이는 연사 간격(%). */
  public record WeaponGrade(int damagePercent, int firePercent) {}

  /**
   * 무기 뽑기 (decisions.md 366번).
   *
   * @param gradeWeights 등급(N·R·SR·UR)별 가중치. 종류는 고르게 뽑는다
   * @param startTickets 처음(또는 이 칸이 생기기 전의 회사가 처음 불러올 때) 받는 무기 뽑기권
   * @param battleTickets 분기 전투 결과를 보낼 때마다 받는 무기 뽑기권
   * @param mergeCount 합쳐 한 등급 올리는 데 드는 같은 무기 수
   */
  public record WeaponGacha(
      Map<String, Integer> gradeWeights, int startTickets, int battleTickets, int mergeCount) {}

  /**
   * 자본으로 사는 전투 강화 (decisions.md 367번).
   *
   * @param maxLevel 강화마다 올릴 수 있는 최대 단계
   * @param basePrice 첫 단계 값(원)
   * @param priceFactor 단계마다 값에 곱하는 수
   * @param stepPercent 강화(damage·fire·speed)마다 한 단계에 오르는 비율(%). fire는 연사 간격을 줄인다
   */
  public record Upgrades(
      int maxLevel, long basePrice, int priceFactor, Map<String, Integer> stepPercent) {}

  /** 건물 이사 (decisions.md 296번): 이사 비용은 다음 띠 자본의 percent%. 자본이 다음 띠 + 비용 이상일 때만 간다. */
  /**
   * @param percent 이사 비용: 다음 띠 자본의 이 비율(%)
   * @param buildYears 새 건물로 가는 등급의 공사 기간(해, #347). 없으면 바로 된다
   * @param deskUnlock 돕는 자리가 열리는 회사 등급(#393). 없는 자리는 처음부터 열려 있다
   */
  public record Upgrade(
      int percent, Map<String, Integer> buildYears, Map<String, String> deskUnlock) {}

  /**
   * 거시경제 회의 (decisions.md 266번).
   *
   * @param normalUpPercent 보통 해에 숨은 방향이 오름(시장에 좋은 쪽)일 확률. 호황은 늘 오름, 폭락장은 늘 내림
   * @param stakePercent 태도별 그해 결산 판돈 비율(%)
   * @param defensiveCrashPercent 방어면 폭락장의 시장 손익에 곱하는 비율(%)
   * @param windBp 섹터 바람: 순풍 자리는 맞혔을 때 이만큼 더 벌고, 역풍 자리는 덜 번다(만분율)
   * @param rightBp 태도가 숨은 방향과 맞으면(공격인데 오름, 방어인데 내림) 판단마다 더하는 만분율 (#388)
   * @param wrongBp 태도가 숨은 방향과 어긋나면(공격인데 내림, 방어인데 오름) 판단마다 빼는 만분율 (#388)
   */
  public record Macro(
      int normalUpPercent,
      Map<String, Integer> stakePercent,
      int defensiveCrashPercent,
      int windBp,
      Map<String, Integer> rightBp,
      Map<String, Integer> wrongBp) {}

  /**
   * 종목 발굴 (decisions.md 267번). 거시경제 회의가 끝나면 종목 발굴팀 직원이 basePercent + 안목 × insightPercent / 100 확률로,
   * 섹터 데스크 직원이 deskPercent 확률로 종목을 물어 온다. 가져온 사람의 안목이 높을수록 종목이 오를 때가 많고 기사가 또렷하다.
   *
   * @param upPerInsightBp 가져온 사람의 안목이 50보다 1 높을 때마다 종목이 오를 확률에 더하는 만분율(낮으면 뺀다)
   * @param clearInsight 가져온 사람의 안목이 이 이상이면 또렷한 기사
   * @param murkyInsight 이 이상이면 조금 흐린 기사, 아래면 가장 흐린 기사(소문)
   */
  public record Scout(
      int basePercent,
      int insightPercent,
      int deskPercent,
      int upPerInsightBp,
      int clearInsight,
      int murkyInsight) {}

  /**
   * 규모의 벽 (decisions.md 244번). 회사 등급 단계(F = 0)만큼 거듭제곱해 곱한다. 큰 돈은 시장이 받아 주지 않아 맞혀도 덜 벌고, 틀리면 빠져나오기
   * 어려워 더 잃고, 폭락장에는 덩치만큼 크게 맞는다. 그래서 어느 등급에서도 잃는 해가 있다.
   *
   * @param gainPercent 맞혔을 때 버는 몫(투자 회의 포함)에 등급 단계마다 곱하는 비율
   * @param missPercent 틀리거나 꼬드김·손 뒤집힘으로 잃는 몫(투자 회의 포함)에 등급 단계마다 곱하는 비율
   * @param crashPercent 폭락장의 시장 손익에 등급 단계마다 곱하는 비율
   */
  public record Scale(int gainPercent, int missPercent, int crashPercent) {}

  /**
   * @param yearUpBp 올해 시장 갈래(boom·normal·crash)가 뉴스가 오를 확률에 더하는 만분율
   * @param sideOppositePercent 곁가지 문장이 숨은 방향의 반대쪽일 확률
   * @param stubbornBp 직원이 제멋대로 할(꼬드김 + 손 뒤집힘) 확률이 이 만분율 이상이면 "보통", 두 배 이상이면 "높음"으로 보인다
   * @param proposalMinGrade "잠깐만요, 사장님!!"(막판 제안)을 쓸 수 있는 가장 낮은 종합 등급 (decisions.md 300번)
   * @param proposalPercent 그 등급 직원이 손을 들 확률(%), 한 단계 높을 때마다 proposalStepPercent씩 더해
   *     proposalMaxPercent까지
   */
  public record Invest(
      Map<String, Integer> yearUpBp,
      int sideOppositePercent,
      int stubbornBp,
      int bigStakePercent,
      int bigMissPercent,
      int bigStubbornPercent,
      int meetingStakePercent,
      String proposalMinGrade,
      int proposalPercent,
      int proposalStepPercent,
      int proposalMaxPercent,
      int proposalBonusPercent,
      List<Clarity> clarity) {}

  /**
   * 투자 회의 기사가 얼마나 또렷한가 (decisions.md 241번). 회의마다 가중치로 하나를 뽑고, 기사를 읽는 모든 직원(리서치 팀 형광펜 포함)의 안목에서
   * penalty를 뺀다. 흐린 기사에서는 안목 높은 직원끼리도 의견이 갈린다.
   *
   * @param code clear·murky·foggy
   * @param weight 뽑힐 가중치
   * @param penalty 읽을 때 안목에서 빼는 점수
   */
  public record Clarity(String code, int weight, int penalty) {}

  /**
   * 뽑은 사람의 능력치와 계약금 (decisions.md 228·258·312번). 계약금은 이제 내지 않지만 연봉(270번)과 이적료(262번)의 바탕으로 남는다.
   *
   * @param levelSteps 뽑기 확률표의 중심 = 회사 등급보다 이만큼 위
   * @param spread 뽑은 사람의 능력치가 중심 띠에서 흩어지는 폭(±점수). 성격이 뾰족해진다
   * @param fees 종합 등급(F~SSS)별 정해진 계약금
   * @param feeBp 종합 등급별 자본 비율 계약금(만분율). 정해진 계약금과 이것 가운데 큰 쪽
   * @param veteranFeeBp 경력직(X 이상)의 계약금(자본의 만분율). 단계마다 veteranFeeStepBp만큼 더
   */
  /**
   * 이직 제안과 근속 (decisions.md 262번).
   *
   * @param poachFromYear 이 해부터 이직 제안이 온다
   * @param poachPercent 해마다 이직 제안이 올 확률
   * @param transferPercent 보낼 때 받는 이적료 = 그 직원 계약금 × 이 비율
   * @param settleYears 같은 자리에서 이 해째부터 손에 익는다
   * @param settledFlipPercent 손에 익으면 손이 뒤집힐 확률에 곱한다
   */
  public record People(
      int poachFromYear,
      int poachPercent,
      int transferPercent,
      int settleYears,
      int settledFlipPercent,
      Pay pay) {}

  /**
   * 연봉과 사기 (decisions.md 270번).
   *
   * @param salaryPercent 한 해 연봉 = 그 직원 계약금의 자본 비율 몫 × 이 비율(%). 분기마다 4분의 1씩 나간다
   * @param salaryFromGrade 이 회사 등급부터 연봉이 나간다. 그 아래 작은 회사의 직원은 지분으로 받는다
   * @param raiseStepPercent 연봉을 올려 줄 때마다 오르는 비율(%)
   * @param raiseFromYear 이 해부터 연봉 협상이 온다
   * @param raisePercent 해마다 연봉 협상이 올 확률(%)
   * @param raiseEveryYears 한 사람이 이만큼 해가 지나야 다시 올려 달라고 한다
   * @param moraleFlipPercent 사기 한 칸마다 손이 뒤집힐 확률에 더하거나(낮을 때) 빼는(높을 때) 비율(%)
   */
  public record Pay(
      int salaryPercent,
      String salaryFromGrade,
      int raiseStepPercent,
      int raiseFromYear,
      int raisePercent,
      int raiseEveryYears,
      int moraleFlipPercent,
      int ignoreQuarters,
      int ignoreLeavePercent,
      int freezeLeavePercent,
      int raiseGrowPercent) {}

  public record Market(
      int levelSteps,
      int spread,
      List<Long> fees,
      List<Integer> feeBp,
      int veteranFeeBp,
      int veteranFeeStepBp) {}

  /**
   * 채용 뽑기 (decisions.md 312번).
   *
   * @param startTickets 회사를 차릴 때 받는 채용권
   * @param quarterTickets 분기를 넘길 때마다 받는 채용권
   * @param yearTickets 연말 결산 때 더 받는 채용권
   * @param achievementTickets 업적 하나를 열 때 받는 채용권
   * @param moveTickets 건물을 올릴 때 받는 채용권
   * @param maxDraws 한 번에 뽑을 수 있는 최대 수
   * @param rosterMax 데리고 있을 수 있는 사람 수(쉬는 사람 포함, 337번). 넘으면 합쳐야 더 뽑는다
   * @param mergeCount 합성에 드는 같은 등급 사람 수(바탕 한 명 포함). 바탕이 한 단계 오른다
   * @param rates 확률표: 회사 등급(인사팀이면 더 높게)에서 steps 단계 위가 percent%로. star면 특급
   */
  public record Gacha(
      int startTickets,
      int quarterTickets,
      int yearTickets,
      int achievementTickets,
      int moveTickets,
      int maxDraws,
      int rosterMax,
      int mergeCount,
      List<Rate> rates,
      int jackpotPercent,
      int inheritPercent) {}

  /** 뽑기 확률표의 한 칸: 회사 등급보다 steps 단계 위(음수면 아래)가 percent%. star면 특급(특급 연출, 능력치가 그 띠에 고르게). */
  public record Rate(int steps, int percent, boolean star) {}

  /**
   * @param capSteps 인사 직원이 끌어올리는 뽑기 중심 등급 = 인사 직원 종합 등급보다 이만큼 아래. 회사 등급으로 정한 중심보다 높을 때만 쓴다
   * @param extraTickets 인사팀에 사람이 있으면 연말에 더 받는 채용권
   */
  public record Hr(int capSteps, int extraTickets) {}

  /**
   * @param convictionGainBp X 확신: 맞히면 더 버는 몫(만분율)
   * @param convictionMissPercent X 확신: 틀렸을 때 잃는 몫의 비율. 편차가 줄어든다
   * @param contrarianCrashBp XXX 역발상: 폭락장에 판단마다 잃는 대신 버는 몫
   * @param leaderFlipPercent Z 리더: 같은 자리 팀원의 꼬드김·손 뒤집힘 확률에 곱하는 비율
   */
  public record Effects(
      int convictionGainBp,
      int convictionMissPercent,
      int contrarianCrashBp,
      int leaderFlipPercent,
      int bigGainPercent,
      int wallMissPercent,
      int godFlipPercent) {}

  /**
   * 등급 효과 (decisions.md 289번): 종합 등급(F~SSS)마다.
   *
   * @param gainPercent 맞혔을 때 버는 몫에 더 얹는 비율(%). SSS 위(X~GOD)는 SSS 값
   * @param growthPercent 한 해 자리에서 일하면 가장 낮은 능력치(운 빼고)가 한 띠 오를 확률(%). SSS는 0: 그 위는 실전 경험으로 오른다
   */
  public record Perks(Map<String, Integer> gainPercent, Map<String, Integer> growthPercent) {}

  /**
   * @param dropLossPercent 한 해 결산에서 맡은 판돈이 이만큼 빠지면 종합 등급 한 단계 하락 (6.4절 제안: 30)
   * @param band 능력치 한 띠의 점수. 떨어지거나 되찾을 때 이만큼 움직인다
   * @param needBase SSS에서 X로 오르는 데 드는 실전 경험. 단계마다 1씩 더 든다 (2.3절: 단계마다 커진다)
   */
  public record Experience(int dropLossPercent, int band, int needBase) {}

  /**
   * @param crashPercent 폭락장에 한 해 시장 손익(phase-bp)에 곱하는 비율. 식품·금융처럼 방어가 되는 섹터는 100보다 작고, 반도체처럼 크게 빠지는
   *     섹터는 크다
   */
  public record DeskReturn(int gainBp, int missBp, int flipBp, int crashPercent) {}

  /**
   * @param minGrade 시대가 끝나기 전에 스스로 팔 수 있는 회사 등급 (9.1절 제안: SSS)
   * @param famePerStep 사장 명성 한 단계에 드는 명성 점수 (9.2절)
   * @param voluntaryBonus 시대가 끝나기 전에 스스로 팔면 더 얹는 명성 점수
   * @param cofounderBase 다음 회사에 데려갈 수 있는 공동창업자 수의 바닥 (9.3절: 한두 명)
   * @param cofounderFameSteps 명성이 이만큼 오를 때마다 공동창업자 +1
   * @param cofounderMax 공동창업자 수의 상한
   * @param fameCapitalPercent 명성 한 단계마다 시작 자본에 더하는 비율 (명성 혜택)
   */
  public record Sale(
      String minGrade,
      int famePerStep,
      int voluntaryBonus,
      int cofounderBase,
      int cofounderFameSteps,
      int cofounderMax,
      int fameCapitalPercent) {}
}
