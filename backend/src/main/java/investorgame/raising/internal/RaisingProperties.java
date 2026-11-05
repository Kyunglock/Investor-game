package investorgame.raising.internal;

import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 3분 육성 한 판의 수치 (증권사 육성 설계 3절, 투자 원칙 장치 설계). (제안)으로 적힌 값을 구현하며 정한 초기값이다. 바꾼 것은 decisions.md에 적는다.
 *
 * @param fund 운용금. 회사가 없는 지금은 판마다 사장의 사재에서 나온다 (6.5절)
 * @param deck 카드 순서. 카드 수가 판의 끝이다 (3.1절)
 * @param buyRatioBp 조금/크게가 열리기 전의 "산다"가 쓰는 현금 비율
 * @param smallRatioBp 조금 사기 (투자 원칙 장치 설계 3.2절)
 * @param bigRatioBp 크게 사기
 * @param reviewInsightExp 뉴스 카드 하나를 복기할 때 안목에 쌓이는 경험치
 * @param deviationExp 손이 뒤집힌 능력치에 쌓이는 경험치
 * @param expPerPoint 능력치 +1에 드는 경험치
 * @param initialStat 태어날 때 능력치 (character.initial-stat과 같은 규칙)
 * @param scripted 처음 온 사람의 짜인 첫 판 (11.2절)
 * @param sideOppositePercent 단서 기사의 곁가지 문장이 숨은 방향의 반대쪽일 확률
 * @param noiseBp 카드 한 장(한 분기) 동안 종목이 저절로 흔들리는 폭(±). 변동성 등급별
 * @param spilloverPercent 종목 뉴스가 같은 섹터의 다른 종목에 번지는 몫
 * @param yearUpBp 공채 육성에서 회사의 올해 시장 갈래(boom·normal·crash)가 뉴스의 오를 확률에 더하는 만분율 (6.2절)
 */
@ConfigurationProperties("raising")
public record RaisingProperties(
    long fund,
    List<Slot> deck,
    int buyRatioBp,
    int smallRatioBp,
    int bigRatioBp,
    int reviewInsightExp,
    int deviationExp,
    int expPerPoint,
    int maxStat,
    int minStat,
    InitialStat initialStat,
    Scripted scripted,
    int sideOppositePercent,
    Map<String, Integer> noiseBp,
    int spilloverPercent,
    Map<String, Integer> yearUpBp,
    Crisis crisis,
    Leverage leverage,
    Principle principle) {

  public enum Slot {
    TRAIT_STYLE,
    TRAIT_SECTOR,
    NEWS,
    BIG,
    LEVERAGE,
    EXAM
  }

  public record InitialStat(int floor, Map<String, Integer> gradePercent) {}

  /**
   * @param stats 첫 판의 능력치. 용기가 낮아 손이 뒤집히고, 안목이 낮아 형광펜이 틀린다
   * @param news 첫 판의 앞쪽 뉴스 세 장. 그 뒤는 무작위다
   */
  public record Scripted(Map<String, Integer> stats, List<ScriptedNews> news) {}

  /**
   * @param mode EASY: 기사만 읽어도 답이 보인다. FLIP: 무엇을 고르든 손이 뒤집힌다. MISLEAD: 형광펜이 틀리고 기사가 맞는다
   * @param up 숨은 방향이 오름인가
   */
  public record ScriptedNews(String news, String stock, boolean up, String mode) {}

  /**
   * @param chancePercent 한 판에 위기가 올 확률
   * @param silentPercent 위기 가운데 전조 없이 오는 몫
   * @param fromCard 위기가 터질 수 있는 가장 이른 카드 번호(0부터)
   * @param omenCards 위기 전 전조가 보이는 뉴스 카드 수
   * @param fallBp 기본 낙폭. 섹터 비율(crises.json)을 곱한다
   */
  public record Crisis(
      int chancePercent, int silentPercent, int fromCard, int omenCards, Range fallBp) {}

  /**
   * @param minDropBp 이만큼 빠진 종목이 있어야 빚내서 사기 카드가 온다. 없으면 돈이 걸린 큰일 카드로 바꾼다
   * @param loanBp 빌리는 돈 = 총자산 × 이 비율
   * @param interestBp 입사 심사 때 빚에 한 번 붙는 이자
   */
  public record Leverage(int minDropBp, int loanBp, int interestBp) {}

  /**
   * @param flips 같은 능력치로 이만큼 뒤집히면 원칙 카드가 뜬다 (확정 2번)
   * @param perRun 판마다 뜨는 원칙 카드 수 (제안: 1)
   * @param maxDevices 동시에 걸어 둘 수 있는 장치 수 (제안: 2)
   * @param releaseAt 장치를 건 능력치가 이만큼 오르면 풀까 묻는다 (제안: 70)
   */
  public record Principle(int flips, int perRun, int maxDevices, int releaseAt) {}

  public record Range(int min, int max) {}
}
