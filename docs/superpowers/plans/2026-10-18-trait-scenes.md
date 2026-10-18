# 상황극 성향 질문과 투자자 유형 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 성장기 6단계의 2지선다 밸런스 게임을 3~4 선택지 상황극 24장면으로 바꾸고, 선택이 네 축(기간·위험·소신·관심)과 능력치를 움직여 21세에 투자자 유형 8종 중 하나가 정해지게 한다.

**Architecture:** 콘텐츠(`traits.json`, `meta.json`)가 장면·축·유형을 정의하고 서버 시작 시 검증한다. 캐릭터 도메인이 축 점수 누적·능력치 즉시 변경·유형 확정을 맡고, 진행이 결과를 인생 기록(`GROWTH reason=TRAIT`, `STYLE` 확장)과 `GameView.investorType`으로 내보낸다. 클라이언트는 문구와 신원 카드 한 줄만 바뀐다.

**Tech Stack:** Java 21 / Spring Boot 4 / JdbcClient / Flyway / Testcontainers(Postgres) · React 19 / TypeScript / Zustand / Vitest / Playwright · OpenAPI 3.1 (`contracts/openapi/game.yaml` → `pnpm gen:api`)

**Spec:** `docs/superpowers/specs/2026-10-18-economy-redesign-design.md` 4절 (4.1~4.5), 10절의 `investorType`·`STYLE`·`GROWTH` payload, 11.5절 신원 카드·문구

## Global Constraints

- 수치는 코드에 쓰지 않고 설정(`application.yml`)이나 콘텐츠에서 읽는다 (code-style.md 3.3절).
- 난수는 `RandomGenerator`를 인자로 받고, 동점 처리는 코드 이름순 정렬 뒤 `nextInt(후보 수)` (character.md 4.3절).
- 다른 도메인의 `internal`을 import하지 않는다. 진행만 도메인을 호출한다. `DomainBoundaryTest`가 강제한다.
- 마이그레이션 파일명 `V<yyyyMMddHHmm>__<도메인>_<설명>.sql`, FK 금지, 테이블 접두사 = 도메인 (`MigrationRulesTest`).
- 서버 코드는 `./gradlew spotlessApply`(google-java-format)를 통과해야 한다. 웹은 `pnpm check`(Biome)와 `pnpm exec tsc -b`.
- `initialStats`(태어날 때 값)는 바꾸지 않는다. 별명은 그대로다. 운(`luck`)은 어떤 경로로도 바뀌지 않는다.
- 선택지 라벨은 18자 안쪽. 선택을 비웃는 문구 금지. 실제 인물·회사명 금지.
- 기존 E2E `data-testid`(`style`, `job`, `outcome-message`, `event-card`, `life-log-line` 등) 유지.
- 커밋 메시지는 한글, 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

- 한 장면에서 능력치가 5 미만이거나 95 초과로 가지 않는다: 능력치 6에 `-3`을 두 번 받아도 5에서 멈춘다 (Task 3 테스트).
- 위험·소신 축 점수가 전혀 없는 판에서도 `finalizeTraits`가 오류 없이 난수로 유형을 정한다 (Task 3 테스트).
- 콘텐츠에 유형 8종 중 하나가 빠지면 서버가 **시작 단계에서** 실패한다. 게임 중 `investorType(code)`가 null을 돌려주지 않는다 (Task 1 테스트).
- 재접속(`GET /current`) 뒤에도 `investorType`이 응답에 있다 (Task 5 `GameFlowTest`).
- 서버가 보낸 `GROWTH` payload에 `reason`이 없어도(옛 기록) 클라이언트 문구가 깨지지 않고 "경험으로"로 보인다 (Task 6 `log.test.ts`).

---

### Task 1: 콘텐츠 형식 — 선택지 `statDeltas`, 축·유형 정의, 검증

**Files:**
- Modify: `server/src/main/java/investorgame/content/TraitDefinition.java`
- Modify: `server/src/main/java/investorgame/content/ContentCatalog.java`
- Modify: `server/src/main/java/investorgame/content/internal/JsonContentCatalog.java`
- Create: `server/src/main/java/investorgame/content/InvestorType.java`
- Create: `server/src/main/java/investorgame/content/internal/ContentProperties.java`
- Modify: `server/src/main/resources/application.yml` (`content.trait-stat-max-delta: 3`, `content.trait-options.min: 3`, `content.trait-options.max: 4`)
- Modify: `content/meta.json` (`risks`, `minds`, `investorTypes` 추가)
- Modify: `content/traits.json` (기존 30장면에 임시로 `statDeltas` 없이도 로드되게 두되, Task 2에서 전부 교체)
- Test: `server/src/test/java/investorgame/content/internal/JsonContentCatalogTest.java` (새 파일)

