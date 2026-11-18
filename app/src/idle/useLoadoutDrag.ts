import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import { haptic } from '../fx/haptics'

/** 터치로 이만큼 머물면 집는다. 길게 누르지 않아도 되게 짧다: 목록을 넘기는 손짓은 이보다 먼저 움직인다. */
const HOLD_MS = 130

/** 끌다 놓은 손가락이 바로 내는 클릭은 이 안에 온다. 그 클릭만 삼키고, 사람이 다시 누르는 클릭은 삼키지 않는다. */
const CLICK_AFTER_DROP_MS = 80

/**
 * 터치는 잠깐 머물거나 옆으로 끌면 바로 집는다. 머물지 않고 위아래로 움직이면 목록을 넘기는 스크롤이다.
 * 손을 떼거나 화면을 떠나면 예약도 함께 취소한다.
 */
export function useLoadoutDrag<T>(
  accepts: (item: T, target: string) => boolean,
  drop: (item: T, target: string) => void,
  /** anyDirection: 스크롤하지 않는 칸(touch-action: none)에서 쓴다. 터치로 어느 쪽으로 움직여도 바로 집는다. */
  options: { anyDirection?: boolean } = {},
) {
  const [drag, setDrag] = useState<{ item: T; x: number; y: number; over: string | null } | null>(
    null,
  )
  const latest = useRef({ accepts, drop, options })
  latest.current = { accepts, drop, options }
  const press = useRef<{
    item: T
    id: number
    x: number
    y: number
    active: boolean
    timer: number
  } | null>(null)
  // 끌기가 끝난 때. 놓은 손가락이 바로 내는 클릭 하나만 삼킨다: 그 뒤의 다른 칸 클릭까지 삼키지 않게 때로 가린다.
  const endedAt = useRef(0)
  useEffect(() => {
    const cancel = () => {
      if (press.current) clearTimeout(press.current.timer)
      press.current = null
      setDrag(null)
    }
    const targetAt = (item: T, x: number, y: number) => {
      const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-loadout-target]')
      if (document.body.dataset.tutorialDragLock && !element?.dataset.tutorialDrop) return null
      const target = element?.dataset.loadoutTarget
      return target && latest.current.accepts(item, target) ? target : null
    }
    const move = (e: PointerEvent) => {
      const p = press.current
      if (!p || e.pointerId !== p.id) return
      if (!p.active) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return
        // 터치로 위아래는 목록 넘기기다(touch-action: pan-y). 옆으로 끄는 것은 스크롤이 아니므로 바로 집는다.
        if (
          e.pointerType !== 'mouse' &&
          !latest.current.options.anyDirection &&
          !document.body.dataset.tutorialDragLock &&
          Math.abs(e.clientX - p.x) <= Math.abs(e.clientY - p.y)
        )
          return cancel()
        clearTimeout(p.timer)
        p.active = true
        haptic.light()
      }
      p.x = e.clientX
      p.y = e.clientY
      setDrag({ item: p.item, x: p.x, y: p.y, over: targetAt(p.item, p.x, p.y) })
    }
    const up = (e: PointerEvent) => {
      const p = press.current
      if (!p || e.pointerId !== p.id) return
      if (p.active) {
        endedAt.current = performance.now()
        const target = targetAt(p.item, e.clientX, e.clientY)
        if (target) latest.current.drop(p.item, target)
      }
      cancel()
    }
    const touch = (e: TouchEvent) => {
      if (press.current?.active) e.preventDefault()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && press.current) {
        e.stopImmediatePropagation()
        cancel()
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('touchmove', touch, { passive: false })
    document.addEventListener('keydown', key, true)
    return () => {
      if (press.current) clearTimeout(press.current.timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('touchmove', touch)
      document.removeEventListener('keydown', key, true)
    }
  }, [])
  const down = (item: T) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || press.current) return
    endedAt.current = 0
    const p = { item, id: e.pointerId, x: e.clientX, y: e.clientY, active: false, timer: 0 }
    p.timer = window.setTimeout(() => {
      p.active = true
      haptic.light()
      setDrag({ item, x: p.x, y: p.y, over: null })
    }, HOLD_MS)
    press.current = p
  }
  const consumeClick = (detail: number) => {
    const consumed = performance.now() - endedAt.current < CLICK_AFTER_DROP_MS
    endedAt.current = 0
    return detail !== 0 && consumed
  }
  return { drag, down, consumeClick }
}
