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
 * @param recruitPercent 공채 육성의 운용금 = 자본 × 이 비율 (6.5절)
 * @param recruitMax 공채 육성 운용금의 상한
 * @param decisions 직원 한 명이 한 해에 내리는 매매 판단 수
 * @param phaseWeights 한 해 시장의 갈래와 가중치: boom·normal·crash
 * @param omenPercent 폭락장 앞에 연초 회의에서 조짐이 보일 확률 (나머지는 조짐 없이 온다)
 * @param falseOmenPercent 폭락장이 아닌 해에 헛조짐이 보일 확률
 * @param desks 돈을 굴리는 자리의 손익(만분율): 맞히면 gain, 틀리면 miss, 손이 뒤집히면 flip
 * @param phaseBp 한 해 시장이 판단 하나마다 더하는 손익(만분율)
 * @param swayPercent 꼬드김 판정이 다른 판정보다 덜 일어나는 비율. 리스크 관리 팀이 없을 때
 */
@ConfigurationProperties("raising.company")
public record CompanyProperties(
    int turns,
    List<Long> gradeCapital,
    List<Integer> seats,
    int multiplierPercent,
    int feeBp,
    int stakePercent,
    int recruitPercent,
    long recruitMax,
    int decisions,
    Map<String, Integer> phaseWeights,
    int omenPercent,
    int falseOmenPercent,
    Map<String, DeskReturn> desks,
    Map<String, Integer> phaseBp,
    int swayPercent,
    int crashFlipPercent) {

  public record DeskReturn(int gainBp, int missBp, int flipBp) {}
}
