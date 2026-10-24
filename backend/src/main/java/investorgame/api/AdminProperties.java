package investorgame.api;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param token 관리자 플레이 기록을 볼 때 `X-Admin-Token` 헤더로 보내는 값. 비어 있으면 관리자 API는 꺼져 있다
 */
@ConfigurationProperties("admin")
record AdminProperties(String token) {}
