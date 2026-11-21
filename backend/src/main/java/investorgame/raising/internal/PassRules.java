package investorgame.raising.internal;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;

/**
 * 시즌패스의 규칙 (decisions.md 529·571번): 시즌은 epoch부터 days일마다 이어지고, 단계마다 포인트 points-per-step이 든다. 포인트는
 * 일일·주간 퀘스트를 깨고 눌러서 받는다 (572·643번). 무료 줄 하나뿐이다. 오늘 날짜(한국 시간)는 부르는 쪽이 준다.
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

  private static final int PAID_MISSIONS = 2;

  /** 643번: 미션이 시즌 내내 되풀이되던 때(570번)의 센 수는 일일·주간 퀘스트로 옮기지 않는다. */
  private static final int RULES = 4;

  private static final int WEEK = 7;

  /** 시즌이 바뀌었으면 진행도를 비운다: 받지 않은 보상은 사라지고 미션도 처음부터 센다. 바꿨으면 true. */
  boolean roll(CompanyState c, LocalDate today) {
    if (c.passMissions == null) {
      c.passMissions = new LinkedHashMap<>();
    }
    if (c.passMissionTaken == null) {
      c.passMissionTaken = new LinkedHashMap<>();
    }
    if (c.passMissionPeriod == null) {
      c.passMissionPeriod = new LinkedHashMap<>();
    }
    if (c.passRules < PAID_MISSIONS) {
      // 570번 전의 저장: 모은 경험치를 포인트로 넘긴다. 단계에 드는 값이 는 만큼 늘려 닿은 단계를 지킨다.
      c.passExp = c.passExp * rule().pointsPerStep() / OLD_STEP;
    }
    if (c.passRules < RULES) {
      // 643번 전의 저장: 시즌 내내 센 수와 받은 문턱은 버리고 퀘스트를 오늘·이번 주의 0부터 센다. 이미 들어온 포인트는 그대로다.
      c.passMissions.clear();
      c.passMissionTaken.clear();
      c.passMissionPeriod.clear();
      c.passRules = RULES;
    }
    // 단계가 줄었으면(643번, 50 → 30) 넘친 포인트는 마지막 단계에서 멈춘다.
    c.passExp = Math.min(cap(), c.passExp);
    int now = season(c, today);
    if (c.passSeason == now) {
      return false;
    }
    c.passSeason = now;
    c.passExp = 0;
    c.passClaimed = new ArrayList<>();
    c.passMissions = new LinkedHashMap<>();
    c.passMissionTaken = new LinkedHashMap<>();
    c.passMissionPeriod = new LinkedHashMap<>();
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

  private CompanyProperties.PassMission mission(String code) {
    return rule().missions().stream().filter(m -> m.code().equals(code)).findFirst().orElse(null);
  }

  /** 퀘스트의 주기 번호 (643번): 일일은 epoch부터 센 날, 주간은 epoch부터 센 주. 시즌이 28일이라 주는 시즌 첫날에 맞는다. */
  long period(CompanyProperties.PassMission m, LocalDate today) {
    long days = ChronoUnit.DAYS.between(epoch(), today);
    return m.weekly() ? Math.floorDiv(days, WEEK) : days;
  }

  /** 그 주기가 끝나는 날(다음 주기의 첫날, 한국 시간 자정). */
  LocalDate resets(CompanyProperties.PassMission m, LocalDate today) {
    long next = period(m, today) + 1;
    return epoch().plusDays(m.weekly() ? next * WEEK : next);
  }

  /** 주기가 바뀌었으면 그 퀘스트의 센 수와 받은 표시를 비운다. */
  private void refresh(CompanyState c, CompanyProperties.PassMission m, LocalDate today) {
    roll(c, today);
    long now = period(m, today);
    Long was = c.passMissionPeriod.get(m.code());
    if (was != null && was == now) {
      return;
    }
    c.passMissionPeriod.put(m.code(), now);
    c.passMissions.remove(m.code());
    c.passMissionTaken.remove(m.code());
  }

  /** 이번 주기에 센 수 (goal까지만). */
  long count(CompanyState c, CompanyProperties.PassMission m, LocalDate today) {
    refresh(c, m, today);
    return c.passMissions.getOrDefault(m.code(), 0L);
  }

  /** 이번 주기에 포인트를 받았다. */
  boolean taken(CompanyState c, CompanyProperties.PassMission m, LocalDate today) {
    refresh(c, m, today);
    return c.passMissionTaken.getOrDefault(m.code(), 0L) > 0;
  }

  /**
   * 퀘스트를 amount만큼 했다 (643번): 이번 주기에 센 수를 올린다(goal에서 멈춘다). goal에 닿으면 포인트를 받을 수 있게 되고, 포인트는 눌러서 받는다
   * (572번, take). 없는 미션이면 아무 일도 없다.
   */
  void progress(CompanyState c, String code, long amount, LocalDate today) {
    roll(c, today);
    CompanyProperties.PassMission m = mission(code);
    if (m == null || amount <= 0) {
      return;
    }
    long now = count(c, m, today);
    c.passMissions.put(code, Math.min(m.goal(), now + amount));
  }

  /** 그 퀘스트에서 닿았지만 아직 받지 않은 포인트 (572번). 한 주기에 한 번이다. */
  long ready(CompanyState c, CompanyProperties.PassMission m, LocalDate today) {
    return count(c, m, today) >= m.goal() && !taken(c, m, today) ? m.points() : 0;
  }

  /** 퀘스트의 포인트를 받는다 (572번). code가 null이면 모든 퀘스트의 것을 받는다. 받은 포인트를 돌려준다(없는 미션이거나 받을 것이 없으면 0). */
  long take(CompanyState c, String code, LocalDate today) {
    roll(c, today);
    long points = 0;
    for (CompanyProperties.PassMission m : rule().missions()) {
      if (code != null && !m.code().equals(code)) {
        continue;
      }
      long got = ready(c, m, today);
      if (got > 0) {
        points += got;
        c.passMissionTaken.put(m.code(), 1L);
      }
    }
    gain(c, points, today);
    return points;
  }

  /** 지금 도달한 단계(0부터 steps까지). */
  int reached(CompanyState c) {
    return (int) Math.min(rule().steps(), c.passExp / rule().pointsPerStep());
  }

  /** 단계의 보상. 돈은 주지 않는다 (570번). */
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
