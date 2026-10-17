# 스펙: 자산 (asset)

> 담당: agent2 · 상태: 초안 v0.1 · 근거: [poc.md](../poc.md) 5절, [decisions.md](../decisions.md), [db.md](../db.md) 3.6~3.8절
> 표기: **(확정)**, **(제안)**, **(초기값)** 은 [README.md](./README.md) 참고.

## 1. 목적과 범위

한 판의 현금과 보유를 소유하고, 거래와 주가 변동을 반영한다.

| 맡는 것 | 맡지 않는 것 |
|---|---|
| 초기 자산 랜덤 생성 | 직업별 월급 액수 계산 (진행이 콘텐츠와 연차로 계산해 넘김) |
| 매수·매도 처리 | 매수·매도 판정과 이탈 (행동) |
| 월급 입금, 자기계발 비용 지출 | 주가 변동의 방향과 폭 결정 (이벤트 운영이 만들고 진행이 넘김) |
| 주가 변동 반영과 손익 계산 | 운에 의한 손실 완화 여부 (행동이 정해 비율만 넘김) |
| 총자산 계산, 거래 장부 | 능력치 읽기 (능력치를 모른다) |

- **직업도 능력치도 모른다** (domains.md 4절). 필요한 값은 모두 인자로 받는다.
- 다른 도메인을 호출하지 않는다.
- 호출하는 쪽(진행)이 한 판의 `progress_game` 행을 잠근 상태에서 부른다. 이 도메인은 추가로 잠그지 않는다 (db.md 5절).

## 2. 공개 인터페이스

```java
package investorgame.asset;

public interface AssetService {

    /** 판 시작 시 계정을 만들고 초기 현금을 랜덤으로 정한다. 같은 gameId로 다시 부르면 기존 계정을 돌려준다(멱등). */
    AccountView create(UUID gameId, RandomGenerator rng);

    AccountView get(UUID gameId);

    /** 사용자의 실제 행동을 반영한다. 매수는 현금의 일정 비율, 매도는 해당 섹터 전량이다. */
    TradeResult trade(UUID gameId, Action action, String sectorCode, int gameDay, UUID eventId);

    /** 뉴스의 숨은 방향·폭을 해당 섹터 보유에 반영한다. 손실이면 lossFactorPercent를 곱한다. */
    PriceChangeResult applyPriceChange(UUID gameId, String sectorCode, Direction direction,
                                       int magnitudeBp, int lossFactorPercent, int gameDay, UUID eventId);

    /** 월급을 입금한다. 같은 (gameId, gameDay)로 다시 부르면 중복 입금하지 않는다. */
    SalaryResult creditSalary(UUID gameId, long amount, int gameDay);

    /** 자기계발 비용 등을 지출한다. 현금이 부족하면 지출하지 않는다. */
    SpendResult spend(UUID gameId, long amount, int gameDay, UUID eventId);

    /** 현금과 보유 평가액의 합. */
    long totalAsset(UUID gameId);

    /** 세션 만료 시 해당 판의 자산 데이터를 지운다. */
    void deleteByGame(UUID gameId);
}
```

## 3. 입력·출력 타입

```java
public record AccountView(UUID gameId, long cash, long initialCash, Map<String, Long> holdings) {}

public enum TradeStatus { EXECUTED, HELD, NOTHING_TO_SELL, INSUFFICIENT_CASH }

public record TradeResult(
    TradeStatus status,
    Action action,       // 요청된 실제 행동
    long amount,         // 거래된 금액(원). 실행되지 않으면 0
    long cashAfter
) {}

public record PriceChangeResult(
    long pnl,            // 이번 변동의 손익(원). 보유가 없으면 0
    boolean lossSoftened,  // 운으로 손실이 줄었는가
    long holdingAfter
) {}

public record SalaryResult(boolean credited, long amount, long cashAfter) {}   // 이미 입금된 날이면 credited=false

public record SpendResult(boolean spent, long cashAfter) {}
```

## 4. 규칙

### 4.1 초기 자산 (확정: 랜덤)

- 초기 현금 = `randomInt(1, 50) × 1,000,000`원 (초기값, poc.md). 난수는 한 번만 뽑는다.
- 보유는 비어 있다.
- `initialCash`를 계정에 함께 저장한다 (결과의 수익률 계산에 쓴다).

### 4.2 매수 (`BUY`)

