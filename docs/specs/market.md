# 스펙: 시장 (market)

> 상태: 구현됨 (2026-10-18) · 근거: [경제 개편 설계](../superpowers/specs/2026-10-18-economy-redesign-design.md) 5절, [domains.md](../domains.md)
> 표기: **(확정)**, **(제안)**, **(초기값)** 은 [README.md](./README.md) 참고.

## 1. 목적과 범위

종목 가격과 월별 이력을 소유한다. 가격은 **매월 1일** 추세+잡음으로 움직이고, 뉴스는 그 위에 충격을 더한다 (확정: "보유 자산은 달마다 갱신").

| 맡는 것 | 맡지 않는 것 |
|---|---|
| 판 시작 시 기준가, 월별 가격 변동 | 보유 수량·현금·손익 (자산) |
| 뉴스 충격을 종목/섹터에 반영 | 충격의 방향·폭 결정 (이벤트 운영) |
| 현재가·시세(1·12개월 전, 최근 12달)·전체 이력 조회 | 운에 의한 폭 완화 (행동이 비율을 정하고 진행이 곱한다) |

- **콘텐츠(`stocks.json`)를 직접 읽는다.** 이벤트→콘텐츠와 함께 허용된 두 개의 도메인 간 직접 호출이다 (domains.md 3절).
- 자산은 가격을 모른다. 진행이 `prices()`를 읽어 자산에 넘긴다.

## 2. 공개 인터페이스

```java
package investorgame.market;

public interface MarketService {
    void create(UUID gameId);                                           // 기준가, 0번째 달. 멱등
    List<Quote> advanceTo(UUID gameId, int toDay, SeededRandom random); // (현재 달, toDay/30] 처리
    ShockResult applyShock(UUID gameId, String sectorCode, String stockCode, boolean sectorWide,
                           Direction direction, int magnitudeBp, int gameDay, UUID eventId);
    Map<String, Long> prices(UUID gameId);
    List<Quote> quotes(UUID gameId);
    List<PricePoint> history(UUID gameId, String stockCode);
    int currentMonth(UUID gameId);
}
public record Quote(String stockCode, long price, long priceMonthAgo, long priceYearAgo, List<Long> last12) {}
public record PricePoint(int month, long price) {}
public record ShockResult(Map<String, Long> before, Map<String, Long> after) {}   // 영향받은 종목만
```

## 3. 규칙

### 3.1 월별 변동

달 `m`(= `day / 30`)마다, 키 `("market","month",m)`의 생성기에서 **섹터를 코드순으로** `U(−sectorVol, +sectorVol)`를 하나씩, 그다음 **종목을 코드순으로** `U(−vol, +vol)`를 하나씩 뽑는다 (순서 고정, 항상 전부 뽑는다).

```
변동(bp)  = driftBpPerYear / 12 + 섹터 움직임 + 종목 움직임
새 가격   = max(min-price, 가격 × (10000 + 변동) / 10000)      # 정수, 0 방향 버림
```

- `market_price_history (game_id, stock_code, month)` PK로 같은 달을 두 번 처리하지 않는다 (멱등).
- 1세부터 움직인다. 24세에 보면 20년치 차트가 있다.

### 3.2 뉴스 충격

- `sectorWide=false`: 대상 종목에 `magnitudeBp`, 같은 섹터의 다른 종목에 `magnitudeBp × spillover-percent / 100`.
- `sectorWide=true`: 섹터 모든 종목에 `magnitudeBp`.
- 그 달의 이력을 **덮어쓴다** (월 1점 유지). 바닥은 `min-price`.
- 운 완화: 진행이 `DOWN`이고 영향받는 종목을 보유했을 때만 `magnitudeBp × lossFactor / 100`으로 줄여서 넘긴다 (설계 5.4절).

### 3.3 시세

`priceMonthAgo`·`priceYearAgo`는 이력이 짧으면 있는 가장 오래된 값. `last12`는 이번 달 포함 최근 12달(있는 만큼).

## 4. 설정값 (초기값)

| 이름 | 초기값 | 의미 |
|---|---|---|
| `market.sector-volatility-bp` | 400 | 섹터 공통 월간 잡음 폭 |
| `market.volatility-bp.low/mid/high` | 400 / 800 / 1200 | 종목 등급별 월간 잡음 폭 |
| `market.spillover-percent` | 30 | 종목 뉴스의 같은 섹터 파급 |
| `market.min-price` | 100 | 가격 바닥(원) |

## 5. DB

`market_price (game_id, stock_code, price, month, updated_at, PK(game_id, stock_code))`, `market_price_history (game_id, stock_code, month, price, PK(game_id, stock_code, month))`. FK 없음.

## 6. 테스트

`MarketServiceTest`: 기준가·멱등, 12달 → 13점·같은 시드 재현, 바닥, 파급 30%, 섹터 전체, 충격이 그 달을 덮어씀, 시세의 전 달·전 해·최근 12달.

## 7. 미결정

| # | 질문 |
|---|---|
| 1 | 변동 폭·추세 수치는 체감 후 조정 |
| 2 | 균등 잡음 대신 추세 지속(모멘텀)을 둘지 |
