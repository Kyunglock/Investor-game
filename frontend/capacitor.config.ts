import type { CapacitorConfig } from '@capacitor/cli'

/**
 * 안드로이드 앱 (decisions.md 306번, docs/app.md). 웹을 WebView에 담는 껍데기다. 두 가지 방식:
 * - `CAP_SERVER_URL`이 있으면 앱은 그 주소(운영 웹)를 그대로 띄운다. API와 세션 쿠키가 웹과 같은 출처라 서버를 손대지 않는다. 기본.
 * - 없으면 `dist`를 앱 안에 담는다. 그때 API는 `VITE_API_BASE`로 가므로 서버에 `api.cors.origins`와 `session.cookie-same-site: None`을 둬야 한다.
 */
const serverUrl = process.env.CAP_SERVER_URL?.trim()

const config: CapacitorConfig = {
  appId: 'com.kyunglock.investorgame',
  appName: '증권사 사장',
  webDir: 'dist',
  server: serverUrl
    ? { url: serverUrl, cleartext: serverUrl.startsWith('http://') }
    : { androidScheme: 'https' },
  android: {
    // 운영 서버는 https다. 앱 안의 화면도 https 출처(androidScheme)라 섞인 콘텍스트를 허용할 까닭이 없다.
    allowMixedContent: false,
  },
}

export default config
