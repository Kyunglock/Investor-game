# 스펙: 자산 (asset)

> 담당: agent2 · 상태: 2026-10-18 경제 개편 반영 (종목 수량 보유, 빚) · 근거: [poc.md](../poc.md) 5절, [decisions.md](../decisions.md), [db.md](../db.md) 3.6~3.8절, [경제 개편 설계](../superpowers/specs/2026-10-18-economy-redesign-design.md) 6절
> 표기: **(확정)**, **(제안)**, **(초기값)** 은 [README.md](./README.md) 참고.

## 1. 목적과 범위

한 판의 현금·종목 보유(수량과 원가)·빚을 소유하고 거래와 수입·지출을 반영한다. **가격은 모른다.** 가격은 시장 도메인이 소유하고 진행이 인자로 넘긴다.

| 맡는 것 | 맡지 않는 것 |
|---|---|
| 초기 자산 랜덤 생성 | 직업별 월급 액수 계산 (진행이 콘텐츠와 연차로 계산해 넘김) |
| 수량·가격으로 매수·매도, 원가 비례 차감, 실현 손익 | 매수·매도 판정과 이탈 (행동) |
| 수입(월급·배우자·퇴직금·경품) 입금, 빚 상환 | 가격의 변동 (시장) |
| 지출(생활비·일회성)과 빚, 월 이자 | 수량 계산 (뉴스 매수 비율은 진행이 현재가로 계산) |
| 평가액·총자산(현금 + 평가 − 빚), 거래 장부 | 능력치·직업 읽기 |

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

    /** 수량 × 가격을 현금에서 빼고 보유를 늘린다. 현금이 모자라면 부분 체결 없이 INSUFFICIENT_CASH. 수량 1 미만은 오류. */
    TradeResult buy(UUID gameId, String stockCode, long quantity, long price, int gameDay, UUID eventId);

    /** 수량만큼 팔아 현금에 더하고 원가를 비례 차감한다. 보유보다 많으면 전량, 보유가 없으면 NOTHING_TO_SELL. */
    TradeResult sell(UUID gameId, String stockCode, long quantity, long price, int gameDay, UUID eventId);

    /** 수입. 빚이 있으면 먼저 갚는다. SALARY·SPOUSE_INCOME·SEVERANCE는 같은 날 한 번만. */
    IncomeResult credit(UUID gameId, String kind, long amount, int gameDay);

    /** 지출. 현금이 모자라면 모자란 만큼 빚. EXPENSE는 같은 날 한 번만, LIFE_COST는 여러 번. */
    SpendResult spend(UUID gameId, String kind, long amount, int gameDay, UUID eventId);

    /** 빚에 월 이자(asset.debt-interest-bp). 빚이 없거나 같은 날 이미 붙였으면 accrued=false. */
    InterestResult accrueInterest(UUID gameId, int gameDay);

    /** Σ 수량 × 가격. */
    long holdingsValue(UUID gameId, Map<String, Long> prices);

    /** 현금 + 평가액 − 빚. */
    long totalAsset(UUID gameId, Map<String, Long> prices);

    /** 세션 만료 시 해당 판의 자산 데이터를 지운다. */
    void deleteByGame(UUID gameId);
}
```

## 3. 입력·출력 타입

```java
public record AccountView(UUID gameId, long cash, long initialCash, long debt, Map<String, Holding> holdings) {
    public record Holding(long quantity, long costBasis) { long avgCost(); }   // 평단 = costBasis / quantity
}

