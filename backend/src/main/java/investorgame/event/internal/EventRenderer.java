package investorgame.event.internal;

import investorgame.content.CareerDefinition;
import investorgame.content.ChildWeddingText;
import investorgame.content.ContentCatalog;
import investorgame.content.FamilyTripText;
import investorgame.content.JobDefinition;
import investorgame.content.LifeText;
import investorgame.content.NewsDefinition;
import investorgame.content.NoticeDefinition;
import investorgame.content.ShakeDefinition;
import investorgame.content.TraitDefinition;
import investorgame.event.ChoiceTicket;
import investorgame.event.EventView;
import investorgame.event.Notice;
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
        ContentCatalog.TextBlock text =
            DefaultEventService.JOB_RETRY.equals(row.definitionCode())
                ? content.jobRetryText()
                : DefaultEventService.JOB_REHIRE.equals(row.definitionCode())
                    ? content.jobRehireText()
                    : content.jobEventText();
        List<EventView.Option> options =
            row.options().stream()
                .map(
                    code ->
                        switch (code) {
                          case ChoiceTicket.Job.WAIT ->
                              new EventView.Option(code, content.jobWaitLabel());
                          case ChoiceTicket.Job.INVEST ->
                              new EventView.Option(code, content.jobInvestLabel());
                          default -> jobOption(content.job(code));
                        })
                .toList();
        yield view(row, text.title(), text.body(), null, null, options);
      }
      case CAREER -> {
        CareerDefinition career = content.career(row.definitionCode());
        List<EventView.Option> options =
            row.options().stream().map(code -> careerOption(career, code)).toList();
        yield view(row, career.title(), career.body(), null, null, options);
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
      case LIFE -> {
        if (row.definitionCode().startsWith(DefaultEventService.WEDDING_PREFIX)) {
          ChildWeddingText text = content.childWeddingText();
          String child = ordinal(DefaultEventService.weddingSeq(row.definitionCode()));
          yield view(
              row,
              text.title().replace("{child}", child),
              text.body().replace("{child}", child),
              null,
              null,
              List.of(
                  new EventView.Option(ChoiceTicket.ChildWedding.FULL, text.fullLabel()),
                  new EventView.Option(ChoiceTicket.ChildWedding.HALF, text.halfLabel()),
                  new EventView.Option(ChoiceTicket.ChildWedding.NONE, text.noneLabel())));
        }
        if (row.definitionCode().startsWith(DefaultEventService.TRIP_PREFIX)) {
          FamilyTripText text = content.familyTripText();
          String who = tripWho(DefaultEventService.tripProposer(row.definitionCode()), text);
          yield view(
              row,
              text.title().replace("{who}", who),
              text.body().replace("{who}", who),
              null,
              null,
              List.of(
                  new EventView.Option(ChoiceTicket.FamilyTrip.LUXURY, text.luxuryLabel()),
                  new EventView.Option(ChoiceTicket.FamilyTrip.NORMAL, text.normalLabel()),
                  new EventView.Option(ChoiceTicket.FamilyTrip.CHEAP, text.cheapLabel()),
                  new EventView.Option(ChoiceTicket.FamilyTrip.NONE, text.noneLabel())));
        }
        LifeText text = content.lifeText(row.definitionCode());
        yield view(
            row,
            text.title(),
            text.body(),
            null,
            null,
            List.of(
                new EventView.Option(DefaultEventService.ACCEPT, text.acceptLabel()),
                new EventView.Option(DefaultEventService.DECLINE, text.declineLabel())));
      }
      case NEWS -> {
        NewsDefinition news = news(row.definitionCode());
        String stockName = row.stockCode() == null ? "" : content.stock(row.stockCode()).name();
        yield view(
            row,
            withStock(news.title(), stockName),
            withStock(news.body(), stockName),
            hintText(row, news, stockName),
            phrase(row.swayCode(), false),
            List.of(
                new EventView.Option("BUY", "매수"),
                new EventView.Option("SELL", "매도"),
                new EventView.Option("HOLD", "관망")));
      }
      case SHAKE -> {
        ShakeDefinition shake = content.shake(row.definitionCode());
        String stockName = content.stock(row.stockCode()).name();
        yield view(
            row,
            withStock(shake.title(), stockName),
            withStock(shake.body(), stockName),
            null,
            null,
            List.of(new EventView.Option("HOLD", "버틴다"), new EventView.Option("SELL", "판다")));
      }
      case HOUSING -> {
        ContentCatalog.TextBlock text = content.housingText(row.definitionCode());
        yield view(
            row,
            text.title(),
            text.body(),
            null,
            null,
            row.options().stream()
                .map(code -> new EventView.Option(code, content.housingLabel(code)))
                .toList());
      }
      case LEVERAGE -> {
        ContentCatalog.LeverageText text = content.leverageText();
        String stockName = content.stock(row.stockCode()).name();
        String drop = String.valueOf(row.hiddenMagnitudeBp() / 100);
        yield view(
            row,
            withStock(text.title(), stockName).replace("{drop}", drop),
            withStock(text.body(), stockName).replace("{drop}", drop),
            null,
            null,
            List.of(
                new EventView.Option(ChoiceTicket.Leverage.BORROW, text.borrowLabel()),
                new EventView.Option(ChoiceTicket.Leverage.PASS, text.passLabel())));
      }
      case NOTICE -> throw new IllegalStateException("알림은 EventView가 아니라 Notice로 그린다");
    };
  }

  /** 알림성 이벤트. 금액은 정의 그대로 넘기고 월급·순자산 비율 계산은 진행이 한다. */
  Notice notice(EventRow row) {
    NoticeDefinition definition = noticeDefinition(row.definitionCode());
    return new Notice(
        row.id(),
        row.occursDay(),
        definition.code(),
        definition.title(),
        definition.body(),
        definition.amount(),
        definition.salaryPercent(),
        definition.assetPercent());
  }

  NoticeDefinition noticeDefinition(String code) {
    return content.notices().stream()
        .filter(n -> n.code().equals(code))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("콘텐츠에 없는 알림: " + code));
  }

  /** 뉴스 문구의 "{stock}" 자리표시를 종목 이름으로 바꾼다. */
  private static String withStock(String text, String stockName) {
    return text.replace("{stock}", stockName);
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

  private static final List<String> ORDINALS = List.of("첫째", "둘째", "셋째", "넷째", "다섯째");

  /** 자녀 순번을 부르는 말. 첫째·둘째·셋째. */
  /** 여행을 제안한 사람의 이름: spouse·parents는 문구에서, child:n은 첫째·둘째…. */
  static String tripWho(String proposer, FamilyTripText text) {
    if (proposer.startsWith("child:")) {
      return ordinal(Integer.parseInt(proposer.substring("child:".length())));
    }
    return "parents".equals(proposer) ? text.parents() : text.spouse();
  }

  static String ordinal(int seq) {
    return seq >= 1 && seq <= ORDINALS.size() ? ORDINALS.get(seq - 1) : seq + "번째";
  }

  private EventView view(
      EventRow row,
      String title,
      String body,
      String hint,
      String sway,
      List<EventView.Option> options) {
    return new EventView(
        row.id(),
        row.kind(),
        row.occursDay(),
        row.sectorCode(),
        row.stockCode(),
        row.sectorWide(),
        title,
        body,
        hint,
        sway,
        options);
  }

  private static EventView.Option jobOption(JobDefinition job) {
    return new EventView.Option(
        job.code(), "%s · 월 %,d만 원".formatted(job.title(), job.baseMonthlySalary() / TEN_THOUSAND));
  }

  /** 이직 제안의 "move:<직업>"은 옮길 직업과 시작 월급을 문구에 붙인다. */
  private EventView.Option careerOption(CareerDefinition career, String code) {
    boolean move = code.startsWith(DefaultEventService.MOVE_PREFIX);
    String optionCode = move ? "move" : code;
    CareerDefinition.Option option =
        career.options().stream()
            .filter(o -> o.code().equals(optionCode))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("콘텐츠에 없는 직장 선택지: " + code));
    if (!move) {
      return new EventView.Option(code, option.label());
    }
    JobDefinition target = content.job(code.substring(DefaultEventService.MOVE_PREFIX.length()));
    long salary = target.baseMonthlySalary() * (100 + option.success().moveSalaryPercent()) / 100;
    return new EventView.Option(
        code,
        "%s → %s · 월 %,d만 원".formatted(option.label(), target.title(), salary / TEN_THOUSAND));
  }

  /**
   * 힌트 문구. 코드는 "방향.강도.구체성.번호"다. 구체성이 높은 문구는 종목·섹터와 이 종류의 뉴스가 보통 움직이는 폭({min}~{max}%, 뉴스 정의의 공개 범위)을
   * 채운다 (decisions.md 53번). 실제로 굴린 폭은 숨은 값이라 쓰지 않는다.
   */
  private String hintText(EventRow row, NewsDefinition news, String stockName) {
    if (row.hintCode() == null) {
      return null;
    }
    String[] parts = row.hintCode().split("\\.");
    List<String> phrases = content.hintPhrases(parts[2], parts[0], parts[1]);
    return withStock(phrases.get(Integer.parseInt(parts[3])), stockName)
        .replace("{sectorName}", content.sectorName(news.sector()))
        .replace("{min}", String.valueOf(news.magnitude().minBp() / 100))
        .replace("{max}", String.valueOf(news.magnitude().maxBp() / 100));
  }

  /** 다른 뉴스 문구. 코드는 "분위기.번호"다. */
  private String phrase(String code, boolean hint) {
    if (code == null) {
      return null;
    }
    String[] parts = code.split("\\.");
    List<String> phrases = content.swayPhrases(parts[0]);
    return phrases.get(Integer.parseInt(parts[parts.length - 1]));
  }
}
