package investorgame.content;

import java.util.List;

/**
 * 직접 작성한 이벤트 콘텐츠(저장소의 content/ JSON). 서버 시작 시 한 번 읽어 메모리에 둔다 (decisions.md 14·15번). 이벤트 운영과 진행이
 * 읽는다.
 */
public interface ContentCatalog {

  String version();

  List<NamedCode> sectors();

  /** 알 수 없는 코드이면 코드를 그대로 돌려준다. */
  String sectorName(String code);

  String styleName(String code);

  List<JobDefinition> jobs();

  JobDefinition job(String code);

  /** order 순서로 정렬되어 있다. */
  List<TraitDefinition> traits();

  List<NewsDefinition> news();

  /** direction: UP/DOWN/NEUTRAL, strength: MILD/STRONG. */
  List<String> hintPhrases(String direction, String strength);

  /** sentiment: POS/NEG. */
  List<String> swayPhrases(String sentiment);

  TextBlock jobEventText();

  OfferText offerText();

  record NamedCode(String code, String name) {}

  record TextBlock(String title, String body) {}

  record OfferText(String title, String body, String acceptLabel, String declineLabel) {}
}
