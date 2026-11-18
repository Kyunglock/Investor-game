import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { IdleIcon } from './icons'
import { usePowerSave } from './powerSave'
import './boss-reward.css'

type Reward = NonNullable<NonNullable<Company['idle']>['bossReward']>
type Currency = 'money' | 'diamond'
const PARTICLES = Array.from({ length: 9 }, (_, i) => `piece-${i}`)

function RewardIcon({ kind }: { kind: Currency }) {
  return kind === 'money' ? (
    <span className="boss-reward-coin">₩</span>
  ) : (
    <IdleIcon name="diamond" />
  )
}

/** 서버에서 새로 받은 보상만 보여 준다. 처음 접속하거나 절전에서 돌아올 때 지난 보상을 재생하지 않는다. */
export function BossReward({ company, hidden }: { company: Company; hidden: boolean }) {
  const powerSave = usePowerSave((s) => s.on)
  const latest = company.idle?.bossReward
  const seen = useRef({ company: company.companyId, wall: latest?.wall ?? 0 })
  const [reward, setReward] = useState<Reward | null>(null)
  const done = useCallback(() => setReward(null), [])
  useEffect(() => {
    const previous = seen.current
    const wall = latest?.wall ?? 0
    seen.current = { company: company.companyId, wall }
    if (hidden || powerSave || previous.company !== company.companyId) {
      setReward(null)
      return
    }
    if (latest && wall !== previous.wall && !document.hidden) setReward(latest)
  }, [latest, company.companyId, hidden, powerSave])
  return reward && !hidden && !powerSave ? (
    <RewardFlight key={`${company.companyId}:${reward.wall}`} reward={reward} done={done} />
  ) : null
}

function RewardFlight({ reward, done }: { reward: Reward; done: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const kinds: Currency[] = [
    ...(reward.money > 0 ? ['money' as const] : []),
    ...(reward.diamonds > 0 ? ['diamond' as const] : []),
  ]
  useLayoutEffect(() => {
    const root = host.current
    if (!root) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const animations: Animation[] = []
    const home = root.closest('.idle-home')
    const bounds = root.getBoundingClientRect()
    if (!reduced) {
      const summary = root.querySelector<HTMLElement>('.boss-reward-summary')
      // 등장 확대 효과가 시작 좌표 측정에 섞이지 않게 최종 배치에서 잰다.
      if (summary) summary.style.animation = 'none'
      for (const kind of ['money', 'diamond'] as const) {
        const source = root.querySelector<HTMLElement>(`[data-reward-source="${kind}"]`)
        const target = home?.querySelector<HTMLElement>(`[data-reward-target="${kind}"]`)
        if (!source || !target) continue
        const start = source.getBoundingClientRect()
        const end = target.getBoundingClientRect()
        const sx = start.x + start.width / 2 - bounds.x
        const sy = start.y + start.height / 2 - bounds.y
        const tx = end.x + end.width / 2 - bounds.x
        const ty = end.y + end.height / 2 - bounds.y
        root
          .querySelectorAll<HTMLElement>(`[data-reward-particle="${kind}"]`)
          .forEach((particle, i) => {
            const angle = (i / PARTICLES.length) * Math.PI * 2
            const px = sx + Math.cos(angle) * (24 + (i % 3) * 9)
            const py = sy + Math.sin(angle) * 28
            const transform = (x: number, y: number, scale: number, turn = 0) =>
              `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale}) rotate(${turn}deg)`
            const flight = particle.animate(
              [
                { transform: transform(sx, sy, 0.2), opacity: 0, offset: 0 },
                { transform: transform(px, py, 1.15, i * 13), opacity: 1, offset: 0.18 },
                { transform: transform(px, py - 5, 1, i * 13), opacity: 1, offset: 0.42 },
                {
                  transform: transform(px + (tx - px) * 0.18, py - 65, 1.05, i * 25),
                  opacity: 1,
                  offset: 0.6,
                },
                {
                  transform: transform(px + (tx - px) * 0.65, py + (ty - py) * 0.65, 0.8, i * 35),
                  opacity: 1,
                  offset: 0.8,
                },
                { transform: transform(tx, ty, 0.25, i * 45), opacity: 0, offset: 1 },
              ],
              {
                duration: 1350,
                delay: 260 + i * 55 + (kind === 'diamond' ? 130 : 0),
                fill: 'both',
                easing: 'ease-in-out',
              },
            )
            animations.push(flight)
            flight.onfinish = () => {
              // 지갑 전체가 숫자와 함께 반응하되, 입자는 실제 아이콘 중심에 도착한다.
              if (i === 0 || i === PARTICLES.length - 1) {
                const wallet = target.closest<HTMLElement>('.idle-cash') ?? target
                animations.push(
                  wallet.animate(
                    [
                      { transform: 'scale(1)', filter: 'brightness(1)' },
                      { transform: 'scale(1.12)', filter: 'brightness(1.55)', offset: 0.35 },
                      { transform: 'scale(1)', filter: 'brightness(1)' },
                    ],
                    { duration: 260, easing: 'ease-out' },
                  ),
                )
                sfx.coin()
                if (i === 0) haptic.light()
              }
            }
          })
      }
    }
    const summary = root.querySelector<HTMLElement>('.boss-reward-summary')
    if (summary) summary.style.removeProperty('animation')
    const timer = window.setTimeout(done, reduced ? 1800 : 2600)
    const visibility = () => {
      if (document.hidden) done()
    }
    const native = (event: Event) => {
      if (!(event as CustomEvent<boolean>).detail) done()
    }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('idle-app-active', native)
    // 화면 회전 뒤에는 옛 지갑 좌표로 날리지 않는다.
    window.addEventListener('resize', done)
    return () => {
      window.clearTimeout(timer)
      for (const animation of animations) {
        animation.onfinish = null
        animation.cancel()
      }
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('idle-app-active', native)
      window.removeEventListener('resize', done)
    }
  }, [done])
  return (
    <div className="boss-reward" ref={host} data-testid="boss-reward" data-wall={reward.wall}>
      <div className="boss-reward-summary" role="status" aria-live="polite">
        <span className="boss-reward-caption">BOSS CLEAR!</span>
        <strong>보스 {reward.wall.toLocaleString()} 클리어!</strong>
        <div className="boss-reward-prizes">
          {kinds.map((kind) => (
            <div className={`boss-reward-prize is-${kind}`} key={kind}>
              <span className="boss-reward-symbol" data-reward-source={kind} aria-hidden="true">
                <RewardIcon kind={kind} />
              </span>
              <span>
                <small>{kind === 'money' ? '돈' : '다이아'}</small>
                <b>+{kind === 'money' ? money(reward.money) : reward.diamonds.toLocaleString()}</b>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true">
        {kinds.flatMap((kind) =>
          PARTICLES.map((id) => (
            <span
              className={`boss-reward-particle is-${kind}`}
              data-reward-particle={kind}
              key={`${kind}-${id}`}
            >
              <RewardIcon kind={kind} />
            </span>
          )),
        )}
      </div>
    </div>
  )
}
