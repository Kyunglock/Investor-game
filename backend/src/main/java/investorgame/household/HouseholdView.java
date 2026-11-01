package investorgame.household;

import investorgame.common.Sex;
import java.util.List;

/**
 * marriedDay·retiredDay는 아직이면 null. children은 순번 순.
 *
 * @param children 자녀. leaveDay는 독립해서 집을 나가는 날, sex는 성별(둘 다 태어날 때 정해진다, decisions.md 68·69번)
 * @param spouse 배우자. 미혼이거나 소개 없이 결혼한 옛 판이면 null (decisions.md 77번)
 */
public record HouseholdView(
    boolean married, Integer marriedDay, List<Child> children, Integer retiredDay, Spouse spouse) {

  /** 자녀 하나. 20~25세에 집을 나간다 (decisions.md 138번). */
  public record Child(int seq, int birthDay, int leaveDay, Sex sex) {
    /** 이 날에 집을 떠난 뒤인가. */
    public boolean leftBy(int day) {
      return day >= leaveDay;
    }
  }

  /** 자녀가 태어난 날. 순번 순. */
  public List<Integer> childBirthDays() {
    return children.stream().map(Child::birthDay).toList();
  }
}
