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
 * @param market 뽑은 사람의 능력치 (decisions.md 228번)
 * @param gacha 채용 뽑기: 채용권으로 뽑는다 (decisions.md 312·315번, 합성은 384번에서 뺐다)
 * @param invest 투자 회의: 해마다 한 번 단서 기사를 놓고 직원들과 고민한다 (decisions.md 229번)
 * @param people 근속과 사기 (decisions.md 262·270번, 이직 제안은 385번에서 뺐다)
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
   * 자본으로 사는 전투 강화 (decisions.md 367·394번). 최대 단계는 없다.
   *
   * @param basePrice 첫 단계 값(원)
   * @param priceGrowthPercent 단계마다 값이 오르는 비율(%)
   * @param maxBatch 한 요청에 올릴 수 있는 단계 수(꾹 눌러 모은 단계를 묶어 보낸다)
   * @param stepPercent 강화(damage·fire)마다 한 단계에 오르는 비율(%). fire는 쏘는 빠르기가 오른다(간격 ÷ (1 + 비율))
   */
  public record Upgrades(
      long basePrice, int priceGrowthPercent, int maxBatch, Map<String, Integer> stepPercent) {}

  /** 건물 이사 (decisions.md 296번): 이사 비용은 다음 띠 자본의 percent%. 자본이 다음 띠 + 비용 이상일 때만 간다. */
  /**
   * @param percent 이사 비용: 다음 띠 자본의 이 비율(%)
   * @param buildYears 새 건물로 가는 등급의 공사 기간(해, #347). 없으면 바로 된다
   * @param deskUnlock 돕는 자리가 열리는 회사 등급(#393). 없는 자리는 처음부터 열려 있다
   */
  public record Upgrade(
      int percent, Map<String, Integer> buildYears, Map<String, String> deskUnlock) {}

  /**
   * 종목 발굴 (decisions.md 267번). 분기 넘기기를 누르면 종목 발굴팀 직원이 basePercent + 안목 × insightPercent / 100 확률로,
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
   * @param deskGainPercent 분기 데스크에서 맞혔을 때 버는 몫에 회사 등급(F부터)마다 곱하는 비율(%). gainPercent 대신 쓴다. 등급 효과가
   *     등급마다 두 배라(387번) 벽도 등급마다 거의 절반씩 높다. 목록보다 높은 등급은 마지막 값
   */
  public record Scale(
      int gainPercent, int missPercent, int crashPercent, List<Double> deskGainPercent) {}

  /**
   * @param yearUpBp 올해 시장 갈래(boom·normal·crash)가 뉴스가 오를 확률에 더하는 만분율
   * @param sideOppositePercent 곁가지 문장이 숨은 방향의 반대쪽일 확률
   * @param stubbornBp 직원이 제멋대로 할(꼬드김 + 손 뒤집힘) 확률이 이 만분율 이상이면 "보통", 두 배 이상이면 "높음"으로 보인다
   */
  public record Invest(
      Map<String, Integer> yearUpBp,
      int sideOppositePercent,
      int stubbornBp,
      int bigStakePercent,
      int bigMissPercent,
      int bigStubbornPercent,
      int meetingStakePercent,
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
   * 근속 (decisions.md 262번). 이직 제안(poach-from-year·poach-percent·transfer-percent)은 385번에서 뺐다.
   *
   * @param settleYears 같은 자리에서 이 해째부터 손에 익는다
   * @param settledFlipPercent 손에 익으면 손이 뒤집힐 확률에 곱한다
   */
  public record People(int settleYears, int settledFlipPercent, Pay pay) {}

  /**
   * 사기 (decisions.md 270번). 연봉·연봉 협상·사표는 뺐다(383번).
   *
   * @param moraleFlipPercent 사기 한 칸마다 손이 뒤집힐 확률에 더하거나(낮을 때) 빼는(높을 때) 비율(%)
   */
  public record Pay(int moraleFlipPercent) {}

  /**
   * 뽑은 사람의 능력치 (decisions.md 228·312번). 계약금(fees·fee-bp·veteran-fee-*)은 채용 뽑기로 바뀌며 내지 않게 됐고(312번),
   * 그것을 바탕으로 하던 연봉(383번)과 이적료(385번)도 빠져 함께 뺐다.
   *
   * @param levelSteps 뽑기 확률표의 중심 = 회사 등급보다 이만큼 위
   * @param spread 뽑은 사람의 능력치가 중심 띠에서 흩어지는 폭(±점수). 성격이 뾰족해진다
   */
  public record Market(int levelSteps, int spread) {}

  /**
   * 채용 뽑기 (decisions.md 312번).
   *
   * @param startTickets 회사를 차릴 때 받는 채용권
   * @param quarterTickets 분기를 넘길 때마다 받는 채용권
   * @param yearTickets 연말 결산 때 더 받는 채용권
   * @param achievementTickets 업적 하나를 열 때 받는 채용권
   * @param moveTickets 건물을 올릴 때 받는 채용권
   * @param maxDraws 한 번에 뽑을 수 있는 최대 수
   * @param rosterMax 데리고 있을 수 있는 사람 수(쉬는 사람 포함, 337번). 넘으면 내보내야 더 뽑는다
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
      List<Rate> rates) {}

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
   * 등급 효과 (decisions.md 289·387번): 종합 등급마다.
   *
   * @param gainPercent 분기 데스크에서 맞혔을 때 버는 몫에 더 얹는 비율(%). F~GOD 모두, 등급마다 두 배. 종목 회의 손익에는 붙지 않는다
   * @param growthPercent 한 해 자리에서 일하면 가장 낮은 능력치(운 빼고)가 한 띠 오를 확률(%). SSS는 0: 그 위는 실전 경험으로 오른다
   * @param flipPercent 손이 뒤집힐 확률에 곱하는 비율(%). 높을수록 판단이 흔들리지 않는다. SSS 위는 SSS 값
   * @param readBonus 종목 회의에서 기사를 읽을 때 안목에 더하는 점수. SSS 위는 SSS 값
   * @param stopLossPercent A 손절: 손이 뒤집혀 잃는 몫에 곱하는 비율(%)
   * @param pullGainPercent S 끌어주기: 같은 데스크 동료가 맞혔을 때 더 버는 비율(%)
   * @param shieldPercent SS 방패: 분기에 잃었을 때 막아 주는 손실의 비율(%)
   */
  public record Perks(
      Map<String, Integer> gainPercent,
      Map<String, Integer> growthPercent,
      Map<String, Integer> flipPercent,
      Map<String, Integer> readBonus,
      int stopLossPercent,
      int pullGainPercent,
      int shieldPercent) {}

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
