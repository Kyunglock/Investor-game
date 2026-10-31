package investorgame.content;

/**
 * 아이가 어릴 때의 가족 나들이 (decisions.md 87번): 놀이동산·동물원·캠핑·운동회, 학예회·공개 수업·생일 파티·피아노 발표회·졸업식 (99번). {child}는
 * 첫째·둘째…로 바뀐다. cost는 보통 비용(25세 기준, 물가가 붙는다). 선택지는 가족 여행과 같은 넷(초호화 4배 / 보통 / 작게 1/5 / 안 간다)이고 결과 문구가
 * 선택마다 있다. minAge~maxAge(세)는 그 아이가 이 나들이를 조르거나 이 행사가 있을 나이다 (106번): 두 살이 캠핑을 가자고 하지 않는다.
 */
public record OutingText(
    String code,
    String name,
    long cost,
    int minAge,
    int maxAge,
    String title,
    String body,
    String luxuryLabel,
    String normalLabel,
    String cheapLabel,
    String noneLabel,
    String luxuryText,
    String normalText,
    String cheapText,
    String noneText) {

  /** 이 나이의 아이에게 맞는 나들이인가. */
  public boolean fits(int age) {
    return age >= minAge && age <= maxAge;
  }
}
