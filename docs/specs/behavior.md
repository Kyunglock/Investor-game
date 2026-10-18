# 스펙: 행동 (behavior)

> 담당: agent1 · 상태: 초안 v0.1 · 근거: [poc.md](../poc.md) 4~6절, [domains.md](../domains.md) 4절
> 표기: **(확정)**, **(제안)**, **(초기값)** 은 [README.md](./README.md) 참고.

## 1. 목적과 범위

능력치가 선택과 정보에 영향을 주는 방식을 **순수 규칙**으로 구현한다.

| 맡는 것 | 맡지 않는 것 |
|---|---|
| 선택이 실제 행동으로 뒤집히는 판정 (줏대 → 인내심/용기) | 능력치 값의 저장과 성장 (캐릭터) |
| 안목 기반 힌트의 방향과 강도 결정 | 힌트 문구 텍스트 선택 (콘텐츠, 이벤트 운영) |
| 운 기반 손실 완화 여부 결정 | 손익 계산과 반영 (자산) |
| 이탈 원인 기록 | 이벤트의 숨은 값 생성 (이벤트 운영) |

- **상태가 없다.** DB 테이블이 없다. 입력과 난수만으로 결과를 돌려준다 (확정).
- 다른 도메인을 import하지 않는다. 공유 타입(`Action`, `Direction`, `Sentiment`, `Stats`)만 쓴다.

## 2. 공개 인터페이스

```java
package investorgame.behavior;

public interface BehaviorService {

    /** 선택이 판정을 거쳐 실제 행동이 된다. 이탈이 있으면 원인을 함께 돌려준다. */
    Resolution resolve(ChoiceContext context, RandomGenerator rng);

    /** 안목에 따른 힌트의 방향과 강도를 정한다. */
    Hint hint(int insight, Direction truth, RandomGenerator rng);

    /** 운에 따라 손실을 줄일지 정한다. 반환값은 손실에 곱할 비율(퍼센트)이다. */
    int lossFactorPercent(int luck, RandomGenerator rng);
}
```

## 3. 입력·출력 타입

```java
public record ChoiceContext(
    Action choice,            // 사용자가 누른 선택
    Stats stats,              // 현재 능력치
    Sentiment swaySentiment,  // "다른 뉴스"의 분위기
    boolean holding           // 해당 섹터의 보유가 있는가
) {}

public record Resolution(
    Action actual,            // 실제 행동
    List<Deviation> deviations  // 이탈 원인. 이탈이 없으면 빈 목록. 순서대로 적용된 단계
) {}

// 아래 두 타입은 이벤트 운영도 쓰므로 공유 타입(investorgame.common)에 있다 (README 4절).
public record Deviation(
    String statCode,          // "conviction", "patience", "courage"
    Action from,
    Action to
) {}

public record Hint(
    HintDirection direction,  // UP, DOWN, NEUTRAL
    HintStrength strength     // MILD, STRONG. direction이 NEUTRAL이면 의미 없음 (MILD로 고정)
) {
    public enum HintDirection { UP, DOWN, NEUTRAL }
    public enum HintStrength { MILD, STRONG }
}
```

- `Deviation`과 `Hint`를 행동 도메인에 두면 이벤트 운영이 행동을 import하게 되어 도메인 경계 규칙(진행만 다른 도메인을 부른다)에 걸린다. 그래서 구현할 때 공유 타입으로 옮겼다.
- 힌트 문구는 이 도메인이 정하지 않는다. 이벤트 운영이 `(direction, strength)`에 맞는 문구를 콘텐츠에서 골라 `event_instance.hint_code`에 저장한다.

## 4. 규칙

### 4.1 이탈 확률

능력치가 높을수록 이탈이 줄어든다 (확정).

```
이탈 확률(bp) = (100 - 능력치) × 80        # 능력치 0이면 8000bp(80%), 100이면 0bp
```

(초기값) 상한 8000bp는 `behavior.deviation-cap-bp`로 설정한다 (처음 5000이었으나 능력치에 따른 편차를 키우기로 해 올렸다, decisions.md 23번). 수식은 `(100 - 능력치) × cap / 100`이다.

### 4.2 판정 순서 (확정)

1. **줏대 판정.** 줏대의 이탈 확률로 난수를 뽑는다. 걸리면 `swaySentiment`가 `POS`이면 `BUY`, `NEG`이면 `SELL`로 바꾼다. 바뀐 값이 현재 행동과 같으면 이탈이 아니다 (기록하지 않는다).
2. **현재 행동이 `HOLD`이면 인내심 판정.** 인내심의 이탈 확률로 뽑는다. 걸리면:
   - `holding`이 true이면 `behavior.impulse-sell-percent`(초기값 40%) 확률로 `SELL`, 나머지는 `BUY`.
   - `holding`이 false이면 `BUY`.
