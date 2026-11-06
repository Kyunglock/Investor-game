package investorgame.raising.internal;

import investorgame.common.Korean;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.RaisingContent;
import investorgame.raising.internal.CompanyState.Settlement;
import investorgame.raising.internal.CompanyState.Target;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.random.RandomGenerator;

/**
 * 올해의 라이벌 (decisions.md 275번). 연초 회의에서 사장이 쉬움·보통·어려움 후보 가운데 하나를 고른다. 후보는 실제 다른 사장의 회사 가운데 연초 우리 자본의
 * 띠에 드는 곳이고, 없으면 지어낸 회사다. 연말 결산에서 한 번만 견준다: 실제 회사면 그때 그 회사의 자본, 지어낸 회사면 그해 시장대로 자란 자본. 실시간으로 순위를
 * 매기지 않아 부하가 없다. 이기면 라이벌의 고객이 넘어와 자본이 는다.
 */
class TargetEngine {

  static final List<String> DIFFICULTIES = List.of("EASY", "MEDIUM", "HARD");
  private static final int PERCENT = 100;
  private static final int BP = 10_000;

  /** 후보로 뽑을 실제 회사 하나: 회사 ID와 지금 자본. */
  record Candidate(String companyId, long capital) {}

  /** 연초 자본의 띠 [아래, 위). */
  record Band(long low, long high) {}

  private final ContentCatalog content;
  private final CompanyProperties properties;

  TargetEngine(ContentCatalog content, CompanyProperties properties) {
    this.content = content;
    this.properties = properties;
  }

  private CompanyProperties.Targets rules() {
    return properties.targets();
  }

  private RaisingContent.Targets texts() {
    return content.raising().company().targets();
  }

  /** 올해 후보를 뽑아야 하는가: 연초(1분기를 넘기기 전)이고 올해 아직 뽑지 않았다. 엔딩을 봤거나 닫은 회사는 없다. */
  boolean needsOptions(CompanyState c) {
    return !c.finished
        && !c.closed
        && c.quarter == 1
        && c.quarters.isEmpty()
        && c.target == null
        && c.targetsYear != c.year;
  }

  /** 난이도마다 실제 후보를 찾을 자본 띠: 연초 우리 자본의 band-percent. */
  Map<String, Band> bands(CompanyState c) {
    long base = Math.max(1, startCapital(c));
    Map<String, Band> bands = new java.util.LinkedHashMap<>();
    for (String d : DIFFICULTIES) {
      List<Integer> band = rules().bandPercent().get(d);
      bands.put(d, new Band(base * band.get(0) / PERCENT, base * band.get(1) / PERCENT));
    }
    return bands;
  }

  private static long startCapital(CompanyState c) {
    return c.yearStartCapital != null ? c.yearStartCapital : c.capital;
  }

  /** 올해 후보를 세운다. found는 난이도마다 서비스가 찾은 실제 회사(없으면 빈 값)다. 없는 난이도는 지어낸 회사로 채운다. 이름은 겹치지 않게 짓는다. */
  void offer(CompanyState c, Map<String, Optional<Candidate>> found, SeededRandom random) {
    c.targetOptions.clear();
    Set<String> names = new HashSet<>();
    long base = Math.max(1, startCapital(c));
    for (String d : DIFFICULTIES) {
      Optional<Candidate> real = found.getOrDefault(d, Optional.empty());
      Target t = new Target();
      t.difficulty = d;
      if (real.isPresent()) {
        t.companyId = real.get().companyId();
        t.capital = real.get().capital();
        t.name = name(t.companyId, names);
      } else {
        t.capital = base * rules().fictionalPercent().get(d) / PERCENT;
        t.name = name("fictional-" + random.forKey("target-name", c.year, d).nextLong(), names);
      }
      names.add(t.name);
      c.targetOptions.add(t);
    }
    c.targetsYear = c.year;
  }

