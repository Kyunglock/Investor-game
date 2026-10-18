import { useEffect } from 'react'
import { useGameStore } from './store'

const TICK_MS = 100

/** 시계를 구동한다. 탭이 백그라운드로 가면 멈춘다 (architecture.md 4절). */
export function useGameClock() {
  const running = useGameStore((s) => s.running)
  const tick = useGameStore((s) => s.tick)
  const pause = useGameStore((s) => s.pause)

  useEffect(() => {
    if (!running) {
      return
    }
    let last = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      tick(now - last)
      last = now
    }, TICK_MS)
    return () => clearInterval(id)
  }, [running, tick])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        pause()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pause])
}
