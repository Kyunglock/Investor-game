package investorgame.market;

import investorgame.common.Direction;
import investorgame.common.random.SeededRandom;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 시장 도메인의 입구 (경제 개편 설계 5절). 종목 가격과 월별 이력을 소유한다. 콘텐츠(stocks.json)를 직접 읽는 것은 이벤트→콘텐츠와 함께 허용된 유일한 도메인
 * 간 직접 호출이다. 자산은 가격을 모르므로 진행이 prices()를 읽어 넘긴다.
 */
public interface MarketService {

  /** 판 시작 시 모든 종목을 기준가로 둔다 (0번째 달). 이미 있으면 아무것도 하지 않는다. */
  void create(UUID gameId);

  /** 아직 처리하지 않은 달을 toDay / 30 까지 순서대로 움직인다. 돌려주는 값은 quotes()와 같다. 같은 날로 다시 불러도 결과가 같다. */
  List<Quote> advanceTo(UUID gameId, int toDay, SeededRandom random);

  /**
   * 뉴스 충격. sectorWide면 섹터 모든 종목에 magnitudeBp, 아니면 stockCode에 magnitudeBp와 같은 섹터 다른 종목에 파급 비율만큼. 그
   * 달의 이력을 덮어쓴다.
   */
  ShockResult applyShock(
      UUID gameId,
      String sectorCode,
      String stockCode,
      boolean sectorWide,
      Direction direction,
      int magnitudeBp,
      int gameDay,
      UUID eventId);

  /** 종목 코드 → 현재가. */
  Map<String, Long> prices(UUID gameId);

  /** 종목별 현재가, 1·12개월 전 가격, 최근 12달. 코드 이름순. */
  List<Quote> quotes(UUID gameId);

  /** 한 종목의 월별 전체 이력. 달 오름차순. */
  List<PricePoint> history(UUID gameId, String stockCode);

  /** 이 판의 경기 흐름(전조·위기). 시드로 정해져 같은 판은 언제 불러도 같다. 화면에 내보내면 안 된다. */
  MarketCycle cycle(SeededRandom random);

  /** fromMonth의 가격 대비 (fromMonth, toMonth] 동안의 최저가 낙폭을 종목 평균으로(만분율, 하락이면 양수). 위기를 돌아볼 때 쓴다. */
  int averageDropBp(UUID gameId, int fromMonth, int toMonth);

  /** 마지막으로 처리한 달 번호 (0부터). */
  int currentMonth(UUID gameId);
}