**Interfaces:**
- Produces:
  - `TraitDefinition.Option(String code, String label, Map<String,Integer> traitDeltas, Map<String,Integer> statDeltas, String note)` — `statDeltas`는 JSON에 없으면 빈 맵 (compact constructor에서 `null → Map.of()`).
  - `public record InvestorType(String code, String name, String description) {}`
  - `ContentCatalog`: `List<NamedCode> risks()`, `List<NamedCode> minds()`, `String riskName(String code)`, `String mindName(String code)`, `InvestorType investorType(String code)` (없으면 `IllegalArgumentException`), `List<InvestorType> investorTypes()`.
  - 유형 코드 형식: `"{styleCode}-{riskCode}-{mindCode}"` 예 `long-safe-own`.
  - 점수 키 접두사: `style.`, `sector.`(기존), `risk.`, `mind.`(신규).

- [ ] **Step 1: 실패하는 테스트 작성** — `JsonContentCatalogTest`는 `new JsonContentCatalog(JsonMapper.builder().build(), new ContentProperties(3, new ContentProperties.Range(3, 4)))`로 실제 콘텐츠를 로드한다 (같은 패키지라 package-private 생성자 접근 가능). 콘텍스트 없이 돈다.

```java
@Test void 투자자_유형은_기간_위험_소신_조합_8개가_모두_있다() {
  var catalog = load();
  for (var s : catalog.styles()) for (var r : catalog.risks()) for (var m : catalog.minds())
    assertThat(catalog.investorType(s.code() + "-" + r.code() + "-" + m.code()).name()).isNotBlank();
  assertThat(catalog.investorTypes()).hasSize(8);
}
@Test void 성향_장면은_단계마다_있고_선택지가_3개에서_4개다() {
  var catalog = load();
  assertThat(catalog.traitStages()).hasSize(6);
  for (var t : catalog.traits()) assertThat(t.options()).hasSizeBetween(3, 4);
}
@Test void 모든_선택지는_기간과_관심을_드러내고_statDeltas는_허용_키와_범위_안이다() {
  for (var t : load().traits()) for (var o : t.options()) {
    assertThat(o.traitDeltas().keySet()).anyMatch(k -> k.startsWith("style.")).anyMatch(k -> k.startsWith("sector."));
    assertThat(o.statDeltas().keySet()).doesNotContain("luck").allMatch(StatCodes.ALL::contains);
    assertThat(o.statDeltas().values()).allMatch(v -> Math.abs(v) <= 3);
  }
}
@Test void 유형이_하나_빠진_콘텐츠는_로드에_실패한다()  // 임시 JsonMapper로 meta를 읽어 investorTypes 하나를 지운 뒤 validate가 IllegalStateException을 던지는지. 파일을 직접 고치지 않고 Meta record를 만들어 검증 메서드를 호출할 수 있게 validate를 정적 메서드로 분리해도 된다.
```

`ContentCatalog.styles()`가 없으면 `List<NamedCode> styles()`도 더한다 (`meta.styles`).

- [ ] **Step 2: 테스트 실행, 실패 확인** — `cd server && ./gradlew test --tests 'investorgame.content.*'` → 컴파일 오류(메서드 없음).

