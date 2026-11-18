import type { CapacitorConfig } from '@capacitor/cli'

/**
 * 안드로이드 앱 (decisions.md 306·624번, docs/app.md). 두 가지 방식:
 * - 기본: `dist`(`pnpm build:bundled`)를 앱 안에 담는다. 화면은 앱 안의 https://localhost 에서 열리고 API만 `VITE_API_BASE`로 간다.
 *   서버에 `api.cors.origins`(https://localhost)와 `session.cookie-same-site: None`을 둬야 한다.
 * - `CAP_SERVER_URL`이 있으면 앱은 그 주소를 그대로 띄운다(내 개발 서버로 볼 때). 화면을 앱에 담지 않는다.
 */
const serverUrl = process.env.CAP_SERVER_URL?.trim() ?? ''

const config: CapacitorConfig = {
  appId: 'com.kyunglock.investorgame',
  appName: '매도벽 돌파냥',
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
