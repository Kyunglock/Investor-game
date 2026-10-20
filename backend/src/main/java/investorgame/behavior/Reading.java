package investorgame.behavior;

/**
 * 안목이 읽어 낸 결론 (매매창 설계 4절).
 *
 * @param index 읽은 갈래의 번호(0부터). 정답과 같을 수도 다를 수도 있다
 * @param confident 확신에 찬 말투인가. 안목과 무관하다: 낮은 안목의 확신은 자신만만한 헛소리가 된다
 */
public record Reading(int index, boolean confident) {}
