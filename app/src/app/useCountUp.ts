import { useEffect, useRef, useState } from 'react'

/** 숫자가 전 값에서 새 값으로 굴러간다 (decisions.md 310번). 처음은 바로 보인다. 움직임 줄이기면 바로 바뀐다. */
export function useCountUp(value: number, ms = 800): number {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const raf = useRef(0)
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const start = from.current
    if (reduced || start === value) {
      from.current = value
      setShown(value)
      return
    }
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / ms)
      const eased = 1 - (1 - t) ** 3
      const at = Math.round(start + (value - start) * eased)
      setShown(at)
      if (t < 1) {
        raf.current = requestAnimationFrame(tick)
      } else {
        from.current = value
      }
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, ms])
  return shown
}
