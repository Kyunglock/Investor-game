# 화면 전면 개편 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** '80억 분의 1' 톤의 문서형 화면, 별명·나이에 따라 바뀌는 도트 캐릭터, 서버가 기록하는 인생 기록·연간 자산을 갖춘 클라이언트로 교체한다.

**Architecture:** 서버는 진행 도메인만 바뀐다. 진행이 이미 조율하는 각 사건 자리에서 자기 테이블 `progress_log`·`progress_year`에 기록하고 `GameView`(= API `Game`)에 `log`, `yearly`로 실어 보낸다. 클라이언트는 색·글꼴 변수와 문서 양식 위에 카드 컴포넌트를 새로 짜고, 캐릭터와 장면은 코드 안의 문자 지도(string map)를 SVG로 그린다. 문구는 전부 클라이언트(`labels.ts`, `log.ts`)가 만들고 서버는 코드와 숫자만 준다.

**Tech Stack:** Spring Boot + JdbcClient + Flyway (server), OpenAPI 계약 → openapi-typescript, React 19 + Zustand + Tailwind v4 + Vitest + Playwright (web), `@fontsource` 글꼴 패키지.

**Spec:** `docs/superpowers/specs/2026-10-18-ui-redesign-design.md` (목업: `docs/superpowers/specs/2026-10-18-ui-redesign/*.html`)

## Global Constraints

- 레트로 UI 금지: 픽셀 폰트, 각진 두꺼운 테두리, 격자 바탕을 쓰지 않는다. 도트는 캐릭터·장면 그림에만 (스펙 2절).
- 색 변수와 값은 스펙 4.1절 그대로 (`--bg #f3f4f3`, `--wine #8b2342`, `--teal #2e7465`, `--gold #b2862b`, 상승 `#c0392b`, 하락 `#2d5fa6` 등). 파란색 버튼·알약 모양·큰 그림자 금지.
- 글꼴: 제목·이름·나이 Noto Serif KR 900, 본문 Noto Sans KR, 숫자 JetBrains Mono. CDN 금지, `@fontsource/*` 패키지.
- 클라이언트에 게임 규칙·숨은 값을 두지 않는다. 서버가 기록하는 payload에 숨은 방향·변동 폭을 넣지 않는다.
- 새 테이블은 `progress_*` 접두사, 마이그레이션 파일명은 `V2026101800NN__progress_*.sql`. 다른 도메인 테이블을 읽지 않는다.
- 기존 `data-testid`(`age`, `nickname`, `total-asset`, `cash`, `job`, `style`, `stat-*`, `event-card`, `hint`, `outcome-card`, `outcome-actions`, `outcome-message`, `birth-reveal`, `reveal-*`, `reveal-nickname`, `result-screen`, `reported-day`) 유지.
- 버튼 문구: `멈춤` / `계속`, `1×`, `2×`, `다시 시작`, `삶을 시작하기`, `태어나기`, `다시 태어나기`. 터치 대상 최소 44px, 최소 폭 360px에서 가로 스크롤 없음.
- `prefers-reduced-motion: reduce`이면 모든 애니메이션을 끈다.
- 커밋 메시지는 한글. 사용자가 명시적으로 요청할 때만 커밋·푸시한다 (메모리 규칙). 아래 커밋 단계는 **사용자가 "커밋해"라고 했을 때** 실행한다.
- 서버 테스트: `cd server && ./gradlew test` (Testcontainers로 Postgres 필요). 웹: `cd web && pnpm test`, `pnpm check`, `pnpm build`, E2E `pnpm e2e`(서버·DB 떠 있어야 함).

## Review Focus

1. **새로고침 뒤 인생 기록·인생 지도가 그대로여야 한다.** 클라이언트 상태가 아니라 서버 `Game.log`·`yearly`에서 와야 한다. → Task 10 E2E.
2. **1세, 아직 아무 기록도 없을 때** 인생 기록은 탄생 줄 하나, 인생 지도는 전부 빈 칸, 자산 곡선은 점 하나로 그려지고 터지지 않아야 한다. → Task 7 단위 테스트(`yearFills`, `curvePoints`에 빈 배열).
3. **특별 별명 셋(천재·험난·보통)** 은 약점 표시가 없고, 머리장식은 왕관·반창고·없음이어야 한다. `nickname().weakness`가 있어도 무시한다. → Task 5 단위 테스트.
4. **성장으로 약점이 바뀌면** 현재 `stats` 기준으로 표시가 바뀌어야 하며, 별명 이름은 `initialStats` 기준으로 안 바뀌어야 한다. → Task 5 단위 테스트(`layersFor`에 initialStats와 stats를 다르게 넣음).
5. **연 경계를 넘는 보고가 재시도되거나 같은 해에 두 번 오면** `progress_year`에 중복 삽입으로 500이 나면 안 된다 (`ON CONFLICT DO NOTHING`). → Task 3 서버 테스트.

---

### Task 1: 계약에 `Game.log`, `Game.yearly`, `LogEntry` 추가

