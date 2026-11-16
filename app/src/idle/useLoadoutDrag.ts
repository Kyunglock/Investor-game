import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import { haptic } from '../fx/haptics'

/** 터치는 길게 집기 전까지 스크롤이다. 손을 떼거나 화면을 떠나면 예약도 함께 취소한다. */
export function useLoadoutDrag<T>(
  accepts: (item: T, target: string) => boolean,
  drop: (item: T, target: string) => void,
) {
  const [drag, setDrag] = useState<{ item: T; x: number; y: number; over: string | null } | null>(
    null,
  )
  const latest = useRef({ accepts, drop })
  latest.current = { accepts, drop }
  const press = useRef<{
    item: T
    id: number
    x: number
    y: number
    active: boolean
    timer: number
  } | null>(null)
  const dragged = useRef(false)
  useEffect(() => {
    const cancel = () => {
      if (press.current) clearTimeout(press.current.timer)
      press.current = null
      setDrag(null)
    }
    const targetAt = (item: T, x: number, y: number) => {
      const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-loadout-target]')
        ?.dataset.loadoutTarget
      return target && latest.current.accepts(item, target) ? target : null
    }
    const move = (e: PointerEvent) => {
      const p = press.current
      if (!p || e.pointerId !== p.id) return
      if (!p.active) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return
        if (e.pointerType !== 'mouse') return cancel()
        clearTimeout(p.timer)
        p.active = true
        haptic.light()
      }
      dragged.current = true
      p.x = e.clientX
      p.y = e.clientY
      setDrag({ item: p.item, x: p.x, y: p.y, over: targetAt(p.item, p.x, p.y) })
    }
    const up = (e: PointerEvent) => {
      const p = press.current
      if (!p || e.pointerId !== p.id) return
      if (p.active) {
        dragged.current = true
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
    dragged.current = false
    const p = { item, id: e.pointerId, x: e.clientX, y: e.clientY, active: false, timer: 0 }
    p.timer = window.setTimeout(() => {
      p.active = true
      dragged.current = true
      haptic.light()
      setDrag({ item, x: p.x, y: p.y, over: null })
    }, 280)
    press.current = p
  }
  const consumeClick = () => {
    const consumed = dragged.current
    dragged.current = false
    return consumed
  }
  return { drag, down, consumeClick }
}