  /** 실제 회사는 이름이 없어 회사 ID로 늘 같은 이름을 짓는다. 이미 쓴 이름이면 다음 짝으로. */
  private String name(String key, Set<String> taken) {
    List<String> prefixes = texts().prefixes();
    List<String> suffixes = texts().suffixes();
    int h = key.hashCode() & Integer.MAX_VALUE;
    int combos = prefixes.size() * suffixes.size();
    for (int i = 0; i < combos; i++) {
      int at = (h + i * 7) % combos;
      String n = prefixes.get(at % prefixes.size()) + suffixes.get(at / prefixes.size());
      if (!taken.contains(n)) {
        return n;
      }
    }
    return prefixes.getFirst() + suffixes.getFirst();
  }

  /** 사장이 올해의 라이벌을 고른다. 연초(1분기를 넘기기 전)에만 고를 수 있다. 이미 골랐으면 400. */
  void pick(CompanyState c, String difficulty) {
    if (c.target != null) {
      throw new InvalidRequestException("올해의 라이벌은 이미 골랐다");
    }
    Target chosen =
        c.targetOptions.stream()
            .filter(t -> t.difficulty.equals(difficulty))
            .findFirst()
            .orElseThrow(() -> new InvalidRequestException("고를 수 있는 라이벌이 아니다: " + difficulty));
    if (c.quarter != 1 || !c.quarters.isEmpty()) {
      throw new InvalidRequestException("올해의 라이벌은 연초 회의에서 고른다");
    }
    c.target = chosen;
    c.targetOptions.clear();
  }

  /** 1분기를 넘기면 고르지 않은 후보는 사라진다: 올해는 라이벌 없이 간다. */
  void quarterPassed(CompanyState c) {
    c.targetOptions.clear();
  }

  /** 지금 견줄 상대 자본: 실제 회사면 결산 직전에 채운 값(없으면 뽑을 때 자본), 지어낸 회사면 뽑을 때 자본 그대로(연말에 자란다). */
  static long current(Target t) {
    return t.capitalNow != null ? t.capitalNow : t.capital;
  }

  /**
   * 연말 결산 (275번): 올해의 라이벌과 한 번 견준다. 지어낸 회사는 그해 시장 갈래대로 자란다(라이벌 증권사와 같은 비율, 261번). 이기면 자본 bonus-bp가
   * 늘고(라이벌의 고객이 넘어온다) 박치기 장면이 쓴다. 견준 뒤 라이벌은 비운다.
   */
  void yearEnd(CompanyState c, Settlement settlement, SeededRandom random) {
    Target t = c.target;
    c.target = null;
    c.targetOptions.clear();
    if (t == null) {
      return;
    }
    long theirs;
    if (t.companyId != null) {
      theirs = current(t);
    } else {
      CompanyProperties.Rivals growth = properties.rivals();
      RandomGenerator rng = random.forKey("target-grow", c.year);
      int percent =
          growth.phasePercent().getOrDefault(c.phase, PERCENT)
              + rng.nextInt(2 * growth.spread() + 1)
              - growth.spread();
      theirs = Math.max(1, t.capital * percent / PERCENT);
    }
    CompanyState.TargetResult r = new CompanyState.TargetResult();
    r.difficulty = t.difficulty;
    r.name = t.name;
    r.real = t.companyId != null;
    r.theirCapital = theirs;
    r.ourCapital = c.capital;
    r.won = c.capital > theirs;
    String difficulty = texts().difficulties().get(t.difficulty);
    if (r.won) {
      r.bonus = c.capital * rules().bonusBp().get(t.difficulty) / BP;
      c.capital += r.bonus;
      r.ourCapital = c.capital;
      settlement.lines.add(
          Korean.fill(
              texts().won(),
              Map.of(
                  "name", t.name, "difficulty", difficulty, "bonus", CompanyEngine.won(r.bonus))));
    } else {
      settlement.lines.add(
          Korean.fill(
              texts().lost(),
              Map.of(
                  "name",
                  t.name,
                  "difficulty",
                  difficulty,
                  "gap",
                  CompanyEngine.won(theirs - c.capital))));
    }
    settlement.target = r;
  }

  /** 이기면 늘 자본 몫(만분율). */
  int bonusBp(String difficulty) {
    return rules().bonusBp().get(difficulty);
  }

  String difficultyName(String difficulty) {
    return texts().difficulties().get(difficulty);
  }
}
