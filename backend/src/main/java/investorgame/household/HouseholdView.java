package investorgame.household;

import java.util.List;

/**
 * marriedDay·retiredDay는 아직이면 null. children은 순번 순.
 *
 * @param children 자녀. leaveDay는 독립해서 집을 나가는 날(태어날 때 정해진다, decisions.md 68번)
 */
public record HouseholdView(
    boolean married, Integer marriedDay, List<Child> children, Integer retiredDay) {

  /** 자녀 하나. 25~30세에 집을 나간다. */
  public record Child(int seq, int birthDay, int leaveDay) {
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
