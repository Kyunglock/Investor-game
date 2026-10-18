# 설계: 상황극 성향 질문, 월 단위 시장과 종목, 가계부, 자유 매매 화면

> 작성: 2026-10-18 · 상태: 빌더 검토 반영, 사용자 승인 대기 (구현 전) · 근거: [prd.md](../../prd.md), [decisions.md](../../decisions.md), [specs/](../../specs/), [2026-10-18-ui-redesign-design.md](./2026-10-18-ui-redesign-design.md)
> 목업: [mockup-invest-screen.html](./2026-10-18-economy-redesign/mockup-invest-screen.html) (브라우저로 열면 보인다)
> 표기: **(확정)** 사용자가 정함 · **(내 결정)** 작성자가 정했고 사용자가 뒤집을 수 있음 · **(빌더)** 구현하는 쪽이 정함 · **(초기값)** 체감 후 조정할 수치

## 1. 의도

사용자가 한 판을 돌려 보고 네 가지를 지적했다.

1. **성향 질문이 재미없다.** 2지선다 밸런스 게임이라 재미도 없고, 재는 것도 단기/장기와 관심 섹터 두 가지뿐이다. "재밌는 상황을 주고 다양한 선택지로 투자자 성향을 파악"하고 싶다 **(확정)**.
2. **주가가 뉴스 때만 움직인다.** 보유 자산은 "달마다 갱신"되어야 하고, 뉴스는 그 위에 얹히는 충격이어야 한다 **(확정)**.
3. **번 돈이 전부 자산이 된다.** 생활비, 결혼, 자녀가 없다. 돈이 나가는 삶이 있어야 한다 **(확정)**.
4. **투자 화면이 빈약하다.** 뉴스 카드 3버튼과 보유 표 하나뿐이다. 개선한다 **(확정)**.

그리고 두 가지를 덧붙였다.

- **뉴스 사이에도 아무 때나 멈추고 사고팔 수 있어야 한다** **(확정)**. 적립식 자동 투자가 아니다.
- **섹터만이 아니라 종목이 있어야 한다. 종목명은 실제 회사명이 아니라 비슷한 가짜 이름**으로 **(확정)**.

바꾸지 않는 것: 핵심 기제인 **"선택은 내가 하지만 실행은 성격이 한다"**(능력치 판정과 이탈), 1세→65세 실시간 진행, 성장기→직업→저축→투자 흐름, '80억 분의 1' 톤의 화면 체계.

## 2. 목표 · 비목표 · 하면 안 되는 것

**목표**

- 성장기 6단계마다 **상황극 장면**(3~4 선택지)이 나오고, 선택이 **네 축**(단기/장기, 공격/안정, 소신/추종, 관심 섹터)에 점수를 쌓아 21세에 **투자자 유형**(8종, 이름 있음)이 정해진다. 선택이 능력치도 조금 움직인다.
- 섹터 6개 아래 **종목 18개**(가짜 이름)가 있고, 종목마다 **가격이 매달** 움직인다. 보유는 **수량 × 현재가**로 평가된다. 뉴스는 특정 종목(또는 섹터 전체)에 **충격**을 더한다.
- **가계부**: 매달 월급(+배우자 소득) − 생활비 = 저축. 결혼·자녀는 선택형 이벤트로 오고 지출 구조를 바꾼다. 60세 은퇴 뒤에는 월급이 끊긴다. 돈이 모자라면 빚(마이너스 통장)이 생기고 이자가 붙는다.
- **자유 매매**: 아무 때나 시계를 멈추고 종목을 골라 수량을 정해 사고판다. 자유 매매도 **용기 판정**을 거친다(겁나서 주문을 못 낼 수 있다). 뉴스 선택은 지금처럼 전체 판정을 거친다.
- 투자 화면: **포트폴리오 카드**(총자산·현금·투자·빚·이번 달 손익, 종목별 수량·평단·현재가·수익률), **시장 패널**(섹터 탭, 종목 목록과 월간 차트, 매매 폼), **가계부 카드**(수입·지출·가족), 뉴스 카드에 종목명과 최근 차트.

**비목표**

- 실제 시세·실제 뉴스. 종목은 전부 가상이다.
- 환율, 채권, 부동산, 예금 이자, 세금, 거래 수수료 (지금은 없음. 자산 스펙 미결정 4번은 그대로 남긴다).
- 배우자·자녀의 개별 이벤트(교육, 결혼 자금 등). 가족은 **지출 구조**로만 존재한다.
- 뉴스 연결(갈래), 자기계발(`TRAINING`), 경제 유튜버. 이전과 같이 미룬다.
- 실패 상태(파산으로 게임 종료). 빚이 늘어도 65세까지 간다.

**하면 안 되는 것**

- 클라이언트가 가격을 계산하거나 판정하는 것. 가격·판정·지출은 모두 서버 (architecture.md 1절).
- 숨은 값(뉴스 방향·폭, 다음 달 변동)을 응답에 넣는 것. 응답은 **이미 일어난** 가격만 담는다.
- 다른 도메인 테이블 조회·조인 (decisions.md 16번).
- 레트로 UI(픽셀 폰트 등) **(확정, 이전 설계)**. 숫자가 많아지는 화면이지만 "증권사 앱" 모양이 아니라 **기록부** 모양을 유지한다.
- 실제 회사명 그대로 쓰기. 상표·로고도 쓰지 않는다.
- 뉴스 선택을 건너뛸 수 있게 하는 것. 뉴스는 여전히 스킵 불가 **(확정, PRD)**.

## 3. 제약

