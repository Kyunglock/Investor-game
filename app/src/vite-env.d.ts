/** 빌드 환경 변수. API 주소는 앱이 다른 출처의 서버를 부를 때만 채운다 (docs/app.md). */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_ADSENSE_CLIENT?: string
  readonly VITE_ADSENSE_SLOT_START?: string
  /** AdMob 보상형 광고 단위 번호 (589번). 비우면 구글의 시험 광고를 띄운다. */
  readonly VITE_ADMOB_REWARDED_ID?: string
  /** '1'이면 테스트판의 입구가 열린 화면으로 만든다 (624번). 화면을 담은 테스트판 APK가 쓴다. */
  readonly VITE_APP_TEST?: string
}
