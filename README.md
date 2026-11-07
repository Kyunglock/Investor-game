# Investor Game

증권사 사장이 되어 사재 100b(게임 금액 단위, 1b = 100만)로 회사를 차린다. 채용권으로 직원을 뽑고(같은 등급 셋을 합치면 한 단계 오른다) 자리에 앉히면, 직원들이 성격(능력치)대로 굴리고 확률로 손이 뒤집힌다. 회사는 해마다 이어진다(회사 매각은 지금 뺐다, decisions.md 236번). 설계는 [증권사 육성 설계](./docs/superpowers/specs/2026-11-05-brokerage-raising-design.md).

설계 문서는 [`docs/`](./docs)에 있다. 처음이라면 [`docs/architecture.md`](./docs/architecture.md)(구조와 API), [`docs/domains.md`](./docs/domains.md)(도메인과 용어), [`docs/db.md`](./docs/db.md)(테이블), [`docs/decisions.md`](./docs/decisions.md)(결정, 228번부터가 지금 흐름) 순으로 읽는다. 옛 "투자자 인생 시뮬레이터"(#292)와 3분 육성 판(decisions.md 228번)의 코드는 지웠고, 그때의 문서는 기록으로 남아 있다.

## 구성

| 폴더 | 내용 |
|---|---|
| `backend/` | Spring Boot (Java 21, Gradle). 게임 규칙 계산과 저장. 도메인은 육성(`raising`, 회사)·행동(`behavior`)·콘텐츠(`content`)·세션(`session`) |
| `frontend/` | React + Vite (TypeScript, pnpm). 웹 화면과 그림. 규칙은 모른다. `frontend/e2e/`에 Playwright 테스트 |
| `app/` | 안드로이드 앱 (Capacitor, [`docs/app.md`](./docs/app.md)). 폰 게임처럼 한 화면씩 넘기는 앱 전용 화면. 그림·회의 창·게임 상태는 `frontend/src`를 그대로 가져다 쓴다. `app/android/`가 안드로이드 프로젝트 |
| `contracts/openapi/` | 클라이언트와 서버의 API 계약 |
| `content/` | 직접 작성한 콘텐츠 (JSON): 회사 문구·자리·시대·단골 인물(`raising.json`), 뉴스와 단서 기사 문장, 종목, 위기와 조짐, 꼬드김 문구 |
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

서버를 `ADMIN_TOKEN` 환경 변수와 함께 띄우고 `http://localhost:5173/admin`에서 그 토큰을 넣으면, 누가(익명 세션 + 접속 IP) 언제 회사를 차렸고 첫 회사가 몇 년 차에서 멈췄는지 볼 수 있다. 토큰을 비워 두면 관리자 API는 꺼진다. 서버 로그에도 `investorgame.play` 로거로 회사의 차림·뽑기·투자 회의·결산이 IP와 함께 남는다.

```bash
cd backend
ADMIN_TOKEN=아무-비밀값 ./gradlew bootTestRun
```

### 안드로이드 앱 (APK)

앱 전용 화면(`app/`)을 WebView에 담은 앱이다 ([`docs/app.md`](./docs/app.md)). 앱 화면은 웹과 같이 `https://game.kwaklabs.com/app/`에 배포되고, GitHub Actions의 **Android** 워크플로를 돌리면 그 주소를 띄우는 `app-debug.apk`가 Artifacts에 생긴다.

```bash
cd frontend && pnpm install      # 앱이 frontend/src를 쓴다
cd ../app && pnpm install
pnpm dev                         # http://localhost:5173/app/
pnpm apk                         # Android Studio가 있으면 → android/app/build/outputs/apk/debug/app-debug.apk
```

### 광고 켜기 (구글 애드센스)

게시자 ID가 없으면 광고는 꺼져 있다. 애드센스 승인 뒤 GitHub 저장소 Settings → Secrets and variables → Actions → Variables에 `ADSENSE_CLIENT`(ca-pub-…)와 `ADSENSE_SLOT_START`(광고 단위 번호)를 넣고 배포하면 첫 화면에 광고가 뜨고 `ads.txt`가 배포 루트에 생긴다. 로컬에서는 `VITE_ADSENSE_CLIENT=… VITE_ADSENSE_SLOT_START=… pnpm dev`. 개인정보처리방침은 `/privacy` (decisions.md 271번).

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
