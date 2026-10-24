# 스펙: 이벤트 운영 (event)

> 담당: agent2 · 상태: 2026-10-18 경제 개편 반영 (종목 뉴스, LIFE, NOTICE) · 근거: [domains.md](../domains.md) 4절, [decisions.md](../decisions.md), [db.md](../db.md) 3.9~3.11절, [prd.md](../prd.md) 3절
> 표기: **(확정)**, **(제안)**, **(초기값)** 은 [README.md](./README.md) 참고.

## 1. 목적과 범위

게임 중 발생하는 모든 이벤트의 **발생 시점, 종류, 선택지, 숨은 값, 연결**을 정하고 기록한다.

| 맡는 것 | 맡지 않는 것 |
|---|---|
| 이벤트 발생 시점과 종류 결정 | 이벤트 내용(문구, 정의) 작성과 로드 (콘텐츠) |
| 관심 섹터 노출 비중, 투자 스타일별 구성 | 선택의 판정과 이탈 (행동) |
| 뉴스의 숨은 방향·변동 폭 생성 | 주가 변동 반영 (자산) |
| 뉴스끼리의 연결(깊이, 갈래) | 직업·성향·성장의 실제 반영 (진행이 캐릭터에 요청) |
| 선택형·알림성 구분, 스킵 규칙 | 힌트 방향·강도 계산 (행동) |
| 해결 기록, 이탈 원인 기록 | 시각 보고 검증, 단계 전환 (진행) |

- **콘텐츠만 직접 호출한다.** 이것이 도메인 간 유일한 직접 호출이다 (domains.md 3절). 캐릭터, 자산, 행동은 호출하지 않는다.
- 힌트가 필요하면 진행이 함수(`HintProvider`)를 넘겨 준다. 이 도메인은 행동을 알지 못한다.
- 호출하는 쪽(진행)이 한 판의 `progress_game` 행을 잠근 상태에서 부른다 (db.md 5절).

## 2. 공개 인터페이스

```java
package investorgame.event;

public interface EventService {

    /**
     * (fromDay, toDay] 구간에서 발생할 이벤트를 만든다.
     * 선택형 이벤트(스킵 불가)를 만나면 거기서 멈추고 그 시각을 돌려준다.
     * 알림성 이벤트는 멈추지 않고 이어서 만든다.
     */
    ScheduleResult schedule(UUID gameId, SchedulingContext context, int fromDay, int toDay,
                            SeededRandom random, HintProvider hints);

    /** 현재 상태에서 다음 이벤트가 발생할 게임 일수. 없으면 비어 있다. (nextEventDay 응답용) */
    OptionalInt peekNextEventDay(UUID gameId, SchedulingContext context, int fromDay, SeededRandom random);

    /** 사용자에게 보여 줄 대기 중 선택형 이벤트. 없으면 비어 있다. 재접속 시에 쓴다. */
    Optional<EventView> pending(UUID gameId);

    /** 선택을 검증하고 진행이 반영해야 할 효과와 숨은 값을 돌려준다. 상태는 바꾸지 않는다. */
    ChoiceTicket prepareChoice(UUID gameId, UUID eventId, String optionCode);

    /** 선택형 이벤트를 해결한 것으로 기록한다. 뉴스이면 이어지는 뉴스를 예약한다. */
    CompleteResult complete(UUID gameId, UUID eventId, Completion completion,
                            SchedulingContext context, int currentDay, SeededRandom random);

    /** 알림성 이벤트를 넘긴다. 선택형 이벤트에 부르면 오류다. */
    void skip(UUID gameId, UUID eventId);

    /** 판의 이탈 횟수를 능력치별로 센다. 결과 집계용. */
    Map<String, Integer> deviationCounts(UUID gameId);

    /** 세션 만료 시 해당 판의 이벤트 데이터를 지운다. */
    void deleteByGame(UUID gameId);
}
```

## 3. 입력·출력 타입