- 스택 그대로. 계약(`contracts/openapi/game.yaml`)이 먼저다. 수치는 모두 설정·콘텐츠에서 읽는다 (code-style.md 3.3절).
- 금액은 `long`(원), 비율은 만분율 `int`, 난수는 판 시드에서 키별로 유도하고 뽑는 순서를 스펙에 적는다 (specs/README.md 4절).
- 운영 데이터가 없으므로 `asset_holding`은 **새 구조로 재생성**해도 된다 (마이그레이션 한 개로 drop·create) **(내 결정)**.
- 기존 E2E의 `data-testid`는 유지하고 새 요소에 새 id를 붙인다. `age`는 `{n}세 {m}개월` 형식 유지.
- 한 판 10분. 성인기 1년 12초 → **1개월 = 1초**. 시계 보고 주기를 **30일**로 줄여 매달 가격이 화면에 반영된다 (초당 1회 요청, 2×면 2회. 소규모 서비스 가정에 맞다) **(내 결정)**.

## 4. 성향 질문: 상황극 (콘텐츠 + 캐릭터)

### 4.1 형식 (확정: 상황 + 다양한 선택지)

- 성장 단계는 지금과 같이 6개(6·9·12·15·18·21세). 단계마다 장면 **4개**, 판마다 하나를 판 시드로 뽑는다 (지금 규칙 유지). 총 24장면 **(내 결정: 분량)**.
- 장면은 **구체적인 상황**이다. 제목은 상황을 한 줄로, 본문은 2~3문장으로 장면을 그린다. 선택지는 **3~4개**이며 "무엇을 하는가"로 쓴다. 라벨은 18자 안쪽.
- 선택마다 `note`(무엇이 드러났는지 한 줄)를 보여 준다 (지금 규칙 유지). 유머가 있어도 되지만 선택을 비웃지 않는다.
- 판정으로 뒤집지 않는다 **(확정, 이전)**.

예시 (톤 기준, 실제 문구는 콘텐츠에서 다듬는다):

> **12세 · 반 친구가 "엄마 몰래 코인 샀는데 3배 됐다"고 자랑한다**
> 점심시간 내내 그 얘기다. 너도 명절 용돈 15만 원이 있다.
> ① 나도 당장 따라 산다 — 단기 +2, 공격 +2, 추종 +2, 금융 +1 · 용기 +1 인내심 −1 · "남이 벌었다는 말에 심장이 먼저 뛰었다"
> ② 어떤 코인인지 일주일 찾아보고 결정한다 — 장기 +1, 공격 +1, 소신 +2, 금융 +1 · 안목 +1 · "뛰어들기 전에 알아봐야 마음이 놓인다"
> ③ 그 돈으로 갖고 싶던 게임기를 산다 — 단기 +1, 안정 +1, 소신 +1, 게임 +2 · "확실한 즐거움이 불확실한 돈보다 좋았다"
> ④ 저금통에 넣고 못 들은 척한다 — 장기 +2, 안정 +2, 소신 +1, 식품 +1 · 인내심 +1 · "흔들리지 않았다. 재미도 없었다"

### 4.2 네 축과 투자자 유형

| 축 | 점수 키 | 값 | 게임에 미치는 영향 |
|---|---|---|---|
| 기간 | `style.short` / `style.long` | 단기 / 장기 | 뉴스 빈도·폭 (기존 규칙 그대로) |
| 위험 | `risk.bold` / `risk.safe` | 공격 / 안정 | **유형 이름에만** (내 결정: 규칙 영향 없음. 나중에 뉴스 가중치 등으로 쓸 수 있다) |
| 소신 | `mind.own` / `mind.crowd` | 소신 / 추종 | **유형 이름에만** (같음) |
| 관심 | `sector.<코드>` | 섹터 6종 | 관심 섹터 뉴스 가중치 3배 (기존) |

- **투자자 유형** = 기간 × 위험 × 소신 = 8종. 이름과 한 줄 설명은 콘텐츠(`meta.json`의 `investorTypes`)가 정한다 **(빌더: 문구)**. 예: 단기·공격·소신 "불꽃 승부사", 장기·안정·소신 "느긋한 농부", 단기·공격·추종 "소문 따라 단타족", 장기·안정·추종 "안전 제일 적립왕".
- 확정 시점은 지금과 같이 마지막(21세) 장면 뒤. 결과 카드에 `당신은 '{유형}'형 투자자다. {설명} 관심이 가는 분야는 {섹터}.`를 보여 주고, 신원 카드의 `스타일` 줄이 `유형` 줄로 바뀐다(`{유형} · {단기|장기}`).
- 동점은 지금처럼 코드 이름순 정렬 뒤 난수. 위험·소신 점수가 하나도 없으면(콘텐츠가 그 축을 안 건드린 경우) 난수로 정한다 **(내 결정)**. 기간·섹터는 모든 선택지가 반드시 건드린다 (기존 검증 유지).

### 4.3 능력치 흔들기 (확정 방향: "초기치도 살짝 흔들린다")

- 선택지에 `statDeltas`(선택)를 둘 수 있다. 키는 `insight`, `patience`, `courage`, `conviction`. **운은 금지** (운은 타고난 값, 확정). 값은 −3~+3. 콘텐츠 검증.
- 선택 즉시 현재 능력치에 더한다. 범위는 `character.trait-stat.min`(초기값 5) ~ `character.growth.max-stat`(95). `character_stat_log`에 `reason = 'TRAIT'`로 남긴다.
- **`initialStats`(태어날 때 값)는 바꾸지 않는다.** 별명은 그대로다. 약점 표시는 현재 값이라 바뀔 수 있다 (이전 설계 7.1절과 일관).
- 결과 카드와 인생 기록에 `GROWTH`로 보인다 (`경험으로` 대신 `그 선택으로 용기 41 → 42 ↑`). payload에 `reason: "TRAIT"`를 더해 문구를 가른다.