**Files:**
- Modify: `contracts/openapi/game.yaml` (`Game` 스키마, `components.schemas`)
- Generate: `web/src/api/schema.d.ts` (`pnpm gen:api`)
- Modify: `web/src/api/client.ts` (타입 export 추가)

**Interfaces:**
- Produces: `Game.log: LogEntry[]`, `Game.yearly: {age:number,totalAsset:number,cash:number}[]`, `LogEntry = {seq:number, day:number, kind:'BIRTH'|'TRAIT'|'JOB'|'STYLE'|'OFFER'|'NEWS'|'PRICE'|'GROWTH'|'END', payload: Record<string, unknown>}`. `client.ts`에서 `export type LogEntry = Schemas['LogEntry']`, `export type YearlyAsset = Game['yearly'][number]`.

- [ ] **Step 1: `game.yaml`에 스펙 6.4절의 스키마를 추가한다.** `Game.required`에 `log`, `yearly`를 넣는다. `LogEntry.kind`는 enum 9개. `payload`는 `type: object, additionalProperties: true`.
- [ ] **Step 2: `cd web && pnpm gen:api` 실행.** Expected: `src/api/schema.d.ts`에 `LogEntry`와 `Game.log`, `Game.yearly`가 생긴다.
- [ ] **Step 3: `client.ts`에 `LogEntry`, `YearlyAsset` 타입 export.**
- [ ] **Step 4: `cd web && pnpm build`** Expected: 타입 오류 없음 (아직 아무 코드도 `log`를 쓰지 않으므로).
- [ ] **Step 5: 커밋** `feat(contract): Game에 인생 기록과 연간 자산 추가`

---

### Task 2: 진행 도메인 테이블·저장소·뷰 필드

**Files:**
- Create: `server/src/main/resources/db/migration/V202610180011__progress_log.sql`
- Create: `server/src/main/java/investorgame/progress/internal/LogRepository.java`
- Create: `server/src/main/java/investorgame/progress/internal/LogRow.java`
- Modify: `server/src/main/java/investorgame/progress/GameView.java`
- Modify: `server/src/main/java/investorgame/progress/internal/DefaultProgressService.java:354-395` (`view`)
- Test: `server/src/test/java/investorgame/progress/LogRepositoryTest.java`

**Interfaces:**
- Produces:
  ```java
  record LogRow(long seq, int day, String kind, Map<String, Object> payload) {}
  class LogRepository {
    void append(UUID gameId, int day, String kind, Map<String, Object> payload);
    List<LogRow> findAll(UUID gameId);                    // seq 오름차순
    void upsertYear(UUID gameId, int age, long totalAsset, long cash); // ON CONFLICT (game_id, age) DO NOTHING
    List<GameView.Yearly> findYears(UUID gameId);          // age 오름차순
  }
  // GameView에 추가
  record LogEntry(long seq, int day, String kind, Map<String, Object> payload) {}
  record Yearly(int age, long totalAsset, long cash) {}
  List<LogEntry> log, List<Yearly> yearly   // record의 마지막 두 컴포넌트
  ```
- Consumes: `EventRepository`의 jsonb 패턴(`JsonMapper json` 주입, `CAST(:payload AS jsonb)`, 읽을 때 `json.readValue(String, Map.class)`).

- [ ] **Step 1: 실패하는 테스트 작성** `LogRepositoryTest`(`@SpringBootTest @Import(TestcontainersConfiguration.class)`, 저장소를 `@Autowired`):
  - `append_두_줄을_넣으면_seq_순으로_읽힌다`: 같은 gameId에 `BIRTH`, `JOB` 순서로 append → `findAll` 크기 2, `get(0).kind()=="BIRTH"`, `get(1).payload().get("jobCode")=="dev"`.
  - `upsertYear_같은_나이를_두_번_넣어도_한_줄이다`: `upsertYear(g, 24, 100, 50)` 두 번 → `findYears` 크기 1, `totalAsset()==100`.
  - `findAll_다른_판의_기록은_섞이지_않는다`.
- [ ] **Step 2: 테스트 실행, 컴파일 실패 확인** `cd server && ./gradlew test --tests '*LogRepositoryTest*'`
- [ ] **Step 3: 마이그레이션 작성** — 스펙 6.2절 SQL 그대로 (`progress_log`, `progress_year`, 인덱스).
- [ ] **Step 4: `LogRow`, `LogRepository` 구현** (`@Repository`, package-private, `JdbcClient`, `JsonMapper`, `Clock` 주입. `GameRepository`와 같은 스타일).
- [ ] **Step 5: `GameView`에 `log`, `yearly` 컴포넌트와 `LogEntry`, `Yearly` 레코드 추가.** `view()`에서 `logs.findAll(game.id())`를 `LogEntry`로 매핑, `logs.findYears(game.id())`를 넣는다. 다른 `new GameView(...)` 호출 지점이 있으면 전부 고친다.
- [ ] **Step 6: 테스트 통과 확인** `./gradlew test --tests '*LogRepositoryTest*' --tests '*GameApiTest*' --tests '*GameFlowTest*'` Expected: 전부 PASS (log는 아직 빈 배열).
- [ ] **Step 7: 커밋** `feat(progress): 인생 기록·연간 자산 테이블과 응답 필드`