```
금액 = 현금 × buy-ratio-bp / 10,000          # 정수 나눗셈, 소수점 이하 버림
```

- `buy-ratio-bp`의 초기값은 3000(30%). 매수 금액이 `min-trade`(초기값 1,000원) 미만이면 실행하지 않고 `INSUFFICIENT_CASH`를 돌려준다.
- 실행하면 현금이 줄고 해당 섹터 보유가 늘어난다. 장부에 `BUY`(현금 변화 음수)를 한 행 남긴다.

### 4.3 매도 (`SELL`)

- 해당 섹터 보유 **전량**을 현금으로 바꾼다 (poc.md).
- 보유가 0이면 실행하지 않고 `NOTHING_TO_SELL`을 돌려준다. 장부에 남기지 않는다. 줏대나 인내심 이탈로 보유가 없는데 매도가 선택된 경우가 여기에 해당한다 (행동 스펙 4.2절).
- 실행하면 장부에 `SELL`(현금 변화 양수)을 한 행 남긴다.

### 4.4 관망 (`HOLD`)

- 아무것도 하지 않는다. `HELD`를 돌려준다. 장부에 남기지 않는다.

### 4.5 주가 변동

```
원 손익 = 보유 × 방향 부호 × magnitudeBp / 10,000        # UP은 +, DOWN은 −. 0 방향으로 버림
손실이면: 손익 = 원 손익 × lossFactorPercent / 100        # 0 방향으로 버림
```

- 보유가 0이면 아무 일도 없다 (`pnl` 0). 장부에 남기지 않는다.
- `lossSoftened`는 손실이고 `lossFactorPercent`가 100 미만일 때만 true다.
- 보유 평가액은 0 아래로 내려가지 않는다. 손실이 보유보다 크면 보유는 0이 된다.
- 변동은 해당 섹터에만 적용한다. 다른 섹터에는 영향을 주지 않는다 (제안).
- 장부에 `PRICE_CHANGE`(평가액 변화)를 한 행 남긴다.

**한 번의 선택에서의 순서** (진행이 지킨다): 실제 행동을 반영한 **뒤에** 주가 변동을 반영한다. 방금 산 보유도 이번 변동을 받고, 방금 판 보유는 변동을 받지 않는다 (poc.md와 같다).

### 4.6 월급과 지출

- 월급은 진행이 연차와 콘텐츠로 계산한 금액을 넘긴다. 이 도메인은 입금만 한다.
- 월급 입금은 `(gameId, gameDay)`당 한 번만 일어난다. 같은 날에 다시 부르면 `credited=false`를 돌려준다 (재시도에 안전하다).
- 지출은 현금이 모자라면 아무것도 바꾸지 않고 `spent=false`를 돌려준다. 현금은 음수가 되지 않는다.

### 4.7 총자산

- 총자산 = 현금 + 모든 섹터의 보유 평가액의 합.

### 4.8 장부 (`asset_ledger`)

모든 변화를 한 행씩 남긴다. `amount`는 해당 `kind`가 바꾼 금액이다.

| kind | amount | 현금 변화 | 평가액 변화 |
|---|---|---|---|
| `BUY` | 매수 금액(음수로 기록) | 감소 | 증가 |
| `SELL` | 매도 금액(양수) | 증가 | 감소 |
| `SALARY` | 월급(양수) | 증가 | 없음 |
| `SPEND` | 지출(음수) | 감소 | 없음 |
| `PRICE_CHANGE` | 손익(부호 있음) | 없음 | 증감 |

`cash_after`는 각 행 직후의 현금이다. 장부의 `cash_after` 마지막 행은 계정의 현금과 같아야 한다.

## 5. 설정값 (초기값)

| 이름 | 초기값 | 의미 |
|---|---|---|
| `asset.initial-cash.min-unit` | 1 | 초기 현금 최소 단위 수 |
| `asset.initial-cash.max-unit` | 50 | 초기 현금 최대 단위 수 |
| `asset.initial-cash.unit` | 1,000,000 | 초기 현금 단위(원) |
| `asset.buy-ratio-bp` | 3000 | 매수 시 현금 사용 비율 |
| `asset.min-trade` | 1,000 | 최소 거래 금액(원) |

## 6. DB

소유 테이블: `asset_account`, `asset_holding`, `asset_ledger` (db.md 3.6~3.8절).

변경 사항:

