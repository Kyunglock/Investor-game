package investorgame.raising.internal;

import investorgame.content.ContentCatalog;
import investorgame.content.RaisingContent;
import investorgame.raising.internal.CompanyState.Employee;
import java.util.List;
import java.util.Objects;

/**
 * 직원 버릇 (decisions.md 349번, #395): 촉파·단톡방파·차트파·뉴스파·커피파. 번호로 정해져 바뀌지 않고, 연봉 협상·사표·이직 제안·뽑기 첫인사의 문구가
 * 버릇을 따른다. 문구 고르기는 난수가 아니라 열쇠(직원·해·분기)의 해시라 같은 상황이면 같은 말을 한다.
 */
class Quirks {

  private final ContentCatalog content;

  Quirks(ContentCatalog content) {
    this.content = content;
  }

  private List<RaisingContent.Quirk> all() {
    return content.raising().company().quirks();
  }

  /** 직원의 버릇. 번호로 정해진다(7은 버릇 수와 서로소라 이웃한 번호의 버릇이 다르다). 합성으로 이어받았으면(350번) 그것. */
  RaisingContent.Quirk of(Employee e) {
    List<RaisingContent.Quirk> quirks = all();
    if (e.quirk != null) {
      for (RaisingContent.Quirk q : quirks) {
        if (q.code().equals(e.quirk)) {
          return q;
        }
      }
    }
    return quirks.get(Math.floorMod(e.id * 7 + 3, quirks.size()));
  }

  /** 합성 재료의 마지막 한마디 (350번, {name}·{base}). */
  String farewellTemplate(Employee material, int turn) {
    return pick(of(material).farewell(), material.id, turn, "farewell");
  }

  /** 버릇 코드. */
  String code(Employee e) {
    return of(e).code();
  }

  String name(Employee e) {
    return of(e).name();
  }

  /** 문구 하나: 열쇠의 해시로 고른다. 비어 있으면 null. */
  static String pick(List<String> lines, Object... key) {
    if (lines == null || lines.isEmpty()) {
      return null;
    }
    return lines.get(Math.floorMod(Objects.hash(key), lines.size()));
  }

  /** 뽑혔을 때 첫인사. */
  String hello(Employee e) {
    return pick(of(e).hello(), e.id, "hello");
  }

  String raiseAskTemplate(Employee e, int year, String fallback) {
    String line = pick(of(e).raiseAsk(), e.id, year, "raise");
    return line != null ? line : fallback;
  }

  String resignTemplate(Employee e, String reason, String fallback) {
    String line = of(e).resign() == null ? null : of(e).resign().get(reason);
    return line != null ? line : fallback;
  }

  String poachKeptTemplate(Employee e, String fallback) {
    String line = of(e).poachKept();
    return line != null ? line : fallback;
  }

  String poachLeftTemplate(Employee e, String fallback) {
    String line = of(e).poachLeft();
    return line != null ? line : fallback;
  }
}
