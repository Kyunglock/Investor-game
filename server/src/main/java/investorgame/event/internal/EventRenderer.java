package investorgame.event.internal;

import investorgame.content.ContentCatalog;
import investorgame.content.JobDefinition;
import investorgame.content.NewsDefinition;
import investorgame.content.TraitDefinition;
import investorgame.event.EventView;
import java.util.List;
import org.springframework.stereotype.Component;

/** 저장된 이벤트를 화면용 문구로 바꾼다. 숨은 값은 옮기지 않는다. */
@Component
class EventRenderer {

  private static final long TEN_THOUSAND = 10_000;

  private final ContentCatalog content;

  EventRenderer(ContentCatalog content) {
    this.content = content;
  }

  EventView render(EventRow row) {
    return switch (row.kind()) {
      case JOB -> {
        ContentCatalog.TextBlock text = content.jobEventText();
        List<EventView.Option> options =
            row.options().stream().map(code -> jobOption(content.job(code))).toList();
        yield view(row, text.title(), text.body(), null, null, options);
      }
      case TRAIT -> {
        TraitDefinition trait = trait(row.definitionCode());
        List<EventView.Option> options =
            trait.options().stream().map(o -> new EventView.Option(o.code(), o.label())).toList();
        yield view(row, trait.title(), trait.body(), null, null, options);
      }
      case OFFER -> {
        ContentCatalog.OfferText offer = content.offerText();
        yield view(
            row,
            offer.title(),
            offer.body(),
            null,
            null,
            List.of(
                new EventView.Option(DefaultEventService.ACCEPT, offer.acceptLabel()),
                new EventView.Option(DefaultEventService.DECLINE, offer.declineLabel())));
      }
      case NEWS -> {
        NewsDefinition news = news(row.definitionCode());
        yield view(
            row,
            news.title(),
            news.body(),
            phrase(row.hintCode(), true),
            phrase(row.swayCode(), false),
            List.of(
                new EventView.Option("BUY", "매수"),
                new EventView.Option("SELL", "매도"),
                new EventView.Option("HOLD", "관망")));
      }
    };
  }

  TraitDefinition trait(String code) {
    return content.traits().stream()
        .filter(t -> t.code().equals(code))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("콘텐츠에 없는 성향 이벤트: " + code));
  }

  NewsDefinition news(String code) {
    return content.news().stream()
        .filter(n -> n.code().equals(code))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("콘텐츠에 없는 뉴스: " + code));
  }

  private EventView view(
      EventRow row,
      String title,
      String body,
      String hint,
      String sway,
      List<EventView.Option> options) {
    return new EventView(
        row.id(), row.kind(), row.occursDay(), row.sectorCode(), title, body, hint, sway, options);
  }

  private static EventView.Option jobOption(JobDefinition job) {
    return new EventView.Option(
        job.code(), "%s · 월 %,d만 원".formatted(job.title(), job.baseMonthlySalary() / TEN_THOUSAND));
  }

  /** 문구 코드는 "방향.강도.번호"(힌트) 또는 "분위기.번호"(다른 뉴스)다. */
  private String phrase(String code, boolean hint) {
    if (code == null) {
      return null;
    }
    String[] parts = code.split("\\.");
    List<String> phrases =
        hint ? content.hintPhrases(parts[0], parts[1]) : content.swayPhrases(parts[0]);
    return phrases.get(Integer.parseInt(parts[parts.length - 1]));
  }
}
