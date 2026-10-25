package investorgame.content;

import java.util.List;

/**
 * 결혼 상대 소개의 재료 (decisions.md 77번). 이름·성격·경제력(직업·월급·돈 습관)·생활 인상을 각각 하나씩 뽑아 조합한다. 뽑힌 인덱스는 "n-p-e-l"
 * 코드로 이벤트 정의 코드에 실려, 카드를 그릴 때와 결혼할 때 같은 사람이 나온다.
 */
public record SpouseText(
    List<String> names, List<String> personalities, List<Economy> economies, List<String> lives) {

  /** income은 25세 기준 월 소득(원). 물가는 가계가 붙인다. */
  public record Economy(String job, long income, String text) {}

  /** 조합된 한 사람. intro는 카드와 기록에 그대로 쓰는 소개 문장. */
  public record Profile(String name, String job, long income, String intro) {}

  public String encode(int name, int personality, int economy, int life) {
    return name + "-" + personality + "-" + economy + "-" + life;
  }

  public Profile profile(String code) {
    String[] parts = code.split("-");
    if (parts.length != 4) {
      throw new IllegalArgumentException("배우자 코드가 아니다: " + code);
    }
    String name = names.get(Integer.parseInt(parts[0]) % names.size());
    String personality = personalities.get(Integer.parseInt(parts[1]) % personalities.size());
    Economy economy = economies.get(Integer.parseInt(parts[2]) % economies.size());
    String life = lives.get(Integer.parseInt(parts[3]) % lives.size());
    String intro =
        "%s. 성격은 %s. 직업은 %s(월 %,d만 원). %s. %s."
            .formatted(
                name, personality, economy.job(), economy.income() / 10_000, economy.text(), life);
    return new Profile(name, economy.job(), economy.income(), intro);
  }
}
