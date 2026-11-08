import { money } from '@web/features/game/labels'
import { useRaisingStore } from '@web/features/raising/store'
import { useEffect } from 'react'
import { companyEvents, type FxEvent } from './events'
import { useFx } from './fx'
import { haptic } from './haptics'
import { sfx } from './sound'

const signed = (n: number) => `${n > 0 ? '+' : ''}${money(n)}`
const capitalEl = () => document.querySelector('[data-testid="company-capital"]')
const settleEl = () => document.querySelector('[data-testid="settle"]')

/** 일어난 일 하나를 효과로 (decisions.md 310번). */
export function playEvent(e: FxEvent) {
  const fx = useFx.getState()
  switch (e.kind) {
    case 'capital':
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
    case 'quarter':
      if (e.crash) {
        fx.shakeScreen()
        fx.flashScreen('rgba(195,58,44,0.35)')
        sfx.thud()
        haptic.heavy()
      } else if (e.delta >= 0) {
        fx.burstAt(settleEl(), 'sparks')
        sfx.cash()
        haptic.medium()
      } else {
        fx.burstAt(settleEl(), 'smoke')
        sfx.thud()
        haptic.medium()
      }
      return
    case 'year-end':
      fx.flashScreen(e.delta >= 0 ? 'rgba(224,180,74,0.35)' : 'rgba(45,95,166,0.35)')
      if (e.delta >= 0) {
        sfx.cash()
      } else {
        sfx.thud()
      }
      if (e.achieved.length > 0) {
        fx.burstAt(null, 'confetti')
        sfx.fanfare()
      }
      haptic.success()
      return
    case 'grade-up':
      fx.burstAt(null, 'confetti')
      fx.flashScreen('rgba(245,211,107,0.4)')
      sfx.fanfare()
      haptic.success()
      return
    case 'grade-down':
      fx.shakeScreen()
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
    case 'broke':
      fx.shakeScreen()
      fx.flashScreen('rgba(139,35,66,0.5)')
      sfx.thud()
      haptic.error()
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