- 월급 중복 입금을 막기 위해 `asset_ledger`에 **부분 유니크 인덱스** `(game_id, game_day) where kind = 'SALARY'`를 둔다 (제안). db.md 3.8절에 반영한다.
- 세션 만료 시 `deleteByGame`으로 세 테이블에서 `game_id` 기준으로 지운다.
- 마이그레이션 `V<번호>__asset_init.sql`이 세 테이블과 인덱스를 만든다. FK가 없다.

## 7. 테스트 시나리오

| # | 입력 | 기대 결과 |
|---|---|---|
| 1 | `create`를 같은 시드로 두 번 | 초기 현금이 같다. 100만~5,000만 범위의 100만 배수 |
| 2 | `create`를 같은 `gameId`로 두 번 | 기존 계정을 돌려준다(멱등) |
| 3 | 현금 10,000,000에서 `BUY` | 3,000,000을 거래. 현금 7,000,000, 보유 3,000,000 |
| 4 | 현금 2,000에서 `BUY` | 매수 금액 600 < 1,000 → `INSUFFICIENT_CASH`, 변화 없음 |
| 5 | 보유 3,000,000에서 `SELL` | 현금에 3,000,000 합산, 보유 0, `EXECUTED` |
| 6 | 보유가 없는데 `SELL` | `NOTHING_TO_SELL`, 장부 변화 없음 |
| 7 | `HOLD` | `HELD`, 장부 변화 없음 |
| 8 | 보유 3,000,000, `UP` 1000bp(10%) | 손익 +300,000, 보유 3,300,000 |
| 9 | 보유 3,000,000, `DOWN` 1000bp, 완화 비율 100 | 손익 −300,000, 보유 2,700,000, `lossSoftened=false` |
| 10 | 같은 상황, 완화 비율 30 | 손익 −90,000, 보유 2,910,000, `lossSoftened=true` |
| 11 | 보유 3,000,000, `UP`, 완화 비율 30 | 이득이므로 비율을 무시. 손익 +300,000, `lossSoftened=false` |
| 12 | 보유 없음에 주가 변동 | 손익 0, 장부 변화 없음 |
| 13 | 보유 1,001원, `DOWN` 3333bp | 손익이 0 방향으로 버림되어 −333, 보유 668 |
| 14 | 다른 섹터의 보유 | 변동이 영향을 주지 않는다 |
| 15 | 같은 (gameId, gameDay)로 `creditSalary` 두 번 | 한 번만 입금. 두 번째는 `credited=false` |
| 16 | `spend` 금액이 현금보다 큼 | `spent=false`, 현금 변화 없음 |
| 17 | `spend` 금액이 현금 이하 | 현금이 줄고 장부에 `SPEND`가 남는다 |
| 18 | 거래 여러 번 뒤 | 장부 마지막 `cash_after`가 계정 현금과 같고, 총자산 = 현금 + 보유의 합 |
| 19 | 거래 순서: `BUY` 후 주가 변동 | 방금 산 보유가 변동을 받는다 |
| 20 | `deleteByGame` 후 `get` | 오류(없음) |

## 8. 완료 조건

1. 공개 인터페이스 9개가 위 시나리오를 통과한다.
2. 다른 도메인을 호출하지 않고, 자기 접두사(`asset_`) 테이블만 읽고 쓴다 (ArchUnit).
3. 금액 계산은 모두 정수(`long`)이며 부동소수점을 쓰지 않는다. 반올림이 아니라 0 방향으로 버린다.
4. 현금과 보유는 음수가 되지 않는다.
5. 수치는 모두 설정에서 읽는다.
6. 마이그레이션이 테이블 3개와 월급 중복 방지 인덱스를 만든다. FK가 없다.

## 9. 미결정

| # | 질문 |
|---|---|
| 1 | 매수 비율(30%)이 적절한지. 투자 스타일에 따라 달라지는지 (현재는 같음) |
| 2 | 주가 변동이 뉴스 해결 때만 일어나는지, 시간에 따른 자연 변동도 둘지 (현재는 뉴스 때만, 제안) |
| 3 | 섹터마다 주가를 따로 두는지, 지금처럼 보유 평가액만 다루는지 (현재는 평가액만) |
| 4 | 이자나 수수료 같은 비용 요소 (현재 없음) |
| 5 | 초기 현금 범위. 월급 구조가 확정되면 다시 본다 |