---

### Task 3: 진행이 사건마다 기록하고 연 경계마다 자산을 저장

**Files:**
- Modify: `server/src/main/java/investorgame/progress/internal/DefaultProgressService.java` (`start` 87-110, `advance` 119-144, `choose` 156-204, `resolveNews` 207-269, `endIfFinished` 320-338)
- Test: `server/src/test/java/investorgame/api/GameFlowTest.java`

**Interfaces:**
- Consumes: Task 2의 `LogRepository`. `EventView`(`title`, `options[code,label]`)는 `events.pending(gameId)`로 읽는다 — `ChoiceTicket`에는 제목·라벨이 없다.
- Produces: `progress_log` payload 키 이름 (스펙 6.3절 표). 클라이언트 `log.ts`(Task 6)가 이 키를 그대로 쓴다:
  - `BIRTH {stats:{insight,patience,courage,conviction,luck}, initialAsset}`
  - `TRAIT {eventTitle, optionCode, optionLabel}` · `JOB {jobCode, jobTitle, monthlySalary}` · `STYLE {styleCode, styleName}` · `OFFER {eventTitle, optionCode, optionLabel, accepted}`
  - `NEWS {eventTitle, sectorCode, sectorName, chosen, actual, deviations:[{statCode,from,to}], trade:{status,amount}|null}`
  - `PRICE {sectorCode, sectorName, direction, changeBp, pnl, lossSoftened}` · `GROWTH {statCode, before, after}` · `END {finalAge, initialAsset, finalAsset, returnBp}`

- [ ] **Step 1: `GameFlowTest`에 실패하는 단언 추가** (기존 흐름 테스트 끝부분, `game`이 ENDED인 시점):
  ```java
  List<String> kinds = game.read("$.log[*].kind");
  assertThat(kinds).startsWith("BIRTH").endsWith("END");
  assertThat(kinds).containsOnlyOnce("JOB", "STYLE", "OFFER");
  assertThat(kinds.stream().filter("TRAIT"::equals).count()).isEqualTo(6);
  assertThat(kinds.stream().filter("NEWS"::equals).count()).isEqualTo(seenKinds.get("NEWS"));
  assertThat(kinds.stream().filter("PRICE"::equals).count()).isEqualTo(seenKinds.get("NEWS"));
  assertThat(game.read("$.log[0].payload.initialAsset", Long.class)).isEqualTo(game.read("$.initialAsset", Long.class));
  List<Integer> ages = game.read("$.yearly[*].age");
  assertThat(ages).startsWith(1).endsWith(65).doesNotHaveDuplicates().hasSize(65);
  List<Map<String, Object>> yearly = game.read("$.yearly");
  assertThat(((Number) yearly.get(yearly.size() - 1).get("totalAsset")).longValue())
      .isEqualTo(game.read("$.result.finalAsset", Long.class));
  ```
  그리고 NEWS 응답 하나에 대해 `$.game.log[-1:].kind`가 `GROWTH` 또는 `PRICE`이고, `$.game.log[?(@.kind=='NEWS')]` 마지막의 `payload.chosen`이 보낸 선택과 같음을 단언.
  재시도 안전성(Review Focus 5): 같은 `target` 일수로 `client.advance`를 두 번 부르는 줄을 루프 밖에 한 번 추가하고 200이어야 한다.
- [ ] **Step 2: 실행해서 실패 확인** `./gradlew test --tests '*GameFlowTest*'` Expected: `log`가 비어 있어 `startsWith("BIRTH")` 실패.
- [ ] **Step 3: 기록 구현.** 각 자리에 `logs.append(gameId, day, kind, Map.of(...))`:
  - `start`: `characters.create` 뒤 `BIRTH` (`day 0`, `stats`는 `CharacterView.initialStats()`를 `Map`으로, `initialAsset`은 `assets.get(id).initialCash()`).
  - `choose`: `prepareChoice` 전에 `EventView pendingView = events.pending(gameId).orElseThrow()`로 제목·라벨 확보. 라벨은 `pendingView.options()`에서 `code.equals(option)`인 것. Job → `JOB`; Trait → `TRAIT`, `traitsComplete`이면 이어서 `STYLE`; Offer → `OFFER`; News → `resolveNews` 안에서 `events.complete` 뒤에 `NEWS`, `PRICE`, 그리고 `growth` 중 before≠after마다 `GROWTH`. day는 `ticket.occursDay()`.
  - `endIfFinished`: `results.save` 뒤 `END` (`returnBp`는 `GameResult`가 계산하는 값을 쓰거나 같은 식으로 계산) 와 `logs.upsertYear(id, endAge, totalAsset, cash)`.
  - `advance`: `paySalaries` 뒤, `last < k × daysPerYear <= stopDay`인 정수 `k`마다 `upsertYear(id, age, assets.totalAsset(id), assets.get(id).cash())`. **마친 나이 `age = game.startAge() - 1 + k`** (startAge 1이면 경계 day 360 → 1세를 마침). 한 번의 보고는 최대 360일이므로 `k`는 많아야 하나다.
