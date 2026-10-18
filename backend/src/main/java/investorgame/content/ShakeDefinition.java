package investorgame.content;

/**
 * 보유 종목이 흔들리는 장면 (decisions.md 33번). "{stock}" 자리표시에 종목 이름이 들어간다. 선택지는 버틴다·판다로 고정이고, 실제 행동은 인내심·용기
 * 판정으로 뒤집힐 수 있다.
 */
public record ShakeDefinition(String code, String title, String body, int weight) {}
