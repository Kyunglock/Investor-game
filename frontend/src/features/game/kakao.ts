/**
 * 카카오톡 공유 (#275). 서버가 카카오 JavaScript 키를 주면 카카오 SDK를 한 번 불러와 피드 카드를 보낸다.
 * 키가 없거나 SDK를 못 불러오면 null이고, 화면은 휴대폰 공유창·링크 복사로 보낸다.
 */
import { api } from '../../api/client'

const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js'

interface KakaoSdk {
  init(key: string): void
  isInitialized(): boolean
  Share: { sendDefault(settings: unknown): void }
}

declare global {
  interface Window {
    Kakao?: KakaoSdk
  }
}

let loading: Promise<KakaoSdk | null> | null = null

export function kakao(): Promise<KakaoSdk | null> {
  loading ??= load().catch(() => null)
  return loading
}

async function load(): Promise<KakaoSdk | null> {
  const { data } = await api.GET('/api/share-config')
  const key = data?.kakaoJsKey?.trim()
  if (!key) {
    return null
  }
  if (!window.Kakao) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SDK_URL
      script.crossOrigin = 'anonymous'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('카카오 SDK를 불러오지 못했다'))
      document.head.appendChild(script)
    })
  }
  const sdk = window.Kakao
  if (!sdk) {
    return null
  }
  if (!sdk.isInitialized()) {
    sdk.init(key)
  }
  return sdk
}
