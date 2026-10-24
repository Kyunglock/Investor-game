package investorgame.progress.internal;

import investorgame.behavior.BehaviorService;
import investorgame.behavior.Reading;
import investorgame.character.CharacterService;
import investorgame.common.GameProperties;
import investorgame.common.random.SeededRandom;
import investorgame.content.AnalysisText;
import investorgame.content.ContentCatalog;
import investorgame.content.HomeRegion;
import investorgame.content.StockDefinition;
import investorgame.household.HouseholdService;
import investorgame.market.IndicatorSeries;
import investorgame.market.MarketService;
import investorgame.market.PricePoint;
import investorgame.market.Quote;
import investorgame.progress.Analysis;
import investorgame.progress.GameView;
import investorgame.progress.MarketOverview;
import investorgame.progress.StockAnalysis;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.random.RandomGenerator;
import org.springframework.stereotype.Component;

/**
 * 매매창의 시황과 종목 분석 (매매창 설계 2·4절). 숫자(사실)는 안목과 상관없이 정확하고, 해석만 안목이 읽는다. 해석은 대상·달마다 한 번 정해 저장한다. 진행의 일부라
 * 다른 도메인을 불러 값을 모은다.
 */
@Component
class MarketDesk {

  private static final long BP = 10_000;
  private static final int MONTHS_PER_YEAR = 12;
  private static final int HISTORY_MONTHS = 60;
  private static final int SHORT_MA = 6;
  private static final int LONG_MA = 12;
  private static final int RECENT_MONTHS = 3;
  static final String MACRO = "macro";

  /** 시황 정답의 문턱 (매매창 설계 4.1절). */
  private static final int COLD_INDEX_BP = -1_000;

  private static final int COLD_SENTIMENT = 30;
  private static final int HOT_SENTIMENT = 70;
  private static final int HOT_TURNOVER = 13_000;
  private static final long CPI_BASE = 1_000;

  private final MarketService market;
  private final CharacterService characters;
  private final BehaviorService behavior;
  private final HouseholdService household;
  private final ContentCatalog content;
  private final LogRepository logs;
  private final AnalysisRepository analyses;
  private final GameProperties calendar;

  MarketDesk(
      MarketService market,
      CharacterService characters,
      BehaviorService behavior,
      HouseholdService household,
      ContentCatalog content,
      LogRepository logs,
      AnalysisRepository analyses,
      GameProperties calendar) {
    this.market = market;
    this.characters = characters;
    this.behavior = behavior;
    this.household = household;
    this.content = content;
    this.logs = logs;
    this.analyses = analyses;
    this.calendar = calendar;
  }

  // ---- 시황 ----

  MarketOverview overview(UUID gameId, SeededRandom random) {
    int month = market.currentMonth(gameId);
    List<MarketOverview.Indicator> indicators = indicators(gameId, month);
    Map<String, String> facts = macroFacts(indicators);
    String truth = macroTruth(indicators);
    Analysis analysis =
        analysis(
            gameId,
            MACRO,
            month,
            truth,
            AnalysisText.MACRO_READINGS,
            content.analysis().macro(),
            content.analysis().remarks().macro(),
            facts,
            random);
    return new MarketOverview(month, indicators, newspaper(gameId), analysis);
  }

  private List<MarketOverview.Indicator> indicators(UUID gameId, int month) {
    List<MarketOverview.Indicator> list = new ArrayList<>();
    list.add(indicator("index", "종합주가지수", "index", market.indexHistory(gameId)));
    list.add(indicator("rate", "주담대 금리", "bp", market.rateHistory(gameId)));
    for (HomeRegion region : content.homeRegions()) {
      list.add(
          indicator(
              region.code(),
              region.name() + " 아파트",
              "won",
              market.homeHistory(gameId, region.code())));
    }
    List<PricePoint> cpi = new ArrayList<>();
    for (int m = Math.max(0, month - HISTORY_MONTHS + 1); m <= month; m++) {
      cpi.add(new PricePoint(m, household.inflated(CPI_BASE, m * calendar.daysPerMonth())));
    }
    list.add(indicator("cpi", "물가", "index", cpi));
    Map<String, String[]> names =
        Map.of(
            "fx", new String[] {"원/달러 환율", "won"},
            "debt", new String[] {"가계부채 증가율", "bp"},
            "sentiment", new String[] {"투자 심리", "score"},
            "turnover", new String[] {"거래대금", "ratio"});
    for (IndicatorSeries series : market.indicators(gameId)) {
      String[] meta = names.get(series.code());
      if (meta != null) {
        list.add(indicator(series.code(), meta[0], meta[1], series.points()));
      }
    }
    return list;
  }