### 4.4 콘텐츠 형식 (`content/traits.json` v2)

```json
{ "code": "k12-friend-coin", "age": 12,
  "title": "반 친구가 \"엄마 몰래 코인 샀는데 3배 됐다\"고 자랑한다",
  "body": "점심시간 내내 그 얘기다. 너도 명절 용돈 15만 원이 있다.",
  "options": [
    { "code": "follow", "label": "나도 당장 따라 산다",
      "traitDeltas": { "style.short": 2, "risk.bold": 2, "mind.crowd": 2, "sector.finance": 1 },
      "statDeltas": { "courage": 1, "patience": -1 },
      "note": "남이 벌었다는 말에 심장이 먼저 뛰었다" } ] }
```

검증(콘텐츠 로드 시): 단계마다 장면 ≥ 1, 선택지 3~4개, 모든 선택지에 `style.*`와 `sector.*` 각 1개 이상, `risk.*`/`mind.*`는 선택, `statDeltas`는 허용 키와 범위, `luck` 금지. 24장면은 **(빌더: 문구 작성)** 이며 4.1절의 톤과 4.2절의 축 분포(각 축이 단계마다 최소 한 장면에서 양쪽 다 나오게)를 지킨다.

### 4.5 캐릭터 도메인 변경

- `recordTraitChoice(gameId, traitDeltas, statDeltas, gameDay)` → 점수 누적 + 능력치 즉시 변경 + 로그. 변경된 능력치를 `List<StatChange>`로 돌려준다.
- `finalizeTraits` → `TraitResult(style, risk, mind, sector, investorType)`. `character_profile`에 `risk_profile`, `mind_profile`, `investor_type` 컬럼 추가. 유형 코드는 `{style}-{risk}-{mind}`로 캐릭터가 만들고, 이름은 진행이 콘텐츠에서 찾는다.

## 5. 시장: 종목과 월 단위 가격 (새 도메인 `market`)

### 5.1 왜 새 도메인인가 (내 결정)

가격의 움직임(추세·잡음·뉴스 충격)은 "시장" 규칙이고, 현금·보유·장부는 "내 계좌" 규칙이다. 같이 바뀌지 않는다. 자산은 **가격을 모르고 수량만 다루며**, 평가가 필요하면 진행이 시장에서 가격을 읽어 인자로 넘긴다 (domains.md 3절 규칙 그대로). 테이블 접두사 `market_`.

**시장은 콘텐츠(`stocks.json`)를 직접 읽는다** **(내 결정, 검토 반영)**. 기준가·추세·변동성·섹터 소속이 매 호출 필요한데 인자로 넘기면 진행이 종목 정의를 들고 다녀야 한다. 이벤트→콘텐츠와 같은 성격의 읽기이므로 **도메인 간 직접 호출 허용 목록을 "이벤트→콘텐츠, 시장→콘텐츠" 둘로** 늘린다. domains.md 3절과 `DomainBoundaryTest`를 함께 고친다 (통합 담당 소유 파일이지만 한 브랜치에서 작업한다). `MigrationRulesTest`의 도메인 목록에 `market`, `household`를 더한다.

### 5.2 종목 (콘텐츠 `content/stocks.json`)

섹터 6개 × 3종목 = 18종목 **(내 결정: 분량)**. 이름은 실제 회사를 떠올리게 하되 한두 글자를 바꾼 **패러디** **(확정)**. 예시 (최종 이름은 **빌더**가 다듬되 실제 상호와 같아지면 안 된다):

| 섹터 | 종목 예시 | 기준가(원) | 변동성 |
|---|---|---|---|
| 반도체 | 삼송전자 · SQ하이닉스 · 한미반도채 | 72,000 · 130,000 · 80,000 | 중 |
| 바이오 | 셀트리언 · 삼송바이오 · 알테오잰 | 180,000 · 900,000 · 300,000 | 고 |
| 에너지 | 한국전륵 · 두샨에너빌리티 · 한화솔루숀 | 20,000 · 20,000 · 35,000 | 중 |
| 게임 | 크래프통 · 넥손게임즈 · 엔씽소프트 | 250,000 · 15,000 · 200,000 | 고 |
| 식품 | CJ제일제담 · 오리옹 · 농씸 | 300,000 · 100,000 · 400,000 | 저 |
| 금융 | KB금용 · 카카우뱅크 · 삼송화재 | 80,000 · 25,000 · 300,000 | 저 |

```json
{ "code": "ssj", "sector": "semiconductor", "name": "삼송전자", "basePrice": 72000,
  "driftBpPerYear": 800, "volatility": "mid" }
```

- `volatility` 등급별 월간 잡음 폭은 설정: `market.volatility.low|mid|high` (초기값 ±400 / ±800 / ±1200bp).
- `driftBpPerYear`: 기대 연간 상승률(명목). 초기값 500~1000bp. 종목마다 다르게 두어 "좋은 종목"이 있게 한다 **(빌더)**.

### 5.3 월 단위 가격 규칙

판 시작(1세) 시 모든 종목 가격 = 기준가. 게임 달력의 **매월 1일**(`day % 30 == 0`, 월 번호 `m = day / 30`)마다 한 번 움직인다. 성장기에도 움직여서 24세에 보면 20년치 차트가 있다 **(내 결정: 재미)**.

```
섹터 움직임(bp)  = U(−sectorVol, +sectorVol)                      # 섹터별로 한 번, 초기값 sectorVol = 400
종목 움직임(bp)  = drift/12 + 섹터 움직임 + U(−vol, +vol)           # vol은 등급별
새 가격          = max(100, 가격 × (10000 + 종목 움직임) / 10000)   # 정수, 0 방향 버림
```

