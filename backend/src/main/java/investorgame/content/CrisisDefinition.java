package investorgame.content;

import java.util.List;
import java.util.Map;

/**
 * 시장 위기의 갈래 (decisions.md 38번). 실제 세계적 하락을 본떠 전조 문구와 섹터별 낙폭을 정한다. 갈래를 본떴다고 위기가 꼭 오지는 않는다: 같은 전조가 아무
 * 일 없이 지나가기도 한다.
 *
 * @param name 끝난 뒤 돌아볼 때 부르는 이름
 * @param model 본뜬 실제 사건. 끝난 뒤 기록에만 쓴다
 * @param sectorPercent 섹터별 낙폭 비율(%). 100이면 기본 낙폭 그대로, 빠진 섹터는 100
 * @param omens 위기 전에 흘러나오는 전조 문구
 */
public record CrisisDefinition(
    String code,
    String name,
    String model,
    Map<String, Integer> sectorPercent,
    List<String> omens) {

  public int sectorPercentOf(String sector) {
    return sectorPercent.getOrDefault(sector, 100);
  }
}
