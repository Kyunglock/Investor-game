# 스펙: 가계 (household)

> 상태: 구현됨 (2026-10-18) · 근거: [경제 개편 설계](../superpowers/specs/2026-10-18-economy-redesign-design.md) 7절
> 표기: **(확정)**, **(제안)**, **(초기값)** 은 [README.md](./README.md) 참고.

## 1. 목적과 범위

결혼·자녀·은퇴 상태를 소유하고 월 지출과 배우자 소득을 계산한다 (확정: "생활비도 쓰고 결혼도 하고 자녀도 가진다"). 돈의 반영은 진행이 자산에 요청한다.

| 맡는 것 | 맡지 않는 것 |
|---|---|
| 결혼일, 자녀 출생일, 은퇴일 | 결혼·자녀를 묻는 시점과 선택지 (이벤트 운영 `LIFE`) |
| 생활비(1인/부부) + 자녀 나이별 비용, 물가 | 지출·입금 (자산) |
| 배우자 소득, 결혼·출산 비용, 은퇴 달 판정 | 월급, 퇴직금 (진행이 직업·연차로 계산) |

- 직업을 모른다. "생활비가 언제부터 나가는가"(취업 뒤)는 진행이 정한다.

## 2. 공개 인터페이스

```java
package investorgame.household;

public interface HouseholdService {
    void create(UUID gameId);                        // 멱등
    HouseholdView get(UUID gameId);
    void marry(UUID gameId, int gameDay);            // 두 번이면 InvalidRequestException
    int addChild(UUID gameId, int gameDay, int leaveAge, Sex sex); // 순번(1부터). 독립 나이·성별은 태어날 때 정해진다 (decisions.md 68·69번)
    void retire(UUID gameId, int gameDay);           // 멱등
    long monthlyExpense(UUID gameId, int gameDay);
    long spouseIncome(UUID gameId, int gameDay);     // 미혼·은퇴 뒤 0
    long pension(UUID gameId, int gameDay);          // 은퇴 전 0, 은퇴 뒤(또는 은퇴 나이가 지난 뒤) 1인/부부 연금, 물가 반영
    long weddingCost(int gameDay);
    long childbirthCost(int gameDay);
    boolean retireMonth(int gameDay);                // == (retire-age − start-age) × 360
}
public record HouseholdView(boolean married, Integer marriedDay, List<Child> children, Integer retiredDay) {
    public record Child(int seq, int birthDay, int leaveDay, Sex sex) {}
}
```

## 3. 규칙

| 항목 | 규칙 | 초기값 |
|---|---|---|
| 생활비 | 1인 / 부부 | 1,400,000 / 2,200,000 |
| 자녀 비용 | 나이 ≤6 / ≤12 / ≤18 / ≤22 / 23 이상 | 600,000 / 800,000 / 1,000,000 / 1,300,000 / 0 |
| 결혼·출산 비용 | 한 번 | 30,000,000 / 3,000,000 |
| 배우자 소득 | 결혼 뒤 매월, 은퇴 뒤 0 | 1,800,000 |
| 물가 | 위 금액 전부. `years = max(0, 나이 − inflation-base-age)`, `(100+p)^years / 100^years` 정수 곱셈 | 2%, 기준 24세 |
| 은퇴 | `retire-age` 첫날. 진행이 월급을 끊고 퇴직금(월급 × 연차)을 넣는다 | 60세 |
| 연금 | 은퇴 뒤, 또는 은퇴 나이(60)가 지난 뒤 매월(정년 없는 직업이면 월급과 같이). 1인 / 부부. 진행이 `PENSION`으로 넣는다 (decisions.md 27·57번) | 1,000,000 / 1,600,000 |

물가 기준을 1세가 아니라 **취업 나이**로 둔 이유: 1세 기준이면 취업 때 이미 1.58배가 되어 밸런스가 깨진다 (설계 13절).

## 4. 설정값

`household.living-single`, `living-couple`, `child-cost.to-age6/12/18/22`, `wedding-cost`, `childbirth-cost`, `spouse-income`, `pension-single`, `pension-couple`, `inflation-percent`, `inflation-base-age`, `retire-age`, `start-age`(progress.start-age와 같은 값을 따로 둔다).

## 5. DB

`household_state (game_id PK, married_day, retired_day, updated_at)`, `household_child (game_id, seq, birth_day, leave_day, sex, PK(game_id, seq))`. FK 없음. sex는 'M'/'F' (decisions.md 69번).

## 6. 테스트

`HouseholdServiceTest`: 1인 생활비와 물가 시작 시점, 결혼 뒤 부부 생활비·배우자 소득·결혼 비용 물가, 자녀 나이 구간, 은퇴 후 배우자 소득 0, 은퇴 뒤 연금(1인 < 부부, 물가), 두 번 결혼 오류·자녀 순번, 재생성 멱등.

## 7. 미결정

| # | 질문 |
|---|---|
| 1 | 수치 전부 체감 후 조정 |
| 2 | 주거(전세·매매) 비용을 따로 둘지 (지금은 생활비에 포함) |
