# 안드로이드 앱

> 상태: v0.1 (2026-11-06, decisions.md 306번). 웹 게임을 Capacitor WebView에 담은 안드로이드 앱이다. 게임 규칙·화면은 웹과 같고, 서버도 같은 서버를 쓴다.

## 1. 무엇인가

- `frontend/android/`가 안드로이드 프로젝트다. `frontend/capacitor.config.ts`가 앱 이름(증권사 사장)·패키지(`com.kyunglock.investorgame`)·화면을 어디서 가져올지를 정한다.
- 앱은 **온라인 전용**이다(architecture.md 1절). 서버가 없으면 "서버에 연결할 수 없습니다"가 뜬다.
- 앱 안에서는 **서비스 워커를 등록하지 않고 애드센스 광고를 그리지 않는다**(`src/app/native.ts`의 `isNativeApp`). 웹 광고를 앱에 넣는 것은 애드센스 정책에 어긋난다. 앱 광고는 AdMob으로 따로 붙인다.
- 세로 화면으로 고정했다(`AndroidManifest.xml`의 `screenOrientation`). 아이콘·시작 화면은 `frontend/assets/`의 원본에서 `pnpm app:assets`로 만든다.
- iOS는 아직 없다. `@capacitor/ios`를 더하고 `cap add ios`를 하면 같은 방식으로 붙는다(맥과 Xcode가 필요하다).

## 2. 화면을 어디서 가져오나 (두 방식)

| 방식 | 언제 | 설정 | 서버 |
|---|---|---|---|
| **운영 웹 띄우기** (기본) | `CAP_SERVER_URL`이 있을 때 | 앱은 그 주소를 WebView에 띄운다. 화면이 배포될 때마다 앱도 새 화면이다 | 손댈 것 없다. API와 세션 쿠키가 웹과 같은 출처다 |
| **화면 담기** | `CAP_SERVER_URL`이 없을 때 | `dist`를 APK 안에 담는다. 앱의 출처는 `https://localhost`이고 API는 `VITE_API_BASE`(예: `https://example.com`)로 간다. 화면을 바꾸면 앱을 다시 내야 한다 | 다른 출처에서 부르므로 **CORS와 쿠키**를 열어야 한다: 환경 변수 `API_CORS_ORIGINS=https://localhost`, `SESSION_COOKIE_SAME_SITE=None` (`cookie-secure`는 이미 true) |

운영 웹 띄우기를 기본으로 둔 까닭: 서버를 바꾸지 않고, 화면을 배포하면 앱 사용자도 바로 새 화면을 본다. 화면 담기는 스토어 심사에서 "웹을 그대로 띄우는 앱"으로 걸릴 때를 위해 남겨 둔다.

클라이언트의 `VITE_API_BASE`가 비어 있으면 웹과 똑같이 같은 출처로 가고, 있으면 그 주소로 가며 `credentials: 'include'`로 쿠키를 보낸다(`src/api/client.ts`).

## 3. APK 만들기

### GitHub Actions (권장)

`.github/workflows/android.yml`. Actions 탭 → **Android** → Run workflow. `server_url`을 비우면 저장소 변수를 쓴다.

| 저장소 설정 | 뜻 |
|---|---|
| 변수 `APP_SERVER_URL` | 앱이 띄울 운영 웹 주소 (운영 웹 띄우기) |
| 변수 `APP_API_BASE` | 화면 담기일 때 API 주소. `APP_SERVER_URL`이 있으면 쓰지 않는다 |
| 시크릿 `ANDROID_KEYSTORE_BASE64` `ANDROID_KEYSTORE_PASSWORD` `ANDROID_KEY_ALIAS` `ANDROID_KEY_PASSWORD` | 있으면 서명한 배포용 APK도 만든다. 없으면 디버그 APK만 |

결과는 실행 결과의 Artifacts에서 `app-debug`(기기에 바로 설치해 보는 용도), `app-release`(서명 키가 있을 때)를 받는다. main에 `frontend/`의 변경이 들어와도 돈다.

### 내 컴퓨터

Android Studio(또는 안드로이드 SDK와 Java 21)가 있어야 한다.

```bash
cd frontend
pnpm install
CAP_SERVER_URL=https://운영-주소 pnpm app:apk     # dist 빌드 → android에 복사 → 디버그 APK
# → android/app/build/outputs/apk/debug/app-debug.apk
pnpm app:open                                        # Android Studio로 열기 (에뮬레이터·실기기 실행)
```

서명 키 만들기(한 번): `keytool -genkeypair -v -keystore release.keystore -alias investor -keyalg RSA -keysize 2048 -validity 10000`. 이 파일은 저장소에 넣지 않는다. GitHub에는 `base64 -w0 release.keystore`의 값을 `ANDROID_KEYSTORE_BASE64`로 넣는다.

### 아이콘·시작 화면 다시 만들기

```bash
cd frontend
pnpm app:assets          # scripts/appAssets.ts가 assets/*.png를 그리고, @capacitor/assets가 res/의 크기별 그림을 만든다
```

크로미움이 Playwright 기본 자리에 없으면 `CHROMIUM_PATH=/경로/chrome pnpm app:assets`.

## 4. 스토어에 올리려면 (아직 하지 않았다)

- 서명 키를 만들고 시크릿을 넣는다. `versionCode`·`versionName`은 `android/app/build.gradle`에서 올린다.
- Play 스토어는 APK가 아니라 **AAB**를 받는다: 워크플로의 `assembleRelease`를 `bundleRelease`로 바꾸면 `app/build/outputs/bundle/release/app-release.aab`가 나온다.
- 개인정보처리방침 주소(웹의 `/privacy`)를 스토어 등록 정보에 적는다.
- 시즌·친구·라이벌처럼 앱에서만 붙일 것은 증권사 육성 설계 10절에 있다. 아직 정하지 않았다.
