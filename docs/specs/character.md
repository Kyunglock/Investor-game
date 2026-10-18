# 스펙: 캐릭터 (character)

> 담당: agent1 · 상태: 초안 v0.1 · 근거: [poc.md](../poc.md) 3·7절, [decisions.md](../decisions.md), [db.md](../db.md) 3.3~3.5절
> 표기: **(확정)**, **(제안)**, **(초기값)** 은 [README.md](./README.md) 참고.

## 1. 목적과 범위

한 판의 캐릭터 상태를 소유한다.

| 맡는 것 | 맡지 않는 것 |
|---|---|
| 능력치 5종의 랜덤 생성 | 능력치를 이용한 판정과 힌트 (행동) |
| 능력치 성장 (경험치, 자기계발) | 초기 자산과 월급 지급 (자산) |
| 직업 확정과 연차 계산의 기준 | 직업별 월급 액수 정의 (콘텐츠) |
| 투자 스타일, 관심 섹터 확정 | 성향 이벤트의 선택지 구성 (이벤트 운영) |

- 다른 도메인을 호출하지 않는다. 필요한 값은 진행이 인자로 넘긴다 (domains.md 3절).

## 2. 공개 인터페이스

```java
package investorgame.character;

public interface CharacterService {

    /** 판 시작 시 캐릭터를 만든다. 같은 gameId로 다시 부르면 기존 캐릭터를 돌려준다(멱등). */
    CharacterView create(UUID gameId, RandomGenerator rng);

    CharacterView get(UUID gameId);

    /** 직업을 확정한다. 판당 한 번만 가능하다(이직 불가). */
    void assignJob(UUID gameId, String jobCode, int startDay);

    /** 성향 이벤트의 선택 하나를 점수로 누적한다. */
    List<StatChange> recordTraitChoice(UUID gameId, Map<String, Integer> traitDeltas,
                                       Map<String, Integer> statDeltas, int gameDay);

    /** 누적 점수로 투자 스타일과 관심 섹터를 확정한다. */
    TraitResult finalizeTraits(UUID gameId, TraitAxes axes, RandomGenerator rng);

    /** 성장 원인을 반영한다. 운은 성장하지 않는다. */
    List<StatChange> grow(UUID gameId, List<GrowthSource> sources, int gameDay);

    /** 연차(년)를 계산한다. 직업이 없으면 0. */
    int tenureYears(UUID gameId, int currentDay);

    /** 세션 만료 시 해당 판의 캐릭터 데이터를 지운다. */
    void deleteByGame(UUID gameId);
}
```

## 3. 입력·출력 타입

```java
public record CharacterView(
    UUID gameId,
    Stats stats,                    // 현재 능력치
    Stats initialStats,             // 판 시작 시 능력치
    String jobCode,                 // 없으면 null
    Integer jobStartDay,            // 없으면 null
    String investmentStyle,         // 기간 축. 확정 전 null
    String riskProfile,             // 위험 축 (bold/safe). 확정 전 null
    String mindProfile,             // 소신 축 (own/crowd). 확정 전 null
    String interestSector,          // 관심 섹터. 확정 전 null
    String investorType             // "{기간}-{위험}-{소신}". 확정 전 null
) {}

public record TraitResult(String investmentStyle, String riskProfile, String mindProfile,
                          String interestSector, String investorTypeCode) {}

/** 위험·소신 축의 후보 코드. 점수가 없는 축은 여기서 난수로 정한다. 캐릭터는 콘텐츠를 읽지 않으므로 진행이 넘긴다. */
public record TraitAxes(List<String> risks, List<String> minds) {}

public sealed interface GrowthSource permits DeviationGrowth, Training {}
public record DeviationGrowth(String statCode, UUID eventId) implements GrowthSource {}   // 이탈을 겪음. eventId는 원인 이벤트
public record Training(String statCode, int expAmount, UUID eventId) implements GrowthSource {}   // 자기계발 이벤트

public record StatChange(String statCode, int expGained, int valueBefore, int valueAfter) {}
```

- 행동의 `Deviation` 타입과 이름이 겹치지 않도록 성장 쪽은 `DeviationGrowth`라고 부른다.
- `eventId`는 `character_stat_log.event_id`에 기록하려고 받는다. 원인 이벤트가 없으면 `null`이다.
- 운(`luck`)은 `DeviationGrowth`나 `Training`을 받아도 **무시한다** (확정).

## 4. 규칙

### 4.1 캐릭터 생성

- 능력치 5종을 각각 **15~85 사이 정수로 균등 랜덤**으로 뽑는다 (초기값, poc.md).
- 난수를 뽑는 순서는 `insight → patience → courage → conviction → luck` (항상 이 순서).
- 생성한 값을 `initial_value`와 `value`에 같이 저장한다.
- 직업, 투자 스타일, 관심 섹터는 `null`로 시작한다.
- **초기 자산은 자산 도메인이 만든다.** 이 도메인이 만들지 않는다.

