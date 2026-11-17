/** 빌드 환경 변수. API 주소는 앱이 다른 출처의 서버를 부를 때만 채운다 (docs/app.md). */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_ADSENSE_CLIENT?: string
  readonly VITE_ADSENSE_SLOT_START?: string
  /** AdMob 보상형 광고 단위 번호 (589번). 비우면 구글의 시험 광고를 띄운다. */
  readonly VITE_ADMOB_REWARDED_ID?: string
}
