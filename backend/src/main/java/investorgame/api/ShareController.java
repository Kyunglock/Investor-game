package investorgame.api;

import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import investorgame.progress.ProgressService;
import investorgame.progress.ShareCard;
import investorgame.progress.SharedResult;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

/**
 * 결과 공유 (#197). 끝난 판의 주인이 공유 ID를 만들고, 누구나 그 ID로 카드를 본다. /r/{id}는 메신저·SNS가 링크 미리보기를 그릴 수 있게 Open
 * Graph 메타를 담은 작은 HTML을 주고, 사람은 곧바로 화면의 공유 페이지(/share/{id})로 넘어간다.
 */
@RestController
class ShareController {

  /** 공유 ID에 쓰는 글자만. 다른 값은 찾아보지도 않는다. */
  private static final String SHARE_ID = "[2-9a-zA-Z]{6,16}";

  /** 요약 그림의 최대 크기. 화면이 그리는 1080×1080 PNG는 100~300KB다. */
  static final int MAX_IMAGE_BYTES = 1024 * 1024;

  private static final byte[] PNG_MAGIC = {(byte) 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a};

  private final ProgressService progress;
  private final SessionCookies cookies;
  private final ShareProperties properties;

  ShareController(ProgressService progress, SessionCookies cookies, ShareProperties properties) {
    this.progress = progress;
    this.cookies = cookies;
    this.properties = properties;
  }

  /** 화면이 쓰는 공유 설정. 카카오 키가 없으면 빈 문자열 (#275). */
  @GetMapping("/api/share-config")
  Map<String, String> config() {
    String key = properties.kakaoJsKey();
    return Map.of("kakaoJsKey", key == null ? "" : key.trim());
  }

  /** 공유한 판의 요약 그림을 올린다 (#275). PNG만, 1MB까지. */
  @PutMapping(value = "/api/games/{gameId}/share/image", consumes = MediaType.IMAGE_PNG_VALUE)
  ResponseEntity<Void> uploadImage(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID gameId,
      @RequestBody byte[] png) {
    if (png.length > MAX_IMAGE_BYTES
        || png.length < PNG_MAGIC.length
        || !Arrays.equals(Arrays.copyOf(png, PNG_MAGIC.length), PNG_MAGIC)) {
      throw new InvalidRequestException("PNG 그림만 1MB까지 올릴 수 있다");
    }
    progress.shareImage(cookies.requireSession(token), gameId, png);
    return ResponseEntity.noContent().build();
  }

  /** 공유한 결과의 요약 그림. 링크 미리보기와 카카오톡 카드가 가져간다. */
  @GetMapping(value = "/api/shares/{shareId}/card.png", produces = MediaType.IMAGE_PNG_VALUE)
  ResponseEntity<byte[]> image(@PathVariable String shareId) {
    if (!shareId.matches(SHARE_ID)) {
      throw new NotFoundException("공유한 그림이 없다");
    }
    byte[] png =
        progress.sharedImage(shareId).orElseThrow(() -> new NotFoundException("공유한 그림이 없다"));
    return ResponseEntity.ok()
        .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
        .body(png);
  }

  @PostMapping("/api/games/{gameId}/share")
  SharedResult share(
      @CookieValue(name = SessionCookies.NAME, required = false) String token,
      @PathVariable UUID gameId) {
    return progress.share(cookies.requireSession(token), gameId);
  }

  @GetMapping("/api/shares/{shareId}")
  ShareCard card(@PathVariable String shareId) {
    return find(shareId);
  }

  @GetMapping(value = "/r/{shareId}", produces = MediaType.TEXT_HTML_VALUE)
  ResponseEntity<String> preview(@PathVariable String shareId, HttpServletRequest request) {
    ShareCard card = find(shareId);
    String base = request.getScheme() + "://" + request.getHeader("Host");
    String page = "/share/" + shareId;
    String title = esc(previewTitle(card));
    String description = esc(previewDescription(card));
    String image =
        progress.sharedImage(shareId).isPresent()
            ? "/api/shares/" + shareId + "/card.png"
            : "/og-card.png";
    String html =
        """
        <!doctype html>
        <html lang="ko">
        <head>
        <meta charset="utf-8">
        <title>%1$s</title>
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="투자자 시뮬레이터">
        <meta property="og:title" content="%1$s">
        <meta property="og:description" content="%2$s">
        <meta property="og:url" content="%3$s/r/%4$s">
        <meta property="og:image" content="%3$s%6$s">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="%1$s">
        <meta name="twitter:description" content="%2$s">
        <meta name="twitter:image" content="%3$s%6$s">
        <meta http-equiv="refresh" content="0;url=%5$s">
        </head>
        <body><a href="%5$s">결과 보기</a></body>
        </html>
        """
            .formatted(title, description, esc(base), shareId, page, image);
    return ResponseEntity.ok()
        .contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
        .body(html);
  }

  private ShareCard find(String shareId) {
    if (!shareId.matches(SHARE_ID)) {
      throw new NotFoundException("공유한 결과가 없다");
    }
    return progress.sharedResult(shareId).orElseThrow(() -> new NotFoundException("공유한 결과가 없다"));
  }

  /** "○○의 인생 — 70세, 최종 자산 12억 3,400만 원" */
  static String previewTitle(ShareCard card) {
    String who = card.name() == null || card.name().isBlank() ? "어느 투자자" : card.name();
    String end = "BANKRUPT".equals(String.valueOf(card.ending())) ? "%d세에 파산" : "%d세까지";
    return "%s의 인생 — %s, 최종 자산 %s"
        .formatted(who, end.formatted(card.finalAge()), won(card.finalAsset()));
  }

  /** "'장기 소신형' 투자자 · 직업 · 가족" */
  static String previewDescription(ShareCard card) {
    StringBuilder text = new StringBuilder();
    if (card.investorTypeName() != null) {
      text.append("'").append(card.investorTypeName()).append("' 투자자");
    }
    if (card.jobTitle() != null) {
      text.append(text.isEmpty() ? "" : " · ").append(card.jobTitle());
    }
    if (card.rank() != null) {
      text.append(text.isEmpty() ? "" : " · ").append("순위표 ").append(card.rank()).append("위");
    }
    text.append(text.isEmpty() ? "" : " · ").append("나도 한 번 살아 보기");
    return text.toString();
  }

  /** 억·만 원 단위로 줄여 쓴다. */
  static String won(long amount) {
    String sign = amount < 0 ? "-" : "";
    long abs = Math.abs(amount);
    long eok = abs / 100_000_000;
    long man = abs % 100_000_000 / 10_000;
    if (eok > 0 && man > 0) {
      return "%s%,d억 %,d만 원".formatted(sign, eok, man);
    }
    if (eok > 0) {
      return "%s%,d억 원".formatted(sign, eok);
    }
    return "%s%,d만 원".formatted(sign, man);
  }

  private static String esc(String text) {
    return HtmlUtils.htmlEscape(text);
  }
}
