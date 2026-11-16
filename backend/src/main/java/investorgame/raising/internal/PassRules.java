package investorgame.raising.internal;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;

/**
 * 시즌패스의 규칙 (decisions.md 529·568번): 시즌은 epoch부터 days일마다 이어지고, 단계마다 포인트 points-per-step이 든다. 포인트는
 * 미션을 깨면 들어온다. 무료 줄 하나뿐이다. 오늘 날짜(한국 시간)는 부르는 쪽이 준다.
 */
class PassRules {
  private final CompanyProperties properties;

  PassRules(CompanyProperties properties) {
    this.properties = properties;
  }

  CompanyProperties.Pass rule() {
    return properties.pass();
  }

  private LocalDate epoch() {
    return LocalDate.parse(rule().epoch());
  }

  /** 오늘의 시즌 번호(1부터). 첫 시즌이 시작하기 전이면 1. 테스트판은 넘긴 만큼(offset) 뒤의 시즌이다. */
  int season(CompanyState c, LocalDate today) {
    long days = ChronoUnit.DAYS.between(epoch(), today);
    return (int) Math.max(0, Math.floorDiv(days, rule().days())) + 1 + c.passSeasonOffset;
  }

  /** 그 시즌이 끝나는 날(다음 시즌의 첫날, 한국 시간 자정). */
  LocalDate ends(CompanyState c, LocalDate today) {
    int natural = season(c, today) - c.passSeasonOffset;
    return epoch().plusDays((long) natural * rule().days());
  }

  /** 단계에 100이 들던 때(529번)의 저장을 새 단계 값으로 옮길 때 곱하는 수: 닿은 단계가 그대로 남는다. */
  private static final int OLD_STEP = 100;

  private static final int RULES = 2;

  /** 시즌이 바뀌었으면 진행도를 비운다: 받지 않은 보상은 사라지고 미션도 처음부터 센다. 바꿨으면 true. */
  boolean roll(CompanyState c, LocalDate today) {
    if (c.passMissions == null) {
      c.passMissions = new LinkedHashMap<>();
    }
    if (c.passRules < RULES) {
      // 568번 전의 저장: 모은 경험치를 포인트로 넘긴다. 단계에 드는 값이 는 만큼 늘려 닿은 단계를 지킨다.
      c.passExp = Math.min(cap(), c.passExp * rule().pointsPerStep() / OLD_STEP);
      c.passRules = RULES;
    }
    int now = season(c, today);
    if (c.passSeason == now) {
      return false;
    }
    c.passSeason = now;
    c.passExp = 0;
    c.passClaimed = new ArrayList<>();
    c.passMissions = new LinkedHashMap<>();
    return true;
  }

  private long cap() {
    return (long) rule().steps() * rule().pointsPerStep();
  }

  /** 포인트를 얻는다. 마지막 단계를 채운 뒤에는 더 쌓이지 않는다. */
  void gain(CompanyState c, long points, LocalDate today) {
    roll(c, today);
    c.passExp = Math.min(cap(), c.passExp + Math.max(0, points));
  }

  /**
   * 미션을 amount만큼 했다 (568번): 이번 시즌에 센 수가 every의 배수를 넘을 때마다 points를 얻는다. 한꺼번에 여러 배수를 넘으면 그만큼 얻는다. 없는
   * 미션이면 아무 일도 없다.
   */
  void progress(CompanyState c, String code, long amount, LocalDate today) {
    roll(c, today);
    CompanyProperties.PassMission mission =
        rule().missions().stream().filter(m -> m.code().equals(code)).findFirst().orElse(null);
    if (mission == null || amount <= 0) {
      return;
    }
    long before = c.passMissions.getOrDefault(code, 0L);
    long after = before + amount;
    c.passMissions.put(code, after);
    gain(c, (after / mission.every() - before / mission.every()) * mission.points(), today);
  }

  /** 지금 도달한 단계(0부터 steps까지). */
  int reached(CompanyState c) {
    return (int) Math.min(rule().steps(), c.passExp / rule().pointsPerStep());
  }

  /** 단계의 보상. 돈은 주지 않는다 (568번). */
  record Reward(long diamonds, boolean weapon, boolean cat) {}

  Reward reward(int step) {
    CompanyProperties.PassRewards r = rule().rewards();
    if (step == rule().steps()) {
      return new Reward(r.lastDiamonds(), false, true);
    }
    if (step % TEN == 0) {
      return new Reward(r.tenDiamonds(), true, false);
    }
    if (step % FIVE == 0) {
      return new Reward(r.fiveDiamonds(), false, false);
    }
    return new Reward(r.normalDiamonds(), false, false);
  }

  private static final int FIVE = 5;
  private static final int TEN = 10;
}
