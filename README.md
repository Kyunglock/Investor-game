# Investor Game

증권사 사장이 되어 사재 1억 원으로 회사를 차린다. 해마다 공채 시장에서 지원자를 계약금을 주고 뽑아 자리에 앉히면, 직원들이 성격(능력치)대로 굴리고 확률로 손이 뒤집힌다. 세 해(한 시대)가 끝나면 회사를 팔고 아끼던 직원을 데려가 다시 차린다. 설계는 [증권사 육성 설계](./docs/superpowers/specs/2026-11-05-brokerage-raising-design.md).

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

서버를 `ADMIN_TOKEN` 환경 변수와 함께 띄우고 `http://localhost:5173/admin`에서 그 토큰을 넣으면, 누가(익명 세션 + 접속 IP) 언제 회사를 차렸고 첫 회사가 몇 년 차에서 멈췄는지 볼 수 있다. 토큰을 비워 두면 관리자 API는 꺼진다. 서버 로그에도 `investorgame.play` 로거로 회사의 차림·뽑기·결산·매각이 IP와 함께 남는다.

```bash
cd backend
ADMIN_TOKEN=아무-비밀값 ./gradlew bootTestRun
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
