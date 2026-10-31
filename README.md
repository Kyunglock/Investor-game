# Investor Game

뉴스 이벤트를 보고 매수·매도·관망을 고르며 자산을 불리는 투자자 시뮬레이터. 사용자의 선택이 캐릭터 능력치에 따라 확률로 뒤집히는 것이 핵심이다.

설계 문서는 [`docs/`](./docs)에 있다. 처음이라면 [`docs/decisions.md`](./docs/decisions.md)와 [`docs/architecture.md`](./docs/architecture.md)부터 읽는다.

## 구성

| 폴더 | 내용 |
|---|---|
| `backend/` | Spring Boot (Java 21, Gradle). 게임 규칙 계산과 저장 |
| `frontend/` | React + Vite (TypeScript, pnpm). 화면과 게임 시계. `frontend/e2e/`에 Playwright 테스트 |
| `contracts/openapi/` | 클라이언트와 서버의 API 계약 |
| `content/` | 직접 작성한 이벤트 데이터 (JSON) |
| `docs/` | 설계 문서와 도메인 스펙 |

## 필요한 것

- Java 21, Node 24, Docker
- pnpm은 `corepack enable`로 켠다

## 실행

```bash
# 1) 서버 — Testcontainers가 Postgres를 띄우므로 Docker만 있으면 된다
cd backend
./gradlew bootTestRun

# (또는 로컬 Postgres를 쓰려면) 저장소 루트에서
docker compose up -d
cd backend && ./gradlew bootRun

# 2) 웹 — http://localhost:5173 (API는 Vite가 서버로 프록시한다)
cd frontend
pnpm install
pnpm dev
```

### 플레이 기록 보기 (관리자)

서버를 `ADMIN_TOKEN` 환경 변수와 함께 띄우고 `http://localhost:5173/admin`에서 그 토큰을 넣으면, 누가(익명 세션 + 접속 IP) 언제 몇 판을 했고 어디까지 갔는지 볼 수 있다. 토큰을 비워 두면 관리자 API는 꺼진다. 서버 로그에도 `investorgame.play` 로거로 판 시작·첫 직업·종료가 IP와 함께 남는다.

```bash
cd backend
ADMIN_TOKEN=아무-비밀값 ./gradlew bootTestRun
```

### 봇 플레이어로 행동 프로필 쌓기

> 게임 규칙이 확정된 뒤에 돌린다. 규칙이 바뀌면 그 전에 쌓은 프로필은 새 규칙과 맞지 않는다.

비슷한 플레이어 추천에 쓸 익명 행동 프로필(`result_profile`)을 봇으로 쌓는다. 봇은 성향이 다른 페르소나 8종(겁쟁이·존버·추격자·역발상·빚투·관망·단타·분산)으로 실제 API를 써서 70세까지 플레이한다. 판이 끝나면 서버가 프로필을 쌓고 봇 판에는 페르소나가 붙는다. 자세한 것은 [행동 프로필·봇 설계](./docs/superpowers/specs/2026-10-27-play-profile-bots-design.md).

```bash
# 1) 데이터가 남는 로컬 Postgres로 서버를 띄운다 (bootTestRun의 DB는 서버를 끄면 사라진다)
docker compose up -d
cd backend && ADMIN_TOKEN=아무-비밀값 ./gradlew bootRun

# 2) 다른 터미널에서. 페르소나마다 50판(모두 400판), 4판씩 동시에. 4코어에서 2~3시간
cd frontend
pnpm bots --token 아무-비밀값 --games 50 --concurrency 4
```

`--personas panic,holder`로 일부 페르소나만, `--seed`로 다른 판을 돌릴 수 있다. 같은 시드면 봇의 선택은 같지만 판 시드는 서버가 정하므로 판은 매번 다르다.

## 검사

```bash
cd backend && ./gradlew spotlessCheck test   # 단위·통합 테스트, 도메인 경계, 마이그레이션 규칙

cd frontend
pnpm check          # Biome 린트·포맷
pnpm exec tsc -b    # 타입 검사
pnpm test           # Vitest
pnpm e2e            # Playwright (서버와 웹을 직접 띄운다. Docker 필요)
pnpm gen:api        # 계약을 바꾼 뒤 클라이언트 타입 다시 생성
```

포맷 자동 수정: 서버 `./gradlew spotlessApply`, 웹 `pnpm format`.