- [ ] **Step 4: 테스트 통과 확인** `./gradlew test` Expected: 전부 PASS. `DomainBoundaryTest`도 통과(진행은 다른 도메인 호출 허용).
- [ ] **Step 5: `./gradlew spotlessApply`** 후 커밋 `feat(progress): 사건마다 인생 기록, 해마다 자산 저장`

---

### Task 4: 클라이언트 기반 — 글꼴, 색 변수, 상단 바, 문서 양식

**Files:**
- Modify: `web/package.json` (`@fontsource/noto-serif-kr`, `@fontsource/noto-sans-kr`, `@fontsource/jetbrains-mono` 추가, `pnpm install`)
- Modify: `web/src/index.css`, `web/index.html`(theme-color `#f3f4f3`), `web/vite.config.ts`(manifest `background_color`/`theme_color` `#f3f4f3`)
- Create: `web/src/features/game/TopBar.tsx`, `web/src/features/game/Document.tsx`, `web/src/features/game/Card.tsx`
- Modify: `web/src/App.tsx`, `web/src/features/game/labels.ts`
- Modify: `web/e2e/game.spec.ts` (버튼 문구 `일시정지`→`멈춤`, `다시 시작하기`→`다시 시작`)
- Test: `web/src/features/game/labels.test.ts`

**Interfaces:**
- Produces:
  - `index.css`: `:root` 변수(스펙 4.1절 전부), 글꼴 변수 `--font-serif`, `--font-sans`, `--font-mono`, 유틸 클래스 `.font-serif-kr`, `.font-mono-num`, `.animate-reveal`(기존), `.animate-slide-in`(높이·투명도 0.3s), `@media (prefers-reduced-motion: reduce)`에서 전부 `animation: none; transition: none`.
  - `TopBar({ game, day, running, speed, controlsDisabled, showControls, onPause, onResume, onSpeed, onRestart })` — 나이 `data-testid="age"` 텍스트는 기존 형식 `{years}세 {months}개월` 유지(E2E가 `1세 0개월`을 본다), 연도 `yearOf(age)`, 65세 진행 막대.
  - `Document({ title, number, children })` — `--wine` 머리띠(왼쪽 title, 오른쪽 모노 number), 흰 본문, 최대 폭 640px.
  - `Card({ title, aside, children, className, testId })` — 스펙 4.3절 모양.
  - `labels.ts`: `export function yearOf(ageYears: number): number` (= `2025 + ageYears - 1`), `export const BIRTH_YEAR = 2025`.
- Consumes: `store.ts`의 `pause/resume/setSpeed`, `SPEEDS`.

- [ ] **Step 1: 실패하는 테스트** `labels.test.ts`: `yearOf(1) === 2025`, `yearOf(31) === 2055`.
- [ ] **Step 2: 실행해 실패 확인** `cd web && pnpm test` Expected: `yearOf is not a function`.
- [ ] **Step 3: 글꼴 패키지 설치, `main.tsx`에서 `@fontsource/noto-serif-kr/900.css`, `@fontsource/noto-sans-kr/400.css`, `.../700.css`, `@fontsource/jetbrains-mono/400.css`, `.../600.css` import.**
- [ ] **Step 4: `index.css` 변수·유틸 작성, `body` 글꼴·바탕색을 변수로.** theme-color 두 곳 수정.
- [ ] **Step 5: `yearOf`, `Card`, `Document`, `TopBar` 구현.** `App.tsx`의 `<header>`를 `TopBar`로 교체: `status==='playing'`이면 배속 묶음 보이고, 선택/결과 카드가 떠 있으면 `controlsDisabled`. `none`/`revealing`/`ended`에서는 제목만. `다시 시작`은 playing에서만.
- [ ] **Step 6: `GameScreen.tsx`에서 기존 배속 버튼 묶음을 제거**(TopBar로 옮겼으므로). 나머지는 아직 그대로.
- [ ] **Step 7: `pnpm test && pnpm check && pnpm build`** Expected: PASS.
- [ ] **Step 8: E2E 문구 갱신 후 `pnpm e2e`** Expected: 기존 5개 테스트 PASS.
- [ ] **Step 9: 커밋** `feat(web): 색·글꼴 체계, 상단 바, 문서 양식`

---

### Task 5: 도트 캐릭터 — 문자 지도, 겹 포개기, Sprite

