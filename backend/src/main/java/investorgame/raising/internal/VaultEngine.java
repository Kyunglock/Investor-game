package investorgame.raising.internal;

import investorgame.common.error.InvalidRequestException;
import investorgame.common.random.SeededRandom;
import investorgame.raising.CompanyView;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.springframework.stereotype.Component;

/**
 * 금고 도전 (decisions.md 641번): 보스전과 주간 던전의 규칙과 보상. 전투는 화면이 돌리고 서버는 결과를 받아 금괴를 준다.
 *
 * <ul>
 *   <li>보스전은 정해진 시간 동안 넣은 피해량을 겨룬다. 피해량이 등급의 문턱을 넘을 때마다 그 주에 한 번씩 금괴를 준다. 수호냥의 약점·내성 스킬과 천적 고양이는
 *       주마다 바뀐다.
 *   <li>주간 던전은 세 층이고, 층에 들어가기 전에 카드 석 장 가운데 한 장을 골라 그 주 내내 쓴다. 층을 처음 깨면 금괴를 준다.
 *   <li>금괴는 금고 상점에서만 쓴다.
 * </ul>
 *
 * 한 주의 경계는 한국 시간 월요일 0시이고 서버 시각으로 판정한다.
 */
@Component
class VaultEngine {
  static final long WEEK_MS = 7 * 86_400_000L;
  // 1970년 1월 5일 한국 시간 월요일 0시.
  static final long MONDAY = 4 * 86_400_000L - 9 * 3_600_000L;

  /** 보스전의 길이(실제 초). */
  static final int BOSS_SECONDS = 60;

  /** 1등급의 문턱(전투 피해)과 한 등급마다 문턱이 커지는 배율. */
  static final double TIER_BASE = 10;

  static final double TIER_GROWTH = 1.5;

  /** 등급 하나에 주는 금괴. 한 주에 등급마다 한 번이다. */
  static final long TIER_GOLD = 3;

  /** 리그 하나에 든 등급 수와 리그의 이름. 마지막 리그는 끝이 없다. */
  static final int LEAGUE_TIERS = 10;

  private static final String[] LEAGUES = {"브론즈", "실버", "골드", "플래티넘", "다이아", "마스터"};

  /** 약점·내성 스킬의 수와 피해 배율(%), 천적 고양이의 수와 그 고양이 총의 피해 배율(%). */
  static final int WEAK_SKILLS = 4;

  static final int WEAK_PERCENT = 200;
  static final int RESIST_PERCENT = 50;
  static final int RIVAL_CATS = 4;
  static final int RIVAL_PERCENT = 300;

  /** 화면이 보낸 피해량을 받아 주는 상한: 지금 팀의 초당 피해로 보스전 내내 때린 것의 이 배수. 약점·치명타·훈련을 넉넉히 덮는다. */
  static final double SCORE_SLACK = 12;

  static final int FLOORS = 3;
  private static final long[] FLOOR_GOLD = {30, 50, 80};
  static final int OFFERS = 3;

  /** 금고 훈련: 한 단계에 금고 전투 공격력 +3%, 값은 40에서 한 단계마다 20씩 오른다. */
  static final int TRAINING_MAX = 30;

  static final int TRAINING_STEP_PERCENT = 3;
  private static final long TRAINING_PRICE = 40;
  private static final long TRAINING_PRICE_STEP = 20;
  static final String TRAINING = "training";

  /** 던전 카드 한 장: 배율은 모두 %이고 100이면 그대로다. */
  record Card(
      String code,
      String name,
      String effect,
      int damage,
      int fire,
      int skill,
      int mental,
      int enemyHp,
      int enemySpeed,
      int wallHp,
      int bossHp) {}

