package investorgame.content;

import java.util.List;

/**
 * 직접 작성한 게임 콘텐츠(저장소의 content/ JSON). 서버 시작 시 한 번 읽어 메모리에 둔다 (decisions.md 14·15번). 육성 도메인이 읽는다. 읽을
 * 때 규칙을 지키는지 확인해, 어긋나면 서버가 시작 단계에서 실패한다.
 */
public interface ContentCatalog {

  String version();

  List<NamedCode> sectors();

  /** 알 수 없는 코드이면 코드를 그대로 돌려준다. */
  String sectorName(String code);

  /** 투자 스타일(기간) 이름. 알 수 없는 코드이면 코드를 그대로 돌려준다. */
  String styleName(String code);

  List<NewsDefinition> news();

  /** 모든 종목. 코드 이름순. */
  List<StockDefinition> stocks();

  /** 없으면 IllegalArgumentException. */
  StockDefinition stock(String code);

  /** 섹터의 종목. 코드 이름순. */
  List<StockDefinition> stocksOf(String sectorCode);

  /** 시장 위기의 갈래. 코드순. */
  List<CrisisDefinition> crises();

  /** 갈래와 상관없이 섞여 나오는 전조 문구. 어느 위기의 전조인지(혹은 아무 일도 없을지) 읽히지 않게 한다. */
  List<String> commonOmens();

  /**
   * 안목 메모(형광펜 옆 여백) 문구. detail: low·mid·high·expert, direction: UP·DOWN·NEUTRAL, strength:
   * MILD·STRONG.
   */
  List<String> hintPhrases(String detail, String direction, String strength);

  /** 단골 인물이 꼬드길 때 들고 오는 "다른 뉴스" 문구. sentiment: POS·NEG. */
  List<String> swayPhrases(String sentiment);

  /** 3분 육성 한 판과 회사의 문구 (증권사 육성 설계). */
  RaisingContent raising();

  /** 뉴스 정의의 단서 기사 재료 문장. 모든 뉴스 정의에 있다 (투자 원칙 장치 설계 3.1절). 없는 코드면 IllegalArgumentException. */
  NewsClues clues(String newsCode);

  record NamedCode(String code, String name) {}
}
