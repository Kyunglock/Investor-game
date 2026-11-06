/** 빌드 환경 변수 (decisions.md 271번). 비어 있으면 광고를 켜지 않는다. */
interface ImportMetaEnv {
  readonly VITE_ADSENSE_CLIENT?: string
  readonly VITE_ADSENSE_SLOT_START?: string
}