- [ ] **Step 3: 구현**
  - `ContentProperties(int traitStatMaxDelta, Range traitOptions)` + `record Range(int min, int max)`, `@ConfigurationProperties("content")`. `JsonContentCatalog` 생성자에 주입.
  - `Meta`에 `List<NamedCode> risks, minds; List<InvestorType> investorTypes` 추가.
  - `validate()`에 추가: 선택지 개수 범위, `risk.`/`mind.` 키는 `risks`/`minds`에 있는 코드만, `statDeltas` 키는 `StatCodes.ALL` 중 `luck` 제외, 절댓값 ≤ `traitStatMaxDelta`, 유형 8조합 모두 존재·중복 없음.
  - `content/meta.json`에 `risks: [{bold,공격},{safe,안정}]`, `minds: [{own,소신},{crowd,추종}]`, `investorTypes` 8개(이름·설명은 Task 2에서 다듬어도 되지만 지금 8개 모두 넣는다). 초안: `short-bold-own 불꽃 승부사`, `short-bold-crowd 소문 따라 단타족`, `short-safe-own 계산기 트레이더`, `short-safe-crowd 눈치 빠른 메뚜기`, `long-bold-own 역발상 농사꾼`, `long-bold-crowd 밀물 타는 선장`, `long-safe-own 느긋한 농부`, `long-safe-crowd 안전 제일 적립왕`. 설명은 한 문장 (예: 느긋한 농부 — "서두르지 않고, 남 말보다 제 눈을 믿는다.").
  - 기존 `traits.json`은 선택지가 2개라 새 검증(3~4)에 걸린다. Task 2가 교체하므로 **이 태스크에서는 검증 하한을 임시로 낮추지 말고**, Task 1과 Task 2를 같은 PR 단위로 보되 커밋은 Task 2에서 테스트가 통과한 뒤 한다. (Task 1 끝에서는 `투자자_유형…` 테스트만 통과하면 된다.)

- [ ] **Step 4: 유형 테스트만 통과 확인** — `./gradlew test --tests 'investorgame.content.internal.JsonContentCatalogTest.투자자_유형*'` → PASS. 장면 테스트는 Task 2 뒤 통과.

### Task 2: 콘텐츠 작성 — 상황극 24장면

**Files:**
- Rewrite: `content/traits.json`
- Modify: `content/meta.json` (유형 설명 다듬기)
- Test: Task 1의 `JsonContentCatalogTest` 전부

**Interfaces:**
- Consumes: Task 1의 JSON 형식.
- 장면 코드 형식 `k{나이}-{영문-slug}`. 단계당 4장면 × 6단계 = 24.

- [ ] **Step 1: 장면 24개를 쓴다.** 아래 전제(한 줄)를 쓰되 문구는 자유. 본문 2~3문장, 선택지 3~4개, 라벨 18자 이내, `note` 한 줄. 각 선택지의 `traitDeltas`에 `style.*` 하나와 `sector.*` 하나는 반드시, `risk.*`/`mind.*`는 선택지 중 절반 이상에, `statDeltas`는 장면당 1~2개 선택지에만(±1~2, 운 금지). 한 단계의 4장면을 합치면 네 축 모두 양쪽 값이 적어도 한 번씩 나오게 한다.

| 나이 | 전제 |
|---|---|
| 6 | 유치원 간식: 지금 하나 vs 10분 뒤 둘, 혹은 친구와 나눠 셋 · 놀이터에서 아무도 안 타는 높은 미끄럼틀 · 뽑기 기계 앞 500원 · 할머니가 준 용돈 봉투 |
| 9 | 반 친구들이 전부 모으는 딱지, 나만 없다 · 학교 앞 문방구에 새 게임기가 나왔다 · 과학의 날 발명품 주제 고르기 · 친구가 "비밀인데 선생님이 쪽지시험 낸대" |
| 12 | 반 친구가 "엄마 몰래 코인 샀는데 3배 됐다"고 자랑한다 · 생일 선물로 받은 10만 원 · 학급 바자회 가게 메뉴 정하기 · 유튜브에서 본 "이것만 사면 부자" 영상 |
| 15 | 아빠가 "주식 하나 골라 보라"며 5만 원을 준다 · 친구들이 다 산 패딩이 내 용돈 석 달치 · 동아리 선택(과학·경제·게임 제작·요리) · 할인 끝나기 10분 전 장바구니 |
| 18 | 첫 알바 월급 60만 원 · 수능 끝나고 다 같이 떠나는 여행 vs 혼자 계획 · 친척이 "내 회사 비상장 주식 사 둘래?" · 대학 전공 선택 |
| 21 | 군대/휴학 중 모은 300만 원 · 룸메이트가 "코인 지금이 바닥이래" · 스타트업 인턴 vs 대기업 인턴 · 교수님이 투자 동아리 창립 멤버를 뽑는다 |

예시(완성형, 이 톤으로):

