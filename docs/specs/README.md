# 도메인 스펙 안내

> 상태: 초안 v0.1
> 표기: **(확정)** = 대화에서 정해진 것, **(제안)** = 제 판단이며 아직 합의되지 않은 것, **(초기값)** = 체감 테스트 후 조정할 수치.
> 상위 문서: [domains.md](../domains.md), [db.md](../db.md), [decisions.md](../decisions.md), [poc.md](../poc.md), [code-style.md](../code-style.md)

## 1. 스펙이란

도메인 에이전트가 구현을 시작하기 전에 읽는 **계약서**다. 다른 문서를 다시 읽지 않아도 구현할 수 있을 만큼 구체적이어야 한다. 스펙에 없는 것은 추측하지 않고 질문한다.

## 2. 스펙 형식

모든 도메인 스펙은 같은 순서로 쓴다.

1. 목적과 범위 (맡는 것, 맡지 않는 것)
2. 공개 인터페이스 (Java 시그니처)
3. 입력·출력 타입
4. 규칙 (수식, 순서, 경계 조건)
5. 설정값 (이름과 초기값)
6. DB (소유 테이블, 변경 사항)
7. 테스트 시나리오 (구체적인 입력과 기대 결과)
8. 완료 조건
9. 미결정

## 3. 스펙 목록

| 스펙 | 상태 | 담당 | 의존 |
|---|---|---|---|
| [behavior.md](./behavior.md) | 초안 v0.1 | agent1 | 없음 (순수 규칙) |
| [character.md](./character.md) | 초안 v0.1 | agent1 | 없음 |
| [asset.md](./asset.md) | 초안 v0.1 | agent2 | 없음 |
| [event.md](./event.md) | 초안 v0.1 | agent2 | 콘텐츠 (유일한 직접 호출) |
| content.md, session.md, result.md | 예정 | agent3 | 없음 |
| progress.md | 예정 | agent5 | 위 전부 |

## 4. 공유 타입 (확정 후 `common`에 둔다)

두 도메인 이상이 쓰는 값 타입이다. 소유자는 통합 담당이며, 변경은 PR 댓글로 요청한다. 패키지는 `investorgame.common`이다 (제안).

```java
public enum Action { BUY, SELL, HOLD }        // 선택과 실제 행동
public enum Direction { UP, DOWN }            // 뉴스의 숨은 방향
public enum Sentiment { POS, NEG }            // 줏대 판정용 "다른 뉴스"의 분위기

public record Stats(int insight, int patience, int courage, int conviction, int luck) {}
// 능력치 값은 0~100. 생성 시 범위를 검증한다.

public enum Phase { SAVING, INVESTING, ENDED }   // 판의 단계 (확정: 투자 시작 전/후)

public interface SeededRandom {
    /** 판 시드에서 키별로 독립적인 생성기를 유도한다. 같은 키는 항상 같은 수열을 만든다. */
    RandomGenerator forKey(Object... keyParts);
}
```

- 능력치 이름은 DB에 행으로 저장되지만(`character_stat`), 규칙이 정해진 다섯 가지는 `Stats`로 다룬다. 새 능력치를 추가하려면 그 능력치의 규칙이 필요하므로 코드 변경이 따른다 (제안). DB는 마이그레이션이 필요 없다.
- 금액은 `long`(원), 게임 시각은 `int`(게임 일수), 확률은 만분율(basis point, 1bp = 0.01%) `int`로 다룬다. 부동소수점을 확률에 쓰지 않는다 (제안).
- **게임 달력** (제안): 1년 = 12개월 × 30일 = 360일. 설정 `game.days-per-month`(30), `game.days-per-year`(360)로 두고 `common`이 소유한다. 월급은 매월 지급, 연차는 360일 단위다.
- 난수는 `java.util.random.RandomGenerator`를 인자로 받는다 (code-style.md 3.4절). 규칙 하나가 난수를 **뽑는 순서**를 스펙에 적는다. 같은 시드이면 같은 결과가 나와야 한다.

## 5. 공통 규칙

- 도메인 사이의 호출은 진행(agent5)만 한다. 이 문서의 인터페이스는 진행이 부르는 입구다.
- 공개 인터페이스를 바꾸는 변경은 PR을 만들고 `cross-domain` 라벨을 붙인다.
- 스펙과 구현이 어긋나면 같은 PR에서 스펙을 고친다.
