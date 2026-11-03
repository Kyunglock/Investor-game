package investorgame.content;

import investorgame.common.Sex;
import java.util.List;
import java.util.Map;

/**
 * 성향 장면. 성장기의 구체적인 상황에서 어떤 행동을 고르는지로 네 축(기간·위험·소신·관심)과 능력치를 움직인다 (경제 개편 설계 4절). 같은 나이의 장면들이 하나의 단계를
 * 이루고, 판마다 단계별로 하나를 랜덤으로 뽑는다.
 *
 * @param age 이 장면이 속한 성장 단계의 나이. adult 장면은 단계가 없으므로 표시용이다
 * @param adult true면 성장기 단계가 아니라 취업 뒤 일상 장면이다. 간격을 두고 랜덤하게 오며 성향(스타일)은 바꾸지 않고 능력치만 움직인다
 * @param job true면 직장(동료·월급·회사)이 배경인 adult 장면이라 직장에 다니는 동안에만 나온다. 실직·은퇴 중에는 미뤄 두었다가 다시 취업하면 나온다
 * @param holdings true면 들고 있는 주식이 전제인 adult 장면("내 계좌도 빨갛다", "투자 계좌를 일부 판다")이라 보유 종목이 있을 때만 나온다
 *     (decisions.md 115번)
 * @param excludeJobs 이 직업에게는 말이 안 되는 장면이라 안 나온다(성과급·승진·퇴직연금은 알바·농부·대표에게 없다). 비어 있으면 모든 직업
 *     (decisions.md 134번)
 * @param minAge 이 나이부터 나온다(adult). null이면 제한 없음
 * @param maxAge 이 나이까지 나온다(adult). null이면 제한 없음
 * @param single true면 결혼하지 않았을 때만
 * @param childless true면 아이가 없을 때만
 * @param childMinAge 이 나이 이상인 자녀가 있을 때만(독립한 자녀 포함)(childMaxAge와 함께 한 아이가 둘 다 맞아야 한다). null이면 제한 없음
 * @param childMaxAge 이 나이 이하인 자녀가 있을 때만. null이면 제한 없음
 * @param works 지금 처지가 이 가운데 하나일 때만: 직업 코드, {@link #INVESTOR}(전업투자자), {@link #JOBLESS}(무직), {@link
 *     #RETIRED}(은퇴). 비어 있으면 모든 처지
 * @param homes 지금 사는 곳이 이 가운데 하나일 때만: PARENTS·MONTHLY·VILLA_JEONSE·APT_JEONSE·OWN. 비어 있으면 어디든
 * @param requires 앞에서 이 선택("장면코드/선택지코드")을 한 적이 있을 때만(하나라도). 성장기 선택이 성인 장면으로 이어질 때 쓴다
 * @param unless 앞에서 이 선택을 한 적이 있으면 안 나온다(하나라도). 대학에 가지 않은 사람에게 등록금 장면이 안 나오게 할 때 쓴다 (#196)
 * @param followUpOnly 앞 장면의 선택(followUps)으로만 오고 무작위로는 뽑지 않는다 (#195). 성장기 장면이면 자기 나이(age) 단계에 온다
 * @param topic 같은 주제(코인 등)의 장면이 한 판의 성장기에 겹치지 않게 묶는 이름. null이면 묶지 않는다 (#196)
 * @param sex 이 성별의 캐릭터에게만 나온다(입대·전역은 남자만). null이면 누구에게나 (#221)
 */
