package investorgame.progress.internal;

import investorgame.common.GameProperties;
import investorgame.content.ContentCatalog;
import investorgame.household.HouseholdService;
import investorgame.household.HouseholdView;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.random.RandomGenerator;
import org.springframework.stereotype.Component;

/**
 * 힘든 일 뒤 누군가의 위로 한 줄 (decisions.md 85번). 결혼했으면 배우자, 집에 있는 여섯 살 넘은 아이, 55세까지는 부모님, 그리고 언제나 친구 가운데 판
 * 시드로 한 명을 골라 상황에 맞는 문구를 준다. 위로를 받으면 행복도가 조금 돌아온다.
 */
@Component
class Comforter {

  static final String LAYOFF = "layoff";
  static final String CAREER_FAIL = "career-fail";
  static final String BIG_LOSS = "big-loss";
  static final String FRAUD = "fraud";

  private static final int CHILD_MIN_AGE = 6;
  private static final int PARENTS_UNTIL_AGE = 55;
  private static final int HAPPY_COMFORT = 2;

  /** 가족 점수가 이 이상이면 가족의 위로가 더 깊다: 행복도가 두 배로 돌아온다 (#230, decisions.md 165번). */
  static final int WARM_FAMILY_FROM = 70;

  private final HouseholdService household;
  private final ContentCatalog content;
  private final GameProperties calendar;

  Comforter(HouseholdService household, ContentCatalog content, GameProperties calendar) {
    this.household = household;
    this.content = content;
    this.calendar = calendar;
  }

  /** age는 내 나이. 모르면(null) 부모님은 빠진다. */
  Optional<String> comfort(
      UUID gameId, String situation, int day, Integer age, RandomGenerator rng) {
    HouseholdView home = household.get(gameId);
    int family = household.familyScore(gameId);
    // 남처럼 멀어진 가족(111번)은 위로하지 않는다 (decisions.md 165번).
    boolean cold = family < HousingFlow.COLD_FAMILY_BELOW;
    List<String> who = new ArrayList<>();
    if (home.married() && !cold) {
      who.add("spouse");
    }
    boolean child =
        home.children().stream()
            .anyMatch(
                c ->
                    !c.leftBy(day)
                        && (day - c.birthDay()) / calendar.daysPerYear() >= CHILD_MIN_AGE);
    if (child && !cold) {
      who.add("child");
    }
    if (age != null && age <= PARENTS_UNTIL_AGE) {
      who.add("parents");
    }
    who.add("friend");
    String by = who.get(rng.nextInt(who.size()));
    List<String> lines = content.comfortPhrases(situation, by);
    if (lines.isEmpty()) {
      return Optional.empty();
    }
    boolean byFamily = by.equals("spouse") || by.equals("child");
    household.cheer(
        gameId, byFamily && family >= WARM_FAMILY_FROM ? HAPPY_COMFORT * 2 : HAPPY_COMFORT);
    // 위로를 주고받으면 가족도 조금 가까워진다 (decisions.md 88번).
    household.bond(gameId, 1);
    return Optional.of(lines.get(rng.nextInt(lines.size())));
  }
}
