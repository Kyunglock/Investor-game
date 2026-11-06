/**
 * 구글 애드센스 (decisions.md 271번, #224). 게시자 ID(ca-pub-숫자)와 광고 단위 번호는 빌드 환경 변수로 받는다: 비어 있으면 광고 스크립트를 부르지 않고
 * 광고 자리도 그리지 않는다. 개발·E2E는 비워 두므로 광고가 없다. 운영은 저장소 변수(ADSENSE_CLIENT·ADSENSE_SLOT_START)를 채우면 켜진다.
 */

/** 게시자 ID 꼴: ca-pub- 뒤에 숫자. */
const CLIENT = /^ca-pub-\d{10,20}$/

/** 광고를 켤 수 있는 게시자 ID인가. */
export function validClient(client: string | undefined): client is string {
  return Boolean(client && CLIENT.test(client))
}

/** 광고 단위 번호 꼴: 숫자. */
export function validSlot(slot: string | undefined): slot is string {
  return Boolean(slot && /^\d{6,20}$/.test(slot))
}

/** 배포 도메인 루트의 ads.txt 한 줄. 게시자 ID의 "ca-" 앞머리를 뗀다. */
export function adsTxt(client: string): string {
  return `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`
}

export const ADSENSE_CLIENT: string = import.meta.env.VITE_ADSENSE_CLIENT ?? ''
export const ADSENSE_SLOT_START: string = import.meta.env.VITE_ADSENSE_SLOT_START ?? ''

let loading: Promise<void> | null = null

/** 광고 스크립트를 한 번만, 늦게 부른다: 광고 자리가 처음 그려질 때. 첫 화면 로딩을 막지 않는다. */
export function loadAdsense(client: string): Promise<void> {
  if (loading) {
    return loading
  }
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.crossOrigin = 'anonymous'
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('광고 스크립트를 불러오지 못했다'))
    document.head.appendChild(script)
  })
  return loading
}