**Files:**
- Create: `web/src/features/game/pixel/palette.ts`, `sprite.ts`, `bodies.ts`, `adornments.ts`, `marks.ts`, `layers.ts`, `Sprite.tsx`
- Test: `web/src/features/game/pixel/sprite.test.ts`, `layers.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // sprite.ts
  export type PixelMap = readonly string[]            // 16열 × 20행, '.'은 투명
  export type Layer = { map: PixelMap } | { paint: (put: (y:number,x:number,ch:string)=>void, headTop:number) => void }
  export function compose(body: Body, layers: Layer[]): string[][]   // 20×16 문자 격자
  export function toRects(grid: string[][], palette: Record<string,string>): string  // <rect …/> 문자열
  // bodies.ts
  export type AgeStage = 'baby'|'child'|'adult'|'middle'|'old'
  export interface Body { stage: AgeStage; headTop: number; map: PixelMap }
  export function stageFor(ageYears: number): AgeStage   // 1–6 baby, 7–13 child, 14–39 adult, 40–64 middle, 65+ old
  export const BODIES: Record<AgeStage, Body>
  // adornments.ts: 강점 5 + 특별 2 (crown, bandage). marks.ts: 약점 5.
  export const ADORNMENTS: Record<keyof Stats | 'genius' | 'rough', Layer>
  export const MARKS: Record<keyof Stats, Layer>
  // layers.ts
  export interface SpriteSpec { stage: AgeStage; adornment: keyof typeof ADORNMENTS | null; mark: keyof Stats | null }
  export function layersFor(initialStats: Stats, stats: Stats, ageYears: number): SpriteSpec
  // Sprite.tsx
  export function Sprite({ spec, size, crop }: { spec: SpriteSpec; size: number; crop?: 'face' | 'full' })  // crop face = 위 10행
  ```
- Consumes: `nickname()`(`nickname.ts`) — 특별 별명 판정은 `nickname(initialStats).name`이 `'타고난 투자 천재'`→`genius`, `'앞날이 험난한 사람'`→`rough`, `'무난한 보통 사람'`→adornment `null`; 셋 다 `mark: null`. 그 외 `adornment = nickname(initialStats).strength`, `mark = nickname(stats).weakness` (현재 능력치!).

- [ ] **Step 1: 실패하는 테스트**
  - `layers.test.ts`: `stageFor(1)==='baby'`, `stageFor(6)==='baby'`, `stageFor(7)==='child'`, `stageFor(13)==='child'`, `stageFor(14)==='adult'`, `stageFor(39)==='adult'`, `stageFor(40)==='middle'`, `stageFor(64)==='middle'`, `stageFor(65)==='old'`.
  - `layersFor({insight:80,patience:50,courage:20,conviction:50,luck:50}, 같은값, 31)` → `{stage:'adult', adornment:'insight', mark:'courage'}`.
  - 약점 이동(Review Focus 4): `initialStats` 위와 같고 `stats`는 courage 60, luck 20 → `mark:'luck'`, `adornment:'insight'` 유지.
  - 특별(Review Focus 3): 전부 75 → `{adornment:'genius', mark:null}`; 전부 20 → `{adornment:'rough', mark:null}`; `{50,52,54,56,58}` → `{adornment:null, mark:null}`.
  - `sprite.test.ts`: `compose(BODIES.adult, [])`가 20행 16열; `compose(BODIES.adult, [ADORNMENTS.courage])`는 `headTop` 행에 `'y'`(안전모 색)가 하나 이상; `toRects`는 `'.'`를 그리지 않고 모든 rect가 `width="1"`.
- [ ] **Step 2: 실행해 실패 확인** `pnpm test`.
- [ ] **Step 3: 구현.** 문자 지도는 목업 `mockup-character-system.html`의 `BASE`, 장식·표시 함수, 팔레트를 출발점으로 옮기되 다듬는다(스펙 7.1절: 다섯 강점이 한눈에 구분, 중년 흰머리·넥타이, 노년 지팡이). `Sprite.tsx`는 `<svg viewBox="0 0 16 {crop==='face'?10:20}" style={{imageRendering:'pixelated', shapeRendering:'crispEdges'}}>`에 `dangerouslySetInnerHTML` 대신 rect 배열을 JSX로 렌더(테스트 가능하게 `toRects` 대신 `toRectProps` 반환도 허용 — 빌더 선택). 눈 깜빡임은 CSS 키프레임으로 눈 rect의 `opacity`를 3초 주기 토글 (`.animate-blink`). **약점 표시 떨어짐(스펙 4.4절):** `Sprite`가 직전 `spec.mark`를 `useRef`로 기억해, 바뀌면 옛 표시 rect 묶음을 0.5초 동안 `.animate-drop`(아래로 6px 이동 + 투명)으로 그린 뒤 제거한다. reduced-motion이면 바로 제거.
- [ ] **Step 4: `pnpm test && pnpm check`** Expected: PASS.
- [ ] **Step 5: 커밋** `feat(web): 도트 캐릭터 조합 (나이 × 강점 × 약점)`

---

### Task 6: 장면 — 문자 지도와 선택 규칙

**Files:**
- Create: `web/src/features/game/pixel/scenes.ts`, `Scene.tsx`
- Test: `web/src/features/game/pixel/scenes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SceneKey = 'nursery'|'school'|'street'|'office'|'studio'|'studio-middle'|'home-old'
  export function sceneFor(stage: AgeStage, phase: Phase, hasJob: boolean): SceneKey
  export const SCENES: Record<SceneKey, { map: PixelMap /* 64×20 */; caption: string; anchor: {x:number,y:number} /* 캐릭터 발 위치 */ }>
  export function Scene({ sceneKey, sprite }: { sceneKey: SceneKey; sprite: SpriteSpec })
  ```
- Consumes: Task 5의 `compose`, `toRects`, `SpriteSpec`, `AgeStage`.