```java
public enum EventKind { JOB, OFFER, TRAIT, LIFE, CAREER, NEWS, NOTICE }   // 구현된 순서 = 우선순위. TRAINING은 아직 없음
public enum EventStatus { SCHEDULED, PENDING, RESOLVED, SKIPPED }

public record SchedulingContext(
    Phase phase,                 // SAVING, INVESTING (공유 타입)
    String investmentStyle,      // 확정 전 null
    String interestSector,       // 확정 전 null
    boolean salaryStarted,       // 첫 월급을 받았는가 (투자 시작 제안 조건)
    boolean traitsFinalized      // 투자 스타일이 확정되었는가 (투자 시작 제안 조건, 확정)
) {}

public interface HintProvider {
    /** 뉴스의 숨은 방향에 대한 힌트. 진행이 행동의 hint()를 감싸서 넘긴다. seq는 이벤트 순번이다. */
    Hint hintFor(Direction truth, int seq);
}

public record ScheduleResult(
    List<EventView> delivered,   // occursDay 순서. 마지막이 선택형이면 거기서 멈춘 것이다
    int stoppedAtDay,            // 멈춘 게임 일수. 멈추지 않았으면 toDay
    OptionalInt nextEventDay
) {}

/** 클라이언트에 내려가도 안전한 값만 담는다. 숨은 방향, 변동 폭, 시드는 없다. */
public record EventView(
    UUID eventId, EventKind kind, int occursDay, boolean skippable,
    String sectorCode,           // 뉴스일 때
    String title, String body,   // 콘텐츠의 문구
    String hintText,             // 뉴스일 때. 없으면 null
    String swayText,             // 줏대용 "다른 뉴스". 뉴스일 때
    List<OptionView> options     // 선택형일 때. 알림성은 빈 목록
) {}

public record OptionView(String code, String label) {}

/** 진행 전용. 숨은 값을 포함하므로 응답에 그대로 내리지 않는다. */
public record ChoiceTicket(
    UUID eventId, EventKind kind, String optionCode, int seq,
    Direction truth,             // 뉴스일 때
    int magnitudeBp,             // 뉴스일 때
    Sentiment swaySentiment,     // 뉴스일 때
    String sectorCode,
    ChoiceEffect effect          // 종류별 효과. 아래 참고
) {}

public sealed interface ChoiceEffect permits NewsEffect, JobEffect, TraitEffect, TrainingEffect, OfferEffect {}
public record NewsEffect() implements ChoiceEffect {}                          // 판정·자산 반영은 진행이 한다
public record JobEffect(String jobCode) implements ChoiceEffect {}             // 진행이 캐릭터에 직업을 정함. jobCode가 WAIT이면 기다림
public record CareerEffect(CareerDefinition.Option option, String targetJobCode) implements ChoiceEffect {}  // 직장 장면. 판정·반영은 진행
public record TraitEffect(Map<String, Integer> traitDeltas, Map<String, Integer> statDeltas, String note) implements ChoiceEffect {}   // 진행이 캐릭터에 축 점수 누적 + 능력치 즉시 변경(statDeltas는 선택, 운 금지, 폭은 content.trait-stat-max-delta). 구현 이름은 ChoiceTicket.Trait
public record TrainingEffect(String statCode, int expAmount, long cost) implements ChoiceEffect {}  // 비용이 0이고 expAmount가 0이면 "하지 않는다"
public record OfferEffect(boolean accepted) implements ChoiceEffect {}         // 수락이면 진행이 단계를 바꿈

public record Completion(
    String chosenOption,         // 사용자가 고른 선택
    String actualOption,         // 판정을 거친 실제 행동. 뉴스가 아니면 chosenOption과 같다
    List<Deviation> deviations   // 행동의 Deviation. 없으면 빈 목록
) {}

public record CompleteResult(
    List<EventView> scheduledFollowups,   // 이어서 예약된 뉴스(SCHEDULED). 없으면 빈 목록
    boolean traitsComplete                // 이 완료로 성향 이벤트가 모두 끝났는가
) {}
```

- `Phase`, `SeededRandom`은 공유 타입이다 (README 4절).
- `HintProvider`는 진행이 구현한다. 행동의 `Hint`를 돌려주고, 힌트 문구는 이 도메인이 콘텐츠에서 고른다.

## 4. 이벤트 종류

| 종류 | 단계 | 선택형 | 스킵 | 설명 |
|---|---|---|---|---|
| `JOB` | `CHILDHOOD` 끝, 실직 뒤 | 예 | 불가 | 직업 선택. 성향이 다 정해진 뒤 처음 오고, 실직하면 다시 온다. 선택지 끝에 **"더 나은 자리를 기다린다"(`WAIT`)**가 붙을 수 있다(5.3절). 성장기에 고르면 `SAVING`으로 바뀐다 (decisions.md 26번) |
| `CAREER` | 직업이 있을 때 | 예 | 불가 | 직장 장면. 직업·나이마다 다르다(decisions.md 51번). 선택지마다 능력치로 성공을 가르고, 결과가 월급 인상분·직장·돈·능력치를 움직인다. 판정과 반영은 진행이 한다 (decisions.md 26번) |
| `TRAIT` | `CHILDHOOD` | 예 | 불가 | 성장기의 일상 장면에서 행동을 고르게 해 성향을 유추한다. 판정으로 뒤집지 않는다 (확정) |
| `TRAINING` | 둘 다 | 예 | 불가 | 자기계발. 비용을 쓰고 능력치 경험치를 얻는 선택지와 "하지 않는다" 선택지가 있다 (확정: 성장 루트) |
| `OFFER` | `SAVING` | 예 | 불가 | 투자 시작 제안. 수락/거절 (확정) |
| `LIFE` | 취업 뒤 | 예 | 불가 | 결혼(`marriage`)·자녀(`child`) 제안. 판정 없음. 수락이면 진행이 가계·자산에 반영 (경제 개편 설계 7.3절) |
| `NOTICE` | 취업 뒤 | 아니오 | — | 지출·수입 알림. **만들어지는 순간 RESOLVED**이고 판은 멈추지 않는다. `ScheduleResult.notice`로 돌려주고 진행이 돈을 반영한다 |
| `NEWS` | `INVESTING` | 예 | **불가** | 매수·매도·관망 선택. 숨은 방향·폭과 **매매 대상 종목** 하나가 있다. `sectorWide`면 충격이 섹터 전체 (확정) |
| `SHAKE` | `INVESTING`, 보유 있음 | 예 | 불가 | 보유 종목 흔들림(인내심 시험). 보유 중 한 종목에 대해 **버틴다(`HOLD`) / 판다(`SELL`, 전량)**. 판정·충격은 뉴스와 같고 힌트·다른 뉴스는 없다 (decisions.md 33번) |
| `LEVERAGE` | `INVESTING`, 든 종목이 크게 빠짐 | 예 | 불가 | 빚투 제안. 가장 많이 빠진 보유 종목에 대해 **대출받아 더 산다(`BORROW`) / 빚은 지지 않는다(`PASS`)**. 판정 없음. 대출·매수는 진행이 한다 (decisions.md 39번) |

