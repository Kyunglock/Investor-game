package investorgame.content.internal;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 콘텍츠 위치와 검증 수치.
 *
 * @param traitStatMaxDelta 성향 선택지 하나가 능력치를 움직일 수 있는 최대 폭 (절댓값)
 * @param traitOptions 성향 장면의 선택지 개수 범위
 * @param dirs 콘텍츠 JSON 디렉터리 후보. 앞에서부터 파일이 있는 곳을 읽고, 모두 없으면 클래스 경로의 content/ (IDE 실행처럼
 *     processResources가 돌지 않았을 때를 위한 것. 작업 디렉터리가 backend/이면 ../content, 저장소 루트면 content)
 */
@ConfigurationProperties("content")
public record ContentProperties(int traitStatMaxDelta, Range traitOptions, List<String> dirs) {

  public ContentProperties {
    dirs = dirs == null ? List.of() : List.copyOf(dirs);
  }

  public record Range(int min, int max) {}
}
