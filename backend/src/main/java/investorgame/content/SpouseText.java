package investorgame.content;

import java.util.List;

/**
 * 결혼 상대 소개의 재료 (decisions.md 77번). 성격·경제력(직업·월급·돈 습관)·생활 인상을 각각 하나씩 뽑아 조합한다. 이름은 없다(90번). 뽑힌 인덱스는
 * "p-e-l" 코드로 이벤트 정의 코드에 실려, 카드를 그릴 때와 결혼할 때 같은 사람이 나온다.
 */
public record SpouseText(List<String> personalities, List<Economy> economies, List<String> lives) {

  /** income은 25세 기준 월 소득(원). 물가는 가계가 붙인다. */
  public record Economy(String job, long income, String text) {}

  /** 조합된 한 사람. intro는 카드와 기록에 그대로 쓰는 소개 문장. */
  public record Profile(String job, long income, String intro) {}

  public String encode(int personality, int economy, int life) {
    return personality + "-" + economy + "-" + life;
  }

  /** 이름이 있던 시절의 "n-p-e-l" 코드(아직 답하지 않은 옛 카드)는 이름 자리를 버리고 읽는다. */
  public Profile profile(String code) {
    String[] parts = code.split("-");
    if (parts.length == 4) {
      parts = new String[] {parts[1], parts[2], parts[3]};
    }
    if (parts.length != 3) {
      throw new IllegalArgumentException("배우자 코드가 아니다: " + code);
    }
    String personality = personalities.get(Integer.parseInt(parts[0]) % personalities.size());
    Economy economy = economies.get(Integer.parseInt(parts[1]) % economies.size());
    String life = lives.get(Integer.parseInt(parts[2]) % lives.size());
    String intro =
        "성격은 %s. 직업은 %s(월 %,d만 원). %s. %s."
            .formatted(personality, economy.job(), economy.income() / 10_000, economy.text(), life);
    return new Profile(economy.job(), economy.income(), intro);
  }
}
