import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { retreatIdle, shownIdle } from '@web/features/raising/useIdleBattle'
import { useEffect, useRef, useState } from 'react'
import type { ActiveCode } from '../mental/actives'
import { idleAssaultSpec } from '../mental/assault'
import type { BattleHandle } from '../mental/battle'
import { heroOf } from '../mental/hero'
import type { IdleRaidKind } from '../mental/waves'
import { idleLoadout } from './loadout'

/** 전투 화면을 띄우지 못했을 때 스스로 다시 해 보는 횟수와 그 틈. 그래도 안 되면 오류 문구와 "다시 시도"를 보인다. */
const AUTO_RETRIES = 2
const RETRY_MS = 800

export function IdleCanvas({ company, connected }: { company: Company; connected: boolean }) {
  const equipped = heroOf(company).weapon
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef({ company, connected })
  latest.current = { company, connected }
  const battle = useRef<BattleHandle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // 전투 화면을 띄우지 못하면 알리기 전에 스스로 다시 해 본다 (#836): 모듈을 못 받았거나 그리기 장치를 못 잡은 것은 대개 잠깐이다.
  const retries = useRef(0)
  // 전투 모듈을 받지 못했는가. 그러면 "다시 시도"는 화면을 새로 고친다.
  const stale = useRef(false)
  const [raid, setRaid] = useState<{ text: string; color: string; id: number } | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry and weapon changes recreate the renderer; server wall progress is preserved.
  useEffect(() => {
    if (!host.current || !company.companyId) return
    let disposed = false
    let foreground = !document.hidden
    let nativeActive = true
    let retry = 0
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
    // 테스트판의 도구 창이 몬스터 습격을 바로 부른다 (decisions.md 499번).
    const raidCalled = (event: Event) =>
      battle.current?.callIdleRaid((event as CustomEvent<IdleRaidKind>).detail)
    // 액티브 스킬 단추 (decisions.md 503번): 서버가 받아 준 스킬의 효과를 전투가 낸다.
    const activeUsed = (event: Event) =>
      battle.current?.castActive((event as CustomEvent<ActiveCode>).detail)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('idle-app-active', native)
    window.addEventListener('idle-test-raid', raidCalled)
    window.addEventListener('idle-active', activeUsed)
    setError(null)
    void import('../mental/battle')
      .catch((cause) => {
        // 모듈을 받지 못했다: 브라우저가 이 실패를 기억해 같은 화면에서는 다시 받지 못한다. 새로 고쳐야 한다.
        stale.current = true
        throw cause
      })
      .then(({ startBattle }) => {
        if (disposed || !host.current) return
        const c = latest.current.company
        // The wall on screen is the predicted one (decisions.md 532): the server's state plus the
        // hits it has not handled yet, so a wall breaks at the hit and not at the next heartbeat.
        const first = shownIdle(c.idle)
        const spec = idleAssaultSpec(first.wall, first.maxHp)
        battle.current = startBattle(host.current, {
          mode: 'assault',
          speed: 2,
          assault: spec,
          genre: 'DEFENSE',
          hero: heroOf(c),
          loadout: idleLoadout(c),
          idle: () => shownIdle(latest.current.company.idle),
          onIdleHit: (wall, kind, damage, depth) => {
            if (!disposed && foreground && nativeActive && latest.current.connected) {
              window.dispatchEvent(
                new CustomEvent('idle-wall-hit', { detail: { wall, kind, depth, damage } }),
              )
            }
          },
          // 몬스터 습격만 알린다 (decisions.md 500번). 그 밖의 전투 알림은 자동 전투에서 띄우지 않는다.
          onIdleRaid: (text, color) => setRaid((old) => ({ text, color, id: (old?.id ?? 0) + 1 })),
          // 매수벽이 무너지면 열 벽 앞으로 돌아간다 (546번).
          onBuyWallBreak: () => {
            if (disposed || !latest.current.connected) return
            setRaid((old) => ({
              text: '매수벽 붕괴! 열 벽 뒤로 후퇴',
              color: '#ff8a5c',
              id: (old?.id ?? 0) + 1,
            }))
            void retreatIdle()
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
      .then(() => {
        if (!disposed && battle.current) retries.current = 0
      })
      .catch((cause) => {
        if (disposed) return
        // 까닭을 콘솔에 남긴다: 브라우저 검사와 원격 디버깅이 읽는다.
        console.error('전투 화면을 띄우지 못했다', cause)
        if (!stale.current && retries.current < AUTO_RETRIES) {
          retries.current++
          retry = window.setTimeout(() => setAttempt((n) => n + 1), RETRY_MS)
        } else setError('전투 화면을 불러오지 못했어요.')
      })
    return () => {
      disposed = true
      window.clearTimeout(retry)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('idle-app-active', native)
      window.removeEventListener('idle-test-raid', raidCalled)
      window.removeEventListener('idle-active', activeUsed)
      battle.current?.stop()
      battle.current = null
    }
  }, [company.companyId, attempt, equipped.kind, equipped.grade])
  useEffect(() => {
    battle.current?.applyLoadout(idleLoadout(company))
    battle.current?.setPaused(!connected || document.hidden)
  }, [company, connected])
  // 보스 클리어 보상 (549번): 서버가 준 보상의 벽 번호가 바뀌면 한 번 알린다. 들어올 때 이미 있던 보상은 알리지 않는다.
  const bossReward = company.idle?.bossReward
  const rewarded = useRef({ company: company.companyId, wall: bossReward?.wall ?? 0 })
  useEffect(() => {
    const seen = rewarded.current
    const wall = bossReward?.wall ?? 0
    rewarded.current = { company: company.companyId, wall }
    // 다른 회사(테스트판)로 바뀐 것은 새 보상이 아니다.
    if (!bossReward || seen.company !== company.companyId || wall === seen.wall) return
    setRaid((old) => ({
      text: `보스 ${bossReward.wall.toLocaleString()} 클리어! 다이아 +${bossReward.diamonds.toLocaleString()} · +${money(bossReward.money)}`,
      color: '#d99a1c',
      id: (old?.id ?? 0) + 1,
    }))
  }, [bossReward, company.companyId])
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
          <button
            type="button"
            onClick={() => {
              if (stale.current) return window.location.reload()
              retries.current = 0
              setAttempt((n) => n + 1)
            }}
          >
            다시 시도
          </button>
        </div>
      )}
    </>
  )
}