  private static MarketOverview.Indicator indicator(
      String code, String name, String unit, List<PricePoint> history) {
    if (history.isEmpty()) {
      return new MarketOverview.Indicator(code, name, unit, 0, 0, List.of());
    }
    List<PricePoint> recent =
        history.subList(Math.max(0, history.size() - HISTORY_MONTHS), history.size());
    long value = history.getLast().price();
    long yearAgo = history.get(Math.max(0, history.size() - 1 - MONTHS_PER_YEAR)).price();
    return new MarketOverview.Indicator(
        code,
        name,
        unit,
        value,
        yearAgo,
        recent.stream().map(p -> new MarketOverview.Point(p.month(), p.price())).toList());
  }

  private static MarketOverview.Indicator find(List<MarketOverview.Indicator> list, String code) {
    return list.stream().filter(i -> i.code().equals(code)).findFirst().orElseThrow();
  }

  /** 지수 12달 −10% 밑이거나 심리 30 밑이면 위축, 심리 70 위이고 거래대금이 평소의 1.3배 위면 과열, 그 밖은 안정 (매매창 설계 4.1절). */
  private static String macroTruth(List<MarketOverview.Indicator> list) {
    MarketOverview.Indicator index = find(list, "index");
    long sentiment = find(list, "sentiment").value();
    long turnover = find(list, "turnover").value();
    if (changeBp(index.value(), index.yearAgo()) < COLD_INDEX_BP || sentiment < COLD_SENTIMENT) {
      return "COLD";
    }
    if (sentiment > HOT_SENTIMENT && turnover > HOT_TURNOVER) {
      return "HOT";
    }
    return "STABLE";
  }

  private static Map<String, String> macroFacts(List<MarketOverview.Indicator> list) {
    MarketOverview.Indicator index = find(list, "index");
    MarketOverview.Indicator fx = find(list, "fx");
    MarketOverview.Indicator seoul = find(list, "seoul");
    Map<String, String> facts = new HashMap<>();
    facts.put("index", signedPercent(changeBp(index.value(), index.yearAgo())));
    facts.put("rate", percent(find(list, "rate").value()));
    facts.put("fx", String.format(Locale.KOREA, "%,d", fx.value()));
    facts.put("fxChange", signedPercent(changeBp(fx.value(), fx.yearAgo())));
    facts.put("debt", percent(find(list, "debt").value()));
    facts.put("sentiment", Long.toString(find(list, "sentiment").value()));
    facts.put("turnover", Long.toString(find(list, "turnover").value() * 100 / BP));
    facts.put("seoul", signedPercent(changeBp(seoul.value(), seoul.yearAgo())));
    return facts;
  }

  /** 전조·헛소문·기사·위기 회고를 구분 없이 날짜순으로. 종류는 화면이 꼬리표를 붙이지 않는다 (매매창 설계 3.3절). */
  private List<MarketOverview.NewsItem> newspaper(UUID gameId) {
    List<MarketOverview.NewsItem> items = new ArrayList<>();
    for (GameView.LogEntry entry : logs.findAll(gameId)) {
      Map<String, Object> p = entry.payload();
      switch (entry.kind()) {
        case "OMEN", "ARTICLE" ->
            items.add(new MarketOverview.NewsItem(entry.day(), entry.kind(), str(p.get("text"))));
        case "CRISIS" ->
            items.add(
                new MarketOverview.NewsItem(
                    entry.day(),
                    entry.kind(),
                    "돌아보니 %s~%s세의 그 시절은 %s, %s이었다."
                        .formatted(
                            str(p.get("startAge")),
                            str(p.get("endAge")),
                            str(p.get("name")),
                            "DEPRESSION".equals(p.get("severity")) ? "대공황" : "불황")));
        default -> {}
      }
    }
    return items;
  }

  // ---- 종목 ----