```json
{ "code": "k12-friend-coin", "age": 12,
  "title": "반 친구가 \"엄마 몰래 코인 샀는데 3배 됐다\"고 자랑한다",
  "body": "점심시간 내내 그 얘기다. 너도 명절에 받은 용돈 15만 원이 서랍에 있다.",
  "options": [
    { "code": "follow", "label": "나도 당장 따라 산다",
      "traitDeltas": { "style.short": 2, "risk.bold": 2, "mind.crowd": 2, "sector.finance": 1 },
      "statDeltas": { "courage": 1, "patience": -1 },
      "note": "남이 벌었다는 말에 심장이 먼저 뛰었다" },
    { "code": "research", "label": "일주일 찾아보고 결정한다",
      "traitDeltas": { "style.long": 1, "risk.bold": 1, "mind.own": 2, "sector.finance": 1 },
      "statDeltas": { "insight": 1 },
      "note": "뛰어들기 전에 알아봐야 마음이 놓인다" },
    { "code": "console", "label": "갖고 싶던 게임기를 산다",
      "traitDeltas": { "style.short": 1, "risk.safe": 1, "mind.own": 1, "sector.game": 2 },
      "note": "확실한 즐거움이 불확실한 돈보다 좋았다" },
    { "code": "ignore", "label": "저금통에 넣고 못 들은 척한다",
      "traitDeltas": { "style.long": 2, "risk.safe": 2, "mind.own": 1, "sector.food": 1 },
      "statDeltas": { "patience": 1 },
      "note": "흔들리지 않았다. 재미도 없었다" } ] }
```

- [ ] **Step 2: 검증 테스트 전부 통과** — `./gradlew test --tests 'investorgame.content.*'` → PASS (장면 수 24, 선택지 3~4, 축 규칙).

- [ ] **Step 3: 서버 전체 테스트** — `./gradlew spotlessApply test` → 기존 `GameFlowTest`가 `options[0]`로 답하므로 여전히 통과해야 한다.

- [ ] **Step 4: 커밋**

```bash
git add content/ server/src/main server/src/test
git commit -m "feat: 성향 질문을 상황극 24장면으로 교체하고 축·유형·statDeltas 콘텐츠 검증 추가"
```

### Task 3: 캐릭터 — 축 점수, 능력치 흔들기, 유형 확정

**Files:**
- Modify: `server/src/main/java/investorgame/character/CharacterService.java`
- Modify: `server/src/main/java/investorgame/character/CharacterView.java`
- Modify: `server/src/main/java/investorgame/character/TraitResult.java`
- Modify: `server/src/main/java/investorgame/character/internal/JdbcCharacterService.java`
- Modify: `server/src/main/java/investorgame/character/internal/CharacterProperties.java` (+`TraitStat(int min)`)
- Modify: `server/src/main/resources/application.yml` (`character.trait-stat.min: 5`)
- Create: `server/src/main/resources/db/migration/V202610190001__character_profile_axes.sql`
- Test: `server/src/test/java/investorgame/character/CharacterServiceTest.java`

**Interfaces:**
- Produces:
  - `List<StatChange> recordTraitChoice(UUID gameId, Map<String,Integer> traitDeltas, Map<String,Integer> statDeltas, int gameDay)` — 점수 누적 + 능력치 즉시 변경(범위 `[trait-stat.min, growth.max-stat]`로 클램프, `luck` 키는 무시) + 바뀐 능력치마다 `character_stat_log(reason='TRAIT', event_id=null)`. 값이 실제로 바뀐 능력치만 `StatChange(statCode, expGained=0, before, after)`로 돌려준다.
  - `TraitResult finalizeTraits(UUID gameId, RandomGenerator rng)` → `TraitResult(String investmentStyle, String riskProfile, String mindProfile, String interestSector, String investorTypeCode)`. `risk.`/`mind.` 점수가 없으면 후보 전체(`bold,safe` / `crowd,own` — 코드 이름순)에서 난수. 난수 순서: style → risk → mind → sector (각각 `top()` 한 번씩, 없을 때도 `nextInt`를 뽑아 순서를 고정).
  - `CharacterView`에 `String riskProfile, String mindProfile, String investorType` 추가 (확정 전 null).
  - 유형 코드는 `investmentStyle + "-" + riskProfile + "-" + mindProfile`.
  - 축 후보 코드 목록은 캐릭터가 콘텐츠를 읽을 수 없으므로 **`finalizeTraits`가 두 번째 인자로 `TraitAxes axes`를 받는다**: `public record TraitAxes(List<String> risks, List<String> minds) {}` (character 패키지, 진행이 콘텍츠에서 코드 목록을 꺼내 넘긴다). 시그니처: `TraitResult finalizeTraits(UUID gameId, TraitAxes axes, RandomGenerator rng)`.