public record TradeResult(Status status, long quantity, long price, long amount, long realizedPnl, long cashAfter) {
    public enum Status { EXECUTED, NOTHING_TO_SELL, INSUFFICIENT_CASH }
}
public record IncomeResult(boolean credited, long amount, long debtRepaid, long cashAfter) {}
public record SpendResult(boolean spent, long fromCash, long toDebt, long cashAfter, long debtAfter) {}
public record InterestResult(boolean accrued, long interest, long debtAfter) {}
```

## 4. 규칙

### 4.1 초기 자산 (확정: 랜덤)

- 초기 현금 = `randomInt(1, 50) × 1,000,000`원 (초기값, poc.md). 난수는 한 번만 뽑는다.
- 보유는 비어 있다.
- `initialCash`를 계정에 함께 저장한다 (결과의 수익률 계산에 쓴다).

### 4.2 매수

- 금액 = 수량 × 가격. 현금보다 크면 부분 체결 없이 `INSUFFICIENT_CASH`. 수량 1 미만은 검증 오류.
- 실행하면 현금이 줄고 종목 수량·원가(`cost_basis`)가 늘어난다. 장부에 `BUY`(현금 변화 음수, 수량·가격).
- **뉴스 선택의 매수 수량**은 진행이 `현금 × progress.news-buy-ratio-bp / 10,000 / 현재가`(버림)로 계산해 넘긴다. 0이면 진행이 `INSUFFICIENT_CASH`로 처리한다. **자유 매매**는 사용자가 수량을 정한다 (설계 8절).

### 4.3 매도

- `sold = min(수량, 보유)`. 보유가 0이면 `NOTHING_TO_SELL`(장부 없음).
- 원가 차감 `costOut = cost_basis × sold / 보유`(전량이면 전부), `realizedPnl = sold × 가격 − costOut`.
- 뉴스 선택의 매도는 **전량**이다 (진행이 보유 수량을 넘긴다).

### 4.4 관망

- 자산을 부르지 않는다. 진행이 `HELD`를 결과에 적는다.

### 4.5 가격 변동 (시장 도메인으로 이동)

- 가격은 시장이 매달 움직이고 뉴스 충격도 시장이 반영한다 ([market.md](./market.md)). 자산은 **평가만** 한다: `holdingsValue(prices)`.
- 뉴스 선택의 손익 = 충격 전후 `holdingsValue` 차이 (진행이 계산). 운 완화는 진행이 충격 폭에 곱한다.
- 2026-10-18 결정: "주가 변동은 뉴스 때만"을 뒤집어 **매달 움직인다** (경제 개편 설계 1절).

### 4.6 수입·지출·빚

- 수입(`credit`)은 빚이 있으면 먼저 갚고 남는 만큼 현금. `SALARY`, `SPOUSE_INCOME`, `SEVERANCE`는 `(gameId, gameDay, kind)`당 한 번 (재시도 안전). `WINDFALL`(경품 등)은 제한 없음.
- 지출(`spend`)은 현금이 모자라면 **모자란 만큼 빚**(마이너스 통장). 현금은 음수가 되지 않는다. `EXPENSE`(생활비)는 같은 날 한 번, `LIFE_COST`(결혼·출산·알림)는 여러 번 가능.
- 이자(`accrueInterest`)는 빚 × `asset.debt-interest-bp` / 10,000. 같은 날 한 번. 빚 0이면 `accrued=false`.

### 4.7 총자산

- 총자산 = 현금 + Σ(수량 × 가격) − 빚.

### 4.8 장부 (`asset_ledger`)

모든 변화를 한 행씩 남긴다. `amount`는 해당 `kind`가 바꾼 금액이다.

| kind | amount | 비고 |
|---|---|---|
| `BUY` / `SELL` | 매수 금액(음수) / 매도 금액(양수) | `stock_code`, `quantity`, `price` |
| `SALARY` / `SPOUSE_INCOME` / `SEVERANCE` / `WINDFALL` | 수입(양수) | 앞의 셋은 같은 날 한 번 |
| `DEBT_REPAY` | 수입 중 빚 상환(음수) | 수입 행 바로 뒤 |
| `EXPENSE` / `LIFE_COST` | 지출(음수) | `EXPENSE`는 같은 날 한 번 |
| `INTEREST` | 이자(음수) | 같은 날 한 번. 빚만 늘어난다 |

`cash_after`·`debt_after`는 각 행 직후의 값이다. `PRICE_CHANGE`는 더 쓰지 않는다 (가격은 시장 이력에).

## 5. 설정값 (초기값)

| 이름 | 초기값 | 의미 |
|---|---|---|
| `asset.initial-cash.min-unit` | 1 | 초기 현금 최소 단위 수 |
| `asset.initial-cash.max-unit` | 50 | 초기 현금 최대 단위 수 |
| `asset.initial-cash.unit` | 1,000,000 | 초기 현금 단위(원) |
| `asset.debt-interest-bp` | 100 | 빚의 월 이자 (1%) |
| `progress.news-buy-ratio-bp` | 3000 | 뉴스 매수의 기본 수량이 쓰는 현금 비율 (진행 설정). 사용자가 선택에 수량을 같이 보내면 그 수량을 쓴다 |

## 6. DB

소유 테이블: `asset_account`, `asset_holding`, `asset_ledger` (db.md 3.6~3.8절).

변경 사항:

- `asset_holding`은 `(game_id, stock_code, quantity, cost_basis)`. `asset_account.debt`. `asset_ledger`에 `stock_code`, `quantity`, `price`, `debt_after`.
- 같은 날 한 번만 처리하는 종류를 위해 **부분 유니크 인덱스** `(game_id, game_day, kind) WHERE kind IN ('SALARY','SPOUSE_INCOME','SEVERANCE','EXPENSE','INTEREST')`.
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
| 2 | ~~주가 변동 시점~~ → **확정: 뉴스를 해결할 때만 일으킨다.** 시간에 따른 자연 변동은 두지 않는다 |
| 3 | 섹터마다 주가를 따로 두는지, 지금처럼 보유 평가액만 다루는지 (현재는 평가액만) |
| 4 | 이자나 수수료 같은 비용 요소 (현재 없음) |
| 5 | 초기 현금 범위. 월급 구조가 확정되면 다시 본다 |