  /** 이 달에 이미 정해 둔 종목 해석의 문구. 없으면 비어 있다. 쓰지 않으므로 읽기 트랜잭션에서 불러도 된다. */
  Optional<String> storedAnalysisText(UUID gameId, String stockCode) {
    return analyses
        .find(gameId, stockCode, market.currentMonth(gameId))
        .map(AnalysisRepository.AnalysisRow::text);
  }

  StockAnalysis analysis(UUID gameId, StockDefinition stock, SeededRandom random) {
    int month = market.currentMonth(gameId);
    List<PricePoint> history = market.history(gameId, stock.code());
    StockAnalysis.Facts facts = facts(gameId, stock, history);
    Map<String, String> words = new HashMap<>();
    words.put("stock", stock.name());
    words.put("sectorName", content.sectorName(stock.sector()));
    words.put("drop", percent(facts.dropFromHighBp()));
    words.put("rise", percent(facts.riseFromLowBp()));
    words.put("recent", signedPercent(facts.change3mBp()));
    words.put("year", signedPercent(facts.change12mBp()));
    words.put("sector", signedPercent(facts.sectorChange12mBp()));
    words.put("ma12", facts.monthsVsMa12() >= 0 ? "위" : "아래");
    words.put("months12", Integer.toString(Math.max(1, Math.abs(facts.monthsVsMa12()))));
    Analysis analysis =
        analysis(
            gameId,
            stock.code(),
            month,
            trendTruth(history),
            AnalysisText.TREND_READINGS,
            content.analysis().trend(),
            content.analysis().remarks().trend(),
            words,
            random);
    return new StockAnalysis(stock.code(), facts, analysis);
  }

  private StockAnalysis.Facts facts(UUID gameId, StockDefinition stock, List<PricePoint> history) {
    long price = history.getLast().price();
    List<Long> last12 = tail(history, LONG_MA);
    long high = last12.stream().mapToLong(Long::longValue).max().orElse(price);
    long low = last12.stream().mapToLong(Long::longValue).min().orElse(price);
    long threeAgo = history.get(Math.max(0, history.size() - 1 - RECENT_MONTHS)).price();
    long yearAgo = history.get(Math.max(0, history.size() - 1 - MONTHS_PER_YEAR)).price();
    List<Integer> sectorChanges = new ArrayList<>();
    for (Quote quote : market.quotes(gameId)) {
      if (content.stock(quote.stockCode()).sector().equals(stock.sector())) {
        sectorChanges.add(changeBp(quote.price(), quote.priceYearAgo()));
      }
    }
    return new StockAnalysis.Facts(
        average(tail(history, SHORT_MA)),
        average(last12),
        high,
        low,
        high <= 0 ? 0 : (int) ((high - price) * BP / high),
        low <= 0 ? 0 : (int) ((price - low) * BP / low),
        changeBp(price, threeAgo),
        changeBp(price, yearAgo),
        (int) sectorChanges.stream().mapToInt(Integer::intValue).average().orElse(0),
        monthsVsLongMa(history));
  }

  /** 현재가 > 12개월선이고 6개월선 > 12개월선이면 UP, 둘 다 아래면 DOWN, 그 밖은 FLAT (매매창 설계 4.1절). */
  static String trendTruth(List<PricePoint> history) {
    if (history.size() < 2) {
      return "FLAT";
    }
    long price = history.getLast().price();
    long ma6 = average(tail(history, SHORT_MA));
    long ma12 = average(tail(history, LONG_MA));
    if (price > ma12 && ma6 > ma12) {
      return "UP";
    }
    if (price < ma12 && ma6 < ma12) {
      return "DOWN";
    }
    return "FLAT";
  }

  /** 12개월선 위(양수)·아래(음수)에 이어서 머문 달 수. 선 위에 있으면 +1부터 센다. */
  static int monthsVsLongMa(List<PricePoint> history) {
    int count = 0;
    Integer side = null;
    for (int end = history.size(); end >= 1; end--) {
      List<PricePoint> upTo = history.subList(0, end);
      long price = upTo.getLast().price();
      long ma = average(tail(upTo, LONG_MA));
      int now = price > ma ? 1 : price < ma ? -1 : 0;
      if (side == null) {
        side = now;
      }
      if (now != side || now == 0) {
        break;
      }
      count++;
    }
    return side == null ? 0 : side * count;
  }