public record TraitDefinition(
    String code,
    int age,
    Boolean adult,
    Boolean job,
    Boolean married,
    Boolean holdings,
    List<String> excludeJobs,
    Integer minAge,
    Integer maxAge,
    Boolean single,
    Boolean childless,
    Integer childMinAge,
    Integer childMaxAge,
    List<String> works,
    List<String> homes,
    List<String> requires,
    List<String> unless,
    Boolean followUpOnly,
    String topic,
    Sex sex,
    String title,
    String body,
    List<Option> options) {

  /** works의 전업투자자. */
  public static final String INVESTOR = "INVESTOR";

  /** works의 무직(일을 쉬는 중, 은퇴 아님). */
  public static final String JOBLESS = "JOBLESS";

  /** works의 은퇴. */
  public static final String RETIRED = "RETIRED";

  /**
   * JSON에 adult가 없으면 성장기 장면이고, job이 없으면 직업과 무관한 장면, married가 없으면 결혼과 무관한 장면이다 (decisions.md 76번).
   */
  public TraitDefinition {
    adult = adult != null && adult;
    job = job != null && job;
    married = married != null && married;
    holdings = holdings != null && holdings;
    excludeJobs = excludeJobs == null ? List.of() : List.copyOf(excludeJobs);
    single = single != null && single;
    childless = childless != null && childless;
    works = works == null ? List.of() : List.copyOf(works);
    homes = homes == null ? List.of() : List.copyOf(homes);
    requires = requires == null ? List.of() : List.copyOf(requires);
    unless = unless == null ? List.of() : List.copyOf(unless);
    followUpOnly = followUpOnly != null && followUpOnly;
  }

  /** 이 나이에 나올 수 있는가. */
  public boolean fitsAge(int age) {
    return (minAge == null || age >= minAge) && (maxAge == null || age <= maxAge);
  }

  /** 이 성별의 캐릭터에게 나올 수 있는가. 성별을 모르면 가리지 않는다 (#221). */
  public boolean fitsSex(Sex character) {
    return sex == null || character == null || sex == character;
  }

  /** 아이 조건이 있는 장면인가. */
  public boolean wantsChild() {
    return childMinAge != null || childMaxAge != null;
  }

  /** 이 나이의 아이가 조건에 맞는가. */
  public boolean fitsChildAge(int age) {
    return (childMinAge == null || age >= childMinAge)
        && (childMaxAge == null || age <= childMaxAge);
  }

  public Option option(String optionCode) {
    return options.stream().filter(o -> o.code().equals(optionCode)).findFirst().orElse(null);
  }

  /** 이 직업에게 나올 수 있는 장면인가. 직업이 없으면(전업투자자·무직) 직업으로 가리지 않는다. */
  public boolean fitsJob(String jobCode) {
    return jobCode == null || !excludeJobs.contains(jobCode);
  }

  /**
   * @param traitDeltas 키는 "style.<코드>", "sector.<코드>", "risk.<코드>", "mind.<코드>"다. 모든 선택지는 style과
   *     sector를 하나 이상 가진다 (콘텐츠 검증)
   * @param statDeltas 선택 즉시 더해지는 능력치 변화. 키는 insight, patience, courage, conviction (운 금지). JSON에
   *     없으면 빈 맵
   * @param note 이 행동에서 무엇이 드러났는지 한 줄로 알려 주는 문구
   * @param amount 고르는 즉시 오가는 돈(원, 음수면 나간다). JSON에 없으면 0
   * @param outcomes 고른 뒤 결과가 갈리는 선택(돈을 빌려줬는데 갚을지 튈지). 가중치로 하나가 나와 그 돈·능력치·문구가 더해진다. 없으면 빈 목록
   * @param followUps 이 선택 뒤 followUpDays가 지나 이어지는 장면(followUpOnly). 여럿이면 판 시드로 가중치만큼 하나를 고른다. 없으면 빈
   *     목록
   * @param followUpDays followUps가 오기까지의 날 수(일상 장면). 성장기 장면은 받는 장면의 나이 단계에 오므로 쓰지 않는다
   */
  public record Option(
      String code,
      String label,
      Map<String, Integer> traitDeltas,
      Map<String, Integer> statDeltas,
      String note,
      Long amount,
      List<Outcome> outcomes,
      Integer familyDelta,
      List<FollowUp> followUps,
      Integer followUpDays) {

    public Option {
      statDeltas = statDeltas == null ? Map.of() : Map.copyOf(statDeltas);
      amount = amount == null ? 0L : amount;
      outcomes = outcomes == null ? List.of() : List.copyOf(outcomes);
      familyDelta = familyDelta == null ? 0 : familyDelta;
      followUps = followUps == null ? List.of() : List.copyOf(followUps);
    }
  }

  /** 이어지는 장면 하나와 그 가중치. */
  public record FollowUp(String code, int weight) {}

  /** 갈리는 결과 하나. statDeltas는 선택지의 statDeltas에 더해진다. */
  public record Outcome(int weight, long amount, Map<String, Integer> statDeltas, String note) {

    public Outcome {
      statDeltas = statDeltas == null ? Map.of() : Map.copyOf(statDeltas);
    }
  }
}
