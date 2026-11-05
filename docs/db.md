# DB 설계

> 상태: v0.3 (증권사 육성 구조로 개정, 2026-11-05. #292에서 옛 인생 시뮬레이터 코드를, decisions.md 228번에서 3분 육성 판을 지운 뒤)
> 표기: **(확정)** = 대화에서 정해진 것, **(제안)** = 제 판단이며 아직 합의되지 않은 것. 구조는 [architecture.md](./architecture.md) 2.1절, 도메인은 [domains.md](./domains.md)를 따른다. 테이블의 원본은 `backend/src/main/resources/db/migration`이고, 코드가 어느 테이블을 쓰는지는 각 도메인의 저장소(`*Repository`, `JdbcSessionService`, `ContentVersionRecorder`)가 원본이다.

## 1. 원칙

| 원칙 | 내용 |
|---|---|
| FK 없음 | 외래 키 제약을 쓰지 않는다. 테이블 사이는 ID 값으로만 연결한다 (확정) |
| 단일 스키마 | 스키마는 하나만 쓴다. MSA 분리는 목표가 아니다 (확정) |
| 도메인 구분 | 테이블 이름 접두사가 도메인 이름과 같다. 예: `raising_company`, `session_info` |
| 교차 접근 | 다른 도메인의 테이블을 읽거나 조인하지 않고, 필요하면 해당 도메인의 서비스 인터페이스를 호출한다 (코드 규칙으로 지킨다) |
| 마이그레이션 | Flyway, 위치 `db/migration` 하나 (확정) |
| DB | PostgreSQL. 로컬(`compose.yaml`)·테스트(Testcontainers)는 `pgvector/pgvector:pg17` 이미지다. 옛 `result_profile`이 `vector` 확장을 써서 마이그레이션이 확장을 만든다 |
| 연결 키 | 회사와 사장의 기억은 **`session_id`** 로 세션에 묶인다 |
| JSON 상태 | 상태가 짧고 다른 도메인이 읽지 않으면 `jsonb` 한 칸(`state`)에 통째로 둔다. 회사와 사장의 기억이 그렇다 (decisions.md 198·208번). 찾는 데 쓰는 값(`session_id`, `status`, `seed`)만 컬럼으로 뺀다 |
| 이름 규칙 | 소문자 snake_case, 테이블 이름은 단수형, 시각은 `timestamptz` |
| ID 형식 | 밖으로 나가는 ID(세션 ID, 회사 ID)는 `uuid`. 직원·지원자 ID는 회사 상태 안의 정수다 |
| 금액 | 원 단위 정수 (`long`, JSON 안에서도 정수) |
| 코드 값 | 능력치, 섹터, 자리, 시대 같은 값은 `text` 코드로 저장한다. 값을 정의하는 곳은 콘텐츠·설정이며 DB에는 CHECK나 enum 타입을 두지 않는다. 고정된 값(`status`)만 CHECK를 쓴다 |

코드 값을 DB 제약으로 묶지 않는 이유: 능력치·섹터·자리·시대를 콘텐츠와 설정으로 늘리고 줄이기 위해서다. 값의 유효성은 애플리케이션이 검증한다.

## 2. 테이블 개요

### 2.1 코드가 쓰는 테이블

| 도메인 | 테이블 | 내용 |
|---|---|---|
| 세션 | `session_info` | 익명 세션 |
| 콘텐츠 | `content_version` | 로드된 콘텐츠 버전 |
| 육성 | `raising_company` | 회사. 상태는 JSON |
| 육성 | `raising_memory` | 세션이 회사를 넘어 기억하는 것(사장 명성). 상태는 JSON |

행동은 상태가 없어서 테이블이 없다.

```
session_info.id ─┬───────── raising_company.session_id
                 └───────── raising_memory.session_id (PK)
content_version            다른 테이블과 연결되지 않는다
```

### 2.2 쓰지 않는 테이블 (기록)

**코드는 이 테이블을 읽거나 쓰지 않는다. 테이블과 마이그레이션은 그대로 둔다.** 운영 데이터를 지우는 것은 되돌릴 수 없어 따로 정한다 (decisions.md 227·228번). 상세는 11절에 기록으로 남긴다.

| 옛 도메인 | 테이블 | 쓰지 않게 된 때 |
|---|---|---|
| 육성 (3분 육성 판) | `raising_run` | 3분 육성 판을 없앨 때 (decisions.md 228번) |
| 진행 | `progress_game`, `progress_log`, `progress_year`, `progress_month`, `progress_analysis` | #292 (decisions.md 227번) |
| 캐릭터 | `character_profile`, `character_stat`, `character_stat_log`, `character_trait_score` | #292 |
| 자산 | `asset_account`, `asset_holding`, `asset_ledger` | #292 |
| 시장 | `market_price`, `market_price_history`, `market_home_history`, `market_rate_history`, `market_indicator_history` ([market.md](./specs/market.md) 5절) | #292 |
| 가계 | `household_state`, `household_child` ([household.md](./specs/household.md) 5절) | #292 |
| 주거 | `housing_state`, `housing_home` | #292 |
| 이벤트 운영 | `event_instance`, `event_resolution`, `event_deviation` | #292 |
| 결과 | `result_game`, `result_profile`, `result_ranking`, `result_share` | #292 |

- `session_info.bot_persona` 컬럼도 옛 봇 세션용이라 지금은 쓰지 않는다.
- `raising_memory`의 옛 행에는 3분 육성 시절의 칸(열린 기능, 단골 인물이 나온 횟수 …)이 남아 있다. 코드는 모르는 칸을 무시하고 읽는다 (`@JsonIgnoreProperties(ignoreUnknown = true)`). `raising_company`의 옛 행도 같다.

## 3. 테이블 상세

### 3.1 `session_info`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | PK. 세션 ID |
| token_hash | text | 세션 토큰의 해시. 원문은 저장하지 않는다 |
| created_at | timestamptz | |
| last_seen_at | timestamptz | 만료 판단과 정리용 |
| first_ip | text | 처음 접속한 IP (decisions.md 63번) |
| last_ip | text | 마지막 접속 IP |
| bot_persona | text | 옛 봇 세션의 페르소나. 지금은 쓰지 않는다 |

- 유니크: `token_hash`
- 인덱스: `last_seen_at`

### 3.2 `raising_company`

사장의 회사 (decisions.md 208·228번). 사장의 사재로 차리면(`POST /api/company`) 직원 없이 열린다. 다른 도메인이 읽지 않아서 상태를 JSON 한 칸에 둔다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | PK. 회사 ID |
| session_id | uuid | 세션 ID (참조만, FK 없음) |
| status | text | `ACTIVE`, `ENDED`. CHECK. 시대가 끝나거나 팔리면 `ENDED` |
| seed | bigint | 회사 시드. 서버가 만든다 |
| state | jsonb | 회사의 모든 상태 (아래) |
| created_at / updated_at | timestamptz | |

- `state`에 드는 것: 지금 해, 몇 번째 회사인지, 시대, 팔렸는지, 차릴 때의 한 줄, 자본, 직원(정수 ID, 이름, 능력치 점수, 앉은 자리, 관심 섹터, SSS 위 단계, 실전 경험, 큰 손실로 내려간 능력치), 올해 시장 갈래와 조짐(숨은 값), 올해 필요한 자리, 다음 해 시장 갈래와 조짐(경보·선견용 숨은 값), 올해 공채 시장의 지원자(능력치, 계약금, 한 줄, 관심 섹터)와 새로 받은 횟수, 만난 지원자 수, 올해 투자 회의(뉴스, 종목, 숨은 방향, 단서 기사 문장, 꼬드김, 사장이 고른 것, 직원마다 한 일과 손익), 이 회사에 나온 뉴스, 지난 결산들. 형태는 `raising/internal/CompanyState.java`가 정한다.
- 인덱스: `(session_id, created_at desc)` (세션의 가장 최근 회사)
- **세션당 `ACTIVE` 회사는 1개다.** 부분 유니크 인덱스 `(session_id) where status = 'ACTIVE'`로 보장한다.
- 난수 처리: 난수 생성기의 진행 위치를 저장하지 않고, 판단마다 `seed`와 키(예: `("company-year", 해)`, `("invest-decide", 해, 직원 ID)`)에서 **하위 시드를 유도**한다(`common.random.HashSeededRandom`). 요청이 재시도되어도 같은 키는 같은 결과를 낸다. 해마다의 시장은 시드와 해로만 정해서 미리 들여다봐도(XX 경보·ZZZ 선견) 그해가 오면 같다 (decisions.md 222번).
- 매각하면 지금 회사는 `ENDED`로 남고 새 회사 행을 만든다 (decisions.md 215번). 끝난 회사는 지우지 않고 관리자 플레이 기록에 쓴다 (decisions.md 228번).
- 올해 시장 갈래, 투자 회의의 숨은 방향, 능력치 점수 같은 숨은 값은 `state`에만 있고 API 응답에 내려가지 않는다.

### 3.3 `raising_memory`

세션이 회사를 넘어 기억하는 것 (decisions.md 216번).

| 컬럼 | 타입 | 비고 |
|---|---|---|
| session_id | uuid | PK. 세션마다 한 행 |
| state | jsonb | 사장 명성 점수, 판 회사 수. 형태는 `raising/internal/RaisingMemory.java` |
| updated_at | timestamptz | |

- 행이 없으면 빈 기억으로 본다. 쓸 때는 `ON CONFLICT (session_id) DO UPDATE`로 덮어쓴다.
- 명성은 회사를 넘어 이어지므로 회사가 아니라 여기에 둔다.
- 3분 육성 시절에는 열린 기능, 본 설명, 단골 인물이 나온 횟수, 판 수도 여기 두었다. 지금은 쓰지 않는다 (2.2절).

### 3.4 `content_version` (옛 3.12절)

콘텐츠 원본은 저장소의 `content/` JSON 파일이다 (확정). DB에는 **어떤 버전이 로드되었는지**만 기록한다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| version | text | PK |
| checksum | text | 콘텐츠 파일 묶음의 해시 |
| loaded_at | timestamptz | 서버가 로드한 시각 |
| summary | jsonb | 종류별 개수 등 요약 |

- 정의 전체는 DB에 적재하지 않는다 (확정). 서버 시작 때 JSON 파일을 읽어 메모리에 두고, 버전만 기록한다.
- 회사는 콘텐츠 버전을 적지 않는다. 회사 상태에는 콘텐츠의 코드(뉴스·종목·자리·시대)만 들어 있다.

## 4. 데이터 생명주기와 정합성

FK가 없으므로 정합성은 애플리케이션이 지킨다.

**회사**

1. `POST /api/company`가 세션에 회사가 하나도 없을 때만 `raising_company`를 만든다. 자본은 사장의 사재 1억 원이고 직원은 없다. 첫 해의 시장·공채 시장·투자 회의를 준비해 둔다 (decisions.md 228번).
2. 뽑기·지원자 새로 받기·배치·투자 회의·결산마다 `state`를 고쳐 쓴다. 시대의 마지막 해를 결산하면 `ENDED`가 된다.
3. 매각하면 지금 회사를 팔린 채로 `ENDED`로 두고 새 `raising_company` 행을 만든다. 명성은 `raising_memory`에 더한다.

**세션 만료**

- 익명 세션은 마지막 접속 후 `session.ttl`(1일)이 지나면 만료된다. 만료된 세션의 쿠키로는 회사를 이어할 수 없다.
- 만료된 세션의 행(`session_info`, `raising_*`)을 지우는 정리 작업은 **아직 없다** (9절).

## 5. 동시성과 트랜잭션

- 회사에 대한 요청은 **돌고 있는 `raising_company` 행을 `SELECT ... FOR UPDATE`로 잠그고** 시작한다. 매각은 가장 최근 회사를 잠근다.
- 회사를 차릴 때와 팔 때는 `raising_memory` 행을 먼저 잠가 같은 세션의 요청을 줄 세운다. 기억 행이 아직 없으면 잠글 것이 없지만, `ACTIVE` 회사의 부분 유니크 인덱스가 회사가 둘 생기는 것을 막는다.
- 같은 요청이 두 번 올 때: 이미 뽑은 지원자, 이미 한 투자 회의는 400이다. 결산 요청은 결산할 해를 싣고, 이미 결산한 해면 아무것도 하지 않고 지금 회사를 돌려준다(멱등, decisions.md 234번). 그래서 결산은 끝난 회사까지 가장 최근 회사를 잠근다. 화면은 요청이 도는 동안 버튼을 잠근다.
- 한 DB, 한 스키마이므로 회사와 기억을 고치는 처리를 **한 DB 트랜잭션**으로 묶는다.

## 6. Flyway 구성 (확정 + 제안)

위치와 이름:

```
backend/src/main/resources/db/migration/V<yyyyMMddHHmm>__<도메인>_<설명>.sql
예: V202611051100__raising_company.sql
```

- 이력 테이블(`flyway_schema_history`)은 하나다.
- 버전 번호는 시각 기반으로 쓴다. 여러 작업이 병렬로 마이그레이션을 추가해도 같은 번호를 쓰지 않게 하려는 장치다. `MigrationRulesTest`가 번호 중복을 검사한다.
- 파일 이름에 도메인이 들어가고, 그 도메인 접두사의 테이블만 만든다.
- 병합 순서가 번호 순서와 어긋날 수 있어서 개발과 CI 환경은 Flyway의 `outOfOrder`를 켠다. **운영 환경은 끈다** (확정, 제안안 수용). 운영에는 번호 순서대로만 반영하고, 이미 적용된 번호보다 앞선 파일이 나중에 병합되면 새 번호로 다시 만든다.
- 적용된 파일은 수정하지 않는다. 변경은 새 버전을 추가한다 (확정). 그래서 옛 파일의 주석(예: "db.md 3.12절", "3분 육성 한 판")은 그때의 문서를 가리킨 채로 남는다.
- FK 제약 구문(`REFERENCES`, `FOREIGN KEY`)이 마이그레이션에 들어가면 테스트가 실패한다(`MigrationRulesTest`).
- 마이그레이션이 접두사 규칙을 지키는지(`raising_`으로 시작하는 테이블은 `raising` 이름의 파일에서만 만든다) 같은 테스트가 검사한다. 파일 이름에 쓸 수 있는 도메인 목록에는 옛 도메인도 남아 있다(옛 파일이 그대로 있어서).

새 테이블은 `raising_*`, `session_*`, `content_*`만 만든다. 옛 도메인 이름의 파일(`progress`, `character`, `asset`, `market`, `household`, `housing`, `event`, `result`)은 이미 적용되었으므로 고치지 않는다. 쓰지 않는 테이블을 지우게 되면 새 버전 파일로 지운다 (decisions.md 227번).

## 7. 접근 권한 (선택, 제안)

스키마를 나누지 않으므로 DB 계정으로 도메인을 막을 수 없다. 규칙은 ArchUnit과 코드 리뷰로 지킨다. 운영 단계에서 앱 계정과 마이그레이션 계정(DDL 가능)을 나누는 정도만 권한을 분리한다.

## 8. 도메인이 DB를 가지지 않는 경우

- **행동**: 상태가 없는 순수 규칙이다.
- **클라이언트**: 규칙과 진행 상태를 저장하지 않는다. 진행 상태는 서버에 있다. 그림 끄기 같은 화면 설정만 브라우저에 둔다.

## 9. 미결정 사항

| # | 질문 | 영향 |
|---|---|---|
| 1 | 쓰지 않는 테이블(2.2절, `raising_run` 포함)과 `session_info.bot_persona`를 지울지 (decisions.md 227·228번) | 전체 |
| 2 | 만료된 세션의 `session_info`·`raising_*` 행을 지우는 정리 작업과 주기 | session, raising |
| 3 | 끝난 회사의 보존 기간 | raising |
| 4 | 콘텐츠 정의 전체를 DB에 적재할지 (현재: 버전만 기록) | content |
| 5 | 운영 환경의 Flyway `outOfOrder` 정책 | 배포 |

## 10. 다음 단계

상태를 JSON 한 칸에 두는 구조가 관리자 기록이나 집계에서 불편해지면 그때 컬럼이나 테이블로 뺀다.

## 11. 쓰지 않는 테이블 상세 (기록)

> 기록: 지금 코드가 쓰지 않는 테이블의 설계다 (2.2절). 테이블은 DB에 남아 있다. 게임 시각(`game_day`)이나 카드 같은 개념과 규칙은 그때의 것이다. 옛 스펙(`docs/specs/*`)과 옛 마이그레이션 주석이 가리키는 "db.md 3.n절"은 아래의 "옛 3.n절"이다(옛 3.1절은 지금의 3.1절, 옛 3.12절은 지금의 3.4절). `market_*`, `household_*`, `housing_*`, `progress_log`·`progress_year`·`progress_month`·`progress_analysis`, `result_share`는 여기 적지 않았고 마이그레이션 파일과 옛 스펙에 있다.

### `raising_run` (3분 육성 판, decisions.md 228번에서 쓰지 않게 됨)

3분 육성 한 판이었다 (decisions.md 197·198번). 카드 12장의 짧은 판이라 상태를 JSON 한 칸에 두었다. 육성 판 엔진·저장·API(`/api/runs`)를 지울 때 테이블은 남겼다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | PK. 판 ID |
| session_id | uuid | 세션 ID (참조만) |
| status | text | `ACTIVE`, `ENDED`, `ABANDONED`. CHECK |
| seed | bigint | 판 시드 |
| scripted | boolean | 세션의 짜인 첫 판이었는가 (decisions.md 204번) |
| state | jsonb | 판의 모든 상태(지금 카드, 능력치, 운용금·현금·빚, 종목, 뒤집힌 횟수, 투자 원칙 장치, 위기와 조짐 …) |
| content_version | text | 판을 시작할 때의 콘텐츠 버전 |
| created_at / updated_at | timestamptz | |
| ended_at | timestamptz | 끝나거나 버려진 시각 |

- 인덱스: `(session_id, created_at desc)`, 부분 유니크 인덱스 `(session_id) where status = 'ACTIVE'`(세션당 진행 중인 판 하나).

### 옛 ID 관계

```
session_info.id ─────────── progress_game.session_id
progress_game.id ─┬──────── character_profile.game_id
                  ├──────── asset_account.game_id
                  ├──────── event_instance.game_id
                  └──────── result_game.game_id
event_instance.id ─┬─────── event_resolution.event_id
                   ├─────── asset_ledger.event_id (거래 원인 기록용)
                   └─────── character_stat_log.event_id (성장 원인 기록용)
content_version.version ─── progress_game.content_version
```

### 옛 3.2절 `progress_game`

한 판의 상태를 소유한다. 다른 도메인이 쓰는 `game_id`를 발급한다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | PK, 이 값이 `game_id` |
| session_id | uuid | 세션 ID (참조만, FK 없음) |
| status | text | `ACTIVE`, `ENDED`, `ABANDONED`. CHECK |
| phase | text | 단계 코드 (확정: 단계가 필요하다). 투자 시작 전 `SAVING`, 사용자가 수락한 뒤 `INVESTING`, 종료 `ENDED`. 시작 전과 후의 이벤트 구성이 다르다. 투자 시작 제안 단계(`OFFER` 등)를 둘지는 스펙에서 정한다 |
| last_reported_day | integer | 클라이언트가 마지막으로 보고한 게임 일수. 감소 불가 |
| start_age | smallint | 시작 나이 |
| end_age | smallint | 종료 나이 |
| seed | bigint | 판 시드. 서버가 만든다 |
| content_version | text | 이 판이 쓰는 콘텐츠 버전 |
| version | integer | 낙관적 잠금 카운터 |
| created_at / updated_at | timestamptz | |
| ended_at | timestamptz | null이면 진행 중 |

- 인덱스: `(session_id, status)` (세션의 진행 중 판 조회), `(status, updated_at)` (방치된 판 정리)
- **세션당 `ACTIVE` 판은 1개다 (확정).** 부분 유니크 인덱스 `(session_id) where status = 'ACTIVE'`로 보장한다.
- **다시 시작하기를 지원한다 (확정).** 진행 중인 판을 `ABANDONED`로 바꾸고 새 판을 만든다. 끝나지 않은 판은 `result_game`에 저장하지 않는다 (제안).

난수 처리(제안): 난수 생성기의 진행 위치를 저장하지 않고, 판단마다 `seed`와 순번에서 **하위 시드를 유도**한다. 예: 이벤트 인스턴스의 시드는 `hash(seed, 'event', 이벤트 순번)`. 요청이 재시도되거나 순서가 바뀌어도 같은 결과가 나온다.

### 옛 3.3절 `character_profile`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| game_id | uuid | PK. 한 판에 캐릭터 하나 |
| job_code | text | 직업 코드. 직업 선택 이벤트 전에는 null |
| job_start_day | integer | 현재 직업을 시작한 게임 일수. 연차(연봉 상승) 계산에 쓴다 |
| interest_sector | text | 관심 섹터 코드. 성향 확정 전에는 null |
| investment_style | text | 기간 축 코드(short/long). 성향 이벤트로 확정되며, 이후 이벤트 구성에 영향을 준다. 확정 전에는 null |
| risk_profile | text | 위험 축 코드(bold/safe). 유형 이름에만 쓴다. 확정 전 null |
| mind_profile | text | 소신 축 코드(own/crowd). 유형 이름에만 쓴다. 확정 전 null |
| investor_type | text | 투자자 유형 코드 `{기간}-{위험}-{소신}`. 확정 전 null |
| name | varchar(16) | 사용자가 정한 이름(1~8자). 정하기 전 null. 별명 대신 이름 자리에 쓴다 (decisions.md 135번) |
| created_at / updated_at | timestamptz | |

### 옛 3.4절 `character_stat`

능력치를 행으로 저장해서 능력치 추가에 마이그레이션이 필요 없게 한다 (확정 방침의 구현).

| 컬럼 | 타입 | 비고 |
|---|---|---|
| game_id | uuid | PK의 일부 |
| stat_code | text | `insight`, `patience`, `courage`, `conviction`, `luck` 등. PK의 일부 |
| initial_value | smallint | 판 시작 시 랜덤으로 정해진 값 |
| value | smallint | 현재 값 |
| exp | integer | 성장 경험치 (성장 방식이 정해지면 사용, 미결정) |

- 운(`luck`)은 성장하지 않는다. 이 규칙은 애플리케이션이 지킨다.

### 옛 3.5절 `character_stat_log`

능력치 변화의 원인 기록. 결과 화면의 "경험치 상승"과 이후 분석에 쓴다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint | PK (identity) |
| game_id | uuid | |
| stat_code | text | |
| delta | smallint | |
| reason | text | `DEVIATION`, `TRAINING` 등 |
| event_id | uuid | 원인 이벤트 (null 가능, 참조만) |
| game_day | integer | |
| created_at | timestamptz | |

- 인덱스: `(game_id, id)`

### 옛 3.5-1절 `character_trait_score`

성향 이벤트의 선택을 점수로 누적한다. 투자 스타일과 관심 섹터를 확정하는 근거다 (character.md 4.3절).

| 컬럼 | 타입 | 비고 |
|---|---|---|
| game_id | uuid | PK의 일부 |
| trait_code | text | `style.<코드>`, `risk.<코드>`, `mind.<코드>`, `sector.<코드>`. PK의 일부 |
| score | integer | 누적 점수 |

### 옛 3.6절 `asset_account`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| game_id | uuid | PK |
| cash | bigint | 현재 현금 (원) |
| initial_cash | bigint | 판 시작 시 랜덤으로 정해진 값 |
| updated_at | timestamptz | |

### 옛 3.7절 `asset_holding`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| game_id | uuid | PK의 일부 |
| sector_code | text | PK의 일부 |
| amount | bigint | 현재 평가액 (원) |
| updated_at | timestamptz | |

- 보유가 0이 되어도 행을 지우지 않고 0으로 둔다 (제안). 조회와 갱신이 단순해진다.

### 옛 3.8절 `asset_ledger` (월급 중복 방지 인덱스는 아래 참고)

현금과 평가액의 모든 변화를 남기는 장부. 총자산 검증과 결과 분석에 쓴다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint | PK (identity) |
| game_id | uuid | |
| game_day | integer | |
| kind | text | `BUY`, `SELL`, `SALARY`, `PRICE_CHANGE` 등 |
| sector_code | text | 매매·주가 변동일 때 |
| amount | bigint | 변화량 (원). 부호 있음 |
| cash_after | bigint | 변화 직후 현금 |
| event_id | uuid | 원인 이벤트 (null 가능, 참조만) |
| created_at | timestamptz | |

- 인덱스: `(game_id, id)`
- 부분 유니크 인덱스: `(game_id, game_day) where kind = 'SALARY'` — 같은 날 월급이 중복 입금되지 않게 한다 (asset.md 6절)

### 옛 3.9절 `event_instance`

발생한 이벤트 하나. 숨은 값을 포함하며 **이 테이블의 숨은 값은 API 응답에 내려가지 않는다.**

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | PK |
| game_id | uuid | |
| seq | integer | 판 안에서의 발생 순번 |
| chain_code | text | 연결된 뉴스 묶음(이야기)의 코드. 연결되지 않으면 null |
| parent_event_id | uuid | 이 이벤트를 일으킨 앞선 이벤트 ID (참조만). 첫 이벤트는 null |
| depth | smallint | 연결 깊이. 첫 이벤트는 0 |
| branch_code | text | 앞선 이벤트의 결과에 따라 갈린 갈래 코드. 갈래가 없으면 null |
| kind | text | `NEWS`, `JOB`, `TRAIT`, `NOTICE` 등 |
| definition_code | text | 콘텐츠의 이벤트 정의 코드 (참조만) |
| sector_code | text | 뉴스 이벤트일 때 |
| occurs_day | integer | 발생 게임 일수 |
| skippable | boolean | 선택형은 false, 알림성은 true |
| status | text | `SCHEDULED`(미래에 예약됨), `PENDING`(사용자에게 전달됨), `RESOLVED`, `SKIPPED`. CHECK (event.md) |
| options | jsonb | 사용자에게 보여 준 선택지 코드 목록. 직업처럼 뽑는 선택지를 재접속해도 같게 보이려고 저장한다 |
| hidden_direction | text | `UP`, `DOWN`. 뉴스일 때. 숨은 값 |
| hidden_magnitude_bp | integer | 변동 폭 (1bp = 0.01%). 숨은 값 |
| hint_code | text | 안목으로 뽑힌 힌트 문구 코드. 재접속 시 같은 문구를 보여 주려고 저장 |
| sway_sentiment | text | 줏대 판정용 다른 뉴스의 분위기 `POS`, `NEG` |
| sway_code | text | 그 뉴스의 문구 코드 |
| created_at / resolved_at | timestamptz | |

- 유니크: `(game_id, seq)`
- 인덱스: `(game_id, status, occurs_day)` (대기·예약된 이벤트와 다음 발생 일수 조회), `(game_id, kind, occurs_day)` (종류별 마지막 발생 조회)

### 옛 3.10절 `event_resolution`

선택형 이벤트의 해결 기록. "선택 → 실제 행동"을 남긴다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| event_id | uuid | PK (이벤트당 하나, 재시도 시 중복 방지) |
| game_id | uuid | |
| choice | text | 사용자가 누른 선택 |
| actual_action | text | 판정을 거쳐 실제로 일어난 행동 |
| created_at | timestamptz | |

### 옛 3.11절 `event_deviation`

이탈 원인. 한 번의 해결에 원인이 둘 이상일 수 있어 별도 테이블로 둔다 (줏대와 용기가 연달아 작용할 수 있다).

| 컬럼 | 타입 | 비고 |
|---|---|---|
| event_id | uuid | PK의 일부 |
| step | smallint | 판정 순서. PK의 일부 |
| stat_code | text | 이탈을 일으킨 능력치 |
| from_action | text | 이 단계 전 행동 |
| to_action | text | 이 단계 후 행동 |

### 옛 3.13절 `result_game`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| game_id | uuid | PK |
| session_id | uuid | |
| content_version | text | |
| initial_asset | bigint | 시작 총자산 (원) |
| final_asset | bigint | 최종 총자산 (원) |
| final_age | smallint | |
| started_at / ended_at | timestamptz | |
| stats_snapshot | jsonb | 종료 시점 능력치 (확정: 저장한다). not null |
| summary | jsonb | 이탈 횟수 등 요약. 활용 방안이 정해질 때 확장 |

- 인덱스: `(session_id, ended_at desc)` (세션의 이전 결과 조회)
- **세션이 만료되면 이 행도 함께 지운다** (확정). 이 테이블은 개인과 연결되는 기록이므로 보존하지 않는다.

### 옛 3.14절 `result_stat`

> 설계만 했고 마이그레이션이 만들지 않았다. DB에 이 테이블은 없다.

개인과 연결되지 않는 집계용 기록. 판이 정상적으로 끝날 때 `result_game`과 같은 트랜잭션에서 한 행을 쌓는다 (제안). **세션 ID와 `game_id`를 저장하지 않는다.** 세션이 만료되어 `result_game`이 지워져도 이 행은 남는다 (확정: 개인과 연결되지 않는 집계만 남긴다).

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint | PK (identity). 다른 테이블과 연결되지 않는 행 ID |
| content_version | text | |
| ended_on | date | 종료 날짜만 저장한다. 시각은 저장하지 않는다 (개인을 좁혀낼 단서를 줄인다) |
| final_age | smallint | |
| initial_asset | bigint | |
| final_asset | bigint | |
| job_code | text | |
| investment_style | text | |
| interest_sector | text | |
| stats_snapshot | jsonb | 종료 시점 능력치 |
| deviation_counts | jsonb | 능력치별 이탈 횟수 |

- 끝나지 않은 판(다시 시작하기, 방치)은 쌓지 않는다.
- 필요한 집계(평균, 분포 등)는 이 테이블에서 조회 시점에 계산한다. 미리 집계 테이블을 만들지 않는다 (제안). 행이 많아지면 그때 집계 테이블을 추가한다.

### 옛 3.15절 `result_profile`

비슷한 플레이어를 찾기 위한 익명 행동 프로필 ([행동 프로필·봇 설계](./superpowers/specs/2026-10-27-play-profile-bots-design.md) 3절). `result_stat`처럼 **세션 ID와 `game_id`를 저장하지 않고**, 세션이 만료돼도 남는다. 투자를 시작한 판이 끝날 때 `result_game`과 같은 트랜잭션에서 한 행을 쌓는다. `result_game`이 이미 있으면 쌓지 않는다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint | PK (identity) |
| content_version | text | |
| ended_on | date | 종료 날짜만 |
| final_age | smallint | |
| ending | text | `NORMAL`, `BANKRUPT`, `QUIT` |
| bot_persona | text | 봇의 판이면 페르소나, 사람이면 null |
| habits | vector(6) | 0~1 습관 지표, 모두 확률이 끼기 전에 고른 행동: 뉴스 매수·매도, 흔들림 버티기, 빚투, 자유 매매 빈도, 분산 (`PlayProfile.Habits` 순서) |
| invested | bigint | 체결된 매수 금액 누계 |
| invest_pnl | bigint | 매도 금액 + 남은 평가액 − 매수 금액 |
| invest_return_bp | integer | invest_pnl / invested (만분율). 판정·운이 섞인 게임 점수다 |

- `vector` 열은 pgvector 확장을 쓴다. 마이그레이션이 `CREATE EXTENSION IF NOT EXISTS vector`를 하므로 DB 사용자가 확장을 만들 수 있어야 한다. 로컬·테스트는 `pgvector/pgvector:pg17` 이미지다.
- 인덱스는 아직 없다. 행이 수천 개면 이웃 찾기를 전부 비교로 해도 충분하다. 수만 개가 넘으면 HNSW 인덱스를 검토한다.

### 옛 3.16절 `result_ranking`

최종 자산 순위표 (decisions.md 141번). 판이 끝난 뒤 사용자가 이름을 적어 올린 줄만 쌓인다. `result_profile`처럼 **세션 ID를 저장하지 않아** 세션이 만료돼도 남는다. 판마다 한 줄만 허용하려고 `game_id`를 PK로 쓴다 (올린 사람이 공개를 택한 기록이라 판 ID를 남겨도 익명성 결정과 어긋나지 않는다).

| 컬럼 | 타입 | 비고 |
|---|---|---|
| game_id | uuid | PK. 판마다 한 번만 올릴 수 있다 |
| name | varchar(16) | 올린 이름. 캐릭터 이름과 같은 1~8자 규칙(앱에서 검사) |
| final_asset | bigint | 최종 총자산 (원). 파산이면 음수 |
| final_age | smallint | |
| ending | text | `NORMAL`, `BANKRUPT`, `QUIT` |
| job_title | text | 끝날 때의 직업 이름. 전업투자자는 "전업투자자", 없으면 null |
| entered_at | timestamptz | 올린 시각. 자산이 같으면 먼저 올린 사람이 앞 |

- 인덱스: `(final_asset desc, entered_at)` — 순위표 조회와 내 순위 계산(나보다 자산이 많거나, 같은데 먼저 올린 줄 수)이 이 순서를 쓴다.

### 옛 데이터 생명주기

FK가 없으므로 정합성은 애플리케이션이 지킨다.

**판 시작 순서** (진행이 조율, 한 트랜잭션)

1. `progress_game` 생성 → `game_id` 확보
2. 캐릭터 생성 요청 → `character_*` (능력치와 초기 자산 값은 시드로 정해짐)
3. 자산 계정 생성 요청 → `asset_account`

각 도메인의 생성은 `game_id` 유니크 제약으로 **멱등**하게 한다. 재시도해도 중복되지 않는다.

**판 종료**

1. 진행이 `status = ENDED`로 바꾸고 결과 도메인에 저장을 요청한다 (`result_game`).
2. 종료된 판의 상세 데이터(`asset_ledger`, `event_*`, `character_stat_log`)는 세션이 만료될 때 함께 지운다.

**세션 만료와 데이터 정리 (확정)**

- 로그인 기능은 없다. 익명 세션은 마지막 접속 후 하루가 지나면 만료되고, 그 세션에 묶인 데이터를 정리 작업이 지운다.
- 정리 작업은 주기적으로 실행된다. 주기는 구현 단계에서 정한다.
- 정리는 진행이 각 도메인의 삭제 인터페이스에 `game_id`를 넘겨 호출한다. 다른 도메인의 테이블을 직접 지우지 않는다.
- 판이 정리된 뒤에 만료된 세션 행을 지운다.
- 진행 중이던 판이 있는 세션이 만료되면 그 판은 `ABANDONED`로 바꾼 뒤 지운다.
- 결과 기록(`result_game`)도 같이 지운다. 개인과 연결되지 않는 집계 행(`result_stat`, 3.14절)과 사용자가 스스로 올린 순위표 줄(`result_ranking`, 3.16절)만 남는다.

**고아 데이터 방지**

- 다른 도메인의 행이 먼저 만들어지는 일이 없도록 항상 `progress_game`을 먼저 만든다.
- 정기 점검 쿼리(예: 진행에 없는 `game_id`를 가진 행 찾기)는 운영 단계에서 추가한다.

### 옛 동시성

- 한 판에 대한 요청은 **`progress_game` 행을 `SELECT ... FOR UPDATE`로 잠그고** 시작한다. 진행이 조율하는 한 요청은 판 단위로 직렬화된다 (제안).
- 같은 요청이 재시도될 때: 선택 제출은 `event_resolution.event_id` 유니크로, 시각 보고는 `last_reported_day`가 감소하지 않는다는 규칙으로 중복 처리를 막는다.
- 한 DB, 한 스키마이므로 도메인을 가로지르는 처리를 **한 DB 트랜잭션**으로 묶는다. MSA 분리를 하지 않으므로 보상 트랜잭션은 필요 없다.

### 옛 미결정 사항

| # | 질문 | 영향 |
|---|---|---|
| 1 | 게임 시각의 단위와 보고 구간 (`game_day` 가정) | progress, event, asset |
| 2 | 시작·종료 나이 | progress |
| 3 | 능력치 성장 방식 (`exp` 컬럼 사용 여부) | character |
| 4 | 세션당 동시에 여러 판 허용 여부 | progress, session |
| 5 | 콘텐츠 정의 전체를 DB에 적재할지 (현재: 버전만 기록) | content |
| 6 | 결과에 능력치 스냅샷을 넣을지 | result |
| 7 | 종료된 판의 상세 데이터 보존 기간, 방치된 판의 기준 기간 | progress, 각 도메인 |
| 8 | 세션 만료 기간과 토큰 전달 방식 | session |
| 9 | 단계(`phase`) 코드의 목록과 전환 조건 | progress |
| 10 | 단일 스키마에서도 다른 도메인 테이블 조회 금지 규칙을 유지할지 (추천: 유지) | 전체 |
| 11 | 운영 환경의 Flyway `outOfOrder` 정책 | 배포 |
