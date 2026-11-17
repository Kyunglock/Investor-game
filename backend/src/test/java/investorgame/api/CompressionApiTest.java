package investorgame.api;

import static org.assertj.core.api.Assertions.assertThat;

import investorgame.TestcontainersConfiguration;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.zip.GZIPInputStream;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

/**
 * 응답 압축 (decisions.md 582번). MockMvc는 톰캣을 거치지 않아 압축을 볼 수 없으므로 실제 포트로 부른다. 세션 쿠키는 Secure라 HTTP에서는 쿠키
 * 저장소가 돌려보내지 않으므로 손으로 싣는다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class CompressionApiTest {

  @LocalServerPort int port;

  final HttpClient http = HttpClient.newHttpClient();

  private URI uri(String path) {
    return URI.create("http://localhost:" + port + path);
  }

  private String session() throws Exception {
    HttpResponse<Void> res =
        http.send(
            HttpRequest.newBuilder(uri("/api/sessions"))
                .POST(HttpRequest.BodyPublishers.noBody())
                .build(),
            HttpResponse.BodyHandlers.discarding());
    String cookie = res.headers().firstValue("Set-Cookie").orElseThrow();
    return cookie.substring(0, cookie.indexOf(';'));
  }

  private HttpResponse<byte[]> openCompany(String cookie, boolean gzip) throws Exception {
    HttpRequest.Builder req =
        HttpRequest.newBuilder(uri("/api/company"))
            .header("Cookie", cookie)
            .POST(HttpRequest.BodyPublishers.noBody());
    if (gzip) req.header("Accept-Encoding", "gzip");
    return http.send(req.build(), HttpResponse.BodyHandlers.ofByteArray());
  }

  @Test
  void 회사_응답은_gzip을_받는_요청에_압축해_보낸다() throws Exception {
    HttpResponse<byte[]> res = openCompany(session(), true);

    assertThat(res.statusCode()).isEqualTo(201);
    assertThat(res.headers().firstValue("Content-Encoding")).hasValue("gzip");
    String body;
    try (GZIPInputStream in = new GZIPInputStream(new ByteArrayInputStream(res.body()))) {
      body = new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
    assertThat(body).contains("\"companyId\"");
    // 회사 응답은 압축하면 원래의 절반에도 한참 못 미친다.
    assertThat(res.body().length).isLessThan(body.getBytes(StandardCharsets.UTF_8).length / 2);
  }

  @Test
  void gzip을_말하지_않은_요청에는_압축하지_않는다() throws Exception {
    HttpResponse<byte[]> res = openCompany(session(), false);

    assertThat(res.statusCode()).isEqualTo(201);
    assertThat(res.headers().firstValue("Content-Encoding")).isEmpty();
    assertThat(new String(res.body(), StandardCharsets.UTF_8)).contains("\"companyId\"");
  }
}
