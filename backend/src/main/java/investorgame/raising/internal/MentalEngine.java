package investorgame.raising.internal;

import investorgame.common.Korean;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.SeededRandom;
import investorgame.content.ContentCatalog;
import investorgame.content.RaisingContent;
import java.util.List;
import java.util.Map;
import java.util.random.RandomGenerator;

/**
 * 멘탈 전투 (decisions.md 320번). 분기마다 결산 직전에 멘탈 카드를 고르고 나쁜 투자 습관(패닉셀·투매·투기·손절매)을 쏘아 물리치는 한 판. 한 판은
 * 클라이언트가 돌리고, 서버는 장르·머리글을 정하고 결과를 한 번 받아 그 분기 강화율을 매긴다. 설계는
 * docs/superpowers/specs/2026-11-07-mental-battle-design.md.
 */
class MentalEngine {

  static final String ASSAULT = "ASSAULT";
  static final String DEFENSE = "DEFENSE";
  static final String SURVIVAL = "SURVIVAL";
  static final List<String> GENRES = List.of(ASSAULT, DEFENSE, SURVIVAL);

  /** 폭락이 터지는 분기의 가중치 열쇠. 시장 갈래(boom·normal·crash)와 나란히 쓴다. */
  static final String BURST = "burst";

  private final ContentCatalog content;
  private final CompanyProperties properties;

  MentalEngine(ContentCatalog content, CompanyProperties properties) {
    this.content = content;
    this.properties = properties;
  }

  private RaisingContent.Mental text() {
    return content.raising().company().mental();
  }

  /**
   * 분기를 열 때: 장르를 시장 갈래의 가중치로만 섞어 뽑는다. 폭락이 터지는 분기면 생존형이 자주 나오지만 꼭 나오지는 않아 숨은 값이 새지 않는다. 머리글은 장르의 것
   * 가운데 하나.
   */
  CompanyState.Mental create(CompanyState c, SeededRandom random) {
    RandomGenerator rng = random.forKey("mental", c.year, c.quarter);
    boolean burst =
        CompanyEngine.CRASH.equals(c.phase)
            && c.crashQuarter != null
            && c.crashQuarter == c.quarter;
    Map<String, Integer> weights = properties.mental().genreWeights().get(burst ? BURST : c.phase);
    int total = GENRES.stream().mapToInt(g -> weights.getOrDefault(g, 0)).sum();
    int roll = rng.nextInt(total);
    CompanyState.Mental mental = new CompanyState.Mental();
    for (String genre : GENRES) {
      roll -= weights.getOrDefault(genre, 0);
      if (roll < 0) {
        mental.genre = genre;
        break;
      }
    }
    List<String> headlines = text().headlines().get(mental.genre);
    mental.headline = headlines.get(rng.nextInt(headlines.size()));
    return mental;
  }

  /**
   * 한 판 결과를 받는다. 이번 분기가 아니면 400, 이미 받았으면 그대로 둔다(같은 요청 두 번). 보고 값은 상한으로 자르고 강화율 = min(최대, 적 ÷ a + 멘탈
   * ÷ b).
   */
  void report(CompanyState c, int year, int quarter, String card, int kills, int mentalLeft) {
    if (c.year != year || c.quarter != quarter) {
      throw new InvalidRequestException("이번 분기가 아니다: " + year + "년 " + quarter + "분기");
    }
    if (c.mental == null) {
      throw new InvalidRequestException("이번 분기에는 멘탈 전투가 없다");
    }
    if (!text().cards().containsKey(card)) {
      throw new InvalidRequestException("없는 카드다: " + card);
    }
    if (c.mental.card != null) {
      return;
    }
    CompanyProperties.Mental rule = properties.mental();
    c.mental.card = card;
    c.mental.kills = Math.clamp(kills, 0, rule.maxKills());
    c.mental.mentalLeft = Math.clamp(mentalLeft, 0, rule.maxMental());
    c.mental.bonusPercent =
        Math.min(
            rule.maxPercent(),
            c.mental.kills / rule.killsPerPercent()
                + c.mental.mentalLeft / rule.mentalPerPercent());
  }

  /** 이번 분기 강화율(%). 치르지 않았거나 이 칸이 없던 분기면 0. */
  int bonusPercent(CompanyState c) {
    return c.mental == null || c.mental.card == null ? 0 : c.mental.bonusPercent;
  }

  /** 분기 실적 소식 줄. 치르지 않았으면 null. */
  String line(CompanyState c) {
    if (bonusPercent(c) == 0) {
      return null;
    }
    return Korean.fill(
        text().line(),
        Map.of(
            "card", text().cards().get(c.mental.card),
            "kills", String.valueOf(c.mental.kills),
            "left", String.valueOf(c.mental.mentalLeft),
            "percent", String.valueOf(c.mental.bonusPercent)));
  }
}