- 난수 키 `("market", "month", m)`. 뽑는 순서: 섹터를 코드 이름순으로 하나씩 → 종목을 코드 이름순으로 하나씩. 항상 전부 뽑는다.
- 한 달이 두 번 처리되지 않도록 `market_price_history (game_id, stock_code, month)` PK로 멱등.
- `market.advanceTo(gameId, toDay, random)`: 아직 처리하지 않은 달을 순서대로 처리한다. 한 번의 보고는 최대 360일(12달).

### 5.4 뉴스 충격

- **모든 뉴스는 매매 대상 종목이 하나 있다** **(내 결정, 검토 반영)**. 뉴스를 만들 때 그 섹터의 종목 중 하나를 난수로 고른다 (키 `("event","news",seq)`의 뽑는 순서에 "종목"을 정의 다음에 넣는다). 제목·본문에 `{stock}` 자리표시를 허용한다 (`"{stock}, 신규 공장 증설 발표"`). 뉴스 정의의 `sectorWide: true`(선택, 기본 false)는 **충격 범위**만 정한다: 매수·매도는 여전히 뽑힌 종목 하나다. 그래서 자산·결과·화면은 항상 종목 하나를 다루고, "금리 인상"처럼 섹터 전체가 흔들리는 뉴스도 쓸 수 있다.
- 충격 적용 `market.applyShock(gameId, sectorCode, stockCode, boolean sectorWide, direction, magnitudeBp, day, eventId)`:
  - `sectorWide=false`: 대상 종목에 `magnitudeBp`, 같은 섹터의 다른 종목에 `magnitudeBp × market.spillover-percent / 100` (초기값 30).
  - `sectorWide=true`: 섹터 모든 종목에 `magnitudeBp`.
  - 가격 바닥 100원. `market_price_history`에는 **그 달의 가격을 덮어쓴다**(월 1점 유지, 뉴스 충격은 그 달 값에 반영).
- **운(손실 완화)**: 방향이 `DOWN`이고 사용자가 충격을 받는 종목 중 하나라도 보유했을 때만, 행동의 `lossFactorPercent`를 `magnitudeBp`에 곱한다. "운 좋게 덜 떨어졌다"는 문구 유지 **(내 결정: 가격은 하나이므로 세상이 덜 떨어지는 것으로 해석)**.
- 결과 카드의 손익 = 충격 전후 **내 보유 평가액 차이**(해당 섹터 종목 전부). 진행이 시장에서 전후 가격을 받아 자산에 평가를 두 번 요청해 계산한다.

### 5.5 공개 인터페이스

```java
public interface MarketService {
  void create(UUID gameId);                                    // 기준가로 시작. 멱등
  List<Quote> advanceTo(UUID gameId, int toDay, SeededRandom random);   // 처리한 달의 마지막 시세
  ShockResult applyShock(UUID gameId, String sectorCode, String stockCode, Direction direction,
                         int magnitudeBp, int gameDay, UUID eventId);
  Map<String, Long> prices(UUID gameId);                       // 종목 코드 → 현재가
  List<Quote> quotes(UUID gameId);                             // 현재가, 1·12개월 전 가격, 최근 12달
  List<PricePoint> history(UUID gameId, String stockCode);     // 월별 전체
}
public record Quote(String stockCode, long price, long priceMonthAgo, long priceYearAgo, List<Long> last12) {}
public record ShockResult(Map<String, Long> before, Map<String, Long> after) {}   // 영향받은 종목만
```

DB: `market_price (game_id, stock_code, price, month, PK(game_id, stock_code))`, `market_price_history (game_id, stock_code, month, price, PK(game_id, stock_code, month))`.

## 6. 자산: 수량 보유, 자유 매매, 빚

### 6.1 보유 구조

`asset_holding`을 **종목 단위, 수량**으로 바꾼다.

```sql
asset_holding (game_id, stock_code, quantity BIGINT, cost_basis BIGINT, updated_at, PK(game_id, stock_code))
-- cost_basis = 매수 총액 누계(매도 시 평단 기준으로 비례 차감). 평단 = cost_basis / quantity
```

`asset_account`에 `debt BIGINT NOT NULL DEFAULT 0` 추가.

### 6.2 매매

```java
TradeResult buy(UUID gameId, String stockCode, long quantity, long price, int gameDay, UUID eventId);
TradeResult sell(UUID gameId, String stockCode, long quantity, long price, int gameDay, UUID eventId);   // quantity가 보유보다 크면 전량
```

- 가격은 **진행이 시장에서 읽어 넘긴다.** 자산은 가격을 모른다.
- 매수 금액 = 수량 × 가격. 현금 부족이면 `INSUFFICIENT_CASH`(부분 체결 없음). 수량 0 또는 음수는 검증 오류.
- 매도: 수량 × 가격을 현금에 더하고 `cost_basis`를 비례 차감. 실현 손익 = 매도 금액 − 차감한 원가. 장부에 남긴다.
- 뉴스 선택의 `BUY`는 **현금 × buy-ratio-bp(30%) / 가격**을 0 방향으로 버린 수량(0이면 `INSUFFICIENT_CASH`), `SELL`은 전량. 지금 규칙을 종목에 옮긴 것이다.
- 수수료·세금 없음 (비목표).

### 6.3 평가

```java
long holdingsValue(UUID gameId, Map<String, Long> prices);   // Σ 수량 × 가격
long totalAsset(UUID gameId, Map<String, Long> prices);      // 현금 + 평가액 − 빚
```

### 6.4 수입·지출·빚

