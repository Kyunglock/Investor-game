package investorgame.content;

import java.util.List;

/**
 * 직접 작성한 이벤트 콘텐츠(저장소의 content/ JSON). 서버 시작 시 한 번 읽어 메모리에 둔다 (decisions.md 14·15번). 이벤트 운영과 진행이
 * 읽는다.
 */
public interface ContentCatalog {

  String version();

  List<NamedCode> sectors();

  /** 투자 스타일(기간) 코드 목록. */
  List<NamedCode> styles();

  /** 위험 축(공격/안정) 코드 목록. */
  List<NamedCode> risks();

  /** 소신 축(소신/추종) 코드 목록. */
  List<NamedCode> minds();

  String riskName(String code);

  String mindName(String code);

  /** 유형 코드 "{기간}-{위험}-{소신}". 없으면 IllegalArgumentException. */
  InvestorType investorType(String code);

  List<InvestorType> investorTypes();

  /** 알 수 없는 코드이면 코드를 그대로 돌려준다. */
  String sectorName(String code);

  String styleName(String code);

  List<JobDefinition> jobs();

  JobDefinition job(String code);

  /** 취업 뒤 직장 장면. 코드순 (decisions.md 26번). */
  List<CareerDefinition> careers();

  CareerDefinition career(String code);

  /** 모든 성향 장면. 나이순이다. */
  List<TraitDefinition> traits();

  /** 성장 단계(adult가 아닌 장면). 나이순이며 단계마다 장면이 하나 이상 있다. 판마다 단계별로 하나를 뽑는다. */
  List<TraitStage> traitStages();

  /** 취업 뒤 일상 장면(adult). 코드순. */
  List<TraitDefinition> adultTraits();

  List<NewsDefinition> news();

  /** 보유 종목 흔들림 장면. 코드순 (decisions.md 33번). */
  List<ShakeDefinition> shakes();

  /** 아파트를 살 수 있는 지역. 콘텐츠 순서 그대로(서울, 경기). */
  List<HomeRegion> homeRegions();

  HomeRegion homeRegion(String code);

  /** 시장 위기의 갈래. 코드순. */
  List<CrisisDefinition> crises();

  /** 갈래와 상관없이 섞여 나오는 전조 문구. 어느 위기의 전조인지(혹은 아무 일도 없을지) 읽히지 않게 한다. */
  List<String> commonOmens();

  ShakeDefinition shake(String code);

  /** 모든 종목. 코드 이름순. */
  List<StockDefinition> stocks();

  /** 없으면 IllegalArgumentException. */
  StockDefinition stock(String code);

  /** 섹터의 종목. 코드 이름순. */
  List<StockDefinition> stocksOf(String sectorCode);

  /** 알림성 생활 이벤트 정의. */
  List<NoticeDefinition> notices();

  /** kind: "marriage" 또는 "child". 없으면 IllegalArgumentException. */
  LifeText lifeText(String kind);

  /** 자녀 결혼 선택의 문구 (decisions.md 68번). */
  ChildWeddingText childWeddingText();

  /** 가족 여행 제안 문구 (decisions.md 71번). */
  FamilyTripText familyTripText();

  /** 결혼 상대 소개의 재료 (decisions.md 77번). */
  SpouseText spouseText();

  /** 결혼 뒤 월세에 살면 배우자가 월세살이를 그만하자고 하는 장면의 문구 (#116). */
  SpouseRentText spouseRentText();

  /** 아이가 어릴 때의 나들이 (decisions.md 87번). 코드 순. */
  java.util.List<OutingText> outings();

  /** 20세부터의 아르바이트 (decisions.md 96번). 판 시드로 하나가 정해진다. */
  java.util.List<PartTimeJob> partTimeJobs();

  OutingText outing(String code);

  /**
   * 다시 구직 본문의 "{money}" 자리에 들어갈 통장 상황 한 줄 (decisions.md 116번). short는 생활비 여섯 달분이 안 남았을 때, 아니면
   * ample.
   */
  String jobRehireMoneyText(boolean ample);

  /** direction: UP/DOWN/NEUTRAL, strength: MILD/STRONG. */
  /**
   * 힌트 문구. detail은 안목 구간(low·mid·high·expert), 높을수록 종목·섹터·폭({stock}·{sectorName}·{min}~{max}%)을 짚는다
   * (decisions.md 53번).
   */
  List<String> hintPhrases(String detail, String direction, String strength);

  /**
   * 뉴스 결과 뒤 안목 구간(low·mid·high·expert)별 되돌아보는 한마디. good은 내가 고른 선택이 결과와 맞았는가 (decisions.md 73번, 기준은
   * 108번).
   */
  List<String> reviewPhrases(String detail, boolean good);

  /**
   * 안목 한마디의 다른 묶음 (decisions.md 108번). group "hold"는 관망을 골랐을
   * 때(kept-good·kept-bad·watched-good·watched-bad), "extra"는 덧붙이는
   * 말(hint-wrong-you-right·hint-wrong-followed·hint-right-ignored·deviated).
   */
  List<String> reviewPhrases(String group, String key);

  /**
   * 힘든 일(layoff·career-fail·big-loss·fraud) 뒤 누군가(spouse·child·parents·friend)의 위로 (decisions.md
   * 85번).
   */
  List<String> comfortPhrases(String situation, String who);

  /** sentiment: POS/NEG. */
  List<String> swayPhrases(String sentiment);

  TextBlock jobEventText();

  /** "더 나은 자리를 기다린다"를 고른 뒤 다시 오는 직업 선택의 문구. */
  TextBlock jobRetryText();

  /** 실직 뒤 다시 오는 직업 선택의 문구. */
  TextBlock jobRehireText();

  /** 직업 선택의 "기다린다" 선택지 문구. */
  String jobWaitLabel();

  /** 직업 선택의 "전업투자자가 된다" 선택지 문구. */
  String jobInvestLabel();

  OfferText offerText();

  /** 주거 이벤트(move-out·lease-end·buy)의 문구. */
  TextBlock housingText(String definition);

  /** 주거 선택지 문구. */
  String housingLabel(String code);

  /** 빚투 제안의 문구. 제목·본문의 {stock}은 종목 이름, {drop}은 낙폭(%)이다. */
  LeverageText leverageText();

  /** 안목 해석의 문구 틀·한마디와 평범한 경제 기사 (매매창 설계 4절). */
  AnalysisText analysis();

  record NamedCode(String code, String name) {}

  record TraitStage(int age, List<TraitDefinition> scenes) {}

  record TextBlock(String title, String body) {}

  record OfferText(String title, String body, String acceptLabel, String declineLabel) {}

  record LeverageText(String title, String body, String borrowLabel, String passLabel) {}
}