- [ ] **Step 1: 실패하는 테스트** `scenes.test.ts` — 스펙 8절 표 그대로: `sceneFor('baby','CHILDHOOD',false)==='nursery'`, `('child','CHILDHOOD',false)==='school'`, `('adult','CHILDHOOD',false)==='street'`, `('adult','SAVING',true)==='office'`, `('adult','INVESTING',true)==='studio'`, `('middle','INVESTING',true)==='studio-middle'`, `('middle','SAVING',true)==='studio-middle'`, `('old','ENDED',true)==='home-old'`, `('old','INVESTING',true)==='home-old'`. 모든 `SCENES[k].map`이 20행이고 각 행 64자.
- [ ] **Step 2: 실행해 실패 확인.**
- [ ] **Step 3: 구현.** 장면 7종 문자 지도(목업 `style-direction` 의 장면 코드를 출발점으로). 캡션은 `서울 · {장소} · {상태}` 꼴(빌더가 문구 작성). `Scene`은 배경 rect 위에 `anchor`에 맞춰 캐릭터 전신 rect를 겹친다.
- [ ] **Step 4: `pnpm test && pnpm check`** PASS.
- [ ] **Step 5: 커밋** `feat(web): 단계별 도트 장면`

---

### Task 7: 인생 기록 문구, 인생 지도·자산 곡선 계산

**Files:**
- Create: `web/src/features/game/log.ts`, `web/src/features/game/timeline.ts`
- Test: `web/src/features/game/log.test.ts`, `timeline.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // log.ts — payload 타입은 Task 3의 키 이름을 그대로 좁힌다
  export type LogTone = 'neutral'|'birth'|'decision'|'flipped'|'growth'|'end'|'offer'
  export interface LogLine { seq: number; age: number; tone: LogTone; text: string; pill?: '탄생'|'제안' }
  export function logLine(entry: LogEntry, game: Pick<Game,'startAge'|'daysPerYear'|'initialStats'>): LogLine
  export function logLines(game: Game): LogLine[]   // 최근 순 (seq 내림차순)
  // timeline.ts
  export type YearFill = 'empty'|'up'|'flat'|'current'|'end'
  export function yearFills(yearly: YearlyAsset[], initialAsset: number, currentAge: number, startAge: number, endAge: number): YearFill[]  // 길이 endAge-startAge+1, index 0 = startAge
  export function curvePoints(yearly: YearlyAsset[], initialAsset: number, startAge: number, currentAge: number): {age:number; totalAsset:number}[]  // 첫 점은 {startAge, initialAsset}
  ```
- Consumes: Task 1 `LogEntry`, `YearlyAsset`; `labels.ts`의 `won`, `signedWon`, `percent`, `actionLabel`, `statLabel`, `yearOf`; `nickname()`.

- [ ] **Step 1: 실패하는 테스트** (스펙 5.5절 표의 문구를 그대로 단언):
  - `BIRTH` → `text` 가 `2025년, 안목 62 · 인내심 81 · 용기 34 · 줏대 55 · 운 47을 타고났다. 별명은 '겁 많은 돌부처'.`, `tone:'birth'`, `pill:'탄생'`.
  - `NEWS` 뒤집힘(`chosen:'BUY', actual:'HOLD', deviations:[{statCode:'courage',from:'BUY',to:'HOLD'}]`) → `… · 선택 매수 → 실제 관망 (용기 부족)`, `tone:'flipped'`; 안 뒤집힘 → `… · 매수`, `tone:'decision'`.
  - `PRICE` pnl 0 → 손익 생략; pnl 1240000, UP, 420bp → `반도체 주가 ▲ 4.2% · 손익 +1,240,000원`.
  - `GROWTH`, `JOB`, `STYLE`, `OFFER`, `TRAIT`, `END` 각 한 건.
  - `age`는 `startAge + floor(day/daysPerYear)`.
  - `yearFills([], 100, 1, 1, 65)`: 길이 65, `[0]==='current'`, `[64]==='end'`, 나머지 `'empty'` (Review Focus 2).
  - `yearFills([{age:1,totalAsset:100,cash:100},{age:2,totalAsset:120,cash:120},{age:3,totalAsset:110,cash:110}], 100, 4, 1, 65)`: `[0]==='flat'`(100 vs initial 100), `[1]==='up'`, `[2]==='flat'`, `[3]==='current'`.
  - `curvePoints([], 100, 1, 1)` → `[{age:1,totalAsset:100}]`.
- [ ] **Step 2: 실행해 실패 확인.**
- [ ] **Step 3: 구현.** 알 수 없는 `kind`는 `tone:'neutral'`, `text: kind`로 떨어뜨린다(서버가 먼저 새 종류를 보내도 화면이 안 죽게).
- [ ] **Step 4: `pnpm test && pnpm check`** PASS.
- [ ] **Step 5: 커밋** `feat(web): 인생 기록 문구와 인생 지도·자산 곡선 계산`

---

### Task 8: 진행 화면 카드와 3단 배치

