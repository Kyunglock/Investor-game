package investorgame.content.internal;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 콘텐츠 위치.
 *
 * @param dirs 콘텍츠 JSON 디렉터리 후보. 앞에서부터 파일이 있는 곳을 읽고, 모두 없으면 클래스 경로의 content/ (IDE 실행처럼
 *     processResources가 돌지 않았을 때를 위한 것. 작업 디렉터리가 backend/이면 ../content, 저장소 루트면 content)
 */
@ConfigurationProperties("content")
public record ContentProperties(List<String> dirs) {

  public ContentProperties {
    dirs = dirs == null ? List.of() : List.copyOf(dirs);
  }
}