  static final List<Card> CARDS =
      List.of(
          new Card("rate-cut", "금리 인하", "공격력 +25%", 125, 100, 100, 100, 100, 100, 100, 100),
          new Card("good-news", "호재 공시", "공격 속도 +20%", 100, 120, 100, 100, 100, 100, 100, 100),
          new Card(
              "leverage", "레버리지", "공격력 +60% · 최대 멘탈 -40%", 160, 100, 100, 60, 100, 100, 100, 100),
          new Card("safe-haven", "안전 자산", "최대 멘탈 +60%", 100, 100, 100, 160, 100, 100, 100, 100),
          new Card("theme", "테마주 급등", "스킬 피해 +50%", 100, 100, 150, 100, 100, 100, 100, 100),
          new Card(
              "short-squeeze", "숏 스퀴즈", "매도 물량 체력 -35%", 100, 100, 100, 100, 65, 100, 100, 100),
          new Card("cooling", "과열 진정", "매도 물량 빠르기 -25%", 100, 100, 100, 100, 100, 75, 100, 100),
          new Card("thin-book", "얇은 호가", "매도벽 체력 -20%", 100, 100, 100, 100, 100, 100, 80, 100),
          new Card("block-deal", "블록딜", "수호냥 체력 -35%", 100, 100, 100, 100, 100, 100, 100, 65),
          new Card(
              "dividend",
              "배당 시즌",
              "공격력 +10% · 최대 멘탈 +25%",
              110,
              100,
              100,
              125,
              100,
              100,
              100,
              100));

  /** 금고 상점의 상품: 값(금괴)과 한 주에 살 수 있는 횟수. 훈련은 따로 다룬다. */
  private record Item(String code, String name, String description, long price, int weekly) {}

  static final long SHOP_DIAMONDS = 300;
  static final long SHOP_FISH = 5;
  private static final List<Item> ITEMS =
      List.of(
          new Item("diamonds", "다이아 " + SHOP_DIAMONDS + "개", "뽑기에 쓰는 다이아", 30, 5),
          new Item("cat", "고양이 1마리", "아무 고양이나 한 마리. 이미 있으면 레벨이 올라요", 60, 3),
          new Item("weapon", "무기 1개", "무기 뽑기 한 번", 40, 3),
          new Item("fish", "생선 " + SHOP_FISH + "마리", "영구 강화에 쓰는 생선", 50, 2));

  private final IdleEngine idle;
  private final CompanyEngine engine;

  VaultEngine(IdleEngine idle, CompanyEngine engine) {
    this.idle = idle;
    this.engine = engine;
  }

  static long weekOf(long now) {
    return Math.floorDiv(now - MONDAY, WEEK_MS);
  }

  /** 주가 바뀌었으면 그 주의 기록(보스전 등급·던전 층·카드·상점 횟수)을 비운다. 금괴·훈련·역대 기록은 남는다. */
  private CompanyState.Vault state(CompanyState c) {
    if (c.vault == null) c.vault = new CompanyState.Vault();
    CompanyState.Vault v = c.vault;
    long week = weekOf(idle.now());
    if (v.week != week) {
      v.week = week;
      v.bossBest = 0;
      v.bossTier = 0;
      v.floors = 0;
      v.cards = new ArrayList<>();
      v.bought.clear();
    }
    return v;
  }

  /** 피해량 score로 닿는 등급 (0이면 아직 없다). */
  static int tier(double score) {
    if (!(score >= TIER_BASE)) return 0;
    int tier = 1 + (int) Math.floor(Math.log(score / TIER_BASE) / Math.log(TIER_GROWTH));
    // 로그의 오차로 문턱에서 한 등급 어긋나지 않게 문턱과 직접 견준다.
    while (tierScore(tier + 1) <= score) tier++;
    while (tier > 0 && tierScore(tier) > score) tier--;
    return tier;
  }

  /** tier등급의 문턱. */
  static double tierScore(int tier) {
    return TIER_BASE * Math.pow(TIER_GROWTH, tier - 1);
  }

  static String tierName(int tier) {
    if (tier <= 0) return "등급 없음";
    int league = Math.min(LEAGUES.length - 1, (tier - 1) / LEAGUE_TIERS);
    return LEAGUES[league] + " " + (tier - league * LEAGUE_TIERS);
  }

  /** 그 주의 약점 스킬(앞 WEAK_SKILLS개)과 내성 스킬(그다음 WEAK_SKILLS개): 스킬의 차례를 주 번호로 섞는다. */
  static List<Integer> skillOrder(long week) {
    List<Integer> order = new ArrayList<>();
    for (int i = 0; i < IdleEngine.skillCount(); i++) order.add(i);
    java.util.Collections.shuffle(order, new Random(week * 31 + 7));
    return order.subList(0, WEAK_SKILLS * 2);
  }

  /** 그 주의 천적 고양이: 스킬이 없는 C·B등급에서 반씩 고른다. 스킬 없는 고양이도 쓸 자리가 생긴다. */
  static List<String> rivals(long week) {
    Random random = new Random(week * 131 + 17);
    List<String> picked = new ArrayList<>();
    for (String grade : List.of("C", "B")) {
      List<String> pool = new ArrayList<>(IdleEngine.catsOf(grade));
      java.util.Collections.shuffle(pool, random);
      picked.addAll(pool.subList(0, Math.min(pool.size(), RIVAL_CATS / 2)));
    }
    return picked;
  }