```java
IncomeResult credit(UUID gameId, String kind, long amount, int gameDay);   // SALARY, SPOUSE_INCOME, SEVERANCE, WINDFALL. (gameId, gameDay, kind) 멱등
SpendResult spend(UUID gameId, String kind, long amount, int gameDay, UUID eventId);   // EXPENSE, LIFE_COST. 현금이 모자라면 모자란 만큼 빚
void accrueInterest(UUID gameId, int bp, int gameDay);        // 빚 × bp / 10000 을 빚에 더함. (gameId, gameDay) 멱등
```

- **빚 규칙 (내 결정)**: 현금이 모자라면 지출을 거부하지 않고 모자란 만큼 `debt`가 늘어난다(마이너스 통장). 매월 1일 `asset.debt-interest-bp`(초기값 100 = 월 1%) 이자가 붙는다. 수입은 **먼저 빚을 갚고** 남는 만큼 현금이 된다. 빚이 있어도 매수는 할 수 있다(현금이 있다면). 현금은 음수가 되지 않는다.
- 장부 `kind` 추가: `EXPENSE`, `LIFE_COST`, `SPOUSE_INCOME`, `SEVERANCE`, `WINDFALL`, `INTEREST`, `DEBT_REPAY`(수입으로 빚을 갚은 부분).

## 7. 가계: 결혼, 자녀, 생활비, 은퇴 (새 도메인 `household`)

### 7.1 소유 상태

```sql
household_state (game_id PK, married_day INTEGER NULL, spouse_income BIGINT NOT NULL DEFAULT 0, retired_day INTEGER NULL, updated_at)
household_child (game_id, seq SMALLINT, birth_day INTEGER, PK(game_id, seq))
```

### 7.2 규칙 (초기값은 설정 `household.*`)

| 항목 | 규칙 | 초기값 |
|---|---|---|
| 생활비(1인) | 매월 1일 지출 | 1,400,000 |
| 생활비(부부) | 결혼 뒤 | 2,200,000 |
| 자녀 비용 | 자녀마다 나이 구간별 월 비용. 0~6 / 7~12 / 13~18 / 19~22세 / 23세 이상 | 600,000 / 800,000 / 1,000,000 / 1,300,000 / 0 |
| 결혼 비용 | 수락 시 한 번 (`LIFE_COST`) | 30,000,000 |
| 출산 비용 | 자녀마다 한 번 | 3,000,000 |
| 배우자 소득 | 결혼 뒤 매월 수입 | 1,800,000 |
| 물가 | 위 금액 전부 매년 복리로 오른다. **기준은 취업 나이**: `years = max(0, 나이 − household.inflation-base-age)`, 기본 24세. 1세 기준으로 하면 취업 시점에 이미 1.58배가 되어 13절의 밸런스가 깨진다 **(내 결정, 검토 반영)** | 2% |
| 은퇴 | `retire-age`에 월급이 끊긴다. 퇴직금 = 그때 월급 × 연차 (`SEVERANCE`) | 60세 |

- 생활비는 **직업이 생긴 뒤부터** 나간다(그 전은 부모 집) **(내 결정)**. 24세 취업 후 첫 월급과 같은 달부터.
- 배우자 소득도 60세에 끊긴다 (같은 은퇴 나이).
- 계산은 `household.monthlyExpense(gameId, day)`, `household.monthlyIncome(gameId, day)`(배우자 소득)로 진행에 돌려주고, **지출·입금은 진행이 자산에 요청**한다.

### 7.3 이벤트 (이벤트 도메인에 두 종류 추가)

**`LIFE` (선택형, 스킵 불가, 판정 없음)**

| 장면 | 조건 | 시점 | 선택지 |
|---|---|---|---|
| 결혼 | 직업 있음, 미혼 | 첫 번째는 `event.life.marriage-age` 구간(초기값 27~31)에서 난수. 거절하면 `+2년`, `marriage-last-age`(35) 넘으면 더 묻지 않음 | `결혼한다 (비용 {금액})` / `아직은 혼자가 좋다` |
| 자녀 | 결혼함, 자녀 < `max-children`(3), 나이 ≤ `child-last-age`(42) | 결혼 1~2년 뒤, 그다음은 마지막 자녀(또는 거절) 2~3년 뒤 | `아이를 가진다` / `지금은 아니다` |

`ChoiceTicket.Effect`에 `Life(kind: MARRIAGE|CHILD, accepted)`. 수락이면 진행이 가계에 `marry(day)`/`addChild(day)`를, 자산에 `LIFE_COST`를 요청한다. 거절도 기록만 하고 다시 묻는 시점을 위 규칙으로 잡는다.

**`NOTICE` (알림성, 멈추지 않음)**

- 콘텐츠 `content/life.json`의 `notices`: `code`, `title`, `body`, `amount`(음수 지출, 양수 수입), `weight`, `phase`(SAVING/INVESTING/모두). 예: 경조사비 −300,000, 병원비 −1,500,000, 자동차 수리 −800,000, 가족 여행 −2,500,000(결혼 뒤), 명절 보너스 +월급 50%(`amountPercentOfSalary`), 경품 당첨 +500,000.
- 간격 `event.notice.gap-days`(초기값 240~600). 직업이 생긴 뒤부터.
- **구현 (내 결정)**: 선택이 필요 없으므로 **대기 상태를 두지 않는다.** `schedule`이 만들면서 바로 `RESOLVED`로 기록하고 효과(자산 `spend`/`credit`)를 진행이 적용하고 `LIFE` 종류로 인생 기록에 남긴다. `schedule`은 여기서 멈추지 않고 이어간다 (event.md 5.1절 4항 그대로). 화면은 인생 기록에 새 줄이 끼어드는 것으로 보고, 추가로 상단에 3초 토스트를 띄운다 **(빌더)**. 스펙의 `skip`은 필요 없어진다(지금도 구현되지 않았다).

## 8. 자유 매매와 판정

### 8.1 흐름

