# 안드로이드 앱

> 상태: v0.4 (2026-11-07, decisions.md 306·307·309·310·312번). 웹과 같은 서버·규칙을 쓰되, 폰 게임처럼 **한 화면씩 넘기는 앱 전용 화면**(`app/`)을 Capacitor WebView에 담은 안드로이드 앱이다.

## 1. 무엇인가

- `app/`이 앱 패키지다. `app/src/`가 앱 화면, `app/android/`가 안드로이드 프로젝트, `app/capacitor.config.ts`가 앱 이름(증권사 사장)·패키지(`com.kyunglock.investorgame`)·화면을 어디서 가져올지를 정한다.
- **앱 화면은 웹 화면과 다르다.** 웹(`frontend/`)은 공문서 한 장을 내리며 읽는 꼴이고, 앱은 위에 머리띠(건물·해·분기·자본), 가운데 장면 하나, 아래에 분기 넘기기 버튼과 다섯 탭(사무실·채용·배치·이슈·기록)이다. 바깥은 스크롤하지 않고 장면 안에서만 움직이며, 자리 고르기·자리 카드는 아래에서 올라오는 시트다. 채용은 뽑기·합성·도감으로 나뉘고, 뽑으면 카드가 하나씩 뒤집힌다(특급은 금빛으로 떨다가 늦게 열리며 화면이 번쩍이고 색종이가 터진다, 312번).
- **같은 것을 그대로 쓴다.** 앱은 `frontend/src`를 `@web/*`로 불러 API 클라이언트·게임 상태(스토어)·도트 그림(건물·사무실·사람)·캐릭터 카드·회의 창(거시경제·종목)·결산서·분기 실적·이사 장면·사표·엔딩·튜토리얼·자동 진행을 다시 만들지 않고 쓴다. 규칙은 서버에 있다.
- 세로 고정, 상태바 숨김(`styles.xml`), 안드로이드 뒤로 가기는 시트 닫기 → 사무실 탭 → 앱을 뒤로 보내기 순(`@capacitor/app`). 앱 안에서는 서비스 워커를 등록하지 않고 애드센스 광고를 그리지 않는다.
- **테마와 임팩트** (310번): 어두운 바탕 위에 종이빛 카드(카드 안은 웹과 같은 색이라 회의 창·결산서·캐릭터 카드가 그대로 맞는다), 아래 모서리가 두꺼운 게임 버튼(`.btn .btn-primary/-gold/-blue/-teal/-ghost/-line`), 장면은 탭 순서대로 옆에서 밀려 들어온다. `app/src/fx/`가 효과를 맡는다: `sound.ts`(Web Audio로 만든 톡·코인·금고·쿵·도장·팡파르, 머리띠의 스피커로 끄기), `haptics.ts`(Capacitor 햅틱, 브라우저는 vibrate), `fx.ts`+`FxLayer.tsx`(캔버스 위의 코인·색종이·불꽃·연기 터짐, 번쩍임, 떠오르는 글), `events.ts`+`useCompanyFx.ts`(서버 응답 전후를 견줘 자본 변화·뽑기·이직·분기 실적(폭락이면 화면 흔들림)·연말 결산·이사·엔딩·파산을 찾아 효과로). 머리띠의 자본은 숫자가 굴러간다(`useCountUp`).
- **멘탈 전투** (decisions.md 328번, [설계](./superpowers/specs/2026-11-07-mental-battle-design.md)): 분기 넘기기를 누르면 회의 뒤, 결산 직전에 `app/src/mental/`의 창이 뜬다. 서버가 정한 장르(공격·디펜스, 329번)와 이벤트 머리글을 보고 멘탈 카드 한 장을 고른 뒤, Phaser 3(`battle.ts`, `import()`로 늦게 불러 1.2MB 덩어리가 따로 간다)로 45초 한 판을 치르고(그림은 `art.ts`: 아군은 사무실의 도트 직원 그대로, 적 넷과 장르별 바닥은 같은 화풍으로 코드로 그려 굽는다, #423) 결과를 `POST /api/company/mental`로 보낸다. 얼마나 세지는지는 서버가 정한다. 건너뛸 수 있고 자동 진행은 건너뛴다. 웹에는 없다.
- iOS는 아직 없다. `@capacitor/ios`를 더하고 `cap add ios`를 하면 같은 방식으로 붙는다(맥과 Xcode가 필요하다).

## 2. 화면을 어디서 가져오나

| 방식 | 언제 | 설정 | 서버 |
|---|---|---|---|
| **운영 웹의 /app/ 띄우기** (기본) | `CAP_SERVER_URL`이 없거나 주소일 때 | 앱 화면은 웹과 같이 배포되어 `https://game.kwaklabs.com/app/`에 있다(deploy.yml이 `app/dist`를 `web/app/`에 둔다). 앱은 그 주소를 WebView에 띄운다. 화면이 배포될 때마다 앱도 새 화면이다 | 손댈 것 없다. API와 세션 쿠키가 웹과 같은 출처다 |
| **화면 담기** | Run workflow의 `server_url`에 `none` | `app/dist`를 APK 안에 담는다. 앱의 출처는 `https://localhost`이고 API는 `VITE_API_BASE`(저장소 변수 `APP_API_BASE`)로 간다. 화면을 바꾸면 앱을 다시 내야 한다 | 다른 출처에서 부르므로 CORS와 쿠키를 열어야 한다: 환경 변수 `API_CORS_ORIGINS=https://localhost`, `SESSION_COOKIE_SAME_SITE=None` |

폰 브라우저로 `https://game.kwaklabs.com/app/`을 열면 앱과 같은 화면이 나온다(설치 없이 확인할 때).

## 3. 개발

```bash
cd frontend && pnpm install          # 앱이 frontend/src를 쓰므로 웹의 의존성이 있어야 한다
cd ../app && pnpm install
pnpm dev                             # http://localhost:5173/app/ (API는 localhost:8080으로 프록시)
pnpm check && pnpm exec tsc -b && pnpm test && pnpm build
```

서버 없이 화면만 보려면 `pnpm dev`를 띄운 채 `CHROMIUM_PATH=/경로/chrome node scripts/shot.ts`(가짜 회사 `scripts/fixture.ts`로 모든 장면을 `scripts/shots/`에 찍는다. `EMPTY=1`이면 제목 화면).

앱 화면을 고칠 때: 규칙·숫자·문구가 웹과 같아야 하는 것(회의 창, 결산서, 그림)은 `frontend/src`를 고친다(웹과 앱 둘 다 바뀐다). 틀·탭·시트·장면은 `app/src/app/`을 고친다.

## 4. APK 만들기

### GitHub Actions (권장)

`.github/workflows/android.yml`. Actions 탭 → **Android** → Run workflow. 아무것도 넣지 않으면 운영 웹의 앱 화면을 띄우는 APK가 나온다. `app/`이나 `frontend/src/`가 바뀐 PR과 main에서도 돈다.

| 저장소 설정 | 뜻 |
|---|---|
| 변수 `APP_SERVER_URL` | 앱이 띄울 주소를 운영 웹이 아닌 곳으로 바꿀 때 |
| 변수 `APP_API_BASE` | 화면 담기일 때 API 주소 |
| 시크릿 `ANDROID_KEYSTORE_BASE64` `ANDROID_KEYSTORE_PASSWORD` `ANDROID_KEY_ALIAS` `ANDROID_KEY_PASSWORD` | 있으면 서명한 배포용 APK도 만든다. 없으면 디버그 APK만 |

결과는 실행 결과의 Artifacts에서 `app-debug`(폰에 바로 설치), `app-release`(서명 키가 있을 때)를 받는다. 디버그 APK는 Play 프로텍트가 "잠재적으로 유해한 앱"이라 경고한다: 모르는 출처의 앱이라 그런 것이고 "무시하고 설치"·"닫기"로 지나간다. 경고를 줄이려면 고정 서명 키를, 없애려면 Play 콘솔 내부 테스트 트랙을 쓴다.

### 내 컴퓨터

Android Studio(또는 안드로이드 SDK와 Java 21)가 있어야 한다.

```bash
cd app
pnpm apk                                   # 앱 화면 빌드 → android에 복사 → 디버그 APK
# → android/app/build/outputs/apk/debug/app-debug.apk
pnpm open                                  # Android Studio로 열기 (에뮬레이터·실기기 실행)
CAP_SERVER_URL=http://192.168.0.10:5173/app/ pnpm apk   # 같은 Wi-Fi의 내 개발 서버(pnpm dev --host)로
```

서명 키 만들기(한 번): `keytool -genkeypair -v -keystore release.keystore -alias investor -keyalg RSA -keysize 2048 -validity 10000`. 이 파일은 저장소에 넣지 않는다. GitHub에는 `base64 -w0 release.keystore`(맥은 `base64 -i release.keystore`)의 값을 `ANDROID_KEYSTORE_BASE64`로 넣는다.

### 아이콘·시작 화면 다시 만들기

```bash
cd app && pnpm assets     # scripts/appAssets.ts가 assets/*.png를 그리고, @capacitor/assets가 res/의 크기별 그림을 만든다
```

## 5. 스토어에 올리려면 (아직 하지 않았다)

- 서명 키를 만들고 시크릿을 넣는다. `versionCode`·`versionName`은 `app/android/app/build.gradle`에서 올린다.
- Play 스토어는 APK가 아니라 **AAB**를 받는다: 워크플로의 `assembleRelease`를 `bundleRelease`로 바꾸면 `app/build/outputs/bundle/release/app-release.aab`가 나온다.
- 개인정보처리방침 주소(웹의 `/privacy`)를 스토어 등록 정보에 적는다.
- 시즌·친구·라이벌처럼 앱에서만 붙일 것은 증권사 육성 설계 10절에 있다. 아직 정하지 않았다.
