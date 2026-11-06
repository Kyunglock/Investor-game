import { useEffect, useRef } from 'react'
import { ADSENSE_CLIENT, loadAdsense, validClient, validSlot } from './adsense'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

/**
 * 광고 자리 하나 (decisions.md 271번, #224). 게시자 ID나 광고 단위 번호가 없으면 아무것도 그리지 않는다. 있으면 높이를 미리 잡아(레이아웃이 밀리지
 * 않게) 반응형 광고를 하나 띄운다. 결정하는 순간(회의 창·결산서)에는 두지 않는다: 잘못 누르기 쉽고 정책 위반 위험이 있다.
 */
export function AdSlot({ slot, client = ADSENSE_CLIENT }: { slot: string; client?: string }) {
  const pushed = useRef(false)
  const enabled = validClient(client) && validSlot(slot)
  useEffect(() => {
    if (!enabled || pushed.current) {
      return
    }
    pushed.current = true
    loadAdsense(client)
      .then(() => {
        window.adsbygoogle = window.adsbygoogle ?? []
        window.adsbygoogle.push({})
      })
      .catch(() => {
        // 광고 차단기 등으로 못 불러와도 게임은 그대로 한다.
      })
  }, [enabled, client])
  if (!enabled) {
    return null
  }
  return (
    <aside className="mt-6 min-h-[120px]" aria-label="광고" data-testid="ad-slot">
      <p className="text-center text-[11px] text-muted">광고</p>
      <ins
        className="adsbygoogle block"
        style={{ display: 'block', minHeight: 100 }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  )
}
