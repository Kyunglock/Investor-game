package investorgame.raising.internal;

import investorgame.common.error.InvalidRequestException;
import investorgame.raising.CompanyView;
import java.util.ArrayList;
import java.util.List;
import java.util.function.ToLongFunction;

/**
 * 업적 (decisions.md 708번): 한 번뿐인 목표를 단계별로 깨면 다이아를 준다. 업적마다 목표 단계가 있고, 지금 단계의 목표에 닿으면 눌러서 그 단계의 다이아를
 * 받고 다음 단계로 간다. 환생해도 남는다. 세는 값은 저장에 이미 있는 기록(최고 벽·깬 보스·가진 고양이·환생·출석)이거나, 시즌패스 미션과 같은 때에 쌓는 누적
 * 기록(c.lifetime: 뽑기·합성·강화·스테이지)이다.
 */
final class Achievements {
  private Achievements() {}

  record Rule(
      String code,
      String title,
      long[] targets,
      int[] diamonds,
      ToLongFunction<CompanyState> count) {}

  private static long lifetime(CompanyState c, String code) {
    return c.lifetime == null ? 0 : c.lifetime.getOrDefault(code, 0L);
  }

  // 다이아는 644번에 줄인 수준에 맞춘다: 모든 업적을 다 깨면 3,000개쯤(뽑기 30번), 첫 며칠에 200~300개다.
  static final List<Rule> RULES =
      List.of(
          new Rule(
              "wall",
              "매도벽 최고 기록 %s 돌파",
              new long[] {10, 50, 100, 250, 500, 1000, 2000, 3000, 5000, 10000},
              new int[] {10, 20, 30, 50, 50, 100, 100, 150, 200, 300},
              c -> c.idle == null ? 0 : c.idle.best),
          new Rule(
              "boss",
              "보스 %s마리 처치",
              new long[] {1, 5, 10, 20, 50, 100},
              new int[] {10, 20, 30, 50, 100, 150},
              c -> c.idle == null ? 0 : c.idle.bossCleared / IdleEngine.BOSS_EVERY),
          new Rule(
              "cats",
              "고양이 %s종 모으기",
              new long[] {3, 10, 20, 30, 45},
              new int[] {10, 30, 50, 80, 150},
              c ->
                  c.idle == null || c.idle.cats == null
                      ? 0
                      : c.idle.cats.values().stream().filter(level -> level > 0).count()),
          new Rule(
              "rebirth",
              "환생 %s번",
              new long[] {1, 3, 5, 10, 20, 50},
              new int[] {20, 30, 50, 80, 100, 150},
              c -> c.rebirths),
          new Rule(
              "draw",
              "뽑기 %s번",
              new long[] {10, 50, 100, 300, 1000},
              new int[] {10, 20, 30, 50, 100},
              c -> lifetime(c, "draw")),
          new Rule(
              "merge",
              "무기 합성 %s번",
              new long[] {5, 20, 50, 100, 300},
              new int[] {10, 20, 30, 50, 100},
              c -> lifetime(c, "merge")),
          new Rule(
              "upgrade",
              "강화 %s번",
              new long[] {50, 200, 1000, 3000, 10000},
              new int[] {10, 20, 30, 50, 100},
              c -> lifetime(c, "upgrade")),
          new Rule(
              "attend",
              "출석 %s일",
              new long[] {1, 7, 14, 30, 60, 100},
              new int[] {10, 20, 30, 50, 80, 100},
              c -> c.attendCount),
          new Rule(
              "stage",
              "매도벽 돌파 스테이지 %s판",
              new long[] {1, 10, 30, 100},
              new int[] {10, 20, 30, 50},
              c -> lifetime(c, "stage")));

  private static int claimed(CompanyState c, Rule r) {
    return c.achieved == null ? 0 : c.achieved.getOrDefault(r.code(), 0);
  }

  private static boolean ready(CompanyState c, Rule r) {
    int tier = claimed(c, r);
    return tier < r.targets().length && r.count().applyAsLong(c) >= r.targets()[tier];
  }

  /** 받을 수 있는 업적 단계를 받는다. code가 null이면 모든 업적에서 받을 수 있는 단계를 모두 받는다. 받을 것이 없으면 400. 받은 다이아를 돌려준다. */
  static long claim(CompanyState c, String code) {
    if (c.achieved == null) c.achieved = new java.util.LinkedHashMap<>();
    if (code != null && RULES.stream().noneMatch(r -> r.code().equals(code))) {
      throw new InvalidRequestException("없는 업적이에요: " + code);
    }
    long got = 0;
    for (Rule r : RULES) {
      if (code != null && !r.code().equals(code)) continue;
      // 한 번에 여러 단계에 닿았으면 닿은 단계를 모두 받는다.
      while (ready(c, r)) {
        int tier = claimed(c, r);
        got += r.diamonds()[tier];
        c.achieved.put(r.code(), tier + 1);
      }
    }
    if (got == 0) throw new InvalidRequestException("받을 업적 보상이 없어요");
    c.diamonds += got;
    c.lastAchievementDiamonds = got;
    return got;
  }

  /** 업적의 화면 값: 업적마다 지금 단계의 목표·진행·다이아. 다 깬 업적은 마지막 목표로 보이고 done이다. */
  static CompanyView.AchievementBoard view(CompanyState c) {
    List<CompanyView.AchievementGoal> list = new ArrayList<>();
    int readyCount = 0;
    for (Rule r : RULES) {
      int tier = claimed(c, r);
      boolean done = tier >= r.targets().length;
      int at = Math.min(tier, r.targets().length - 1);
      long target = r.targets()[at];
      long count = r.count().applyAsLong(c);
      boolean ready = ready(c, r);
      if (ready) readyCount++;
      list.add(
          new CompanyView.AchievementGoal(
              r.code(),
              r.title().formatted(String.format("%,d", target)),
              tier,
              r.targets().length,
              Math.min(count, target),
              target,
              r.diamonds()[at],
              ready,
              done));
    }
    return new CompanyView.AchievementBoard(list, readyCount, c.lastAchievementDiamonds);
  }
}
