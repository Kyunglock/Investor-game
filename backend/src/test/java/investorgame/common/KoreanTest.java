package investorgame.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

/** 자리표시 뒤 조사를 값의 받침에 맞춘다 (decisions.md 112번). */
class KoreanTest {

  @Test
  void 겸용_조사는_값의_받침에_맞게_하나로_고른다() {
    assertThat(Korean.fill("{who}이(가) 여행을 가자고 한다", Map.of("who", "배우자")))
        .isEqualTo("배우자가 여행을 가자고 한다");
    assertThat(Korean.fill("{who}이(가) 여행을 가자고 한다", Map.of("who", "부모님")))
        .isEqualTo("부모님이 여행을 가자고 한다");
    assertThat(Korean.fill("{stock}은(는) 반년째 큰 움직임이 없다", Map.of("stock", "엔씽소프트")))
        .isEqualTo("엔씽소프트는 반년째 큰 움직임이 없다");
    assertThat(Korean.fill("{stock}을(를) 같이 샀던 친구", Map.of("stock", "카카우뱅크")))
        .isEqualTo("카카우뱅크를 같이 샀던 친구");
    assertThat(Korean.fill("{job}(으)로 일하기 시작했다", Map.of("job", "대기업 사무직")))
        .isEqualTo("대기업 사무직으로 일하기 시작했다");
  }

  @Test
  void 고정_조사도_값에_맞게_바꾼다() {
    assertThat(Korean.fill("{stock}이 6~35% 정도 밀릴 수 있다", Map.of("stock", "엔씽소프트")))
        .isEqualTo("엔씽소프트가 6~35% 정도 밀릴 수 있다");
    assertThat(
            Korean.fill(
                "{stock}은 {min}~{max}% 상승을 봐야 한다",
                Map.of("stock", "삼송전자", "min", "6", "max", "35")))
        .isEqualTo("삼송전자는 6~35% 상승을 봐야 한다");
    assertThat(Korean.fill("{child}가 결혼했다", Map.of("child", "첫째"))).isEqualTo("첫째가 결혼했다");
    assertThat(Korean.fill("{word}이(가) 울었다", Map.of("word", "아들"))).isEqualTo("아들이 울었다");
    assertThat(Korean.fill("{word}이(가) 울었다", Map.of("word", "딸"))).isEqualTo("딸이 울었다");
  }

  @Test
  void 숫자와_ㄹ_받침과_모르는_키() {
    // 숫자는 읽는 소리로: "…원"은 받침, 끝자리 2는 받침 없음, 1·7·8은 ㄹ 받침이라 "로".
    assertThat(Korean.fill("결혼 비용 {total}을 모두 대줬다", Map.of("total", "31,840,000원")))
        .isEqualTo("결혼 비용 31,840,000원을 모두 대줬다");
    assertThat(Korean.fill("{n}이(가)", Map.of("n", "2"))).isEqualTo("2가");
    assertThat(Korean.fill("{n}(으)로", Map.of("n", "8"))).isEqualTo("8로");
    assertThat(Korean.withParticle("서울", "으로", "로")).isEqualTo("서울로");
    assertThat(Korean.withParticle("경기", "으로", "로")).isEqualTo("경기로");
    assertThat(Korean.withParticle("1억 7,566만 원", "으로", "로")).isEqualTo("1억 7,566만 원으로");
    // 조사가 아닌 글자와 값이 없는 키는 그대로.
    assertThat(Korean.fill("아이가 {count}인데 {x}은(는)", Map.of("count", "2")))
        .isEqualTo("아이가 2인데 {x}은(는)");
    assertThat(Korean.fill("{stock}의 이익", Map.of("stock", "삼송전자"))).isEqualTo("삼송전자의 이익");
  }
}