**Files:**
- Create: `web/src/features/game/IdentityCard.tsx`, `StatsCard.tsx`, `SceneCard.tsx`, `HoldingsCard.tsx`, `LifeLog.tsx`, `LifeMap.tsx`, `AssetCurve.tsx`
- Modify: `web/src/features/game/GameScreen.tsx` (전면 재작성), 삭제: `StatusPanel.tsx`
- Modify: `web/e2e/game.spec.ts` (필요 시 선택자)

**Interfaces:**
- Consumes: Task 4 `Card`, Task 5 `Sprite`/`layersFor`, Task 6 `Scene`/`sceneFor`/`stageFor`, Task 7 `logLines`/`yearFills`/`curvePoints`, 기존 `ageAt`, `nickname`, `labels`.
- Produces: `data-testid`: 기존 것 유지(`age`는 TopBar, `nickname`은 IdentityCard 한 곳, `total-asset`·`cash`는 StatsCard, `job`·`style`은 IdentityCard, `stat-*`는 StatsCard, `reported-day`는 GameScreen 캡션) + 새것 `identity-card`, `life-log`, `life-log-line`(줄마다, `data-kind`), `life-map`, `asset-curve`, `scene`.

- [ ] **Step 1: 컴포넌트 작성** — 스펙 5.2절의 내용·순서를 따른다.
  - `IdentityCard({game, day})`: 머리띠 `신원 기록 · KOR` / `{yearOf(startAge)}`, `Sprite crop="face" size={64}`, 별명(`data-testid="nickname"`), 표(단계·직업·월급·스타일·관심), MRZ 두 줄(빌더).
  - `StatsCard({game})`: 막대 색 규칙(강점 `--wine`, 약점 `--gold`, 나머지 `--teal`; **강점은 `nickname(game.initialStats).strength`, 약점은 `nickname(game.stats).weakness`** — Task 5 `layersFor`와 같은 기준), `약점: {statLabel} — {weaknessEffect}` 줄(현재 stats 기준), 총자산·현금.
  - `SceneCard({game, day})`: `Scene` + 캡션 `SCENES[key].caption`.
  - `HoldingsCard({game})`: 보유 없으면 `null`.
  - `LifeLog({game})`: `logLines(game)`, 줄마다 `.animate-slide-in`, `tone`별 클래스. 30줄 초과는 `<details>더 보기</details>`(빌더).
  - `LifeMap({game, day})`: 13열 격자, `yearFills` 결과를 클래스에 매핑, 현재 칸 `--wine` 테두리, 범례.
  - `AssetCurve({game, day, full?})`: 인라인 SVG, `curvePoints`, x축 눈금 `startAge, 24, 현재, endAge`, y는 만원 단위 3눈금. `full`이면 결과 화면용 1→65.
- [ ] **Step 2: `GameScreen` 재작성.** 데스크톱 `lg:grid-cols-[280px_minmax(0,1fr)_300px]`, 태블릿 `md:grid-cols-[280px_minmax(0,1fr)]`, 모바일 1단 순서: 장면 → 선택/결과 자리 → 신원 → 능력치 → 인생 기록 → 보유 → 지도 → 곡선 (CSS `order`). 선택/결과 자리는 비어 있으면 아무것도 그리지 않는다(점선 상자 제거). `reported-day` 캡션은 가운데 칸 맨 아래 11px.
- [ ] **Step 3: `pnpm check && pnpm build`** PASS. 브라우저로 360px·768px·1280px에서 가로 스크롤 없음 확인 (`pnpm dev`, 서버 떠 있어야 함).
- [ ] **Step 4: `pnpm e2e`** Expected: 기존 테스트 PASS (`job`, `style`, `nickname` id가 옮겨졌어도 한 곳씩만 있어야 함).
- [ ] **Step 5: 커밋** `feat(web): 진행 화면을 신원·장면·기록·지도 3단으로 재구성`

---

### Task 9: 결정 카드와 결과 카드

**Files:**
- Create: `web/src/features/game/DecisionCard.tsx` (EventCard 대체), `web/src/features/game/Overlay.tsx`
- Modify: `web/src/features/game/OutcomeCard.tsx` (모양만), `GameScreen.tsx`(자리에 끼움), 삭제 `EventCard.tsx`
- Modify: `web/e2e/game.spec.ts` (`event-card` 선택자 유지 — `DecisionCard` 루트에 `data-testid="event-card"`, `data-kind`)

**Interfaces:**
- Consumes: 기존 `PendingEvent`, `Outcome`, `KIND_LABELS`(DecisionCard로 이동), `deviationMessage`, `TRADE_NOTES`.
- Produces: `Overlay({children})` — `fixed inset-0 bg-[rgba(30,40,40,.45)]`, 가운데 정렬, `.animate-reveal`. `DecisionCard({event, game, busy, onChoose})`, 뉴스이면 `Overlay`로 감싼다; `OutcomeCard`도 `outcome.kind==='NEWS'`이면 `Overlay`.

