package investorgame.household;

import java.util.List;

/** marriedDay·retiredDay는 아직이면 null. childBirthDays는 순번 순. */
public record HouseholdView(
    boolean married, Integer marriedDay, List<Integer> childBirthDays, Integer retiredDay) {}
