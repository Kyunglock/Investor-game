import { useEffect, useState } from 'react'
import { FrameMeter, type FrameStats, frameLevel } from './frameMeter'

/** 숫자는 1초에 두 번만 고친다: 측정이 화면을 느리게 하지 않게. */
const REFRESH_MS = 500

/**
 * 프레임 표시 (decisions.md 543번): 테스트판에서만 테스트판 단추 옆에 뜬다. 지금 FPS, 최근 10초의 가장 긴 프레임, 끊긴 프레임 수. 누르면 다시
 * 센다. 프레임마다 하는 일은 시각 하나를 적는 것뿐이다.
 */
export function IdleFrameMeter() {
  const [stats, setStats] = useState<FrameStats | null>(null)
  const [meter] = useState(() => new FrameMeter())
  useEffect(() => {
    let frame = 0
    let shown = 0
    const tick = (now: number) => {
      meter.push(now)
      if (now - shown >= REFRESH_MS) {
        shown = now
        setStats(meter.read(now))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [meter])
  if (!stats) return null
  return (
    <button
      type="button"
      className="idle-frames"
      data-testid="idle-frames"
      data-level={frameLevel(stats.fps)}
      aria-label={`프레임 ${stats.fps} FPS, 가장 긴 프레임 ${stats.worst}밀리초, 끊긴 프레임 ${stats.slow}개. 누르면 다시 센다`}
      onClick={() => {
        meter.reset()
        setStats({ fps: 0, worst: 0, slow: 0 })
      }}
    >
      <b className="idle-frames-fps">{stats.fps} FPS</b>
      <small className="idle-frames-note">최장 {stats.worst}ms</small>
      <small className="idle-frames-note">끊김 {stats.slow}</small>
    </button>
  )
}