- [ ] **Step 1: `DecisionCard` 작성** — 스펙 5.3절: 머리(종류·섹터 / 나이·연도), 명조 제목, 본문, 힌트 상자(`data-testid="hint"` 유지), 다른 뉴스 상자, 선택지(뉴스 3열, 나머지 1열, 매수/매도 아래 모노 보조 `현금 {won(cash)}` / `보유 {won(amount)}`), 바닥 문구 `선택은 당신이 하지만, 실행은 당신의 성격이 합니다.` 매도 불가 비활성 규칙 유지. 누른 버튼은 요청 중 `--wine-soft` 바탕.
- [ ] **Step 2: `OutcomeCard` 모양 갱신** — 색만 스펙 5.4절로(뒤집힘 `--wine`, 성장 `--teal`, 손익 빨강/파랑, 손익 금액에 `.animate-flash` 0.6초). 버튼 `계속`은 `--wine` 주 버튼.
- [ ] **Step 3: `pnpm check && pnpm build && pnpm e2e`** PASS (`event-card`, `outcome-card`, `outcome-actions`, `outcome-message`, `hint` 그대로 동작).
- [ ] **Step 4: 커밋** `feat(web): 결정 카드와 결과 카드를 문서 톤으로`

---

### Task 10: 출생 신고서, 인생 기록부, 시작 전 화면, E2E

**Files:**
- Modify→Rename: `BirthReveal.tsx` → `BirthCertificate.tsx`, `ResultScreen.tsx` → `LifeRecord.tsx`
- Modify: `web/src/App.tsx` (`none` 화면, import)
- Modify: `web/e2e/game.spec.ts`

**Interfaces:**
- Consumes: Task 4 `Document`, Task 5 `Sprite`, Task 8 `LifeMap`, `AssetCurve`, `LifeLog`.
- Produces: 버튼 `삶을 시작하기`(옛 `인생 시작하기`), `다시 태어나기`, `태어나기`. `data-testid` `birth-reveal`, `reveal-*`, `reveal-nickname`, `result-screen` 유지.

- [ ] **Step 1: E2E 갱신 및 추가 (먼저 실패하게)**
  - 문구 `인생 시작하기` → `삶을 시작하기` 전부 교체.
  - 새 테스트 `인생 기록은 서버에서 와서 새로고침해도 남는다`: `born` → `playUntil('TRAIT')` → `step` → `life-log-line` 중 `data-kind="BIRTH"` 1개, `data-kind="TRAIT"` 1개 → `멈춤` 클릭 → `reload` → 같은 두 줄이 보인다 (Review Focus 1).
  - 결과 화면 검사는 기존 흐름 테스트가 65세까지 안 가므로 추가하지 않는다.
- [ ] **Step 2: `pnpm e2e`로 새 테스트 실패 확인** (`삶을 시작하기` 버튼 없음).
- [ ] **Step 3: `BirthCertificate` 작성** — 스펙 5.6절. `Document title="출생 신고" number={`No. KOR-${yearOf(1)}-${game.gameId.slice(0,7)}`}`. 공개 로직(`STEP_MS 700`, `CountUpBar`, reduced-motion 즉시 공개)은 기존 코드 그대로 옮긴다. 공개가 끝나면 아기 `Sprite`, 약점 줄, `--teal-soft` 안내 상자, 주 버튼 `삶을 시작하기`.
- [ ] **Step 4: `LifeRecord` 작성** — 스펙 5.7절. `Document title="인생 기록부"`, 노년 `Sprite`, 초기→최종(수익률), 직업·스타일, 최종 능력치 5칸, 뒤집힌 횟수 알약, `AssetCurve full`, `LifeMap`, `<details>`에 `LifeLog`, 주 버튼 `다시 태어나기`.
- [ ] **Step 5: 시작 전 화면(`App.tsx`의 `status==='none'`)** — `Document` 한 장, 설명 두 줄 유지, 주 버튼 `태어나기`, 아래 청년 몸통 5종 `Sprite` 나란히(`adornment` 5가지, `mark:null`).
- [ ] **Step 6: `pnpm test && pnpm check && pnpm build && pnpm e2e`** Expected: 전부 PASS.
- [ ] **Step 7: 체감 확인** — 브라우저에서 한 판을 시작해 탄생 → 성장기 → 취직 → 뉴스까지 보고, 폭 360px에서 가로 스크롤이 없고 버튼이 44px 이상인지, reduced-motion 켜면 움직임이 없는지 확인. 어긋난 곳은 고친다.
- [ ] **Step 8: 커밋** `feat(web): 출생 신고서·인생 기록부·시작 화면, 인생 기록 E2E`

---

### Task 11: 마무리 — 문서와 상태 인계

**Files:**
- Modify: `docs/specs/README.md` 5절 표의 progress 행 (`progress_log`, `progress_year` 구현됨), `docs/architecture.md` 7절에 "화면 문구는 클라이언트, 사실은 서버" 한 줄.
- Modify: 메모리 `project-status-handoff.md` (구현 상태 갱신).

- [ ] **Step 1: 문서 두 곳 갱신.**
- [ ] **Step 2: 전체 검증** `cd server && ./gradlew test` / `cd web && pnpm test && pnpm check && pnpm build && pnpm e2e` 전부 PASS를 출력으로 확인.
- [ ] **Step 3: 커밋** `docs: 화면 개편 반영`
