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

  /** direction: UP/DOWN/NEUTRAL, strength: MILD/STRONG. */
  List<String> hintPhrases(String direction, String strength);

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

  record NamedCode(String code, String name) {}

  record TraitStage(int age, List<TraitDefinition> scenes) {}

  record TextBlock(String title, String body) {}

  record OfferText(String title, String body, String acceptLabel, String declineLabel) {}

  record LeverageText(String title, String body, String borrowLabel, String passLabel) {}
}