- **스킵할 수 있는 것은 알림성(`NOTICE`)뿐이다** (확정). 선택형은 모두 스킵할 수 없다. 뉴스는 선택의 순간이기 때문이다.
- 한 판에서 **대기 중(`PENDING`)인 선택형 이벤트는 최대 하나**다. 선택형을 만나면 `schedule`이 멈추기 때문이다.
- `TRAIT`의 선택은 이탈 판정을 받지 않는다 (확정). 진행은 `Completion.actualOption = chosenOption`으로 넘긴다.

## 5. 규칙

### 5.1 발생 시점 결정

한 번의 `schedule`은 다음을 반복한다.

1. 종류별로 **다음 발생 후보 일수**를 계산한다 (5.2절). `SCHEDULED` 상태로 이미 예약된 연결 뉴스도 후보다.
2. 후보 중 가장 이른 것을 고른다. 같은 날이면 우선순위로 정한다: `JOB` > `OFFER` > `TRAIT` > `NEWS` > `TRAINING` > `NOTICE`.
3. 그 일수가 `toDay`보다 크면 멈춘다. 아니면 이벤트를 만들고(`SCHEDULED`는 `PENDING`으로 바꾸고) `delivered`에 더한다.
4. 만든 이벤트가 선택형이면 거기서 멈추고 `stoppedAtDay`를 그 일수로 한다. 알림성이면 다음 후보로 이어간다.

모든 난수는 **판 시드에서 유도한 키별 생성기**에서 뽑는다 (5.7절). 같은 상태에서 같은 구간으로 다시 불러도 같은 이벤트가 나온다.

### 5.2 종류별 후보 일수

종류별 "마지막 발생 일수"는 그 종류의 가장 최근 이벤트(`occurs_day`)다. 없으면 기준일을 쓴다.

| 종류 | 조건 | 다음 후보 일수 |
|---|---|---|
| `TRAIT` 성장기 | `CHILDHOOD`, 성장 단계가 남음 | 다음 성장 단계의 나이(콘텐츠의 `adult`가 아닌 장면 중 `age`가 같은 것들이 한 단계. 15~24세 10단계)를 게임 일수로 바꾼 값 **+ 반년(180일)**. 시작 나이와 같은 단계가 0일에 바로 뜨지 않게 한다. 장면은 그 단계의 풀에서 `("event", "trait-scene", 단계 번호)` 키로 랜덤하게 하나 뽑는다 |
| `TRAIT` 취업 뒤 | 취업함, 콘텐츠의 `adult` 장면 중 아직 안 나온 것이 있음(`job` 장면은 직장에 다니는 동안에만 — decisions.md 36번) | 마지막 adult `TRAIT`(없으면 취업일) + `event.trait.adult-gap-days`(초기값 540~900) 구간에서 뽑은 값. 장면은 남은 adult 풀에서 `("event","trait-scene","adult",n)` 키로 뽑는다. 성향 확정(`traitsComplete`)에는 세지 않고 능력치만 움직인다 (decisions.md 23번) |
| `JOB` 첫 선택 | `CHILDHOOD`, 성향 이벤트가 모두 끝나 스타일이 확정됨, 직업 없음 | 처음은 `event.job.age`(초기값 25)를 게임 일수로 바꾼 값(마지막 성향 이벤트보다 앞서지 않는다). `WAIT`을 골랐으면 마지막 `JOB` + `event.job.wait-days`(180) |
| `JOB` 재취업 | 취업한 적 있음, 지금 직업 없음, 전업투자자 아님, 은퇴 전, 나이 ≤ `event.career.last-age` | 실직시킨 마지막 `CAREER` + `event.job.rehire-days`(150). 그 뒤 `WAIT`을 골랐으면 마지막 `JOB` + `wait-days` |
| `CAREER` | 직업 있음 또는 전업투자자, 은퇴 전, 나이 ≤ `event.career.last-age`(57) | 직전 결과에 후속이 있으면 마지막 `CAREER` + `followUpDays`. 아니면 `max(지금 직업 시작일, 마지막 CAREER)`(전업투자자는 `max(마지막 JOB, 마지막 CAREER)`) + `event.career.gap-days`(540~1080) 구간에서 뽑은 값(키 `("CAREER", n)`) |
| `OFFER` | `SAVING`, `salaryStarted`, `traitsFinalized`, 대기·예약된 `OFFER` 없음 | 처음이면 `max(현재, 첫 월급 후)`; 거절되었다면 마지막 `OFFER` + `game.days-per-year` (1년마다 다시 묻는다, 확정) |
| `TRAINING` | `JOB`이 해결됨 | 마지막 `TRAINING`(없으면 `JOB` 해결 일수) + `event.training.gap-days` 구간에서 뽑은 값 |
| `LIFE` 결혼 | 취업함, 미혼, 나이 ≤ `marriage-last-age` | 처음은 `marriage-age` 구간의 나이(키 `("event","life","marriage-age")`), 거절했으면 마지막 + `marriage-retry-years`년 |
| `LIFE` 자녀 | 결혼함, 자녀 < `max-children`, 나이 ≤ `child-last-age` | 처음은 결혼일 + `child-first-gap-years`, 그다음은 마지막 자녀 제안 + `child-gap-years` (키 `("event","life","child",n)`) |
| `NOTICE` | 취업함 | 마지막 `NOTICE`(없으면 취업일) + `event.notice.gap-days`. 정의는 `("event","notice",seq)`로 가중치 선택, `requiresMarried`는 결혼 뒤에만 |
| `NEWS` | `INVESTING` | 마지막 뿌리 `NEWS`(없으면 `INVESTING` 시작 일수) + 투자 스타일별 간격 구간에서 뽑은 값 (5.4절) |
| `SHAKE` | `INVESTING`, `heldStockCodes`가 비어 있지 않음 | 마지막 `SHAKE`(없으면 `INVESTING` 시작 일수) + `event.shake.gap-days`(300~600) 구간에서 뽑은 값(키 `("SHAKE", n)`). 종목·장면·숨은 방향(`up-bp`)·폭(`magnitude-bp`)은 `("event","shake",seq)`로 뽑는다 |
| `LEVERAGE` | `INVESTING`, `heldDropBp`에 `event.leverage.drop-bp`(3000) 이상인 종목이 있음 | 마지막 `LEVERAGE` + `event.leverage.gap-days`(720), 없으면 `INVESTING` 시작 일수(지나 있으면 지금). 가장 많이 빠진 종목(같으면 코드순) |
| 연결 뉴스 | `SCHEDULED` 상태 | 예약된 `occurs_day` |