### 4.2 직업

- `assignJob`은 한 판에 한 번만 가능하다. 이미 있으면 오류를 던진다 (이직 불가, 확정).
- `startDay`는 직업을 시작한 게임 일수다. 연차 계산에 쓴다.
- 연차(년) = `(currentDay - startDay) / 360` (정수 나눗셈). 게임 달력은 1년 = 12개월 × 30일 = 360일이다 (제안, README 4절).
- 직업별 월급과 연차별 상승 곡선은 콘텐츠가 정의하고, 월급 계산은 진행이 한다 (연차를 이 도메인에서 읽어 넘긴다).

### 4.3 투자 성향 (확정)

성향 이벤트는 "상황을 주고 어떻게 행동하는지"로 판단한다(상황극, 선택지 3~4개). 판정으로 뒤집지 않는다 (확정). 네 축을 잰다: **기간**(`style.short/long`), **위험**(`risk.bold/safe`), **소신**(`mind.own/crowd`), **관심**(`sector.<코드>`) (경제 개편 설계 4.2절).

1. 콘텐츠가 각 선택지에 축 점수표(`traitDeltas`)와 능력치 변화(`statDeltas`, 선택)를 붙인다. 예: `{"style.long": 2, "risk.safe": 1, "sector.bio": 1}`, `{"patience": 1}`.
2. 사용자가 선택하면 진행이 둘을 `recordTraitChoice`로 넘긴다. 점수는 `character_trait_score`에 누적하고, **능력치는 즉시 더한다**: 범위 `[character.trait-stat.min(5), growth.max-stat(95)]`로 자르고, 운은 무시한다(확정). 바뀐 능력치마다 `character_stat_log(reason='TRAIT')`를 남기고 `StatChange(expGained=0)`로 돌려준다. `initial_value`는 바꾸지 않는다(별명은 그대로).
3. 성향 이벤트가 끝나면 진행이 `finalizeTraits(gameId, axes, rng)`를 부른다. 뽑는 순서는 **기간 → 위험 → 소신 → 관심**.
   - 각 축 = 그 접두사의 점수가 가장 높은 항목. 동점이면 난수로 정한다.
   - 기간·관심 점수가 하나도 없으면 오류(진행이 성향 이벤트 이후에만 부른다). 위험·소신 점수가 없으면 `axes`의 후보 전체에서 난수로 정한다(내 결정).
   - **투자자 유형 코드** = `{기간}-{위험}-{소신}`. 이름·설명은 콘텍츠(`meta.investorTypes`)에 있고 진행이 찾는다.
4. 확정은 한 번만 가능하다. 다시 부르면 이미 확정된 값을 돌려준다(멱등).
5. 동점 난수는 `sort(코드 이름)` 순서로 후보를 정렬한 뒤 `nextInt(후보 수)`로 뽑는다 (재현성). 점수가 없는 축도 난수를 한 번 뽑아 순서를 고정한다.

점수 항목의 이름 규칙: `style.<코드>`, `risk.<코드>`, `mind.<코드>`, `sector.<코드>`. 코드 목록은 콘텐츠(`meta.json`)가 정의한다.

### 4.4 성장 (확정: 경험치와 자기계발, 다양한 루트)

성장 원인은 두 가지다.

| 원인 | 경험치 | 설명 |
|---|---|---|
| `DeviationGrowth` | `character.growth.deviation-exp` (초기값 3) | 해당 능력치 때문에 이탈이 일어남 |
| `Training` | `expAmount` (콘텐츠가 정함) | 자기계발 이벤트의 결과. 비용(월급 지출)은 자산이 처리한다 |

- 경험치는 능력치별로 `character_stat.exp`에 누적한다.
- **`character.growth.exp-per-point`(초기값 5) 경험치마다 능력치 +1.** 경험치가 이 값을 넘으면 점수로 환산하고 나머지는 남긴다.
- 능력치 상한은 `character.growth.max-stat`(초기값 95). 상한에 도달하면 경험치는 쌓이되 점수는 오르지 않는다.
- **운은 어떤 원인으로도 오르지 않는다** (확정).
- 능력치가 오르면 `character_stat_log`에 한 행을 남긴다 (`reason`은 `DEVIATION` 또는 `TRAINING`, `event_id`는 `GrowthSource`의 `eventId`).
- 한 번의 `grow` 호출에 여러 원인이 있으면 입력 순서대로 처리하고, 능력치별로 변화를 합쳐 `StatChange`로 돌려준다.

> 성장 속도(`deviation-exp` 3, `exp-per-point` 5)는 사용자가 "알아서 하라"고 해서 제가 정한 초기값이다 (확정: 위임). 이탈 두 번이면 거의 +1이 되는 정도를 의도했다. 체감 테스트 후 조정한다.

