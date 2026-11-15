package investorgame.raising.internal;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;

/**
 * 시즌패스의 규칙 (decisions.md 529번): 시즌은 epoch부터 days일마다 이어지고, 단계마다 패스 경험치 exp-per-step이 든다. 무료 줄 하나뿐이다.
 * 오늘 날짜(한국 시간)는 부르는 쪽이 준다.
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

  /** 시즌이 바뀌었으면 진행도를 비운다: 받지 않은 보상은 사라진다. 바꿨으면 true. */
  boolean roll(CompanyState c, LocalDate today) {
    int now = season(c, today);
    if (c.passSeason == now) {
      return false;
    }
    c.passSeason = now;
    c.passExp = 0;
    c.passClaimed = new ArrayList<>();
    c.passStageDay = null;
    c.passStageExp = 0;
    return true;
  }

  /** 패스 경험치를 얻는다. 마지막 단계를 채운 뒤에는 더 쌓이지 않는다. */
  void gain(CompanyState c, long exp, LocalDate today) {
    roll(c, today);
    long cap = (long) rule().steps() * rule().expPerStep();
    c.passExp = Math.min(cap, c.passExp + Math.max(0, exp));
  }

  /** 멘탈 보호 스테이지를 깼다: 별과 상관없이 exp.stage, 하루에 exp.stage-daily-max까지. */
  void stageCleared(CompanyState c, LocalDate today) {
    roll(c, today);
    String day = today.toString();
    if (!day.equals(c.passStageDay)) {
      c.passStageDay = day;
      c.passStageExp = 0;
    }
    int room = rule().exp().stageDailyMax() - c.passStageExp;
    int add = Math.clamp(rule().exp().stage(), 0, Math.max(0, room));
    c.passStageExp += add;
    gain(c, add, today);
  }

  /** 지금 도달한 단계(0부터 steps까지). */
  int reached(CompanyState c) {
    return (int) Math.min(rule().steps(), c.passExp / rule().expPerStep());
  }

  /** 단계의 보상. 보통 단계는 다이아와 돈이 번갈아 나온다. */
  record Reward(long diamonds, boolean money, boolean weapon, boolean cat) {}

  Reward reward(int step) {
    CompanyProperties.PassRewards r = rule().rewards();
    if (step == rule().steps()) {
      return new Reward(r.lastDiamonds(), false, false, true);
    }
    if (step % TEN == 0) {
      return new Reward(r.tenDiamonds(), false, true, false);
    }
    if (step % FIVE == 0) {
      return new Reward(r.fiveDiamonds(), false, false, false);
    }
    // 보통 단계의 차례: 5의 배수를 뺀 순번. 홀수 번째는 다이아, 짝수 번째는 돈.
    int order = step - step / FIVE;
    return order % 2 == 1
        ? new Reward(r.normalDiamonds(), false, false, false)
        : new Reward(0, true, false, false);
  }

  private static final int FIVE = 5;
  private static final int TEN = 10;
}
