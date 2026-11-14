import type { Company } from '@web/api/client'
import { useEffect, useRef, useState } from 'react'
import { idleAssaultSpec } from '../mental/assault'
import type { BattleHandle } from '../mental/battle'
import { heroOf } from '../mental/hero'
import type { IdleRaidKind } from '../mental/waves'
import { idleLoadout } from './loadout'

export function IdleCanvas({ company, connected }: { company: Company; connected: boolean }) {
  const equipped = heroOf(company).weapon
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef({ company, connected })
  latest.current = { company, connected }
  const battle = useRef<BattleHandle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [raid, setRaid] = useState<{ text: string; color: string; id: number } | null>(null)
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
    // The heartbeat loop says which beat carried the hits so far, and when it dropped them
    // (decisions.md 496): the renderer keeps its early damage until the server has handled that beat.
    const sent = (event: Event) =>
      battle.current?.idleHitsSent((event as CustomEvent<number>).detail)
    const dropped = () => battle.current?.clearIdleHits()
    // 테스트판의 도구 창이 몬스터 습격을 바로 부른다 (decisions.md 499번).
    const raidCalled = (event: Event) =>
      battle.current?.callIdleRaid((event as CustomEvent<IdleRaidKind>).detail)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('idle-app-active', native)
    window.addEventListener('idle-hits-sent', sent)
    window.addEventListener('idle-hits-clear', dropped)
    window.addEventListener('idle-test-raid', raidCalled)
    setError(null)
    void import('../mental/battle')
      .then(({ startBattle }) => {
        if (disposed || !host.current) return
        const c = latest.current.company
        const spec = idleAssaultSpec(c.idle?.wall ?? 1, c.idle?.maxHp)
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
          // 몬스터 습격만 알린다 (decisions.md 500번). 그 밖의 전투 알림은 자동 전투에서 띄우지 않는다.
          onIdleRaid: (text, color) => setRaid((old) => ({ text, color, id: (old?.id ?? 0) + 1 })),
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
      window.removeEventListener('idle-hits-sent', sent)
      window.removeEventListener('idle-hits-clear', dropped)
      window.removeEventListener('idle-test-raid', raidCalled)
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
      {raid && (
        <p
          key={raid.id}
          className="idle-raid"
          data-testid="idle-raid"
          style={{ background: raid.color }}
          aria-live="polite"
        >
          {raid.text}
        </p>
      )}
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