- `OFFER`는 거절하면 다시 묻되, 수락하면 `SAVING`이 끝나므로 더 만들지 않는다.
- `INVESTING` 단계로 넘어가면 아직 남은 `TRAIT`, `OFFER`는 만들지 않는다.
- 판이 `ENDED`이면 아무것도 만들지 않고, 예약된(`SCHEDULED`) 연결 뉴스는 버린다.

### 5.3 선택지 구성

| 종류 | 선택지 |
|---|---|
| `JOB` | 콘텐츠의 직업 중 `event.job.option-count`(초기값 3)개를 가중치대로 뽑는다(키 `("event","job-options",기다린 횟수)`). **기다린 뒤**라면 이번 "기다림 줄"(마지막 `CAREER` 뒤의 `JOB`들)에서 제안된 최고 월급보다 나은 직업을 하나는 섞는다(있다면). 끝에 **`WAIT`("더 나은 자리를 기다린다")**는 기다린 횟수 < `event.job.max-waits`(3)이고 지금 제안보다 월급이 많은 직업이 남아 있을 때만 붙는다. `definition_code`는 첫 선택 null, 기다린 뒤 `retry`, 실직 뒤 `rehire`로 문구(`phrases.json`의 `job`/`jobRetry`/`jobRehire`)를 가른다. 뽑은 코드를 `options`에 저장해 재접속해도 같다 |
| `CAREER` | 지금 직업이 `jobs`에 들고(비었으면 전부) 나이가 `minAge`~`maxAge` 안이며 연차 ≥ `minTenureYears`인 장면 중 직전 장면을 뺀 나머지에서 가중치로 하나(키 `("event","career",seq)`). 그런 장면이 없으면 그 직업의 조건 없는 장면(이직 제안 제외)에서 뽑는다 (decisions.md 51번). 직전 장면의 결과에 `followUp`이 있으면 무엇보다 그 장면을 낸다. 전업투자자는 직업 자리에 `INVEST`를 쓰고 순자산(`minNetWorth`)도 본다 (44번). 이직 제안(`moveJob` 선택지가 있는 장면)은 지금 직업보다 기본 월급이 많은 직업이 있을 때만 나오고, 옮길 직업을 가중치로 골라 선택지 코드 **`move:<직업 코드>`**에 남긴다. 나머지 선택지는 콘텐츠 코드 그대로 |
| `TRAIT` | 콘텐츠의 성향 이벤트 정의가 가진 선택지 전부 (2~4개) |
| `TRAINING` | 콘텐츠의 자기계발 정의 선택지 + 항상 "하지 않는다" 선택지 |
| `OFFER` | `accept`, `decline` |
| `NEWS` | `BUY`, `SELL`, `HOLD`. 보유가 없을 때 `SELL`을 막는 것은 화면이 하고(비활성), 서버는 막지 않는다 (제안) |
| `NOTICE` | 없음 |

### 5.4 뉴스 생성

뿌리 뉴스(연결의 첫 이벤트)를 만들 때:

1. **정의 선택.** 콘텐츠의 `root: true`이고 단계·스타일 조건에 맞는 뉴스 정의를 가중치로 뽑는다. 이어서 **종목**을 그 섹터의 종목(코드순)에서 `nextInt`로 뽑는다. 제목·본문의 `{stock}`은 종목 이름으로 바뀐다. 정의의 `sectorWide`는 충격 범위만 정한다 (매매는 항상 뽑힌 종목).
   - 섹터가 `interestSector`와 같으면 가중치에 `event.news.interest-weight-percent`(초기값 300 = 3배)를 곱한다. 다른 섹터 뉴스도 남는다 (확정 방향).
   - 최근 `event.news.no-repeat-window`(초기값 5)개 안에 나온 같은 정의는 제외한다 (제안).
   - 정의가 `styles`를 지정했으면 그 스타일에만 나온다.