- [ ] **Step 1: 실패하는 테스트** (`CharacterServiceTest`에 추가)

```java
@Test void 성향_선택이_능력치를_즉시_움직이고_범위를_벗어나지_않는다() {
  // 시드로 만든 캐릭터의 courage를 알고 있다. statDeltas {courage:+2, luck:+3}
  var changes = characters.recordTraitChoice(gameId, Map.of("style.long", 1, "sector.food", 1), Map.of("courage", 2, "luck", 3), 1800);
  assertThat(changes).extracting(StatChange::statCode).containsExactly("courage");
  assertThat(characters.get(gameId).stats().courage()).isEqualTo(before.courage() + 2);
  assertThat(characters.get(gameId).stats().luck()).isEqualTo(before.luck());
  assertThat(characters.get(gameId).initialStats()).isEqualTo(before);
}
@Test void 능력치는_하한_5와_상한_95에서_멈춘다()  // -3을 40번 → 5, +3을 40번 → 95. 변하지 않은 호출은 빈 목록
@Test void 유형은_네_축_점수로_정해진다() {
  characters.recordTraitChoice(gameId, Map.of("style.long", 3, "risk.safe", 2, "mind.own", 1, "sector.food", 2), Map.of(), 1800);
  var r = characters.finalizeTraits(gameId, AXES, new SplittableRandom(1));
  assertThat(r).isEqualTo(new TraitResult("long", "safe", "own", "food", "long-safe-own"));
  assertThat(characters.get(gameId).investorType()).isEqualTo("long-safe-own");
}
@Test void 위험_소신_점수가_없으면_난수로_정하되_같은_시드면_같다()  // style/sector만 누적 → 두 캐릭터, 같은 시드 → risk/mind 동일, 둘 다 후보 안
```

`AXES = new TraitAxes(List.of("bold","safe"), List.of("crowd","own"))`.

- [ ] **Step 2: 실패 확인** — `./gradlew test --tests 'investorgame.character.*'` → 컴파일 오류.

- [ ] **Step 3: 마이그레이션 + 구현** — SQL: `ALTER TABLE character_profile ADD COLUMN risk_profile TEXT, ADD COLUMN mind_profile TEXT, ADD COLUMN investor_type TEXT;`. `recordTraitChoice`는 능력치별로 `UPDATE character_stat SET value = :v` 후 `logChange` 재사용(reason은 `GrowthSource`가 아니라 문자열을 받도록 `logChange(gameId, statCode, delta, reason, eventId, gameDay)`로 시그니처를 바꾼다). `finalizeTraits`는 `top(scores, prefix, candidatesWhenEmpty, rng)`로 일반화.

- [ ] **Step 4: 통과 확인** — `./gradlew test --tests 'investorgame.character.*'` → PASS. 전체 빌드는 진행이 아직 옛 시그니처를 부르므로 Task 5까지 깨진다. 그래서 **Task 3·4·5는 한 커밋**으로 묶는다.

### Task 4: 이벤트 — 성향 티켓에 `statDeltas`

**Files:**
- Modify: `server/src/main/java/investorgame/event/ChoiceTicket.java` (`Trait(Map<String,Integer> traitDeltas, Map<String,Integer> statDeltas, String note)`)
- Modify: `server/src/main/java/investorgame/event/internal/DefaultEventService.java` (`prepareChoice`의 TRAIT 분기에서 `chosen.statDeltas()` 전달)

- [ ] **Step 1: 구현** — 두 줄 수정. 테스트는 Task 5의 `GameFlowTest`가 덮는다.

### Task 5: 진행·계약 — 유형 노출, `GROWTH reason`, `STYLE` 확장

**Files:**
- Modify: `contracts/openapi/game.yaml`
- Modify: `server/src/main/java/investorgame/progress/GameView.java`
- Modify: `server/src/main/java/investorgame/progress/ChoiceOutcome.java` (`Growth(String statCode, int before, int after, String reason)`)
- Modify: `server/src/main/java/investorgame/progress/internal/DefaultProgressService.java`
- Test: `server/src/test/java/investorgame/api/GameFlowTest.java`
- Run: `cd web && pnpm gen:api` (타입 재생성, `src/api/schema.d.ts` 커밋)

