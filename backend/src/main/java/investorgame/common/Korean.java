package investorgame.common;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 한글 조사. 받침이 있으면 앞 것(과·이·을·은·으로), 없으면 뒤 것(와·가·를·는·로). 숫자는 읽는 소리로(0·1·3·6·7·8 받침), 그 밖의 한글 아닌 글자는
 * 받침이 있는 것으로 본다. 자리표시 뒤의 조사는 {@link #fill}이 값에 맞춰 고른다 (decisions.md 112번).
 */
public final class Korean {

  /** 자리표시 "{키}"와 바로 뒤에 붙은 조사(겸용 "이(가)" 또는 고정 "이"). */
  private static final Pattern PLACEHOLDER =
      Pattern.compile(
          "\\{(\\w+)\\}(이\\(가\\)|가\\(이\\)|은\\(는\\)|는\\(은\\)|을\\(를\\)|를\\(을\\)|과\\(와\\)|와\\(과\\)|\\(으\\)로|으로|이|가|은|는|을|를|과|와|로)?");

  private static final String[][] PAIRS = {
    {"이", "가"}, {"은", "는"}, {"을", "를"}, {"과", "와"}, {"으로", "로"}
  };

  /** 숫자 끝자리를 읽을 때 받침이 있는가 (영·일·삼·육·칠·팔). */
  private static final boolean[] DIGIT_BATCHIM = {
    true, true, false, true, false, false, true, true, true, false
  };

  /** 숫자 끝자리가 ㄹ 받침인가 (일·칠·팔). "로"가 붙는다. */
  private static final boolean[] DIGIT_RIEUL = {
    false, true, false, false, false, false, false, true, true, false
  };

  private Korean() {}

  public static String withParticle(String word, String withBatchim, String withoutBatchim) {
    if (word == null || word.isEmpty()) {
      return word + withBatchim;
    }
    // 으로/로: ㄹ 받침 뒤에는 "로"다 (서울로).
    boolean ro = "으로".equals(withBatchim) && "로".equals(withoutBatchim);
    return word + (hasBatchim(word) && !(ro && endsWithRieul(word)) ? withBatchim : withoutBatchim);
  }

  /** 마지막 글자에 받침이 있는가. 한글이 아니면(숫자 제외) 있는 것으로 본다. */
  public static boolean hasBatchim(String word) {
    if (word == null || word.isEmpty()) {
      return true;
    }
    char last = word.charAt(word.length() - 1);
    if (last >= '0' && last <= '9') {
      return DIGIT_BATCHIM[last - '0'];
    }
    boolean hangul = last >= 0xAC00 && last <= 0xD7A3;
    return !hangul || (last - 0xAC00) % 28 != 0;
  }

  /** 마지막 글자가 ㄹ 받침인가. */
  public static boolean endsWithRieul(String word) {
    if (word == null || word.isEmpty()) {
      return false;
    }
    char last = word.charAt(word.length() - 1);
    if (last >= '0' && last <= '9') {
      return DIGIT_RIEUL[last - '0'];
    }
    boolean hangul = last >= 0xAC00 && last <= 0xD7A3;
    return hangul && (last - 0xAC00) % 28 == 8;
  }

  /**
   * 틀의 "{키}"를 값으로 바꾸고, 자리표시 바로 뒤의 조사(겸용 "이(가)"·"(으)로"든 고정 "이"든)를 값의 받침에 맞게 고른다. 값이 없는 키는 그대로 둔다.
   */
  public static String fill(String template, Map<String, String> values) {
    Matcher m = PLACEHOLDER.matcher(template);
    StringBuilder out = new StringBuilder();
    while (m.find()) {
      String value = values.get(m.group(1));
      if (value == null) {
        m.appendReplacement(out, Matcher.quoteReplacement(m.group()));
        continue;
      }
      String particle = m.group(2);
      m.appendReplacement(out, Matcher.quoteReplacement(value + resolve(value, particle)));
    }
    m.appendTail(out);
    return out.toString();
  }

  private static String resolve(String value, String particle) {
    if (particle == null) {
      return "";
    }
    String bare = particle.replace("(", "").replace(")", "");
    for (String[] pair : PAIRS) {
      String both = pair[0] + pair[1];
      if (bare.equals(both)
          || bare.equals(pair[1] + pair[0])
          || bare.equals(pair[0])
          || bare.equals(pair[1])) {
        return withParticle(value, pair[0], pair[1]).substring(value.length());
      }
    }
    return particle;
  }
}
