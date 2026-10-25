package investorgame.common;

/** 한글 조사. 받침이 있으면 앞 것(과·이·을), 없으면 뒤 것(와·가·를). 한글이 아니면 받침이 있는 것으로 본다. */
public final class Korean {

  private Korean() {}

  public static String withParticle(String word, String withBatchim, String withoutBatchim) {
    if (word == null || word.isEmpty()) {
      return word + withBatchim;
    }
    char last = word.charAt(word.length() - 1);
    boolean hangul = last >= 0xAC00 && last <= 0xD7A3;
    boolean batchim = !hangul || (last - 0xAC00) % 28 != 0;
    return word + (batchim ? withBatchim : withoutBatchim);
  }
}