  /** 지금 골라야 할 카드들. 고를 차례가 아니면(이미 골랐거나 다 깼으면) 비어 있다. 같은 주·같은 차례에는 늘 같은 석 장이고 이미 고른 카드는 빠진다. */
  private List<Card> offers(CompanyState.Vault v) {
    if (v.floors >= FLOORS || v.cards.size() > v.floors) return List.of();
    List<Card> pool = new ArrayList<>(CARDS);
    java.util.Collections.shuffle(pool, new Random(v.week * 1009 + v.cards.size()));
    return pool.stream().filter(card -> !v.cards.contains(card.code())).limit(OFFERS).toList();
  }

  /** 다음 층에 들어가기 전에 카드 한 장을 고른다. 고를 차례가 아니거나 나온 카드가 아니면 400. */
  void pickCard(CompanyState c, String code) {
    CompanyState.Vault v = state(c);
    List<Card> offered = offers(v);
    if (offered.isEmpty()) {
      throw new InvalidRequestException("지금은 카드를 고를 차례가 아니에요");
    }
    if (offered.stream().noneMatch(card -> card.code().equals(code))) {
      throw new InvalidRequestException("고를 수 없는 카드예요: " + code);
    }
    v.cards.add(code);
    v.lastNote = null;
  }

  /** 던전의 floor층을 깼다: 차례대로만 깨고, 그 층의 카드를 고른 뒤여야 한다. 금괴를 준다. */
  void clearFloor(CompanyState c, int floor) {
    CompanyState.Vault v = state(c);
    if (v.floors >= FLOORS) {
      throw new InvalidRequestException("이번 주 금고는 이미 다 돌파했어요");
    }
    if (floor != v.floors + 1) {
      throw new InvalidRequestException("지금 도전할 층은 " + (v.floors + 1) + "층이에요");
    }
    if (v.cards.size() < floor) {
      throw new InvalidRequestException("카드를 먼저 골라 주세요");
    }
    v.floors = floor;
    long gold = FLOOR_GOLD[floor - 1];
    v.gold += gold;
    v.lastNote = floor + "층 돌파 · 금괴 +" + gold;
  }

  /**
   * 보스전을 마쳤다: 넣은 피해량을 받아 이번 주 최고 기록과 역대 기록을 고치고, 새로 닿은 등급마다 금괴를 준다. 피해량은 지금 팀이 낼 수 있는 상한까지만 받아 준다.
   */
  void reportBoss(CompanyState c, double damage) {
    if (!Double.isFinite(damage) || damage < 0) {
      throw new InvalidRequestException("피해량이 올바르지 않아요");
    }
    CompanyState.Vault v = state(c);
    double cap =
        idle.fieldDps(c)
            * BOSS_SECONDS
            * SCORE_SLACK
            * (1 + v.training * TRAINING_STEP_PERCENT / 100.0);
    double score = Math.min(damage, cap);
    v.bossBest = Math.max(v.bossBest, score);
    v.bossRecord = Math.max(v.bossRecord, score);
    int reached = tier(v.bossBest);
    long gold = Math.max(0, reached - v.bossTier) * TIER_GOLD;
    v.bossTier = Math.max(v.bossTier, reached);
    v.gold += gold;
    v.lastNote = gold > 0 ? tierName(reached) + " 달성 · 금괴 +" + gold : null;
  }

  private static long trainingPrice(int level) {
    return TRAINING_PRICE + TRAINING_PRICE_STEP * level;
  }

