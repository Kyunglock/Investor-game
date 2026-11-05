package investorgame.raising.internal;

import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 아주 작은 회사의 수치 (증권사 육성 설계 4·6절, 2단계). (제안)으로 적힌 값을 구현하며 정한 초기값이다.
 *
 * @param turns 회사가 도는 해의 수. 2단계는 세 해로 끝나는 체험판이다
 * @param gradeCapital 회사 등급의 자본 띠(원). F부터 차례로, 자본만 본다 (4.5절)
 * @param seats 등급별 자리 수. F부터 차례로 (4.5절)
 * @param multiplierPercent 등급이 한 단계 오를 때마다 수수료 매출과 판돈에 곱하는 비율 (F = 100%)
 * @param feeBp 수수료 매출 = 자본 × 이 비율 × 배율. 시장이 나빠도 들어오는 바닥 수입
 * @param stakePercent 돈을 굴리는 자리가 나눠 맡는 판돈 = 자본 × 이 비율 × 배율 (자본을 넘지 않는다)
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
 * @param hr 인사팀이 공채 시장을 돕는다 (6.3절)
 * @param market 공채 시장: 해마다 지원자가 오고 계약금을 내고 뽑는다 (decisions.md 228번)
 * @param invest 투자 회의: 해마다 한 번 단서 기사를 놓고 직원들과 고민한다 (decisions.md 229번)
 * @param sale 매각과 재창업 (9절). 한 해 시장 갈래의 가중치는 시대(content/raising.json의 eras)가 정한다
 */
@ConfigurationProperties("raising.company")
public record CompanyProperties(
    int turns,
    List<Long> gradeCapital,
    List<Integer> seats,
    int multiplierPercent,
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
    Hr hr,
    Market market,
    Invest invest,
    Sale sale) {

  /**
   * @param yearUpBp 올해 시장 갈래(boom·normal·crash)가 뉴스가 오를 확률에 더하는 만분율
   * @param sideOppositePercent 곁가지 문장이 숨은 방향의 반대쪽일 확률
   * @param stubbornBp 직원이 제멋대로 할(꼬드김 + 손 뒤집힘) 확률이 이 만분율 이상이면 "보통", 두 배 이상이면 "높음"으로 보인다
   */
  public record Invest(Map<String, Integer> yearUpBp, int sideOppositePercent, int stubbornBp) {}

  /**
   * @param applicants 해마다 오는 지원자 수
   * @param levelSteps 지원자 종합 등급의 중심 = 회사 등급보다 이만큼 위 (F 회사면 D)
   * @param spread 지원자 능력치가 중심 띠에서 흩어지는 폭(±점수). 성격이 뾰족해진다
   * @param fees 종합 등급별 계약금(원). F부터 SSS까지
   * @param refreshCost 지원자를 새로 받는 값(원)
   */
  public record Market(
      int applicants, int levelSteps, int spread, List<Long> fees, long refreshCost) {}

  /**
   * @param capSteps 인사 직원이 데려오는 지원자의 중심 등급 = 인사 직원 종합 등급보다 이만큼 아래. 회사 등급으로 정한 중심보다 높을 때만 쓴다
   * @param extraApplicants 인사팀에 사람이 있으면 더 오는 지원자 수
   */
  public record Hr(int capSteps, int extraApplicants) {}

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
      int leaderFlipPercent) {}

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
   * @param baseCapital 회사의 시작 자본 (명성 0). 첫 회사는 사장의 사재다
   * @param fameCapitalPercent 명성 한 단계마다 시작 자본에 더하는 비율 (명성 혜택)
   */
  public record Sale(
      String minGrade,
      int famePerStep,
      int voluntaryBonus,
      int cofounderBase,
      int cofounderFameSteps,
      int cofounderMax,
      long baseCapital,
      int fameCapitalPercent) {}
}