1. 사용자가 시장 패널을 열면 클라이언트가 **시계를 멈추고** 현재 일수를 보고한다 (지금 `pause()`가 `report()`를 부르는 것과 같다).
2. 종목·방향·수량을 정해 `POST /api/games/{gameId}/trades` 를 보낸다. 몸체 `{ stockCode, side: BUY|SELL, quantity }`.
3. 서버(진행): 판을 잠근다 → 대기 중 선택형 이벤트가 있으면 400(`먼저 선택을 해야 한다`) → **행동 판정** (8.2절) → 실제 행동이 `HOLD`가 아니면 자산에 매수/매도(가격은 시장의 현재가) → 이탈이 있으면 캐릭터 성장 → 인생 기록 `TRADE` → `Outcome(kind: TRADE)`와 판 상태를 돌려준다.
4. 클라이언트는 결과를 **패널 안에** 한 줄로 보여 준다(이탈이면 와인색). 패널을 닫으면 시계가 다시 간다.

### 8.2 판정 (내 결정)

핵심 기제를 자유 매매가 우회하면 안 된다. 그러나 "다른 뉴스"가 없으므로 줏대 판정은 할 수 없다.

- `ChoiceContext.swaySentiment`가 `null`이면 **줏대 단계를 건너뛴다** (난수는 뽑는다, 순서 보존). 행동 스펙 4.2절에 이 조항을 더한다.
- 자유 매매는 `BUY`/`SELL`만 오므로 **용기 판정**만 실제로 걸린다: 걸리면 `HOLD`(`겁나서 주문 버튼을 누르지 못했다`). 이탈이면 용기 경험치가 쌓인다 (기존 성장 규칙).
- 뉴스 선택은 지금과 같이 줏대 → 인내심/용기 전체 판정.
- **결과의 "내 선택이 뒤집힌 횟수"에 자유 매매의 이탈도 넣는다** **(내 결정, 검토 반영)**. 자유 매매는 이벤트가 아니어서 `event_deviation`에 남지 않으므로, 진행이 `progress_log`의 `TRADE` payload(`deviations`)에서 세어 이벤트 집계와 합친다. 결과 화면 문구는 그대로("내 선택이 뒤집힌 횟수").

### 8.3 왜 수량인가

가격이 있으니 "주식 몇 주"가 자연스럽고, 평단·수익률이 생긴다. 화면은 수량 입력과 함께 **현금의 10/25/50/100%** 버튼으로 수량을 채워 준다(수량 = 버림). 매도는 **보유의 25/50/100%**.

## 9. 진행: 월 단위 처리 순서

`advance(day)`에서 `(last, stopDay]` 구간의 **매월 1일**마다, 월 번호 순서로:

1. `market.advanceTo` (그 달 가격)
2. 수입: 월급(직업 있고 은퇴 전) → `asset.credit(SALARY)`; 배우자 소득 → `credit(SPOUSE_INCOME)`
3. 은퇴 달이면 `credit(SEVERANCE)`, 가계에 `retire(day)`, 인생 기록 `RETIRE`
4. 지출: `household.monthlyExpense` → `asset.spend(EXPENSE)` (직업이 생긴 뒤부터)
5. `asset.accrueInterest` (빚이 있으면)
6. 연 경계면 `progress_year` 기록 (총자산은 **현금 + 평가 − 빚**)

그다음 이벤트 예약(지금과 같음). `NOTICE`는 `schedule`이 만들면 즉시 효과 적용(7.3절).

**월급 일자 변경 (내 결정)**: 지금은 `직업 시작일 + 30k`일에 들어온다. 매월 1일로 통일해 시장·지출과 같은 날에 처리한다. 직업 시작이 24세 첫날(`day % 30 == 0`)이므로 실제 차이는 없다.

## 10. 계약 변경 (`contracts/openapi/game.yaml`)

```yaml
Game:
  properties:
    holdings:            # 바뀜
      items:
        required: [stockCode, stockName, sectorCode, sectorName, quantity, avgCost, price, value, pnl, pnlBp]
    invested: int64      # Σ 평가액
    debt: int64
    market:
      required: [month, stocks]
      stocks: [{ code, name, sectorCode, sectorName, price, change1mBp, change12mBp, spark: [int64 × ≤12] }]
    household:
      required: [married, children, monthlyIncome, spouseIncome, monthlyExpense, retired]
      children: [{ age: int }]
      marriedAge: int|null
    investorType: Named|null  (code, name) + description
    riskProfile, mindProfile: Named|null
    pendingEvent:
      kind: [JOB, TRAIT, OFFER, NEWS, LIFE]
      stockCode, stockName: string|null     # 뉴스일 때 (항상 종목 하나)
      sectorWide: boolean                   # 충격이 섹터 전체인가
      spark: [int64]|null                   # 뉴스 종목의 최근 12달. 화면에 작은 차트
    LogEntry.kind: + TRADE, LIFE, MARRIAGE, CHILD, RETIRE
Outcome:
  kind: + TRADE, LIFE
  trade: { status, quantity, price, amount, realizedPnl|null }
  price: { sectorCode, sectorName, stockCode|null, stockName|null, direction, changeBp, pnl, lossSoftened }

POST /api/games/{gameId}/trades   → TradeOutcome { game, outcome }
  body { stockCode, side: BUY|SELL, quantity ≥ 1 }
  400: 대기 중 이벤트, 알 수 없는 종목, 수량, 투자 단계 아님
GET  /api/games/{gameId}/stocks/{stockCode}/history → { stockCode, points: [{ month, price }] }
```

`Game`의 크기: 종목 18 × (필드 8 + spark 12) ≈ 3~4KB 추가. 매초 보고에 실어도 된다. 전체 히스토리(최대 780점)는 패널에서 종목을 고를 때만 가져온다.

