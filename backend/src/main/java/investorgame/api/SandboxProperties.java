package investorgame.api;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param code 테스트판을 여는 코드 (decisions.md 499번). 비어 있으면 테스트판은 꺼져 있다
 */
@ConfigurationProperties("sandbox")
record SandboxProperties(String code) {}
