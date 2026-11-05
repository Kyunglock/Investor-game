package investorgame.raising.internal;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import investorgame.raising.CardKind;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 육성 한 판의 모든 상태. raising_run.state에 JSON으로 통째로 저장한다. 판이 짧고(카드 12장 안팎) 다른 도메인이 읽지 않아서 표로 나누지 않는다. 숨은
 * 값(뉴스의 방향, 결정적 문장)이 들어 있으므로 화면에는 RunView로 바꿔 내보낸다.
 */
@JsonAutoDetect(
    fieldVisibility = Visibility.ANY,
    getterVisibility = Visibility.NONE,
    isGetterVisibility = Visibility.NONE)
class RunState {

  /** 지금 카드의 번호(0부터). 카드 수와 같으면 끝났다. */
  int card;

  boolean scripted;

  /** 짜인 첫 판에서 지금까지 나온 뉴스 수. */
  int scriptedNews;

  Map<String, Integer> stats = new LinkedHashMap<>();
  Map<String, Integer> exp = new HashMap<>();
  Map<String, Integer> traitScores = new HashMap<>();

  long fund;

  /** 회사가 공채로 내준 판인가 (6.3·6.5절). 아니면 사장의 사재로 하는 판이다. */
  boolean recruit;

  /** 공채 육성이면 회사의 올해 시장 갈래(boom·normal·crash), 아니면 null (6.2절). */
  String marketPhase;

  /** 끝난 뒤 등록할지 정했는가. */
  boolean decided;

  long cash;
  long debt;

  /** 판 시작 가격과 지금 가격. */
  Map<String, Long> startPrices = new HashMap<>();

  Map<String, Long> prices = new HashMap<>();
  Map<String, Holding> holdings = new LinkedHashMap<>();

  /** 능력치별로 이 판에서 손이 뒤집힌 횟수. 원칙 카드를 거절하면 0으로 돌아간다. */
  Map<String, Integer> flips = new HashMap<>();

  /** 걸어 둔 투자 원칙 장치(능력치 코드). */
  List<String> devices = new ArrayList<>();

  int principlesOffered;
  boolean releaseOffered;

  /** 원칙 카드를 띄울 능력치. 다음 뉴스 자리에 뜬다. */
  String pendingPrinciple;

  String pendingRelease;

  /** 단톡방을 나간 뒤 단골 인물의 서운한 한 줄을 아직 안 보였는가. */
  boolean chatLeftPending;

  List<String> usedCards = new ArrayList<>();
  List<String> usedNews = new ArrayList<>();
  Crisis crisis;
  Card current;

  /** 결과 화면의 한 판 요약. */
  List<String> highlights = new ArrayList<>();

  int totalFlips;

  /** 이 판에서 꼬드긴 단골 인물 이름. 나온 순서대로. */
  List<String> tempted = new ArrayList<>();

  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Holding {
    long quantity;
    long avgCost;
  }

  /**
   * @param atCard 위기가 터지는 카드 번호
   * @param omenCards 전조가 보이는 카드 번호. 전조 없는 위기면 비어 있다
   */
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Crisis {
    String code;
    int atCard;

    /** 거짓이면 헛조짐이다: 조짐만 나오고 위기는 오지 않는다 (6.2절, 회사의 헛조짐). */
    boolean hits = true;

    /** 판에서 실제로 본 조짐 수. 단톡방을 나가면 조짐이 보이지 않아 세지 않는다. */
    int seenOmens;

    /** 처음 조짐을 본 카드의 종목 가격. 아직 못 봤으면 null. */
    Map<String, Long> pricesAtFirstOmen;

    List<Integer> omenCards = new ArrayList<>();
    List<String> omens = new ArrayList<>();
  }

  /** 지금 펼쳐진 카드. 고를 때까지 바뀌지 않는다. */
  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Card {
    CardKind kind;

    /** 콘텐츠 카드 코드(성향·큰일) 또는 뉴스 정의 코드. */
    String code;

    String title;
    String body;
    String stockCode;
    boolean sectorWide;
    boolean up;
    int magnitudeBp;

    /** 짜인 첫 판의 뉴스 모드. 아니면 null. */
    String scriptMode;

    List<Sentence> sentences = new ArrayList<>();

    /** 형광펜을 그은 문장 번호. 긋지 않았으면 -1. */
    int highlight = -1;

    String memo;
    String sway;
    String swaySentiment;
    String tempter;
    String omen;

    /** 원칙·풀기 카드의 능력치. */
    String deviceStat;

    int dropBp;
    List<Option> options = new ArrayList<>();
    List<String> tips = new ArrayList<>();
  }

  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Sentence {
    String text;

    /** UP·DOWN·NEUTRAL. */
    String sign;

    boolean decisive;

    Sentence() {}

    Sentence(String text, String sign, boolean decisive) {
      this.text = text;
      this.sign = sign;
      this.decisive = decisive;
    }
  }

  @JsonAutoDetect(fieldVisibility = Visibility.ANY)
  static class Option {
    String code;
    String label;
    String detail;

    Option() {}

    Option(String code, String label, String detail) {
      this.code = code;
      this.label = label;
      this.detail = detail;
    }
  }

  long holdingValue() {
    long sum = 0;
    for (Map.Entry<String, Holding> entry : holdings.entrySet()) {
      sum += entry.getValue().quantity * prices.get(entry.getKey());
    }
    return sum;
  }

  long totalAsset() {
    return cash + holdingValue() - debt;
  }

  long held(String stockCode) {
    Holding holding = holdings.get(stockCode);
    return holding == null ? 0 : holding.quantity;
  }
}
