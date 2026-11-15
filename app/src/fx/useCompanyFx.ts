import { money } from '@web/features/game/labels'
import { useRaisingStore } from '@web/features/raising/store'
import { useEffect } from 'react'
import { useAppUi } from '../app/ui'
import { companyEvents, type FxEvent } from './events'
import { useFx } from './fx'
import { haptic } from './haptics'
import { sfx } from './sound'

const signed = (n: number) => `${n > 0 ? '+' : ''}${money(n)}`
const capitalEl = () => document.querySelector('[data-testid="company-capital"]')

/** 일어난 일 하나를 효과로 (decisions.md 310번). */
export function playEvent(e: FxEvent) {
  const fx = useFx.getState()
  switch (e.kind) {
    case 'capital':
      // 자동 전투의 초당 수입 같은 작은 증감(1b 미만)과 메뉴가 열려 있을 때의 증감은 띄우지 않는다: 숫자가 메뉴 위로 계속 떠다녔다 (492번).
      if (Math.abs(e.delta) < 1_000_000 || useAppUi.getState().modalBack) return
      fx.floatAt(capitalEl(), signed(e.delta), e.delta > 0 ? 'up' : 'down')
      if (e.delta > 0) {
        sfx.coin()
      }
      return
    case 'hired':
      // 뽑기는 카드를 뒤집는 창(GachaReveal)이 카드마다 효과를 낸다 (312번).
      return
    case 'left':
      fx.burstAt(document.querySelector('[data-testid="hud"]'), 'smoke')
      return
    case 'grade-up':
      // 건물은 확장을 사서만 오르고(#803), 건물 확장 연출(ToyCityMove)이 힘 모으기·쾅·축하를 차례로 낸다: 여기서 먼저 터뜨리면 겹친다 (399번).
      return
    case 'grade-down':
      fx.burstAt(null, 'smoke')
      sfx.thud()
      haptic.error()
      return
    case 'opened':
      fx.burstAt(null, 'sparks')
      sfx.whoosh()
      return
    case 'landmark':
      fx.burstAt(null, 'confetti')
      sfx.fanfare()
      haptic.success()
      return
  }
}

/** 서버 응답으로 회사가 바뀔 때마다 효과를 낸다. 앱 맨 위에서 한 번만 쓴다. */
export function useCompanyFx() {
  useEffect(() => {
    return useRaisingStore.subscribe((state, prev) => {
      if (state.company === prev.company) {
        return
      }
      // 앱을 켜며 불러온 회사는 "일어난 일"이 아니다: 아직 ready가 아니었으면 효과를 내지 않는다.
      if (prev.status !== 'ready') {
        return
      }
      for (const e of companyEvents(prev.company, state.company)) {
        playEvent(e)
      }
    })
  }, [])
}
