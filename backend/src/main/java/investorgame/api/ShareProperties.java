package investorgame.api;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 결과 공유 (#275).
 *
 * @param kakaoJsKey 카카오 JavaScript 키. 있으면 화면이 카카오 SDK로 카톡 카드를 보낸다. 비어 있으면 휴대폰 공유창·링크 복사로 보낸다. 공개되는
 *     값이라(브라우저가 쓴다) 비밀이 아니다. 카카오 개발자 사이트에 사이트 도메인을 등록해야 동작한다
 */
@ConfigurationProperties("share")
record ShareProperties(String kakaoJsKey) {}