  /** 금고 상점에서 하나를 산다. 없는 상품이거나 이번 주 횟수를 다 썼거나 금괴가 모자라면 400. */
  void buy(CompanyState c, String code, SeededRandom random) {
    CompanyState.Vault v = state(c);
    if (TRAINING.equals(code)) {
      if (v.training >= TRAINING_MAX) {
        throw new InvalidRequestException("금고 훈련을 끝까지 올렸어요");
      }
      pay(v, trainingPrice(v.training));
      v.training++;
      v.lastNote = "금고 훈련 Lv." + v.training;
      return;
    }
    Item item =
        ITEMS.stream()
            .filter(i -> i.code().equals(code))
            .findFirst()
            .orElseThrow(() -> new InvalidRequestException("없는 상품이에요: " + code));
    int bought = v.bought.getOrDefault(code, 0);
    if (bought >= item.weekly()) {
      throw new InvalidRequestException("이번 주에는 다 샀어요. 월요일에 다시 열려요");
    }
    pay(v, item.price());
    v.bought.put(code, bought + 1);
    switch (code) {
      case "diamonds" -> {
        c.diamonds += SHOP_DIAMONDS;
        v.lastNote = "다이아 +" + SHOP_DIAMONDS;
      }
      case "fish" -> {
        c.fish += SHOP_FISH;
        v.lastNote = "생선 +" + SHOP_FISH;
      }
      case "cat" -> {
        CompanyState.Pulled cat = idle.grantCat(c, random);
        v.lastNote = idle.catName(cat.kind) + (cat.isNew ? " 합류!" : " Lv." + cat.level);
      }
      default -> {
        engine.mental.initWeapons(c);
        CompanyState.Pulled weapon = engine.mental.drawOne(c, random);
        v.lastNote = weapon.grade + "등급 " + engine.mental.weaponName(weapon.kind) + " 획득";
      }
    }
  }

  private static void pay(CompanyState.Vault v, long price) {
    if (v.gold < price) {
      throw new InvalidRequestException("금괴가 모자라요");
    }
    v.gold -= price;
  }

  private static CompanyView.VaultCard cardView(Card card) {
    return new CompanyView.VaultCard(
        card.code(),
        card.name(),
        card.effect(),
        card.damage(),
        card.fire(),
        card.skill(),
        card.mental(),
        card.enemyHp(),
        card.enemySpeed(),
        card.wallHp(),
        card.bossHp());
  }

  CompanyView.Vault view(CompanyState c) {
    CompanyState.Vault v = state(c);
    List<Integer> order = skillOrder(v.week);
    List<CompanyView.VaultSkill> weak =
        order.subList(0, WEAK_SKILLS).stream().map(IdleEngine::vaultSkill).toList();
    List<CompanyView.VaultSkill> resist =
        order.subList(WEAK_SKILLS, WEAK_SKILLS * 2).stream().map(IdleEngine::vaultSkill).toList();
    List<CompanyView.VaultRival> rivals =
        rivals(v.week).stream()
            .map(
                code ->
                    new CompanyView.VaultRival(code, idle.catName(code), IdleEngine.catGrade(code)))
            .toList();
    CompanyView.VaultBoss boss =
        new CompanyView.VaultBoss(
            BOSS_SECONDS,
            weak,
            resist,
            WEAK_PERCENT,
            RESIST_PERCENT,
            rivals,
            RIVAL_PERCENT,
            v.bossBest,
            v.bossRecord,
            v.bossTier,
            tierName(v.bossTier),
            tierScore(v.bossTier + 1),
            tierName(v.bossTier + 1),
            TIER_GOLD);
    List<CompanyView.VaultCard> cards =
        v.cards.stream()
            .flatMap(code -> CARDS.stream().filter(card -> card.code().equals(code)))
            .map(VaultEngine::cardView)
            .toList();
    List<Long> floorGold = new ArrayList<>();
    for (long gold : FLOOR_GOLD) floorGold.add(gold);
    CompanyView.VaultDungeon dungeon =
        new CompanyView.VaultDungeon(
            FLOORS,
            v.floors,
            cards,
            offers(v).stream().map(VaultEngine::cardView).toList(),
            floorGold);
    List<CompanyView.VaultItem> shop = new ArrayList<>();
    for (Item item : ITEMS) {
      shop.add(
          new CompanyView.VaultItem(
              item.code(),
              item.name(),
              item.description(),
              item.price(),
              item.weekly(),
              Math.max(0, item.weekly() - v.bought.getOrDefault(item.code(), 0)),
              null));
    }
    boolean maxed = v.training >= TRAINING_MAX;
    shop.add(
        new CompanyView.VaultItem(
            TRAINING,
            "금고 훈련",
            "금고 전투의 공격력 +" + TRAINING_STEP_PERCENT + "% · 주가 바뀌어도 남아요",
            maxed ? 0 : trainingPrice(v.training),
            0,
            maxed ? 0 : 1,
            v.training));
    return new CompanyView.Vault(
        v.gold,
        v.week,
        MONDAY + (v.week + 1) * WEEK_MS,
        v.training * TRAINING_STEP_PERCENT,
        boss,
        dungeon,
        shop,
        v.lastNote);
  }
}