3. **현재 행동이 `BUY` 또는 `SELL`이면 용기 판정.** 용기의 이탈 확률로 뽑는다. 걸리면 `HOLD`로 바꾼다.
4. 단계마다 행동이 바뀌었으면 `Deviation(statCode, from, to)`를 순서대로 기록한다.

경계 조건:

- 줏대 단계에서 바뀐 행동은 이후 단계(인내심 또는 용기)의 입력이 된다. 예: 사용자가 `HOLD`, 줏대 이탈로 `BUY`가 되면 그다음은 용기 판정을 받는다.
- 용기 이탈로 `HOLD`가 되면 인내심 판정을 받지 않는다. 단계는 한 번씩만 지나간다.
- `SELL`로 바뀌었는데 `holding`이 false이면 행동은 그대로 `SELL`이다. 실행 시 팔 것이 없다는 처리는 자산이 한다 (poc.md 5절과 동일).

### 4.3 난수를 뽑는 순서

같은 시드로 같은 결과가 나오도록 **항상 이 순서로** 뽑는다. 판정에 해당하지 않는 단계도 난수는 건너뛰지 않는다 (순서가 입력에 따라 달라지지 않게 한다).

1. 줏대 판정용 값 (`rng.nextInt(10000)`)
2. 인내심/용기 판정용 값 (`rng.nextInt(10000)`) — 현재 행동이 `HOLD`이면 인내심, 아니면 용기에 쓴다
3. 충동 매도 여부용 값 (`rng.nextInt(100)`) — 인내심 이탈이고 `holding`이 true일 때만 쓰지만 **항상 뽑는다**

### 4.4 힌트

```
정답률(bp) = 2500 + 안목 × 70            # 안목 0이면 25%, 100이면 95%
```

1. **모호 판정.** `insight < 40`이면 `behavior.hint.neutral-percent`(초기값 50%) 확률로 `NEUTRAL`을 돌려준다.
2. **정오 판정.** 정답률로 뽑는다. 맞으면 `truth` 방향, 틀리면 반대 방향이다.
3. **강도 판정.** `insight >= 65`이면 `behavior.hint.strong-percent`(초기값 70%) 확률로 `STRONG`, 아니면 `MILD`.

난수 순서: 모호 → 정오 → 강도 (항상 세 번 뽑는다).

### 4.5 운

```
손실 완화 확률(bp) = 운 × 50            # 운 0이면 0%, 100이면 50%
```

- 걸리면 `behavior.luck.loss-factor-percent`(초기값 30)를 돌려준다. 안 걸리면 100을 돌려준다.
- 자산이 **손실일 때만** 이 비율을 적용한다. 이득이면 무시한다 (자산 스펙).
- 이 메서드는 이득인지 손실인지 모르므로 항상 한 번 뽑는다.

## 5. 설정값 (초기값)

| 이름 | 초기값 | 의미 |
|---|---|---|
| `behavior.deviation-cap-bp` | 8000 | 능력치 0일 때 이탈 확률 |
| `behavior.impulse-sell-percent` | 40 | 충동 행동이 매도일 확률 (보유가 있을 때) |
| `behavior.hint.accuracy-base-bp` | 2500 | 안목 0의 힌트 정답률 |
| `behavior.hint.accuracy-per-point-bp` | 70 | 안목 1점당 정답률 증가 |
| `behavior.hint.neutral-below-insight` | 40 | 이 값 미만이면 모호 판정 대상 |
| `behavior.hint.neutral-percent` | 50 | 모호 확률 |
| `behavior.hint.strong-from-insight` | 65 | 이 값 이상이면 강한 힌트 대상 |
| `behavior.hint.strong-percent` | 70 | 강한 힌트 확률 |
| `behavior.luck.chance-per-point-bp` | 50 | 운 1점당 손실 완화 확률 |
| `behavior.luck.loss-factor-percent` | 30 | 손실 완화 시 손실 비율 |

- 코드에 숫자를 쓰지 않는다. 모두 설정에서 읽는다 (code-style.md 3.3절). 수치 조정이 코드 변경 없이 되어야 한다.
- 수치는 체감 테스트 후 조정한다 (poc.md 5절).

## 6. DB