**Interfaces:**
- Consumes: Task 3 `recordTraitChoice`, `finalizeTraits(gameId, TraitAxes, rng)`, Task 1 `content.risks()/minds()/investorType()`.
- Produces (계약):
  ```yaml
  InvestorType: { type: object, required: [code, name, description], properties: { code, name, description: string } }
  Game.investorType: oneOf [InvestorType, null]
  Game.riskProfile, Game.mindProfile: oneOf [Named, null]
  Outcome.growth.items: required [statCode, before, after, reason]; reason enum [DEVIATION, TRAIT]
  ```
  `GameView`에 `InvestorType investorType, Named riskProfile, Named mindProfile` 추가 (`record InvestorType(String code, String name, String description)` 중첩).
- 인생 기록: `STYLE` payload = `{styleCode, styleName, riskCode, mindCode, investorTypeCode, investorTypeName}`; `GROWTH` payload = `{statCode, before, after, reason}` (뉴스 이탈 성장도 `reason: "DEVIATION"`을 넣는다).
- 성향 결과 메시지(마지막 장면): `"%s\n\n자라 온 날들을 돌아보니 당신은 '%s'형 투자자다. %s 관심이 가는 분야는 %s."` (note, 유형 이름, 유형 설명, 섹터 이름). 중간 장면은 note만 (기존).

- [ ] **Step 1: 실패하는 테스트** — `GameFlowTest.성장기_…` 끝에 추가:

```java
assertThat(game.read("$.investorType.code", String.class)).matches("(short|long)-(bold|safe)-(own|crowd)");
assertThat(game.read("$.investorType.name", String.class)).isNotBlank();
assertThat(game.read("$.riskProfile.code", String.class)).isIn("bold", "safe");
List<Map<String,Object>> styles = game.read("$.log[?(@.kind=='STYLE')].payload");
assertThat(styles).hasSize(1); assertThat(styles.get(0)).containsKeys("investorTypeCode", "investorTypeName", "riskCode", "mindCode");
List<Map<String,Object>> growth = game.read("$.log[?(@.kind=='GROWTH')].payload");
assertThat(growth).allSatisfy(p -> assertThat(p.get("reason")).isIn("DEVIATION", "TRAIT"));
assertThat(reloaded.read("$.investorType.code", String.class)).isNotNull();   // 재접속 뒤에도
```
그리고 성향 선택 결과에 성장이 실릴 수 있으므로 `responses`를 돌며 `$.outcome.growth[*].reason`이 있으면 `TRAIT`/`DEVIATION` 중 하나인지 확인.

- [ ] **Step 2: 실패 확인** — `./gradlew test --tests 'investorgame.api.GameFlowTest'` → FAIL (`investorType` 경로 없음).

- [ ] **Step 3: 구현** — `choose`의 `Trait` 분기: `characters.recordTraitChoice(gameId, trait.traitDeltas(), trait.statDeltas(), ticket.occursDay())` → 각 변화마다 `logs.append(... "GROWTH", {statCode, before, after, reason: "TRAIT"})`; 결과 `Outcome.growth`에 담는다(`simpleOutcome`에 growth 인자 추가). 마지막 장면이면 `finalizeTraits(gameId, new TraitAxes(codes(content.risks()), codes(content.minds())), random.forKey("character","traits"))` → `STYLE` 로그 확장 → 메시지. `view()`에 유형 세 필드. `resolveNews`의 GROWTH에 `reason: "DEVIATION"`.

- [ ] **Step 4: 통과 확인** — `./gradlew spotlessApply test` → 전부 PASS. `cd web && pnpm gen:api && pnpm exec tsc -b` → 타입 통과(아직 클라이언트는 새 필드를 안 쓴다).

- [ ] **Step 5: 커밋 (Task 3·4·5 묶음)**

```bash
git add contracts server web/src/api/schema.d.ts
git commit -m "feat: 네 축 성향 점수와 투자자 유형 확정, 성향 선택의 능력치 변화를 기록·응답에 담기"
```

### Task 6: 클라이언트 — 유형 표시와 문구