2. **숨은 방향.** 정의의 `directionRule`을 따른다. `FREE`이면 `upBp`(기본 5000) 확률로 `UP`. 뿌리 뉴스는 `FREE`만 쓴다.
3. **변동 폭.** 정의의 `[minBp, maxBp]` 구간에서 균등하게 뽑고, 투자 스타일의 `magnitude-percent`를 곱한다 (정수, 0 방향으로 버림). 기본 구간은 600~3000bp(6~30%)다 (2026-10-24에 두 배로, 상한 35%; decisions.md 65번).
4. **줏대용 다른 뉴스.** `POS`/`NEG`를 50:50으로 뽑고, 콘텐츠의 해당 분위기 문구 중 하나를 고른다.
5. **힌트.** 이벤트를 사용자에게 **보여 줄 때**(`PENDING`이 될 때) `HintProvider.hintFor(truth, seq)`를 불러 방향·강도를 받고, 콘텐츠에서 맞는 문구 하나를 고른다. 고른 문구 코드를 `hint_code`에 저장한다.
   - 힌트는 보여 주는 시점의 안목을 따른다. 예약 시점에 계산하지 않는다 (그 사이 안목이 오를 수 있다).
   - 같은 이벤트를 다시 조회(재접속)할 때는 저장된 `hint_code`를 그대로 쓴다.

### 5.5 투자 스타일별 구성 (확정: 단기는 자주·크게, 장기는 드물고 깊게)

| 설정 (스타일 코드별) | 단기(`short`) | 장기(`long`) | 의미 |
|---|---|---|---|
| `event.style.<코드>.news-gap-days` | 300~390 | 330~420 | 뉴스 간격 구간. 처음 값(15~45 / 60~150)은 40년 동안 뉴스가 단기 약 470번, 장기 약 130번이라 너무 많아 120~240 / 240~480으로 늘렸고, 그래도 "매수·매도가 너무 자주 나온다"는 평가로 **1년에 한 번꼴**로 다시 늘렸다 (decisions.md 30번). 투자 44년 동안 단기 약 46번, 장기 약 42번 |
| `event.style.<코드>.magnitude-percent` | 150 | 100 | 변동 폭 배율 |
| `event.style.<코드>.chain-continue-percent` | 30 | 70 | 연결 뉴스가 이어질 확률 배율 |

- 위 값은 초기값이다. 스타일 코드 목록은 콘텐츠가 정의한다 (decisions.md 남은 질문 B). `short`, `long` 두 개를 가정한다 (제안).
- 스타일이 정해지지 않았거나 설정에 없는 코드이면 `event.style.default.*`를 쓴다 (초기값은 장기와 같다).

### 5.6 뉴스 연결 (확정: 깊이로 엮이고 여러 갈래, 갈래는 실제 행동에 따라)

뉴스 정의는 **이어지는 뉴스(`followups`)** 를 가질 수 있다. 뉴스가 `complete`되면:

1. 실제 행동(`Completion.actualOption`)과 `on`이 맞는 `followups` 항목을 모은다 (`on`이 `*`이면 모든 행동).
2. 모은 항목 중 가중치로 하나를 뽑는다. 항목이 없으면 연결이 끝난다.
3. **이어질 확률.** `항목.continueBp × 스타일 chain-continue-percent / 100` (상한 10000)으로 뽑는다. 실패하면 연결이 끝난다.
4. 이어지는 뉴스를 만든다.
   - 발생 일수 = 현재 게임 일수 + 항목의 `delayDays` 구간에서 균등하게 뽑은 값
   - `parent_event_id`, `chain_code`(뿌리 뉴스의 정의 코드 또는 콘텐츠가 정한 이야기 코드), `depth` = 부모 + 1, `branch_code` = 부모의 실제 행동
   - `status`는 `SCHEDULED`. 숨은 값은 만들 때 정한다
   - 숨은 방향은 항목의 `directionRule`에 따른다: `SAME`(부모와 같음), `OPPOSITE`(반대), `FREE`
   - 섹터는 항목이 지정하지 않으면 부모의 섹터를 이어받는다
5. `depth`가 `event.news.max-chain-depth`(초기값 5)에 이르면 더 잇지 않는다.

- 갈래는 **판정을 거친 실제 행동**으로 정한다 (확정). 이탈이 이후 이야기에 영향을 준다.
- 사용자가 선택(`chosenOption`)한 것은 갈래에 영향을 주지 않는다. 기록만 한다.
- 연결 뉴스는 뿌리 뉴스의 간격 계산에 포함되지 않는다. 연결 뉴스와 뿌리 뉴스가 같은 날이면 우선순위(5.1절)로 순서를 정한다.

### 5.7 난수

판 시드에서 유도하는 키별 생성기를 쓴다 (README 4절의 `SeededRandom`). 같은 키면 항상 같은 값이다.

| 용도 | 키 |
|---|---|
| 종류별 간격 | `("event", 종류, 그 종류의 몇 번째)` |
| 뉴스 정의 선택, 종목, 숨은 값, 변동 폭, 줏대 뉴스 | `("event", "news", seq)` — 이 안에서 뽑는 순서: 정의 → **종목** → 방향 → 폭 → 분위기 → 분위기 문구 |
| 결혼 제안 나이 / 자녀 간격 / 알림 정의 | `("event","life","marriage-age")` / `("event","life","child",n)` / `("event","notice",seq)` |
| 직업 선택지 뽑기 | `("event", "job-options")` |
| 연결 뉴스 | `("event", "followup", 부모의 seq)` — 순서: 항목 선택 → 이어질 확률 → 지연 일수 → 방향 → 폭 |
| 힌트 문구 선택 | `("event", "hint", seq)` |

