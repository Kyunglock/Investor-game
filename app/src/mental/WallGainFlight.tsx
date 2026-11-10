import { type RefObject, useEffect, useEffectEvent, useRef } from 'react'
import type { WallGain } from './wallGain'

export function WallGainFlight({
  gain,
  target,
  paused,
  onDone,
}: {
  gain: WallGain
  target: RefObject<HTMLElement | null>
  paused: boolean
  onDone: () => void
}) {
  const node = useRef<HTMLDivElement>(null)
  const motion = useRef<Animation | null>(null)
  const done = useEffectEvent(onDone)
  useEffect(() => {
    const el = node.current
    const to = target.current
    if (!el || !to) return
    const from = el.getBoundingClientRect()
    const dest = to.getBoundingClientRect()
    const dx = dest.x + dest.width / 2 - (from.x + from.width / 2)
    const dy = dest.y + dest.height / 2 - (from.y + from.height / 2)
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const animation = el.animate(
      reduced
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { opacity: 0, transform: 'translate(-50%, 8px) scale(.85)', offset: 0 },
            { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.15 },
            { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.55 },
            {
              opacity: 0.5,
              transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(.3)`,
              offset: 1,
            },
          ],
      { duration: reduced ? 400 : 1000, easing: 'ease-in-out', fill: 'forwards' },
    )
    motion.current = animation
    animation.onfinish = () => done()
    return () => {
      animation.cancel()
      motion.current = null
    }
  }, [target])
  useEffect(() => {
    if (paused) motion.current?.pause()
    else motion.current?.play()
  }, [paused])
  return (
    <div ref={node} className="battle-wall-gain" data-testid="battle-wall-gain" aria-live="polite">
      <small>매도벽 돌파</small>
      <strong>+{((gain.amount / gain.start) * 100).toFixed(1)}%</strong>
    </div>
  )
}
