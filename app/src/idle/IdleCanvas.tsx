import type { Company } from '@web/api/client'
import { IDLE_HOLD_EVENT, idleHeld } from '@web/features/raising/idleHold'
import { shownIdle } from '@web/features/raising/useIdleBattle'
import { useEffect, useRef, useState } from 'react'
import type { ActiveCode } from '../mental/actives'
import { IDLE_GAME_SPEED, idleAssaultSpec } from '../mental/assault'
import type { BattleHandle } from '../mental/battle'
import { heroOf } from '../mental/hero'
import type { IdleRaidKind } from '../mental/waves'
import { idleLoadout } from './loadout'
import { POWER_SAVE_FPS, usePowerSave } from './powerSave'

/** 전투 화면을 띄우지 못했을 때 스스로 다시 해 보는 횟수와 그 틈. 그래도 안 되면 오류 문구와 "다시 시도"를 보인다. */
const AUTO_RETRIES = 2
const RETRY_MS = 800
/** 전장이 이만큼 아무 진척 없이 열리지 않으면 멈춘 것으로 보고 다시 띄운다 (#836). 화면이 보이는 동안만 잰다. */
const STALL_MS = 12000

export function IdleCanvas({ company, connected }: { company: Company; connected: boolean }) {
  const equipped = heroOf(company).weapon
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef({ company, connected })
  latest.current = { company, connected }
  const battle = useRef<BattleHandle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // 전장이 다 차려졌는가. 그 전에는 배경색만 보이므로 불러오는 중임을 알린다 (#836).
  const [ready, setReady] = useState(false)
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
    let stall = 0
    let opened = false
    // 전장이 열리지 않은 채 멈췄다 (#836): 그림 하나가 끝나지 않거나 차리다 멈추면 오류도 없이 배경색만 남는다.
    // 스스로 몇 번 다시 띄우고, 그래도 안 되면 오류 문구와 "다시 시도"를 보인다.
    const stalled = () => {
      if (disposed || opened) return
      console.error('전장이 열리지 않아 다시 띄운다')
      if (retries.current < AUTO_RETRIES) {
        retries.current++
        setAttempt((n) => n + 1)
      } else {
        battle.current?.stop()
        battle.current = null
        setError('전장 그림을 불러오지 못했어요.')
      }
    }
    // 진척이 있을 때마다 다시 잰다. 화면이 가려진 동안은 브라우저가 그리기를 멈추므로 재지 않는다.
    const watch = () => {
      window.clearTimeout(stall)
      if (!disposed && !opened && foreground && nativeActive)
        stall = window.setTimeout(stalled, STALL_MS)
    }
    const pause = () =>
      battle.current?.setPaused(
        !foreground || !nativeActive || idleHeld() || !latest.current.connected,
      )
    const visibility = () => {
      foreground = !document.hidden
      pause()
      watch()
    }
    const native = (event: Event) => {
      nativeActive = (event as CustomEvent<boolean>).detail
      pause()
      watch()
    }
    // 테스트판의 도구 창이 몬스터 습격을 바로 부른다 (decisions.md 499번).
    const raidCalled = (event: Event) =>
      battle.current?.callIdleRaid((event as CustomEvent<IdleRaidKind>).detail)
    // 액티브 스킬 단추 (decisions.md 503번): 서버가 받아 준 스킬의 효과를 전투가 낸다.
    const activeUsed = (event: Event) =>
      battle.current?.castActive((event as CustomEvent<ActiveCode>).detail)
    // 절전 모드 (607번): 전장을 그리지 않고 낮은 빈도로 돌린다.
    const powerSave = (event: Event) =>
      battle.current?.setPowerSave((event as CustomEvent<boolean>).detail, POWER_SAVE_FPS)
    window.addEventListener('idle-power-save', powerSave)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('idle-app-active', native)
    // 스테이지 한 판이나 광고를 보는 동안에는 (682번) 전투를 세운다.
    window.addEventListener(IDLE_HOLD_EVENT, pause)
    window.addEventListener('idle-test-raid', raidCalled)
    window.addEventListener('idle-active', activeUsed)
    setError(null)
    setReady(false)
    watch()
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
          // 전투의 빠르기 (580번): 2배속이 너무 빨라 1.5배속으로 줄였다. 서버 IdleEngine.SPEED와 같아야 한다.
          speed: IDLE_GAME_SPEED,
          assault: spec,
          genre: 'DEFENSE',
          hero: heroOf(c),
          loadout: idleLoadout(c),
          idle: () => shownIdle(latest.current.company.idle),
          onIdleHit: (wall, kind, damage, depth, source) => {
            if (!disposed && foreground && nativeActive && latest.current.connected) {
              // owner·crit은 전투 통계(645번)에만 쓴다: 서버로 가는 명중에는 실리지 않는다.
              window.dispatchEvent(
                new CustomEvent('idle-wall-hit', {
                  detail: {
                    wall,
                    kind,
                    depth,
                    damage,
                    owner: source?.owner ?? null,
                    crit: source?.crit ?? false,
                  },
                }),
              )
            }
          },
          // 전투 통계 (647번): 매도벽이 아닌 것을 맞힌 피해. 서버로 가지 않고 통계에만 쌓인다.
          onIdleStatsHit: (kind, damage, source) => {
            if (!disposed && foreground && nativeActive && latest.current.connected) {
              window.dispatchEvent(
                new CustomEvent('idle-stats-hit', {
                  detail: { kind, damage, owner: source.owner, crit: source.crit, order: true },
                }),
              )
            }
          },
          // 몬스터 습격만 알린다 (decisions.md 500번). 그 밖의 전투 알림은 자동 전투에서 띄우지 않는다.
          onIdleRaid: (text, color) => setRaid((old) => ({ text, color, id: (old?.id ?? 0) + 1 })),
          // 매수벽이 무너져도 지금 벽에 그대로 머문다 (584번): 다시 설 때까지 공격이 멈출 뿐이다.
          onBuyWallBreak: () => {
            if (disposed || !latest.current.connected) return
            setRaid((old) => ({
              text: '매수벽 붕괴! 다시 세우는 중',
              color: '#ff8a5c',
              id: (old?.id ?? 0) + 1,
            }))
          },
          // 고양이를 꾹 누르면 그 고양이의 정보를 띄운다 (605번): 창은 IdleHome이 연다.
          onCatSelect: (code) =>
            window.dispatchEvent(new CustomEvent('idle-cat-info', { detail: code })),
          onHud: () => {},
          onBanner: () => {},
          onHurt: () => {},
          onDone: () => {},
          onProgress: watch,
          onReady: () => {
            if (disposed) return
            opened = true
            window.clearTimeout(stall)
            retries.current = 0
            setReady(true)
            // 절전 모드 (607번)인 채로 전장이 다시 만들어졌으면 그대로 이어 간다.
            if (usePowerSave.getState().on) battle.current?.setPowerSave(true, POWER_SAVE_FPS)
            // 이미 돌고 있던 효과(불장, 광고 스킬 588번)는 화면을 다시 열어도 남은 시간만큼 이어진다. 서버의 초는 실제 시간이라 전투 초로 바꾼다.
            for (const active of latest.current.company.idle?.actives ?? []) {
              if (active.left > 0)
                battle.current?.castActive(active.code, active.left * IDLE_GAME_SPEED)
            }
          },
          onError: (message) => {
            opened = true
            window.clearTimeout(stall)
            setError(message)
          },
          onLevelUp: () => {
            battle.current?.applyLoadout(idleLoadout(latest.current.company))
            pause()
          },
        })
      })
      .catch((cause) => {
        if (disposed) return
        opened = true
        window.clearTimeout(stall)
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
      window.clearTimeout(stall)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('idle-app-active', native)
      window.removeEventListener(IDLE_HOLD_EVENT, pause)
      window.removeEventListener('idle-test-raid', raidCalled)
      window.removeEventListener('idle-active', activeUsed)
      window.removeEventListener('idle-power-save', powerSave)
      battle.current?.stop()
      battle.current = null
    }
  }, [company.companyId, attempt, equipped.kind, equipped.grade])
  useEffect(() => {
    battle.current?.applyLoadout(idleLoadout(company))
    battle.current?.setPaused(!connected || document.hidden || idleHeld())
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
      {!ready && !error && (
        <p className="idle-canvas-loading" data-testid="idle-canvas-loading" aria-live="polite">
          전장을 불러오는 중…
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
