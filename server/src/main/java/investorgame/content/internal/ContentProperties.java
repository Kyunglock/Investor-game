package investorgame.content.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 콘텐츠 검증 수치.
 *
 * @param traitStatMaxDelta 성향 선택지 하나가 능력치를 움직일 수 있는 최대 폭 (절댓값)
 * @param traitOptions 성향 장면의 선택지 개수 범위
 */
@ConfigurationProperties("content")
public record ContentProperties(int traitStatMaxDelta, Range traitOptions) {

  public record Range(int min, int max) {}
}
