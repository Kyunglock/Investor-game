package investorgame.content;

import java.util.List;
import java.util.Map;

/**
 * 결혼 뒤 월세에 살면 배우자가 "언제까지 월세 살 거야?" 하고 묻는 장면의 문구 (#116). 단계(처음·다시·부부 갈등)마다 제목·본문이 다르고, 본문의
 * {children} 자리에는 아이가 있을 때의 말이, {job} 자리에는 배우자의 직업·돈 습관(decisions.md 77번)에 따른 한 줄이 들어간다.
 *
 * @param levels 단계별 문구. 마지막 단계 뒤로는 마지막 것을 되풀이한다
 * @param oneChild 아이가 하나일 때 {children} 자리
 * @param moreChildren 아이가 둘 이상일 때 {children} 자리. {count}에 수가 들어간다
 * @param jobLines 배우자 직업별 {job} 자리. 없는 직업이면 빈 문자열
 * @param waitTexts "조금만 더 모으자"고 설득한 결과 문구(단계별)
 * @param stayTexts 그냥 월세에 남은 결과 문구(단계별)
 * @param movedText 배우자의 말에 월세를 벗어난 결과 문구 앞머리
 * @param boughtText 배우자의 말에 집을 산 결과 문구 앞머리
 */
public record SpouseRentText(
    List<Level> levels,
    String oneChild,
    String moreChildren,
    Map<String, String> jobLines,
    List<String> waitTexts,
    List<String> stayTexts,
    String movedText,
    String boughtText) {

  public record Level(String title, String body) {}

  /** 단계(1부터)의 문구. 범위를 넘으면 마지막 단계. */
  public Level level(int level) {
    return levels.get(Math.clamp(level - 1, 0, levels.size() - 1));
  }

  /** 본문을 채운다: 아이 수와 배우자 직업에 따라 문장이 더 붙는다. */
  public String body(int level, int children, String spouseJob) {
    String kids =
        children <= 0
            ? ""
            : children == 1 ? oneChild : moreChildren.replace("{count}", String.valueOf(children));
    String job = spouseJob == null ? "" : jobLines.getOrDefault(spouseJob, "");
    return level(level).body().replace("{children}", kids).replace("{job}", job);
  }

  public String waitText(int level) {
    return at(waitTexts, level);
  }

  public String stayText(int level) {
    return at(stayTexts, level);
  }

  private static String at(List<String> texts, int level) {
    return texts.get(Math.clamp(level - 1, 0, texts.size() - 1));
  }
}