## 5. 설정값 (초기값)

| 이름 | 초기값 | 의미 |
|---|---|---|
| `character.initial-stat.min` | 15 | 초기 능력치 최솟값 |
| `character.initial-stat.max` | 85 | 초기 능력치 최댓값 |
| `character.growth.deviation-exp` | 3 | 이탈 한 번의 경험치 |
| `character.growth.exp-per-point` | 5 | 능력치 +1에 필요한 경험치 |
| `character.growth.max-stat` | 95 | 성장 상한 (성향 선택의 상한이기도 하다) |
| `character.trait-stat.min` | 5 | 성향 선택으로 내려갈 수 있는 하한 |
| `game.days-per-year` | 360 | 연차 계산 기준. 달력 설정은 `common`이 소유한다 |

## 6. DB

소유 테이블: `character_profile`, `character_stat`, `character_stat_log` (db.md 3.3~3.5절) + **새로 추가하는 `character_trait_score`**.

### 새 테이블: `character_trait_score` (db.md에 반영 필요)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| game_id | uuid | PK의 일부 |
| trait_code | text | `style.<코드>`, `sector.<코드>`. PK의 일부 |
| score | integer | 누적 점수 |

### 변경 사항

- 세션 만료 시 이 도메인의 모든 테이블에서 `game_id` 기준으로 지운다 (`deleteByGame`).

## 7. 테스트 시나리오

| # | 입력 | 기대 결과 |
|---|---|---|
| 1 | `create`를 같은 시드로 두 번 | 능력치가 동일하다. 5개 모두 15~85 |
| 2 | `create`를 같은 `gameId`로 두 번 | 두 번째는 새로 만들지 않고 기존 값을 돌려준다(멱등) |
| 3 | `create` 대량 반복(20,000회) | 각 능력치가 15~85 범위에서 대략 균등하다 |
| 4 | `assignJob` 두 번 | 두 번째는 오류 |
| 5 | `tenureYears` startDay 0, currentDay 359 / 360 / 720 | 0 / 1 / 2 |
| 6 | 직업 없는 캐릭터의 `tenureYears` | 0 |
| 7 | 성향 선택 3개를 누적하고 `finalizeTraits` | 가장 높은 점수의 네 축이 확정되고 유형 코드가 `{기간}-{위험}-{소신}`이다 |
| 7-1 | 위험·소신 점수 없이 `finalizeTraits` | 후보에서 난수로 정하며 같은 시드면 같다 |
| 7-2 | `statDeltas {courage:+2, luck:+3}` | 용기만 +2, 운·초기값은 그대로 |
| 7-3 | `-3`을 40번 / `+3`을 40번 | 5 / 95에서 멈추고, 더 못 움직이면 빈 목록 |
| 8 | 스타일 점수가 동점 | 난수로 정하며 같은 시드에서는 같은 결과 |
| 9 | 점수가 없는 상태에서 `finalizeTraits` | 오류 |
| 10 | `finalizeTraits` 두 번 | 두 번째는 확정된 값을 그대로 돌려준다 |
| 11 | `DeviationGrowth("patience")` 2번 (exp 3씩) | 총 6 exp → 인내심 +1, 남은 exp 1 |
| 12 | `Training("insight", 10)` | 안목 +2 |
| 13 | 능력치가 이미 95일 때 성장 | 값은 95 그대로, 경험치만 쌓인다 |
| 14 | `DeviationGrowth("luck")` | 운은 변하지 않고 `StatChange`도 돌려주지 않는다 |
| 15 | `grow`가 능력치를 올림 | `character_stat_log`에 `reason`과 `event_id`가 남는다 |
| 16 | `deleteByGame` 후 `get` | 오류(없음) |

## 8. 완료 조건

1. 공개 인터페이스 8개가 위 시나리오를 통과한다.
2. 다른 도메인을 호출하지 않고, 자기 접두사(`character_`) 테이블만 읽고 쓴다 (ArchUnit).
3. 난수는 인자로 받고, 현재 시각을 읽지 않는다.
4. 수치는 모두 설정에서 읽는다.
5. 마이그레이션 `V<번호>__character_init.sql`이 테이블 4개를 만든다. FK가 없다.
6. db.md에 `character_trait_score`를 추가한다.

## 9. 미결정

| # | 질문 |
|---|---|
| 1 | 성장 속도와 경험치 환산 수치 (체감 테스트로 조정) |
| 2 | 투자 스타일 코드 목록, 성향 이벤트의 점수표 설계 (콘텐츠) |
| 3 | 성향 이벤트 개수와 끝나는 시점 (이벤트 운영, 콘텐츠) |
| 4 | 자기계발 이벤트의 종류와 비용 (콘텐츠, 자산) |
| 5 | 투자 스타일이 확정된 뒤 바뀔 수 있는지 (현재: 바뀌지 않는다) |
