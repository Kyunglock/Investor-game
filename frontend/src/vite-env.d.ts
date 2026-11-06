/** 빌드 환경 변수. 광고(decisions.md 271번)는 비어 있으면 켜지 않는다. API 주소(306번)는 앱이 다른 출처의 서버를 부를 때만 채운다. */
interface ImportMetaEnv {
  readonly VITE_ADSENSE_CLIENT?: string
  readonly VITE_ADSENSE_SLOT_START?: string
  readonly VITE_API_BASE?: string
}