  private static List<Long> tail(List<PricePoint> history, int months) {
    return history.subList(Math.max(0, history.size() - months), history.size()).stream()
        .map(PricePoint::price)
        .toList();
  }

  private static long average(List<Long> values) {
    return values.isEmpty()
        ? 0
        : (long) values.stream().mapToLong(Long::longValue).average().orElse(0);
  }

  // ---- 해석 (매매창 설계 4절) ----

  /**
   * 이 달의 해석이 있으면 그대로, 없으면 안목으로 읽어 문구 틀을 고르고 사실을 채워 저장한다. 지난 해석이 있으면 맞았는지에 따라 한마디를 붙인다. 난수는
   * ("behavior","analysis",대상,달)과 ("progress","analysis",대상,달) 키라 같은 달에는 언제 열어도 같다.
   */
  private Analysis analysis(
      UUID gameId,
      String target,
      int month,
      String truth,
      List<String> readings,
      Map<String, Map<String, List<AnalysisText.Template>>> templates,
      AnalysisText.Verdicts verdicts,
      Map<String, String> facts,
      SeededRandom random) {
    Optional<AnalysisRepository.AnalysisRow> existing = analyses.find(gameId, target, month);
    if (existing.isPresent()) {
      return view(existing.get());
    }
    int insight = characters.get(gameId).stats().insight();
    Reading reading =
        behavior.analyze(
            insight,
            readings.indexOf(truth),
            readings.size(),
            random.forKey("behavior", "analysis", target, month));
    RandomGenerator rng = random.forKey("progress", "analysis", target, month);
    String tier = AnalysisText.templateTier(insight);
    String read = readings.get(reading.index());
    List<AnalysisText.Template> pool = templates.get(tier).get(read);
    List<AnalysisText.Template> matching =
        pool.stream().filter(t -> t.confident() == reading.confident()).toList();
    List<AnalysisText.Template> candidates = matching.isEmpty() ? pool : matching;
    AnalysisText.Template template = candidates.get(rng.nextInt(candidates.size()));

    Optional<AnalysisRepository.AnalysisRow> previous =
        analyses.findLatestBefore(gameId, target, month);
    Boolean prevCorrect = null;
    String remark = null;
    if (previous.isPresent()) {
      prevCorrect = previous.get().reading().equals(previous.get().truth());
      Map<String, List<String>> lines = prevCorrect ? verdicts.right() : verdicts.wrong();
      List<String> remarks = lines.get(AnalysisText.remarkTier(insight));
      remark = remarks.get(rng.nextInt(remarks.size()));
    }
    AnalysisRepository.AnalysisRow row =
        new AnalysisRepository.AnalysisRow(
            gameId,
            target,
            month,
            insight,
            tier,
            truth,
            read,
            reading.confident(),
            fill(template.text(), facts),
            prevCorrect,
            remark);
    analyses.insertIfAbsent(row);
    return view(analyses.find(gameId, target, month).orElse(row));
  }

  private static Analysis view(AnalysisRepository.AnalysisRow row) {
    return new Analysis(
        row.month(),
        row.insight(),
        row.reading(),
        row.text(),
        row.prevCorrect() == null ? null : new Analysis.Remark(row.prevCorrect(), row.remark()));
  }

  static String fill(String template, Map<String, String> facts) {
    String text = template;
    for (Map.Entry<String, String> e : facts.entrySet()) {
      text = text.replace("{" + e.getKey() + "}", e.getValue());
    }
    return text;
  }

  // ---- 숫자 표기 ----

  static int changeBp(long now, long before) {
    return before <= 0 ? 0 : (int) ((now - before) * BP / before);
  }

  /** 만분율 → "28.3" (부호 없음). */
  static String percent(long bp) {
    return String.format(Locale.ROOT, "%.1f", Math.abs(bp) / 100.0);
  }

  /** 만분율 → "+4.2" / "−3.1" (마이너스는 U+2212). */
  static String signedPercent(long bp) {
    String sign = bp > 0 ? "+" : bp < 0 ? "−" : "";
    return sign + percent(bp);
  }

  private static String str(Object value) {
    return value == null ? "" : value.toString();
  }
}