없음. 이 도메인은 테이블을 소유하지 않는다.

이탈 원인의 저장은 이벤트 운영(`event_deviation`)이 하며, 진행이 `Resolution.deviations`를 넘긴다.

## 7. 테스트 시나리오

난수는 시드를 고정하거나, 지정한 값을 차례로 돌려주는 테스트용 `RandomGenerator`로 만든다.

| # | 입력 | 기대 결과 |
|---|---|---|
| 1 | 선택 `HOLD`, 인내심 100, 줏대 100, 용기 임의 | 어떤 난수에서도 실제 `HOLD`, 이탈 없음 |
| 2 | 선택 `BUY`, 용기 100, 줏대 100 | 어떤 난수에서도 실제 `BUY`, 이탈 없음 |
| 3 | 선택 `HOLD`, 인내심 0, 줏대 100, 보유 없음, 인내심 난수가 걸림 | 실제 `BUY`, 이탈 `[patience: HOLD→BUY]` |
| 4 | 선택 `HOLD`, 인내심 0, 보유 있음, 충동 매도 값 < 40 | 실제 `SELL` |
| 5 | 선택 `HOLD`, 인내심 0, 보유 있음, 충동 매도 값 ≥ 40 | 실제 `BUY` |
| 6 | 선택 `BUY`, 용기 0, 줏대 100, 용기 난수가 걸림 | 실제 `HOLD`, 이탈 `[courage: BUY→HOLD]` |
| 7 | 선택 `BUY`, 줏대 0, 분위기 `NEG`, 줏대 난수가 걸리고 용기 난수는 안 걸림 | 실제 `SELL`, 이탈 `[conviction: BUY→SELL]` |
| 8 | 선택 `BUY`, 줏대 0, 분위기 `POS`, 줏대 난수가 걸림 | 줏대는 `BUY`로 바꿔도 같으므로 이탈 기록 없음 |
| 9 | 선택 `HOLD`, 줏대 0, 분위기 `POS`, 줏대 난수가 걸리고 용기 난수도 걸림 | 줏대로 `BUY`, 이어서 용기로 `HOLD`. 이탈 `[conviction: HOLD→BUY, courage: BUY→HOLD]`, 실제 `HOLD` |
| 10 | 줏대 0, 인내심 0, 용기 0, 같은 시드로 두 번 호출 | 두 결과가 동일하다 (재현성) |
| 11 | 안목 0, 진실 `UP`, 대량 반복(예: 20,000회) | `NEUTRAL`이 아닌 힌트 중 정답 비율이 약 25% (허용 오차 ±2%p) |
| 12 | 안목 100, 진실 `UP`, 대량 반복 | 정답 비율이 약 80% (±2%p). `NEUTRAL`은 나오지 않는다 |
| 13 | 안목 34와 35 | 34는 모호 판정 대상이고 35는 아니다 (경계) |
| 14 | 안목 64와 65 | 64는 `STRONG`이 나오지 않고 65는 나온다 (경계) |
| 15 | 운 0, 대량 반복 | 항상 100을 돌려준다 |
| 16 | 운 100, 대량 반복 | 약 30%가 30을 돌려준다 (±2%p) |
| 17 | 이탈 확률: 능력치 0과 100, 대량 반복 | 약 50%와 0% |
| 18 | 모든 능력치 범위 밖 값(-1, 101) | 입력 검증 오류 |

확률 시나리오(11, 12, 16, 17)는 poc.md 9절의 시뮬레이션 방식과 같다. 단 한 번의 결과로 단언하지 않는다.

## 8. 완료 조건

1. 공개 인터페이스 3개가 위 시나리오 1~18을 통과한다.
2. 이 도메인이 다른 도메인의 `internal`이나 DB를 접근하지 않는다 (ArchUnit).
3. `Math.random`, `new Random`, 현재 시각 사용이 없다.
4. 모든 수치가 설정에서 읽힌다. 코드에 매직 넘버가 없다.
5. 같은 시드로 반복 실행해도 결과가 같다.

## 9. 미결정

| # | 질문 |
|---|---|
| 1 | 확률 계수(`deviation-cap-bp`, 힌트 계수, 운 계수)는 체감 테스트 후 조정한다. 초기값은 poc.md의 가정값이다 |
| 2 | 능력치 5개 외의 능력치를 추가할 때 규칙을 어디에 넣을지 (현재는 코드 변경 필요) |
| 3 | 투자 스타일(장기/단기)이 판정에 영향을 주는지. 현재는 주지 않는다 (제안) |