- `seq`는 판 안에서의 이벤트 생성 순번이며 `event_instance.seq`와 같다. 같은 키가 요청 재시도에서도 같은 값을 만들어, **중복 생성 없이 멱등**하다.
- 이벤트가 이미 만들어져 있으면(`(game_id, seq)` 유니크) 새로 만들지 않고 기존 것을 돌려준다.

### 5.8 해결과 기록

`complete`는 한 트랜잭션 안에서:

1. `event_resolution`에 `(event_id, game_id, choice, actual_action)`을 쓴다. 같은 `event_id`가 있으면 기존 결과를 돌려준다(멱등).
2. `deviations`를 `event_deviation`에 순서(`step`)대로 쓴다.
3. 이벤트 `status`를 `RESOLVED`로, `resolved_at`을 쓴다.
4. 뉴스이면 5.6절대로 연결 뉴스를 예약한다.
5. `TRAIT`이면 콘텐츠의 성향 이벤트가 모두 해결되었는지 확인해 `traitsComplete`를 돌려준다.

`prepareChoice`는 아무것도 바꾸지 않는다. 이벤트가 이 게임의 것이고 `PENDING`이며 선택형이고 `optionCode`가 선택지에 있는지만 검증한다.

### 5.9 스킵

- `skip`은 `NOTICE`에만 쓸 수 있다. 상태를 `SKIPPED`로 바꾼다.
- 스킵하지 않은 `NOTICE`는 전달(delivered) 시점에 `RESOLVED`가 되고, 이후 `skip`은 아무 일도 하지 않는다 (제안). 화면은 알림을 닫기만 해도 된다.

## 6. 콘텐츠에 요구하는 것 (콘텐츠 스펙이 정의할 계약)

이 도메인이 콘텐츠 카탈로그(`ContentCatalog`)에서 읽어야 하는 필드다. 형식은 JSON이다 (확정).

**뉴스 정의**

```json
{
  "code": "semi-capex-1",
  "sector": "semiconductor",
  "root": true,
  "title": "○○반도체, 신규 공장 증설 발표",
  "body": "…",
  "styles": ["short", "long"],
  "weight": 10,
  "magnitude": { "minBp": 300, "maxBp": 1500 },
  "directionRule": { "type": "FREE", "upBp": 5000 },
  "followups": [
    { "on": ["BUY", "HOLD"], "definition": "semi-capex-2a", "delayDays": [30, 90], "continueBp": 8000, "weight": 3 },
    { "on": ["SELL"],        "definition": "semi-capex-2b", "delayDays": [30, 90], "continueBp": 8000, "weight": 1 }
  ]
}
```

| 정의 | 필요한 필드 |
|---|---|
| 뉴스 | 위 JSON의 필드. `styles`가 없으면 모든 스타일 |
| 직업 | `code`, `title`, 선택 가중치, 월급 정보 (진행·자산용, 콘텐츠 스펙). 14개, 월급이 많을수록 가중치가 낮다 |
| 직장 장면 (`careers.json`) | `code`, `title`, `body`, `weight`, `minTenureYears`, `jobs`(나오는 직업 코드, 없으면 전부), `minAge`·`maxAge`(나이 범위, 없으면 제한 없음), `minNetWorth`(순자산 조건), `followUpOnly`(후속으로만 온다), 선택지 2~4개(`code`, `label`, 판정 `stat`·`baseBp`·`perPointBp`(없으면 항상 성공)·`perRaisePercentBp`(지금 직장의 인상분 1%p당 확률 가산), `success`/`fail` 효과: `salaryPercent`, `quit`, `severanceMonths`, `moveJob`, `moveSalaryPercent`, `amount`, `statDeltas`(운 제외), `followUp`·`followUpDays`(이어서 올 장면과 그때까지의 날 수), `becomeJob`(전업투자자가 그 직업의 대표가 된다), `text`). `jobs`에 `INVEST`를 쓰면 전업투자자의 장면이다 |
| 성향 | `code`, `age`, `adult`(선택, true면 취업 뒤 일상 장면), `job`(선택, true면 직장에 다니는 동안에만), 선택지의 `amount`·`outcomes`(선택, 결과가 갈리는 돈·능력치·문구 — decisions.md 41번), `title`, `body`(상황), 선택지 3~4개(`code`, `label`, `traitDeltas`(style/risk/mind/sector), `statDeltas`(선택, 절댓값 ≤ `content.trait-stat-max-delta` 8), `note`) |
| 자기계발 | `code`, `title`, `body`, 선택지 목록(`code`, `label`, `statCode`, `expAmount`, `cost`) |
| 알림 | `code`, `title`, `body`, 단계 조건 |
| 힌트 문구 | 방향(`UP`/`DOWN`/`NEUTRAL`) × 강도(`MILD`/`STRONG`) 별 문구 목록 (poc.md 6절) |
| 다른 뉴스 문구 | 분위기(`POS`/`NEG`) 별 문구 목록 |

- 콘텐츠 로드 시 `followups.definition`이 존재하는지, 연결에 순환이 없는지 등은 **콘텐츠가 검증**한다 (콘텐츠 스펙).

