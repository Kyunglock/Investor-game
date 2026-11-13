import type { Company } from '@web/api/client'
import { useEffect, useRef, useState } from 'react'
import { assaultSpec } from '../mental/assault'
import type { BattleHandle } from '../mental/battle'
import { heroOf } from '../mental/hero'
import { idleLoadout } from './loadout'

export function IdleCanvas({ company, connected }: { company: Company; connected: boolean }) {
  const equipped = heroOf(company).weapon
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef({ company, connected })
  latest.current = { company, connected }
  const battle = useRef<BattleHandle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry and weapon changes recreate the renderer; server wall progress is preserved.
  useEffect(() => {
    if (!host.current || !company.companyId) return
    let disposed = false
    let foreground = !document.hidden
    let nativeActive = true
    const pause = () =>
      battle.current?.setPaused(!foreground || !nativeActive || !latest.current.connected)
    const visibility = () => {
      foreground = !document.hidden
      pause()
    }
    const native = (event: Event) => {
      nativeActive = (event as CustomEvent<boolean>).detail
      pause()
    }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('idle-app-active', native)
    setError(null)
    void import('../mental/battle')
      .then(({ startBattle }) => {
        if (disposed || !host.current) return
        const c = latest.current.company
        const spec = assaultSpec(1)
        spec.walls = [
          { ...spec.walls[0], rows: 1, mid: false, boss: (c.idle?.wall ?? 1) % 10 === 0 },
        ]
        battle.current = startBattle(host.current, {
          mode: 'assault',
          speed: 2,
          assault: spec,
          genre: 'DEFENSE',
          hero: heroOf(c),
          loadout: idleLoadout(c),
          idle: () => latest.current.company.idle ?? { wall: 1, hp: 120, maxHp: 120 },
          onIdleHit: (wall, kind, damage) => {
            if (!disposed && foreground && nativeActive && latest.current.connected) {
              window.dispatchEvent(
                new CustomEvent('idle-wall-hit', { detail: { wall, kind, damage } }),
              )
            }
          },
          onHud: () => {},
          onBanner: () => {},
          onHurt: () => {},
          onDone: () => {},
          onError: setError,
          onLevelUp: () => {
            battle.current?.applyLoadout(idleLoadout(latest.current.company))
            pause()
          },
        })
      })
      .catch(() => {
        if (!disposed) setError('전투 화면을 불러오지 못했어요.')
      })
    return () => {
      disposed = true
      window.dispatchEvent(new Event('idle-hits-clear'))
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('idle-app-active', native)
      battle.current?.stop()
      battle.current = null
    }
  }, [company.companyId, attempt, equipped.kind, equipped.grade])
  useEffect(() => {
    battle.current?.applyLoadout(idleLoadout(company))
    battle.current?.setPaused(!connected || document.hidden)
  }, [company, connected])
  return (
    <>
      <div ref={host} className="idle-canvas" data-testid="idle-canvas" aria-hidden="true" />
      {error && (
        <div className="idle-canvas-error" role="alert">
          {error}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            다시 시도
          </button>
        </div>
      )}
    </>
  )
}