**Files:**
- Modify: `web/src/features/game/IdentityCard.tsx` (`스타일` 줄 → `유형` 줄: `{investorType.name} · {investmentStyle.name}`; `data-testid="style"`는 이 `<dd>`에 그대로. 확정 전 `아직 모름`)
- Modify: `web/src/features/game/log.ts` (`STYLE`: `'{investorTypeName}'형 투자자로 자랐다. 관심 분야는 {sectorName}.` — 섹터는 같은 응답의 `game.interestSector?.name`을 쓴다; `GROWTH`: `reason === 'TRAIT'` → `그 선택으로 {능력치} {before} → {after} ↑`, 아니면 기존 `경험으로 …`)
- Modify: `web/src/features/game/OutcomeCard.tsx` (뉴스가 아닌 결과에도 `outcome.growth` 줄을 보여 준다. 문구는 `log.ts`와 같은 규칙; 공통 함수 `growthText(statCode, before, after, reason)`를 `labels.ts`에 두고 둘 다 쓴다)
- Modify: `web/src/features/game/DecisionCard.tsx` (TRAIT일 때 바닥 문구 `성장기의 선택은 성격에 뒤집히지 않습니다. 고른 대로 자랍니다.`)
- Modify: `web/src/features/game/LifeRecord.tsx` (직업 옆 `{investorType?.name ?? '유형 미정'}`)
- Test: `web/src/features/game/log.test.ts`, `web/e2e/game.spec.ts`

**Interfaces:**
- Consumes: `Game.investorType`, `Game.riskProfile`, `Game.mindProfile`, `Outcome.growth[].reason`, `LogEntry.payload.reason`.

- [ ] **Step 1: 실패하는 단위 테스트** (`log.test.ts`)

```ts
it('성향으로 능력치가 움직인 기록은 "그 선택으로"로 쓴다', () => {
  expect(logLine(entry('GROWTH', { statCode: 'courage', before: 41, after: 42, reason: 'TRAIT' }), game).text).toBe('그 선택으로 용기 41 → 42 ↑')
})
it('reason이 없는 옛 기록은 "경험으로"로 쓴다', () => {
  expect(logLine(entry('GROWTH', { statCode: 'courage', before: 41, after: 42 }), game).text).toBe('경험으로 용기 41 → 42 ↑')
})
it('STYLE 기록은 유형 이름을 쓴다', () => {
  expect(logLine(entry('STYLE', { styleName: '장기 투자자', investorTypeName: '느긋한 농부' }), { ...game, interestSector: { code: 'food', name: '식품' } }).text)
    .toBe("'느긋한 농부'형 투자자로 자랐다. 관심 분야는 식품.")
})
```
`logLine`의 `GameInfo`에 `interestSector`를 더한다(`Pick<Game, ... | 'interestSector'>`).

- [ ] **Step 2: 실패 확인** — `cd web && pnpm test` → FAIL.

- [ ] **Step 3: 구현** — 위 파일들. `IdentityCard`의 `<dt>`를 `유형`으로.

- [ ] **Step 4: E2E 수정** — `game.spec.ts`의 성장기 테스트에 추가: TRAIT 카드가 보일 때 `eventCard(page).getByRole('button')`가 3개 이상(`toHaveCount` 대신 `expect(await ….count()).toBeGreaterThanOrEqual(3)`). 직업 뒤 `style`이 `아직 모름`이 아닌 것은 기존 단언으로 충분.

- [ ] **Step 5: 검증** — `pnpm check && pnpm exec tsc -b && pnpm test` → PASS. `pnpm e2e` (Docker 필요) → PASS.

- [ ] **Step 6: 커밋**

```bash
git add web
git commit -m "feat: 신원 카드에 투자자 유형, 성향 선택의 능력치 변화 문구"
```

### Task 7: 문서 정리

**Files:**
- Modify: `docs/specs/character.md` (4.3절 네 축·유형, `recordTraitChoice` 시그니처, `TraitAxes`, 테이블 컬럼 3개)
- Modify: `docs/decisions.md` ("스펙을 쓰며 확정된 것"의 성향 줄을 상황극으로 갱신)
- Modify: `docs/db.md` (`character_profile` 컬럼)

- [ ] **Step 1: 세 문서를 코드와 맞춘다. 커밋** — `docs: 성향 상황극과 투자자 유형을 스펙·결정 기록에 반영`
