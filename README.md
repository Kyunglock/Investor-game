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
