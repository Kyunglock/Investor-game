import type { Company } from '@web/api/client'
import { type ActiveCode, useRaisingStore } from '@web/features/raising/store'
import { useShownIdle } from '@web/features/raising/useIdleBattle'
import { useState } from 'react'
import { watchRewardedAd } from '../app/ads'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { ACTIVE_HINTS } from '../mental/actives'

type Active = NonNullable<NonNullable<Company['idle']>['actives']>[number]

/**
 * 액티브 스킬 단추 (decisions.md 503번). 누르면 서버가 대기 시간을 보고 받아 주고, 받아 준 뒤에 전투가 효과를 낸다. 남은 대기 시간은 접속
 * 신호마다 서버가 다시 알려 준다.
 *
 * 오른쪽에는 장착한 고유 스킬이 선다 (587번): 스킬 탭에서 세 개까지 장착한다. 왼쪽에는 광고 스킬이 선다 (588번): 광고를 본 뒤에 쓴다. 아직 광고를
 * 붙이지 않아 누르면 바로 나간다(app/ads.ts).
 */
export function IdleActives({ company, connected }: { company: Company; connected: boolean }) {
  const [pending, setPending] = useState<ActiveCode | null>(null)
  const idle = company.idle
  const actives = idle?.actives ?? []
  // 거래 정지는 화면이 벽을 부순 때 시작한다 (532번): 서버가 알기 전에도 단추가 잠긴다.
  const halted = useShownIdle(idle).circuitSeconds > 0
  const unique = actives.filter((active) => !active.ad && active.equipped)
  const ads = actives.filter((active) => active.ad)
  const use = async (active: Active) => {
    if (pending) return
    setPending(active.code)
    sfx.tap()
    haptic.light()
    // 광고를 끝까지 봤을 때만 쓴다. 닫았으면 아무 일도 없다.
    if (active.ad && !(await watchRewardedAd('active'))) {
      setPending(null)
      return
    }
    const ok = await useRaisingStore.getState().useActive(active.code, active.ad)
    if (ok) window.dispatchEvent(new CustomEvent('idle-active', { detail: active.code }))
    setPending(null)
  }
  const button = (active: Active) => {
    const wait = Math.ceil(active.readyIn)
    // 효과가 도는 동안에는 남은 시간을 적는다 (588번).
    const left = active.ad ? Math.ceil(active.left) : 0
    const note = left > 0 ? `${left}초 남음` : wait > 0 ? `${wait}초` : ACTIVE_HINTS[active.code]
    return (
      <button
        key={active.code}
        type="button"
        data-testid={active.ad ? 'idle-ad-active' : 'idle-active'}
        data-code={active.code}
        data-ready={wait === 0}
        data-on={left > 0 || undefined}
        disabled={!connected || halted || wait > 0 || pending !== null}
        aria-label={
          left > 0
            ? `${active.name} · ${left}초 남았어요`
            : wait > 0
              ? `${active.name} · ${wait}초 뒤에 쓸 수 있어요`
              : `${active.name} · ${ACTIVE_HINTS[active.code]}${active.ad ? ' · 광고 보고 쓰기' : ''}`
        }
        onClick={() => void use(active)}
      >
        {active.ad && (
          <em className="idle-active-ad" aria-hidden="true">
            ▶ 광고
          </em>
        )}
        <b>{active.name}</b>
        <small className="idle-active-note">{note}</small>
        {wait > 0 && left === 0 && (
          <i
            aria-hidden="true"
            style={{ height: `${Math.min(100, (100 * active.readyIn) / active.cooldown)}%` }}
          />
        )}
      </button>
    )
  }
  return (
    <>
      {ads.length > 0 && (
        <div className="idle-actives idle-actives-ad" data-testid="idle-ad-actives">
          {ads.map(button)}
        </div>
      )}
      {unique.length > 0 && (
        <div className="idle-actives" data-testid="idle-actives">
          {unique.map(button)}
        </div>
      )}
    </>
  )
}