## 7. 설정값 (초기값)

| 이름 | 초기값 | 의미 |
|---|---|---|
| `event.job.age` | 25 | 직업 선택이 오는 나이 (성향 확정 뒤) |
| `event.trait.adult-gap-days` | 540~900 | 취업 뒤 일상 장면(adult) 간격 |
| `event.job.option-count` | 3 | 직업 선택지 개수 (`WAIT` 제외) |
| `event.job.wait-days` | 180 | "기다린다" 뒤 다시 직업 선택이 오기까지 |
| `event.job.max-waits` | 3 | 연속으로 기다릴 수 있는 횟수 |
| `event.job.rehire-days` | 150 | 실직 뒤 다시 직업 선택이 오기까지 |
| `event.career.gap-days` | 540~1080 | 직장 장면 간격 |
| `event.career.last-age` | 57 | 이 나이를 넘으면 직업·직장 이벤트가 없다 |
| `event.training.gap-days` | 120~240 | 자기계발 이벤트 간격 |
| `event.notice.gap-days` | 240~600 | 알림성 이벤트 간격 |
| `event.shake.gap-days` | 300~600 | 보유 종목 흔들림 간격 (보유가 있을 때만) |
| `event.shake.up-bp` | 5500 | 흔들림 뒤 그 종목이 오를 확률 |
| `event.shake.magnitude-bp` | 1000~2500 | 흔들림 뒤 변동 폭 |
| `event.news.interest-weight-percent` | 300 | 관심 섹터 뉴스의 가중치 배율 |
| `event.news.no-repeat-window` | 5 | 같은 정의가 다시 나오지 않는 최근 개수 |
| `event.news.max-chain-depth` | 5 | 연결 뉴스의 최대 깊이 |
| `event.style.<코드>.news-gap-days` | 단기 300~390 / 장기 330~420 | 뉴스 간격, 1년에 한 번꼴 (5.5절) |
| `event.style.<코드>.magnitude-percent` | 단기 150 / 장기 100 | 변동 폭 배율 |
| `event.style.<코드>.chain-continue-percent` | 단기 30 / 장기 70 | 연결 확률 배율 |
| `game.days-per-year` | 360 | 투자 시작 재제안 주기 |

코드에 숫자를 쓰지 않는다 (code-style.md 3.3절). 수치는 체감 테스트 후 조정한다.

## 8. DB

소유 테이블: `event_instance`, `event_resolution`, `event_deviation` (db.md 3.9~3.11절).

**`event_instance` 변경 (db.md에 반영)**

- `status`에 `SCHEDULED`를 추가한다: `SCHEDULED`, `PENDING`, `RESOLVED`, `SKIPPED`.
- `options jsonb` 컬럼을 추가한다. 선택지 코드 목록이며, `JOB`처럼 뽑는 선택지를 재접속해도 같게 보이도록 저장한다.
- 인덱스 `(game_id, status, occurs_day)`를 추가한다. 다음 후보 일수를 빠르게 찾는다.
- `(game_id, kind, occurs_day)` 인덱스를 추가한다. 종류별 마지막 발생을 찾는다.

- 세션 만료 시 `deleteByGame`으로 세 테이블에서 `game_id` 기준으로 지운다.
- 마이그레이션 `V<번호>__event_init.sql`이 테이블 3개와 인덱스를 만든다. FK가 없다.

## 9. 테스트 시나리오

콘텐츠는 테스트용 작은 카탈로그를 쓴다. 난수는 시드 고정 `SeededRandom`을 쓴다.