인생 기록 payload 추가:

| kind | payload |
|---|---|
| `TRADE` | `{ stockCode, stockName, side, chosen, actual, deviations, quantity, price, amount, realizedPnl }` |
| `LIFE` (알림) | `{ noticeCode, title, amount }` |
| `MARRIAGE` | `{ cost }` · `CHILD` `{ seq, cost }` · `RETIRE` `{ age, severance }` |
| `STYLE` | 기존 + `{ investorTypeCode, investorTypeName, riskCode, mindCode }` |
| `NEWS` | 기존 + `{ stockCode, stockName }` · `PRICE` 기존 + `{ stockCode, stockName }` |
| `GROWTH` | 기존 + `{ reason: DEVIATION|TRAIT }` |

## 11. 화면

목업 `mockup-invest-screen.html` 참고. 배치는 이전 설계의 3단을 유지하고 **오른쪽 열을 투자 중심으로** 바꾼다.

### 11.1 포트폴리오 카드 (오른쪽 위, 보유 종목 카드를 대체)

- 머리: `포트폴리오` · 오른쪽 `{월}월 기준`.
- 숫자 4칸(모노): **총자산** / 현금 / 투자 / 빚(0이면 숨김, 있으면 빨강). 아래 한 줄: `이번 달 {+1,240,000원 (+2.3%)}` — 전월 말 총자산 대비 **(내 결정: 전월 `progress_year`가 아니라 서버가 `market.month` 기준 전월 평가를 응답에 넣는다: `Game.lastMonthTotalAsset`)**.
- 보유 표: 종목(아래 작게 섹터) · 수량 · 평단 · 현재가 · 수익률(빨강/파랑) · 평가액. 보유가 없으면 `아직 보유 종목이 없다` 한 줄.
- 바닥 주 버튼 **`매매`**(와인). 투자 단계가 아니면 비활성(`투자 시작 전`).

### 11.2 시장 패널 (어두운 배경 위 큰 카드, 뉴스 결정 카드와 같은 오버레이)

- 머리: `시장 · {연도}년 {월}월` · 오른쪽 `닫기`. 열려 있는 동안 시계는 멈춰 있고 상단 바 배속 버튼은 비활성.
- 왼쪽(또는 모바일 위): 섹터 탭 6개(관심 섹터에 `관심` 알약). 종목 행: 이름 · 현재가 · 1개월(색) · 12개월(색) · 12달 스파크라인(SVG, 청록). 보유 중이면 행 왼쪽에 와인색 점.
- 오른쪽(또는 모바일 아래): 고른 종목의 **월간 차트**(인라인 SVG 선, 전체 히스토리, x축 나이, y축 원) · 내 보유 한 줄(수량 · 평단 · 수익률) · **주문 폼**: `매수 | 매도` 토글, 수량 입력(모노), 빠른 버튼 4개(10/25/50/100% — 매도는 25/50/100%), `주문 금액 {수량 × 현재가}`, 주 버튼 `매수 주문` / `매도 주문`.
- 주문 결과는 폼 아래 한 줄: 체결 `삼송전자 12주를 72,000원에 샀다` / 이탈 `용기 부족 — 주문 버튼을 누르려다 겁나서 그만뒀다`(와인). 이탈 시 성장도 한 줄.
- 바닥 11px: `선택은 당신이 하지만, 실행은 당신의 성격이 합니다.`

### 11.3 가계부 카드 (왼쪽, 능력치 카드 아래. 능력치 카드의 총자산·현금 줄은 여기로 옮긴다)

- 머리: `가계부` · `{월}월`.
- 표: 월급 `+2,800,000` · 배우자 `+1,800,000`(결혼 뒤) · 생활비 `−2,200,000` · 자녀 `−1,400,000 (2명)` · **저축** `= +1,000,000`(굵게, 음수면 빨강).
- 가족 한 줄: `혼자` / `배우자 · 자녀 2 (3세, 7세)` 아이콘 없이 글자로. 은퇴 뒤 `은퇴 · 월급 없음`.
- 빚이 있으면 `빚 {금액} · 월 1% 이자`(빨강).

### 11.4 뉴스 결정 카드

- 머리 `뉴스 · {섹터} · {종목}`(섹터 전체 충격이면 `· 섹터 전체` 덧붙임). 제목 아래 **최근 12달 스파크라인**과 `현재가 {가격} · 1개월 {±%}`.
- 선택지 3개 그대로. 매수 보조 `현금의 30% ≈ {수량}주`, 매도 보조 `보유 {수량}주 ≈ {평가액}`.
- 결과 카드: `{종목} 주가 ▲ 4.2% (같은 섹터 ▲ 1.3%) · 내 손익 +1,240,000원`.

### 11.5 그 밖에

- 신원 카드: `스타일` 줄 → `유형` 줄(`느긋한 농부 · 장기`). `관심` 유지. 가족은 가계부 카드가 맡는다.
- 인생 기록 문구 (`log.ts`): `TRADE` `삼송전자 12주 매수 (864,000원)` / 이탈 `삼송전자 매수 → 못 샀다 (용기 부족)`; `LIFE` `{제목} {−300,000원}`; `MARRIAGE` `결혼했다. 결혼 비용 3,000만 원.`; `CHILD` `{n}번째 아이가 태어났다.`; `RETIRE` `60세, 은퇴했다. 퇴직금 {금액}.`; `STYLE` `'{유형}'형 투자자로 자랐다.`
- 알림성 이벤트 토스트: 상단 바 아래 오른쪽, 3초, `{제목} · {금액}`.
- 장면: 결혼·자녀는 장면에 반영하지 않는다 (비목표. 나중에 가족 스프라이트 가능).
- 결과 화면(인생 기록부): `가족` 줄(배우자, 자녀 수), `최종 포트폴리오` 표, 빚이 있으면 표시.
- 시계: `REPORT_EVERY_DAYS = 30`. 매달 보고 → 포트폴리오 숫자가 1초마다 바뀐다. 숫자 변화는 전환 없이 즉시(깜빡임 없음) **(내 결정)**.

