package investorgame.progress;

import investorgame.common.Sex;
import investorgame.common.Stats;
import investorgame.result.Ending;

/**
 * 공유 링크로 보이는 결과 카드 한 장 (#197). 공유를 누른 순간의 화면 값만 담고 IP·세션은 담지 않는다. 이름은 플레이어가 지은 캐릭터
 * 이름이다(decisions.md 135번).
 *
 * @param rank 순위표에 올렸으면 그 순위, 아니면 null
 * @param investorTypeCode 성향이 정해지지 않고 끝났으면 null
 * @param jobTitle 끝날 때의 직업(전업투자자 포함), 없으면 null
 * @param home 끝날 때 사는 곳(PARENTS·MONTHLY·VILLA_JEONSE·APT_JEONSE·OWN)
 */
public record ShareCard(
    String name,
    Sex sex,
    int finalAge,
    Ending ending,
    long initialAsset,
    long finalAsset,
    int returnBp,
    Integer rank,
    Stats initialStats,
    Stats finalStats,
    String investorTypeCode,
    String investorTypeName,
    String investorTypeDescription,
    String sectorName,
    String jobTitle,
    boolean married,
    int children,
    String home) {}
