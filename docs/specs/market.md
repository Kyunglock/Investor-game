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
    List<PricePoint> indexHistory(UUID gameId);                        // 종합주가지수(판 시작 = 1000)
    List<PricePoint> rateHistory(UUID gameId);                         // 주담대 금리(연 만분율)
    List<PricePoint> homeHistory(UUID gameId, String region);
    List<IndicatorSeries> indicators(UUID gameId);                     // fx, debt, sentiment, turnover (매매창 설계 3.1절)
    MarketCycle cycle(SeededRandom random);                            // 전조(헛소문 포함)·경보 구간·위기. 화면에 내보내지 않는다
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

### 3.2.1 경기 흐름 (decisions.md 38번)

- `cycle(random)`: 키 `("market","cycle")` 하나에서 순서대로 뽑는다. 같은 판은 언제나 같다. **화면에 내보내지 않는다.**
- 불안한 시기 `windows`(1~3)를 `[first-month, last-month]` 구간에 나눠 하나씩 둔다. 시기마다 `silent-percent`로 전조 없는 위기인지 굴리고, 아니면 전조를 흘린 뒤 `outcome-percent`(대공황·불황·조정, 나머지는 아무 일 없음)로 결과를 굴린다.
- 위기 달의 변동: 빠지는 동안 `−fallBp × 갈래의 섹터 비율 / 100`, 회복하는 동안 `+recoveryBp`. 겹치면 더한다.
- `averageDropBp(from, to)`: from 달 가격 대비 (from, to] 최저가 낙폭의 종목 평균. 회고 기록에 쓴다.

### 3.3 시세

`priceMonthAgo`·`priceYearAgo`는 이력이 짧으면 있는 가장 오래된 값. `last12`는 이번 달 포함 최근 12달(있는 만큼).

## 4. 설정값 (초기값)

| 이름 | 초기값 | 의미 |
|---|---|---|
| `market.sector-volatility-bp` | 150 | 섹터 공통 월간 잡음 폭 (2026-10-24 400에서 줄임, decisions.md 65번) |
| `market.volatility-bp.low/mid/high` | 150 / 300 / 450 | 종목 등급별 월간 잡음 폭 (400/800/1200에서 줄임) |
| `market.spillover-percent` | 30 | 종목 뉴스의 같은 섹터 파급 |
| `market.min-price` | 100 | 가격 바닥(원) |

### 3.4 거시 지표와 헛소문 (매매창 설계 3절)

- 지표 4종(환율 `fx`, 가계부채 증가율 `debt`, 투자 심리 `sentiment`, 거래대금 `turnover`)을 달마다 만든다. **표시만 하고 가격에는 영향이 없다.** 값 = 지난달 + (목표 − 지난달) × `revert-percent` + 잡음. 목표는 경기 흐름의 구간이 정한다: 평소 `base`, 전조 구간(`MarketCycle.alarms`, 결과와 상관없이) `alarm`(갈래가 `strong-scenarios`면 `alarm-strong`), 빠지는 동안 `fall`(첫 `panic-months`는 `panic`), 회복 `recovery`. 전조 없는 위기는 빠지기 전까지 평소다. 평온한 달에도 `fake-start-percent`로 가짜 신호가 시작돼 `fake-months` 동안 `alarm` 쪽으로 기운다. 난수 키 `("market","indicator",m)`, 가짜 신호는 `("market","fake",m)`.
- 헛소문: `cycle()`이 불안한 시기를 모두 정한 뒤 `rumor-first-month`부터 `rumor-gap-months` 간격으로 같은 전조 풀에서 뽑아 `omens`에 섞는다. 전조 구간·위기와 겹치는 달은 건너뛴다. 어느 위기에도 묶이지 않아 회고에 나오지 않는다.

## 5. DB

`market_price (game_id, stock_code, price, month, updated_at, PK(game_id, stock_code))`, `market_price_history (game_id, stock_code, month, price, PK(game_id, stock_code, month))`, `market_home_history`, `market_rate_history`, `market_indicator_history (game_id, month, code, value, PK(game_id, month, code))`. FK 없음.

## 6. 테스트

`MarketServiceTest`: 기준가·멱등, 12달 → 13점·같은 시드 재현, 바닥, 파급 30%, 섹터 전체, 충격이 그 달을 덮어씀, 시세의 전 달·전 해·최근 12달, 헛소문이 위기와 겹치지 않음, 지표가 달마다 쌓이고 같은 시드면 같으며 대공황 바닥에서 심리가 식음.

## 7. 미결정

| # | 질문 |
|---|---|
| 1 | 변동 폭·추세 수치는 체감 후 조정 |
| 2 | 균등 잡음 대신 추세 지속(모멘텀)을 둘지 |