## 12. 클라이언트 구조 변경 (내 결정)

```
web/src/features/game/
  PortfolioCard.tsx       HoldingsCard 대체
  MarketPanel.tsx         오버레이. 섹터 탭·종목 목록·차트·주문 폼
  Sparkline.tsx           12점 작은 선
  PriceChart.tsx          월간 전체 차트
  HouseholdCard.tsx       가계부
  Toast.tsx               알림성 이벤트
  market.ts               수량 계산(현금 비율→수량), 변화율 표시 등 순수 함수 + 테스트
  store.ts                marketOpen, selectedStock, trade(), history 캐시 추가
  labels.ts / log.ts      새 종류 문구
```

E2E 추가: 투자 시작 뒤 `매매`를 눌러 패널을 열고 종목 하나를 사면 포트폴리오 표에 줄이 생긴다(이탈이면 결과 문구 확인으로 대체). 성장기 장면에 선택지가 3개 이상이다. 가계부에 생활비 줄이 보인다.

## 13. 설정값 요약 (초기값)

| 이름 | 초기값 |
|---|---|
| `market.sector-volatility-bp` | 400 |
| `market.volatility.low/mid/high-bp` | 400 / 800 / 1200 |
| `market.spillover-percent` | 30 |
| `market.min-price` | 100 |
| `asset.buy-ratio-bp` (뉴스 매수) | 3000 (기존) |
| `asset.debt-interest-bp` | 100 |
| `household.living-single/couple` | 1,400,000 / 2,200,000 |
| `household.child-cost` (0-6/7-12/13-18/19-22) | 600,000 / 800,000 / 1,000,000 / 1,300,000 |
| `household.wedding-cost`, `childbirth-cost` | 30,000,000 / 3,000,000 |
| `household.spouse-income` | 1,800,000 |
| `household.inflation-percent` / `inflation-base-age` | 2 / 24 |
| `household.retire-age` | 60 |
| `event.life.marriage-age` / `marriage-retry-years` / `marriage-last-age` | 27~31 / 2 / 35 |
| `event.life.child-first-gap-years` / `child-gap-years` / `max-children` / `child-last-age` | 1~2 / 2~3 / 3 / 42 |
| `event.notice.gap-days` | 240~600 |
| `character.trait-stat.min` / `trait-stat.max-delta` | 5 / 3 |
| 클라이언트 `REPORT_EVERY_DAYS` | 30 |

밸런스 감각 (초기값으로 계산): 사무직 2,800,000 − 1인 생활비 1,400,000 = 월 140만 저축. 결혼하면 2,800,000 + 1,800,000 − 2,200,000 = 240만. 자녀 둘(학령기)이면 240 − 180 = 60만. 은퇴 뒤 부부 생활비 220만 × 물가 상승 ≈ 월 450만이 5년간 나간다. **투자를 안 하면 은퇴 후 빚이 생길 수 있다** — 의도한 긴장이다. 수치는 체감 후 조정.

## 14. 빌더에게 맡기는 것

- 성향 장면 24개와 선택지 문구, 투자자 유형 8개 이름·설명, 종목 18개 최종 이름(실제 상호와 겹치지 않게)·기준가·추세, 알림성 이벤트 10개 안팎, 뉴스 정의에 `{stock}` 자리표시와 `sectorWide` 반영, 종목 뉴스 문구 추가(기존 12개 뉴스를 `{stock}` 문구로 바꾸고, 섹터 전체 충격 뉴스도 2~3개 둔다).
- 마이그레이션 번호, `asset_holding` 재생성 방식.
- 시장 패널의 태블릿·모바일 배치(모바일은 목록 → 상세 2단계로 전환해도 된다).
- 차트 축 눈금, 스파크라인 색 규칙(1개월 변화가 양수면 빨강 계열, 음수면 파랑 계열로 선을 칠해도 되고 청록 고정도 된다).
- 토스트 구현 방식, 알림이 연속으로 올 때 쌓는 방식.
- 테스트 분량: 시장(월 처리 멱등·충격·바닥), 자산(수량 매매·평단·빚·이자·멱등), 가계(생활비 계산·물가·은퇴), 행동(`swaySentiment=null`), 이벤트(`LIFE`·`NOTICE` 시점), 진행(월 순서·`trades` 400 조건), 콘텐츠 검증, 클라이언트 순수 함수, E2E 3건.

## 15. 작업 묶음 (참고)

1. 콘텐츠: `traits.json` v2(24장면), `stocks.json`, `life.json`, `meta.json`(유형·축), `news.json`(종목). 콘텐츠 검증.
2. 계약: 10절. `pnpm gen:api`.
3. 서버 도메인: 시장(신규), 자산(수량·빚), 가계(신규), 캐릭터(축·능력치 흔들기), 행동(줏대 생략), 이벤트(`LIFE`·`NOTICE`·종목 뉴스).
4. 서버 진행: 월 처리 순서, `trades`·`history` 엔드포인트, 인생 기록 종류, `GameView` 확장.
5. 클라이언트: 포트폴리오·시장 패널·가계부·토스트·결정 카드·문구·시계 30일.
6. E2E 갱신, 체감 조정.

1과 2는 서로 독립. 3의 도메인들은 서로 독립(진행만 다 부른다). 5는 2 뒤에 목으로 먼저 시작할 수 있다.