| # | 입력 | 기대 결과 |
|---|---|---|
| 1 | 15세에 판 시작 | 180일째(15세 중반)에 첫 `TRAIT`. 성장 단계 10개가 끝나면 25세에 `JOB`(선택지 3개). 다음 이벤트 시각을 넘겨 보고해도 판은 그 시각에서 멈춘다 |
| 1-1 | 여러 판을 시작해 첫 성향 장면을 비교 | 판마다 다른 장면이 나온다. 같은 판은 재접속해도 같은 장면이다 |
| 2 | 같은 상태·같은 시드로 `schedule`을 두 번 | 두 결과가 같다. 같은 `event_instance` 행이 하나만 있다(멱등) |
| 3 | `JOB`이 `PENDING`인 채로 다시 `schedule` | 새 선택형을 만들지 않는다. 대기 중인 이벤트가 최대 하나다 |
| 4 | `JOB` 해결 뒤 `SAVING`에서 구간을 길게 | 간격 구간 안에서 `TRAIT`이 나오고 멈춘다. `NOTICE`는 그 전에 섞여 delivered에 들어가고 멈추지 않는다 |
| 5 | `NOTICE`만 있는 구간 | 모두 delivered, `stoppedAtDay = toDay` |
| 6 | `TRAIT`의 선택을 `complete` | `actual = chosen`, `event_deviation` 없음. 마지막 성향이면 `traitsComplete=true` |
| 7 | `salaryStarted=false` | `OFFER`가 나오지 않는다 |
| 8 | `salaryStarted=true`, `traitsFinalized=false` | `OFFER`가 나오지 않는다 (확정) |
| 9 | 둘 다 true | `OFFER`가 나온다. 선택지는 `accept`, `decline` |
| 10 | `OFFER` 거절 후 | 다음 `OFFER` 후보 일수가 거절한 날 + 360 |
| 11 | `INVESTING`에서 `NEWS` | 뉴스가 나온다. 선택지 `BUY/SELL/HOLD`, `skippable=false`, 숨은 값은 `EventView`에 없다 |
| 12 | `INVESTING`이 아닌데 `NEWS` | 나오지 않는다 |
| 13 | 관심 섹터가 있는 상태에서 뉴스 20,000번 생성 | 관심 섹터 뉴스의 비율이 가중치(3배)에 맞게 많다 (허용 오차 ±2%p). 다른 섹터 뉴스도 나온다 |
| 14 | 최근 5개 안에 나온 정의 | 다시 뽑히지 않는다 |
| 15 | 단기와 장기, 뉴스 20,000번 | 평균 간격이 설정 구간 안이고 단기가 짧다. 변동 폭 평균은 단기가 약 1.5배 |
| 16 | 숨은 방향, `FREE`/`upBp=5000` 20,000번 | `UP` 비율이 약 50% (±2%p) |
| 17 | 뉴스 `complete`, 실제 행동 `BUY`, 정의가 `on:["BUY"]`와 `on:["SELL"]`을 가짐 | `BUY` 쪽 항목만 후보가 된다. `branch_code=BUY`로 연결 뉴스가 `SCHEDULED`로 생긴다 |
| 18 | 같은 상황에서 선택은 `BUY`지만 실제 행동은 `HOLD` | `HOLD`에 맞는 항목을 쓴다. 선택은 기록만 된다 |
| 19 | 항목이 하나도 맞지 않음 | 연결이 끝난다. 후속 이벤트가 없다 |
| 20 | `chain-continue` 확률이 0 | 연결 뉴스가 생기지 않는다. 100%이면 항상 생긴다 |
| 21 | `depth`가 최대 깊이 | 더 이어지지 않는다 |
| 22 | `directionRule=SAME`/`OPPOSITE` | 부모의 숨은 방향과 같음/반대 |
| 23 | `SCHEDULED` 뉴스의 발생 일수가 구간 안 | `PENDING`으로 바뀌어 delivered에 들어간다. 그 전에는 `delivered`에 없다 |
| 24 | 뉴스가 `PENDING`이 될 때 | `HintProvider`가 불려 `hint_code`가 저장된다. 같은 이벤트를 다시 조회하면 같은 문구 |
| 25 | `skip`을 `NOTICE`에 | 정상. 뉴스, `JOB` 등 선택형에 부르면 오류 |
| 26 | `complete`를 같은 이벤트에 두 번 | 두 번째는 기존 결과를 돌려주고 중복 기록하지 않는다(멱등) |
| 27 | `prepareChoice`에 없는 선택지, 다른 게임의 이벤트, 이미 해결된 이벤트 | 각각 오류 |
| 28 | `pending` | 대기 중인 선택형이 있으면 `EventView`를 돌려주고 없으면 비어 있다. 응답에 숨은 값이 없다 |
| 29 | `deviationCounts` | 능력치별 이탈 횟수가 맞다 |
| 30 | 판이 `ENDED` | 새 이벤트를 만들지 않고 예약된 연결 뉴스를 버린다 |
| 31 | 같은 우선순위 충돌: 같은 날 `JOB`과 `NOTICE` | `JOB`이 먼저, 그 뒤 멈춘다 |
| 32 | `deleteByGame` 후 `pending` | 비어 있다 |

확률 시나리오(13, 15, 16)는 한 번의 결과로 단언하지 않고 대량 반복으로 비교한다.

## 10. 완료 조건

1. 공개 인터페이스 9개가 위 시나리오를 통과한다.
2. 콘텐츠 외 다른 도메인을 호출하지 않고, 자기 접두사(`event_`) 테이블만 읽고 쓴다 (ArchUnit).
3. 난수는 모두 `SeededRandom`의 키별 생성기를 쓰고, 현재 시각을 읽지 않는다.
4. `EventView`와 모든 클라이언트 응답용 타입에 숨은 방향, 변동 폭, 시드가 없다 (타입으로 보장하고 테스트로 확인한다).
5. `schedule`과 `complete`는 여러 번 불러도 같은 결과를 내고 중복 행을 만들지 않는다.
6. 한 판에서 대기 중인 선택형 이벤트가 둘 이상이 되지 않는다.
7. 수치는 모두 설정에서 읽는다.
8. 마이그레이션이 테이블 3개와 인덱스를 만든다. FK가 없다.

## 11. 미결정

| # | 질문 |
|---|---|
| 1 | 투자 스타일 코드 목록과 스타일별 구성 수치 (콘텐츠, 체감 테스트) |
| 2 | 성향 이벤트의 개수와 순서 (콘텐츠 분량) |
| 3 | `TRAINING`의 비용과 효과 수치, `NOTICE`의 종류 (콘텐츠) |
| 4 | 뉴스가 나오는 간격이 시각 보고 구간(`nextEventDay`)과 잘 맞는지 (구현 후 조정) |
| 5 | 보유가 없을 때 `SELL` 선택지를 서버가 막을지 (현재 화면이 막고 서버는 자산의 `NOTHING_TO_SELL`로 처리) |
| 6 | 연결 뉴스가 다른 섹터로 이어지는 경우를 허용할지 (현재 정의가 지정하면 허용) |
| 7 | 이벤트 개수의 상한 (한 판의 총 이벤트가 너무 많거나 적지 않도록 하는 장치) |
