/** 빌드 환경 변수. API 주소는 앱이 다른 출처의 서버를 부를 때만 채운다 (docs/app.md). */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_ADSENSE_CLIENT?: string
  readonly VITE_ADSENSE_SLOT_START?: string
}
