package investorgame.content;

import java.util.List;

/**
 * 자녀 결혼 선택의 문구 (decisions.md 68·86번). title·bodies의 {child}는 첫째·둘째·셋째로, 결과 문구의
 * {child}·{word}(아들/딸)·{total}·{cost}는 진행이 채운다. 선택지는 전부 대준다 / 절반만 보탠다 / 안 대준다 셋이고, 결과 문구는 선택마다 여러
 * 벌이다. 넉넉한데 안 대주면 noneRichTexts.
 */
public record ChildWeddingText(
    String title,
    String body,
    String fullLabel,
    String halfLabel,
    String noneLabel,
    List<String> bodies,
    List<String> fullTexts,
    List<String> halfTexts,
    List<String> noneTexts,
    List<String> noneRichTexts) {

  public ChildWeddingText {
    bodies = bodies == null ? List.of() : List.copyOf(bodies);
    fullTexts = fullTexts == null ? List.of() : List.copyOf(fullTexts);
    halfTexts = halfTexts == null ? List.of() : List.copyOf(halfTexts);
    noneTexts = noneTexts == null ? List.of() : List.copyOf(noneTexts);
    noneRichTexts = noneRichTexts == null ? List.of() : List.copyOf(noneRichTexts);
  }

  /** 카드 본문: 여러 벌 가운데 index번째(돌려 가며), 없으면 body. */
  public String bodyAt(int index) {
    return bodies.isEmpty() ? body : bodies.get(Math.floorMod(index, bodies.size()));
  }
}
