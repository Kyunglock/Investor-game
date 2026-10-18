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

  /** 모든 성향 장면. 나이순이다. */
  List<TraitDefinition> traits();

  /** 성장 단계. 나이순이며 단계마다 장면이 하나 이상 있다. 판마다 단계별로 하나를 뽑는다. */
  List<TraitStage> traitStages();

  List<NewsDefinition> news();

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

  OfferText offerText();

  record NamedCode(String code, String name) {}

  record TraitStage(int age, List<TraitDefinition> scenes) {}

  record TextBlock(String title, String body) {}

  record OfferText(String title, String body, String acceptLabel, String declineLabel) {}
}
