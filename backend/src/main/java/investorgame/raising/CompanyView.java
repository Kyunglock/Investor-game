package investorgame.raising;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 회사 화면의 값 (증권사 육성 설계 4·6절). 직원 능력치는 등급만. 분기·결산·파산·엔딩은 없앴다 (decisions.md 523번): 회사는 끝나지 않고 시간이 흐르는
 * 대로 돈을 번다.
 *
 * @param grade 회사 등급 = 산 건물 (4.5절)
 * @param nextGradeCapital 다음 등급의 자본. 맨 위면 null
 * @param seats 앉힐 수 있는 자리 수
 * @param meeting 채용·시대 안내 줄
 * @param gacha 채용 뽑기: 채용권, 데리고 있는 사람, 확률표, 마지막 뽑기, 도감 (decisions.md 312번)
 * @param history 회사 연표·업적·명예의 전당 (decisions.md 263번)
 * @param invest 지금(또는 마지막) 종목회의. 아직 한 번도 열지 않았으면 null (decisions.md 229·523번)
 * @param meetings 종목회의의 기회 (523번)
 * @param number 사장이 차린 몇 번째 회사인가
 * @param era 이 회사의 시대 (9.4절)
 * @param opening 회사를 차릴 때의 한 줄
 */
public record CompanyView(
    UUID companyId,
    int number,
    Era era,
    String opening,
    java.math.BigDecimal capital,
    Diamonds diamonds,
    AdDraws adDraws,
    String grade,
    Long nextGradeCapital,
    Upgrade upgrade,
    int seats,
    List<Employee> employees,
    List<Desk> desks,
    Meeting meeting,
    Gacha gacha,
    History history,
    Invest invest,
    Meetings meetings,
    Attendance attendance,
    Pass pass,
    Shop shop,
    List<LockedDesk> lockedDesks,
    List<Weapon> weapons,
    Armory armory,
    List<BattleUpgrade> battleUpgrades,
    Stages stages,
    Assaults assaults,
    Idle idle,
    boolean sandbox,
    boolean sandboxInfinite,
    Vault vault) {

  /**
   * 금고 도전 (decisions.md 641번): 보스전과 주간 던전, 금괴로 사는 금고 상점. 한 주의 경계는 한국 시간 월요일 0시다.
   *
   * @param gold 가진 금괴. 금고 도전에서만 얻고 금고 상점에서만 쓴다
   * @param week 이번 주의 번호
   * @param resetsAt 다음 주가 시작되는 때(서버 시각, ms)
   * @param trainingPercent 금고 훈련으로 오른 금고 전투 공격력(%)
   * @param shop 금고 상점의 진열, 차례대로
   * @param lastNote 마지막으로 받은 것 한 줄. 없으면 null
   */
  public record Vault(
      long gold,
      long week,
      long resetsAt,
      int trainingPercent,
      VaultBoss boss,
      VaultDungeon dungeon,
      List<VaultItem> shop,
      String lastNote) {}

  /** 스킬 하나: 코드(idle.cats[].skills[].code와 같다)와 이름. */
  public record VaultSkill(String code, String name) {}

  /** 천적 고양이 한 마리. */
  public record VaultRival(String code, String name, String grade) {}

  /**
   * 금고 보스전: seconds초 동안 수호냥에게 넣은 피해량을 겨룬다.
   *
   * @param weakSkills 이번 주의 약점 스킬: 피해가 weakPercent%
   * @param resistSkills 이번 주의 내성 스킬: 피해가 resistPercent%
   * @param rivals 이번 주의 천적 고양이: 그 고양이 총의 피해가 rivalPercent%
   * @param best 이번 주의 최고 피해량
   * @param record 역대 최고 피해량
   * @param tier 이번 주에 닿은 등급(0이면 아직 없다)
   * @param nextScore 다음 등급의 문턱(피해량)
   * @param tierGold 등급 하나에 받는 금괴. 한 주에 등급마다 한 번이다
   */
  public record VaultBoss(
      int seconds,
      List<VaultSkill> weakSkills,
      List<VaultSkill> resistSkills,
      int weakPercent,
      int resistPercent,
      List<VaultRival> rivals,
      int rivalPercent,
      double best,
      double record,
      int tier,
      String tierName,
      double nextScore,
      String nextTierName,
      long tierGold) {}

  /** 던전 카드 한 장. 배율은 모두 %이고 100이면 그대로다: 공격력·공격 속도·스킬 피해·최대 멘탈, 매도 물량의 체력·빠르기, 매도벽 체력, 수호냥 체력. */
  public record VaultCard(
      String code,
      String name,
      String effect,
      int damagePercent,
      int firePercent,
      int skillPercent,
      int mentalPercent,
      int enemyHpPercent,
      int enemySpeedPercent,
      int wallHpPercent,
      int bossHpPercent) {}

  /**
   * 주간 던전: 층에 들어가기 전에 카드 한 장을 고르고, 고른 카드는 그 주 내내 쌓인다.
   *
   * @param floors 층 수
   * @param cleared 이번 주에 돌파한 층
   * @param cards 이번 주에 고른 카드, 고른 차례대로
   * @param offers 지금 골라야 할 카드들. 고를 차례가 아니면 비어 있다
   * @param floorGold 층마다 받는 금괴, 1층부터
   */
  public record VaultDungeon(
      int floors,
      int cleared,
      List<VaultCard> cards,
      List<VaultCard> offers,
      List<Long> floorGold) {}

  /**
   * 금고 상점의 상품 하나.
   *
   * @param price 금괴 값
   * @param weeklyLimit 한 주에 살 수 있는 횟수. 0이면 횟수 대신 단계(level)가 있는 상품이다
   * @param left 이번 주에 더 살 수 있는 횟수(단계가 있는 상품은 더 올릴 수 있으면 1)
   * @param level 단계가 있는 상품의 지금 단계. 아니면 null
   */
  public record VaultItem(
      String code,
      String name,
      String description,
      long price,
      int weeklyLimit,
      int left,
      Integer level) {}

  /** 광고 뽑기: 종류별 하루 한도와 남은 수, 다음 한국 자정(ms). */
  public record AdDraws(int dailyLimit, int catLeft, int weaponLeft, long resetsAt) {}

  /**
   * 다이아 (decisions.md 526번): 직원·고양이·무기 뽑기에 쓰는 하나뿐인 뽑기 재화. 멘탈 보호 스테이지의 별과 EX 디펜스로 얻는다.
   *
   * @param amount 가진 다이아
   * @param draw 고양이·무기 한 번 뽑는 값
   * @param tenDraw 고양이·무기 10연차의 값
   * @param tenCount 10연차에 나오는 수(하나 더)
   * @param hire 직원 한 명을 뽑는 값
   */
  public record Diamonds(long amount, long draw, long tenDraw, int tenCount, long hire) {}

  /**
   * 시즌패스 (decisions.md 529번): 4주짜리 시즌 동안 플레이로 패스 경험치를 모아 단계마다 보상을 받는다. 무료 줄 하나뿐이다. 시즌이 끝나면 받지 않은
   * 보상은 사라진다.
   *
   * @param season 시즌 번호
   * @param endsAt 시즌이 끝나는 때(서버 시각, ms)
   * @param secondsLeft 끝날 때까지 남은 시간(초)
   * @param endingSoon 끝나기까지 하루가 안 남았다: 받지 않은 보상이 있으면 알려 준다
   * @param points 이번 시즌에 모은 포인트 (570번)
   * @param pointsPerStep 한 단계에 드는 포인트
   * @param step 지금 도달한 단계(0부터)
   * @param claimable 받을 수 있는 보상의 수
   * @param steps 단계마다의 보상, 1단계부터
   * @param missionsReady 받을 포인트가 있는 미션의 수 (572번)
   * @param missions 포인트를 주는 미션과 그 진행도 (570번)
   * @param lastRewards 마지막으로 받은 보상들. 화면이 획득 연출에 쓴다
   */
  public record Pass(
      int season,
      String name,
      long endsAt,
      long secondsLeft,
      boolean endingSoon,
      long points,
      int pointsPerStep,
      int step,
      int claimable,
      int missionsReady,
      List<PassStep> steps,
      List<PassMission> missions,
      List<PassReward> lastRewards) {}

  /**
   * 시즌패스의 일일·주간 퀘스트 (570·643번): 이번 주기에 센 수가 target에 닿으면 points를 한 번 받는다.
   *
   * @param code wall·boss·upgrade·draw·merge·attend·fish·forever·stage
   * @param title 화면에 적는 글: "강화 20번"처럼 target이 들어 있다
   * @param period day(오늘의 퀘스트) 또는 week(이번 주의 퀘스트)
   * @param count 이번 주기에 센 수 (target까지만)
   * @param target 포인트를 받는 데 필요한 수
   * @param points 받는 포인트
   * @param ready 닿았지만 아직 받지 않은 포인트. 눌러서 받는다 (572번)
   * @param done 이번 주기에 이미 받았다
   * @param resetsIn 다음 주기까지 남은 초. 그때 처음부터 다시 센다
   */
  public record PassMission(
      String code,
      String title,
      String period,
      long count,
      long target,
      int points,
      long ready,
      boolean done,
      long resetsIn) {}

  /**
   * 시즌패스의 한 단계. 돈은 주지 않는다 (570번).
   *
   * @param diamonds 받는 다이아
   * @param weapon 무기 하나를 더 받는다(등급은 뽑기처럼 정해진다)
   * @param cat 고양이 한 마리를 더 받는다
   * @param reached 포인트가 이 단계에 닿았다
   * @param claimed 이미 받았다
   */
  public record PassStep(
      int step, long diamonds, boolean weapon, boolean cat, boolean reached, boolean claimed) {}

  /** 받은 단계 보상 하나. 무기·고양이는 받은 것의 코드(없으면 null). */
  public record PassReward(
      int step, long diamonds, String weaponKind, String weaponGrade, String cat, String catName) {}

  /**
   * 상점 (decisions.md 541번): 게임 재화로만 사는 날마다의 상품. 한국 시간 자정에 남은 횟수가 다시 찬다.
   *
   * @param lastReceipt 마지막으로 산 것. 산 적이 없으면 null
   */
  public record Shop(List<ShopItem> items, ShopReceipt lastReceipt) {}

  /**
   * 상품 하나.
   *
   * @param priceDiamonds 다이아 값. 돈으로 사거나 무료면 0
   * @param priceMoney 돈 값(지금의 초당 수입 기준). 다이아로 사거나 무료면 null
   * @param giveDiamonds 주는 다이아. 돈을 주면 0
   * @param giveIncomeMinutes 돈을 주면 회사의 초당 수입 몇 분어치인가. 다이아를 주면 0
   * @param giveMoney 돈을 주면 지금 사면 들어올 돈. 다이아를 주면 null
   * @param dailyLimit 하루에 살 수 있는 횟수
   * @param left 오늘 남은 횟수
   */
  public record ShopItem(
      String code,
      String name,
      long priceDiamonds,
      java.math.BigDecimal priceMoney,
      long giveDiamonds,
      int giveIncomeMinutes,
      java.math.BigDecimal giveMoney,
      int dailyLimit,
      int left) {}

  public record ShopReceipt(String code, long diamonds, java.math.BigDecimal money) {}

  /**
   * 출석 보상 (decisions.md 528번): 하루에 한 번, 한국 시간 자정에 다시 열린다. 누적 출석이라 빠진 날이 있어도 이어서 간다.
   *
   * @param today 오늘 받을 칸(1부터). 오늘 이미 받았으면 오늘 받은 칸
   * @param claimable 오늘 보상을 아직 안 받았다
   * @param board 출석판, 1일 차부터
   * @param lastReward 마지막으로 받은 보상. 받은 적이 없으면 null
   */
  public record Attendance(
      int today, boolean claimable, List<AttendanceDay> board, AttendanceReward lastReward) {}

  /**
   * 출석판의 한 칸.
   *
   * @param diamonds 받는 다이아. 돈 칸이면 0
   * @param incomeMinutes 돈 칸이면 회사의 초당 수입 몇 분어치인가. 다이아 칸이면 0
   * @param money 돈 칸이면 지금 받으면 들어올 돈(지금의 초당 수입 기준). 다이아 칸이면 null
   * @param claimed 이번 주기에서 이미 받은 칸
   */
  public record AttendanceDay(
      int day, long diamonds, int incomeMinutes, java.math.BigDecimal money, boolean claimed) {}

  public record AttendanceReward(int day, long diamonds, java.math.BigDecimal money) {}

  /**
   * 종목회의의 기회 (decisions.md 523번): 1시간마다 하나씩 생기고 max까지 쌓인다. 자리를 비운 동안에도 쌓인다.
   *
   * @param chances 지금 열 수 있는 횟수
   * @param nextSeconds 다음 기회까지 남은 시간(초). 상한에 찼으면 0
   */
  public record Meetings(int chances, int max, long nextSeconds) {}

  /**
   * 회사의 수입 (523번): 화면에서 흐르는 실제 1초에 버는 돈. 접속해 있는 동안과 자리를 비운 동안이 같다.
   *
   * @param perSecond 회사의 초당 수입 = (매도벽 돌파의 시간 수입 + 직원 초당 수입의 합) × (1 + 멘탈 보호 보너스)
   * @param staffPerSecond 그 가운데 직원들의 몫
   * @param bonusPercent 멘탈 보호 보너스(%)
   */
  public record Income(
      java.math.BigDecimal perSecond, java.math.BigDecimal staffPerSecond, int bonusPercent) {}

  /**
   * 자리를 비운 동안 번 돈 (523번). 화면이 at이 바뀐 것을 보고 한 번 알려 준다.
   *
   * @param at 받은 때(서버 시각, ms)
   * @param seconds 비운 시간(초). 상한(8시간)까지만 센다
   * @param capped 상한보다 오래 비워 상한만큼만 받았다
   */
  public record Offline(long at, long seconds, java.math.BigDecimal earned, boolean capped) {}

  /** 화면에 주는 돈 (decisions.md 505번): long을 넘게 커지므로 소수 없는 큰 수로 준다. JSON에서는 그냥 숫자다. */
  public static java.math.BigDecimal money(double amount) {
    return new java.math.BigDecimal(Double.isFinite(amount) ? Math.floor(amount) : 0);
  }

  /**
   * 마지막으로 받은 보스 클리어 보상 (decisions.md 549번). 화면이 wall이 바뀐 것을 보고 한 번 알려 준다.
   *
   * @param wall 깬 보스의 벽 번호
   * @param money 벽 보상과 따로 받은 돈
   */
  public record BossReward(long wall, long diamonds, java.math.BigDecimal money) {}

  public record Idle(
      long wall,
      double hp,
      double maxHp,
      double dps,
      java.math.BigDecimal earned,
      boolean boss,
      List<IdleSkill> skills,
      List<IdleCat> cats,
      int fieldSlots,
      long bread,
      java.math.BigDecimal bundlePrice,
      long bundleDiamonds,
      long nextDiamondSeconds,
      int bakingPercent,
      double wallDps,
      double circuitSeconds,
      List<IdleWall> upcoming,
      long sequence,
      long cleared,
      long epoch,
      boolean bossChallenge,
      BossReward bossReward,
      List<IdleActive> actives,
      List<CatDraw> lastDraws,
      Income income,
      Offline offline,
      double power,
      Rebirth rebirth,
      Onboarding onboarding,
      long bestWall) {}

  public record Onboarding(
      int step,
      boolean catClaimed,
      boolean weaponClaimed,
      boolean skillsUnlocked,
      boolean skillGuideSeen) {}

  /**
   * 환생 (decisions.md 571번): 매도벽 1로 돌아가 전투 강화와 돈을 처음으로 되돌리고 생선을 받는다. 생선은 영구 강화에 쓴다 (600번).
   *
   * @param count 환생한 횟수
   * @param fish 가진 생선
   * @param gain 지금 환생하면 받는 생선. 깊이 갈수록 덤이 커진다 (633번). 아직 할 수 없으면 0
   * @param fromWall 이 벽에 서야 환생할 수 있다: 첫 환생은 첫 보스를 깬 다음 벽(51), 그 뒤로는 생선 한 마리가 나오는 벽(6, 603·625번)
   * @param adGain 광고를 보고 환생하면 받는 생선 (586번): gain의 3배
   * @param upgrades 생선으로 올리는 영구 강화 (600번). 환생해도 남는다
   */
  public record Rebirth(
      int count, long fish, long gain, long fromWall, long adGain, List<FishUpgrade> upgrades) {}

  /**
   * 영구 강화 하나 (decisions.md 600번): 생선으로 올리고 환생해도 남는다. 효과는 같은 종류의 전투 강화(battleUpgrades)의 효과에 이미 더해져
   * 있다.
   *
   * @param kind damage(공격력)·hp(매수벽 체력)·buy(매수벽 공격)
   * @param cost 다음 단계의 값(생선)
   * @param bonus 지금 더해 주는 양. buy는 주, 나머지는 %
   * @param nextBonus 한 단계 올리면 더해 주는 양
   */
  public record FishUpgrade(String kind, int level, long cost, int bonus, int nextBonus) {}

  /**
   * 고양이 뽑기에서 나온 한 마리 (517번).
   *
   * @param level 나온 직후의 레벨. 10연속에서 같은 고양이가 또 나오면 차례로 오른다
   * @param isNew 처음 얻은 고양이
   * @param grade 그 고양이의 등급 (539번)
   */
  public record CatDraw(String code, int level, boolean isNew, String grade) {}

  /**
   * 액티브 스킬 하나 (decisions.md 503번): 눌러서 쓴다. 시간은 화면에서 흐르는 실제 초다(전투는 2배속).
   *
   * @param cooldown 한 번 쓰고 다시 쓸 때까지
   * @param seconds 효과가 이어지는 시간
   * @param readyIn 다시 쓸 수 있을 때까지 남은 시간. 0이면 쓸 수 있다. 전투가 돌아가는 동안만 준다
   * @param left 효과가 남은 시간. 손절처럼 바로 끝나는 것은 0이다
   * @param ad 광고를 보면 쓰는 스킬이다 (588번). 늘 참이다: 사장냥의 고유 스킬은 자동 전투에서 없앴다 (667번)
   */
  public record IdleActive(
      String code,
      String name,
      double cooldown,
      double seconds,
      double readyIn,
      double left,
      boolean ad) {}

  /**
   * 고양이 한 마리 (decisions.md 488·501번). 뽑기로 얻고, 출전하면 제 총으로 함께 쏘고 제 스킬을 쓴다.
   *
   * @param level 0이면 아직 없다. 또 뽑을 때마다 하나씩 오른다
   * @param damagePercent 이 고양이 총의 공격력(%): 든 무기 공격력의 이만큼으로 쏜다. 레벨과 특성이 들어 있다 (492번)
   * @param firePercent 이 고양이 총의 쏘는 빠르기(%). 특성이 없으면 100
   * @param criticalPercent 이 고양이 총의 치명타 배율(%). 특성이 없으면 100
   * @param slot 선 출전 칸의 번호(0부터, 599번). 출전하지 않았으면 null. 전투에서도 이 차례로 줄을 선다
   * @param weapon 든 무기. 없으면 null(기본 권총을 쏜다)
   * @param skills 이 고양이의 고유 스킬 (501·561번). C·B등급은 없고 A등급은 하나, S등급은 둘이다. 출전해 있는 동안 발동한다
   * @param grade 등급 C·B·A·S (539번). 종마다 정해져 있고, 높을수록 총이 세고 뽑기에서 드물다
   */
  public record IdleCat(
      String code,
      String name,
      int level,
      int damagePercent,
      int firePercent,
      int criticalPercent,
      boolean fielded,
      Integer slot,
      CatWeapon weapon,
      List<CatSkill> skills,
      int skillLevel,
      int skillNextLevel,
      String grade) {}

  public record CatWeapon(String kind, String grade) {}

  /** 고양이의 고유 스킬 하나 (561번): 코드(water·meteor·bolt·ram·ice·wind)와 이름. */
  public record CatSkill(String code, String name) {}

  public record IdleWall(long wall, double hp, double maxHp) {}

  /**
   * 스킬 하나 (decisions.md 501번).
   *
   * @param owned 지금 발동 중이다: 이 스킬을 가진 고양이가 출전해 있다
   */
  public record IdleSkill(String code, String name, boolean owned, int level) {}

  /**
   * 무기 뽑기 (decisions.md 366번).
   *
   * @param mergeCount 합쳐 한 등급 올리는 데 드는 같은 무기 수
   * @param lastDraw 마지막으로 뽑은 무기. 뽑은 적이 없으면 null
   * @param lastDraws 마지막 뽑기(한 번 또는 10연속, 517번)에서 나온 무기, 나온 차례대로
   */
  public record Armory(int mergeCount, WeaponDraw lastDraw, List<WeaponDraw> lastDraws) {}

  /**
   * 멘탈 스테이지 (decisions.md 369번).
   *
   * @param best 깬 최고 스테이지(0이면 아직 없다). 다음에 열리는 것은 best + 1
   * @param last 마지막 스테이지(챕터당 스테이지 수 × 챕터 수, 407번)
   * @param perChapter 한 챕터의 스테이지 수. 챕터 마지막은 보스
   * @param stars 깬 스테이지의 별, 1번부터 차례로
   * @param bonusPercent 멘탈 보호 보너스(%): 깬 최고 스테이지만큼 회사의 초당 수입에 곱한다 (523번)
   * @param exAvailable 오늘 EX 디펜스를 아직 안 했다. 하루에 한 번이다 (523번)
   * @param diamondsLeft 스테이지마다 아직 받을 수 있는 다이아, 1번부터 마지막 스테이지까지 (527번). 별 셋을 다 얻었으면 0
   * @param exDiamonds EX 디펜스 한 번의 다이아 (527번)
   * @param lastResult 마지막으로 보낸 스테이지·EX 결과와 받은 보상. 없으면 null
   */
  public record Stages(
      int best,
      int last,
      int perChapter,
      List<Integer> stars,
      int bonusPercent,
      boolean exAvailable,
      List<Long> diamondsLeft,
      long exDiamonds,
      StageResult lastResult) {}

  /**
   * 매도벽 돌파 스테이지 (#698): 주 게임. 멘탈 스테이지와 따로 1-1부터 차례로 깬다.
   *
   * @param best 깬 최고 스테이지(0이면 아직 없다). 다음에 열리는 것은 best + 1
   * @param last 마지막 스테이지
   * @param perChapter 한 챕터의 스테이지 수. 챕터 마지막은 보스
   * @param stars 깬 스테이지의 별, 1번부터 차례로
   * @param lastResult 마지막으로 보낸 결과와 받은 보상. 없으면 null
   */
  public record Assaults(
      int best, int last, int perChapter, List<Integer> stars, StageResult lastResult) {}

  /**
   * 스테이지·EX 한 판의 결과 (369번).
   *
   * @param stage 스테이지 번호. EX 디펜스면 0
   * @param firstClear 이 판에 처음 깼다
   * @param capital 받은 자본
   * @param diamonds 받은 다이아 (526번)
   */
  public record StageResult(
      int stage, boolean cleared, int stars, boolean firstClear, long capital, long diamonds) {}

  /**
   * 자본으로 사는 전투 강화 하나 (decisions.md 367·394번). 최대 단계는 없다.
   *
   * @param kind damage(공격력)·fire(연사)·hp(매수벽 체력: 최대 멘탈, 410번)·buy(매수벽 공격: 매수 주문의 공격력, 495번). 치명타 피해
   *     강화는 없앴다 (556번)
   * @param level 지금 단계(0부터)
   * @param price 다음 단계 값
   * @param priceGrowthPercent 단계마다 값이 오르는 비율(%). 꾹 눌러 연속으로 올릴 때 화면이 다음 값들을 미리 셈한다(정하는 것은 서버)
   * @param bonusPercent 지금 단계의 효과(%): 공격력은 그만큼 오르고, 연사는 쏘는 빠르기가 그만큼 오르고, 체력은 최대 멘탈이 그만큼 오른다
   * @param nextBonusPercent 다음 단계의 효과(%)
   * @param stepBonusPercent 이 강화만의 지금 효과(%): 단계 × 한 단계 효과. 영구 강화(600번)를 곱하지 않아 성장 화면이 보인다 (661번).
   *     bonusPercent는 영구 강화를 곱한 전투 값이다
   * @param nextStepBonusPercent 다음 단계의 그 값(%)
   * @param bonusShares 매수벽 공격(buy)만: 지금 단계에 매수 주문 한 장이 는 수량(주, 579번). buy는 %로 오르지 않아 bonusPercent가
   *     0이다. 다른 강화는 0
   * @param nextBonusShares 다음 단계의 그 수량
   * @param maxLevel 살 수 있는 마지막 단계(487번). 0이면 끝없이 산다
   */
  public record BattleUpgrade(
      String kind,
      int level,
      java.math.BigDecimal price,
      int priceGrowthPercent,
      double bonusPercent,
      double nextBonusPercent,
      double stepBonusPercent,
      double nextStepBonusPercent,
      long bonusShares,
      long nextBonusShares,
      int maxLevel) {}

  /**
   * 뽑은 무기 하나 (366번).
   *
   * @param isNew 새로 얻었다. 이미 가진 종류·등급이면 거짓(그 무기의 수가 하나 늘어 무기 합성 재료가 된다)
   */
  public record WeaponDraw(
      String kind, String name, String grade, String gradeName, boolean isNew) {}

  /**
   * 가진 무기 하나 (decisions.md 346번). 수치는 등급을 더한 최종값: 한 판의 바탕 수치가 된다.
   *
   * @param damagePercent 탄 하나의 공격력(%). 100이 적 체력 1
   * @param fireMs 연사 간격(ms)
   * @param power 탄 강화 단계(0~3). 탄은 항상 한 줄이고, 단계가 오를수록 세고 크며 2단계부터 맞으면 주변 적도 휘말린다
   * @param bulletSpeed 탄 속도(px/s)
   * @param equipped 지금 든 무기
   * @param count 가진 수 (366번). 무기 합성 재료로 쓴다
   */
  public record Weapon(
      String kind,
      String name,
      String grade,
      String gradeName,
      int damagePercent,
      int fireMs,
      int power,
      int bulletSpeed,
      boolean equipped,
      int count) {}

  /**
   * @param desk 앉은 자리 코드. 뽑으면 바로 앉는다 (524번). 자리는 그림과 종목회의의 팀에만 쓰인다
   * @param overallGrade 종합 등급(F~SSS, 그 위 X~GOD). 뽑은 그대로 가고 오르거나 떨어지지 않는다 (421번)
   * @param effects 등급 효과 이름(A 손절·S 끌어주기·SS 방패·SSS 전설의 촉, X 이상의 확신·경보…). 쌓인다 (2.4절, decisions.md
   *     387번)
   * @param perk 등급 효과 한 줄: 이름·맞히면 버는 배수·손 뒤집힘 보정·이름 붙은 효과·(decisions.md 289·387번)
   * @param sector 관심 섹터 코드. 같은 섹터 데스크에 앉으면 조금 더 번다. 없으면 null
   * @param role 앉은 자리의 직함(애널리스트·종목 발굴 담당…). 직함이 없는 자리거나 쉬면 null (decisions.md 267번)
   */
  public record Employee(
      int id,
      String name,
      String overallGrade,
      Map<String, String> grades,
      String desk,
      List<String> effects,
      String perk,
      String sector,
      String sectorName,
      String role,
      String quirk,
      String quirkName,
      java.math.BigDecimal incomePerSecond) {}

  /**
   * 채용 뽑기 (decisions.md 312번).
   *
   * @param roster 데리고 있는 사람 수
   * @param rosterMax 데리고 있을 수 있는 사람 수 = 회사의 자리 수 (524번). 꽉 차면 회사를 넓혀야 더 뽑는다
   * @param draws 지금까지 뽑은 횟수. 뽑기 요청에 싣는다
   * @param maxDraws 한 번에 뽑을 수 있는 최대 수
   * @param rates 이 회사의 확률표: 칸마다 나오는 등급과 확률. star면 특급
   * @param drawn 마지막 뽑기에서 온 사람. 분기를 넘기면 비운다
   * @param collection 도감: 등급(F~GOD)마다 뽑아서 얻은 사람 수. 다음 회사로 이어진다
   */
  public record Gacha(
      int roster,
      int rosterMax,
      int draws,
      int maxDraws,
      List<Rate> rates,
      List<Drawn> drawn,
      List<CollectionEntry> collection) {}

  /** 확률표의 한 칸. */
  public record Rate(String grade, int percent, boolean star) {}

  /**
   * 뽑기로 온 사람.
   *
   * @param star 특급 칸에서 나왔다
   * @param fresh 도감에 처음 오른 등급이다
   * @param perk 짧은 등급 효과: 맞히면 버는 배수와 가장 높은 이름 붙은 효과("맞히면 13.8배 · 방패", decisions.md 387번)
   */
  public record Drawn(
      int employeeId,
      String name,
      String grade,
      boolean star,
      boolean fresh,
      String hello,
      String perk) {}

  /** 도감의 한 칸: 그 등급을 몇 명 얻었나. 0이면 아직 못 봤다. */
  public record CollectionEntry(String grade, int count) {}

  /**
   * 투자 회의 (decisions.md 229번). 정하기 전에는 숨은 방향이 없다.
   *
   * @param ready 지금 정할 수 있다(돈을 굴리는 자리에 사람이 있다)
   * @param highlightBy 형광펜을 그은 리서치 팀 직원. 없으면 null
   * @param remarks 자리에 앉은 직원의 한마디. 회의를 열기 전에는 비어 있다
   * @param convened 회의를 열어 한마디와 형광펜을 굳혔다. 그 뒤로 배치를 바꿔도 그대로다 (decisions.md 249번)
   * @param finder 이 종목을 물어 온 직원 (267번). 아직 아무도 안 가져왔거나 옛 회의면 null
   * @param outcome 정한 뒤의 결과. 아직이면 null
   * @param scouted 이번 분기에 이미 직원이 종목을 물어 왔거나, 분기 넘기기를 눌러 발굴을 굴렸다 (267·382번)
   * @param range 종목 회의 수익률이 오갈 수 있는 범위 (decisions.md 388번): −50% ~ +300%
   */
  public record Invest(
      String title,
      String stockName,
      String sectorName,
      List<InvestSentence> sentences,
      String highlightBy,
      Sway sway,
      List<Remark> remarks,
      List<Option> options,
      boolean ready,
      boolean convened,
      Finder finder,
      InvestOutcome outcome,
      Integer teamBuy,
      Integer teamSell,
      String teamCall,
      List<DebateLine> debate,
      TeamGrade team,
      boolean scouted,
      InvestRange range) {}

  /**
   * 종목 회의 수익률의 범위 (decisions.md 388번, 만분율). 데스크 몫과 떼어 낸 회의만의 수익률이다.
   *
   * @param lossBp 틀렸을 때 가장 크게 잃는 몫. 틀려도 손실이 없어 늘 0이다(#697)
   * @param gainBp 맞혔을 때 가장 크게 버는 몫(+300%)
   */
  public record InvestRange(int lossBp, int gainBp) {}

  /**
   * 회의에 앉은 팀의 합산 등급 (decisions.md 353번): 잘하는 셋의 가중 평균(종목 회의는 안목 절반) + 리서치 팀·팀장 보너스.
   *
   * @param grade F~SSS
   * @param score 0~100
   * @param hint 한 줄 풀이("이 팀이면 기사 열에 일곱은 맞힌다")
   * @param members 앉은 사람 수
   */
  public record TeamGrade(String grade, int score, String hint, int members) {}

  /**
   * 종목을 물어 온 직원 (decisions.md 267번).
   *
   * @param role 직함. 직함이 없는 자리면 null
   * @param pitch 가져올 때 한마디
   */
  public record Finder(int employeeId, String name, String role, String desk, String pitch) {}

  public record InvestSentence(String text, boolean highlighted) {}

  public record Sway(String who, String text) {}

  /**
   * @param read 기사를 읽은 쪽 UP·DOWN·NEUTRAL
   * @param stubborn 돈을 굴리는 직원이 제멋대로 할 낌새 LOW·MID·HIGH. 돈을 굴리지 않으면 null
   */
  public record Remark(
      int employeeId, String name, String desk, String read, String text, String stubborn) {}

  public record Option(String code, String label) {}

  /**
   * 맡긴 회의의 토론 한 줄 (decisions.md 285번).
   *
   * @param side BUY(매수파)·SELL(매도파)
   * @param last 결판의 세 박자(표결·선언·승복)면 참 (295번)
   * @param kind TALK(토론) · TALLY(사회가 표결을 부름) · WIN(이긴 쪽 선언) · LOSE(진 쪽 승복)
   */
  public record DebateLine(String name, String side, String text, boolean last, String kind) {}

  /**
   * @param decisive 결정적 문장의 번호(sentences 안)
   * @param total 회의 손익. 이미 자본에 들어갔다
   */
  /**
   * @param big 크게 했다: 판돈 두 배, 고집 1.5배 (decisions.md 260번)
   */
  /**
   * @param delegated 사장이 "너희가 알아서 해" 하고 맡겼다(decisions.md 279번). choice는 직원들이 정한 쪽
   * @param teamBuy 맡겼을 때 매수 쪽에 얹힌 무게(직원 안목). 맡기지 않았으면 0
   * @param teamSell 매도 쪽 무게
   * @param debate 맡겼을 때 매수파·매도파가 주고받은 말(decisions.md 285번). 맡기지 않았으면 비었다
   * @param returnBp 회의 수익률(만분율, decisions.md 388번) = 회의 손익 ÷ 건 판돈. 판돈을 적기 전에 정한 옛 회의면 null
   * @param gainBp 이 종목을 맞힌 쪽으로 했으면 번 수익률(만분율)
   * @param lossBp 틀린 쪽으로 했으면 잃은 수익률(만분율). 틀려도 손실이 없어 늘 0이다(#697)
   */
  public record InvestOutcome(
      String choice,
      boolean big,
      boolean delegated,
      int teamBuy,
      int teamSell,
      List<DebateLine> debate,
      boolean up,
      String reveal,
      int decisive,
      long total,
      List<InvestResult> results,
      List<DebateLine> reactions,
      String credit,
      Integer returnBp,
      int gainBp,
      int lossBp,
      InvestBattle battle) {}

  /**
   * 종목 회의 뒤 전투 (decisions.md 414번, #573).
   *
   * @param mode DEFENSE(틀린 쪽에 걸어 손실을 줄인다) · ASSAULT(맞힌 쪽이라 매도벽을 부수고 수익을 키운다)
   * @param level 전투의 세기(1부터): 크게 움직인 종목, 크게 건 회의, 깬 번호 스테이지, 회사 건물, 지난 분기 수(분기마다 한 스테이지)가 클수록 높다
   *     (#594)
   * @param levelParts 세기가 오른 이유와 그만큼(0인 것은 빼고). news·big·stage·building·quarter
   * @param open 아직 할 수 있다(분기를 넘기면 끝난다)
   * @param stars 얻은 별. 아직 안 했으면 null
   * @param bonus 전투로 막은 손실 + 더 번 몫(0 이상). 아직 안 했으면 null
   * @param before 전투 전 회의 손익
   * @param after 전투 뒤 회의 손익(= before + bonus). 아직 안 했으면 null
   */
  public record InvestBattle(
      String mode,
      int level,
      List<LevelPart> levelParts,
      boolean open,
      Integer stars,
      Long bonus,
      long before,
      Long after) {}

  /** 회의 뒤 전투의 세기가 오른 이유 하나 (#594): code는 news·big·stage·building·year·upgrade, plus는 더한 세기. */
  public record LevelPart(String code, int plus) {}

  /**
   * follow: BOSS(사장 말대로)·OWN(제 판단대로, "제가 알아서 할게요")·SWAY(꼬드김).
   *
   * @param rival 사장 말과 맞붙은 행동(꼬드김 또는 제 판단). 맞붙을 것이 없었으면 null (decisions.md 235번)
   */
  public record InvestResult(
      int employeeId,
      String name,
      String desk,
      String action,
      String follow,
      long pnl,
      String line,
      Rival rival) {}

  /**
   * @param kind SWAY(꼬드김)·OWN(제 판단)
   * @param action 맞붙은 행동 BUY·SELL·HOLD
   * @param stat 사장 쪽을 지킨 능력치 코드
   */
  public record Rival(String kind, String action, String stat) {}

  /**
   * @param sector 섹터 데스크면 그 섹터 코드. 섹터를 가리지 않는 자리면 null
   * @param hot 이 시대에 뜨는 자리(시대 보너스가 붙는다, 9.4절)
   */
  /**
   * 자리 하나 (4.2절). 돈을 굴리는 자리면 예상 효과가 실린다 (decisions.md 259번).
   *
   * @param gainBp 맞혔을 때 버는 몫(만분율, 시대 보너스 포함, 규모의 벽 전). 돈을 굴리지 않으면 null
   * @param missBp 틀렸을 때 잃는 몫(만분율). 돈을 굴리지 않으면 null
   * @param crashPercent 폭락장의 시장 손익에 곱하는 비율. 100보다 작으면 폭락장에 덜 빠진다. 돈을 굴리지 않으면 null
   */
  public record Desk(
      String code,
      String name,
      String statCode,
      boolean trades,
      String sector,
      boolean hot,
      String description,
      Integer gainBp,
      Integer missBp,
      Integer crashPercent,
      String unlockGrade) {}

  /** 아직 닫힌 돕는 자리 (#393): 회사가 unlockGrade가 되면 열린다. */
  public record LockedDesk(String code, String name, String description, String unlockGrade) {}

  /**
   * @param hrCap 인사팀에 사람이 있으면 지원자 등급의 중심이 오를 수 있는 곳(인사 직원보다 두 단계 아래). 없으면 null
   * @param hot 이번 시대에 뜨는 섹터 한 줄. 뜨는 섹터가 없는 시대면 null (9.4절)
   */
  public record Meeting(String hrCap, String hot) {}

  /**
   * 건물 이사 (decisions.md 296번): 다음 건물로 가는 데 드는 돈. 끝 등급이면 null.
   *
   * @param to 다음 등급(건물)
   * @param cost 이사 비용(다음 띠 자본의 일부)
   * @param needed 이사하려면 있어야 하는 자본(다음 띠 + 이사 비용)
   * @param affordable 지금 자본으로 갈 수 있다
   */
  /**
   * 다음 건물 (296번). 공사 중이면(#347) to가 짓고 있는 건물이고 left가 남은 해다.
   *
   * @param years 그 건물을 짓는 데 걸리는 해. 같은 건물 안에서 책상만 늘면 0(바로 된다)
   * @param left 공사 중이면 남은 해, 아니면 null
   */
  public record Upgrade(String to, long cost, long needed, boolean affordable) {}

  public record Era(String code, String name, String description) {}

  /**
   * 회사 연표·업적·명예의 전당 (decisions.md 263번).
   *
   * @param timeline 큰 일, 오래된 것부터
   * @param achievements 모든 업적. 연 해가 없으면 아직 못 열었다
   * @param hall 이 회사에서 가장 많이 번 사람부터(지금 직원과 떠난 직원), 다섯까지
   */
  public record History(List<Event> timeline, List<Achievement> achievements, List<Hall> hall) {}

  /**
   * @param kind open·grow·shrink·era·overtake·rise·left·best·worst. grade는 grow·shrink의 새 등급(화면이 건물
   *     이름으로 바꾼다)
   */
  public record Event(int year, String kind, String text, String grade) {}

  /**
   * @param year 연 해. 아직이면 null
   */
  /** fail: 실패 업적 (351번). 열리면 채용권은 위로 보상 한 장. */
  public record Achievement(
      String code, String name, String description, Integer year, boolean fail) {}

  /**
   * @param to 떠난 해. 아직 일하면 null
   */
  public record Hall(String name, int from, Integer to, long totalPnl, String grade) {}
}
