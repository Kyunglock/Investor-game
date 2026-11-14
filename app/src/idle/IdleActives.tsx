import type { Company } from '@web/api/client'
import { type ActiveCode, useRaisingStore } from '@web/features/raising/store'
import { useState } from 'react'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { ACTIVE_HINTS } from '../mental/actives'

/**
 * 액티브 스킬 단추 (decisions.md 503번): 전투 화면 오른쪽에 세로로 선다. 누르면 서버가 대기 시간을 보고 받아 주고, 받아 준 뒤에 전투가 효과를 낸다.
 * 남은 대기 시간은 접속 신호마다 서버가 다시 알려 준다.
 */
export function IdleActives({ company, connected }: { company: Company; connected: boolean }) {
  const [pending, setPending] = useState<ActiveCode | null>(null)
  const idle = company.idle
  const actives = idle?.actives ?? []
  if (actives.length === 0) return null
  const halted = (idle?.circuitSeconds ?? 0) > 0
  const use = async (code: ActiveCode) => {
    if (pending) return
    setPending(code)
    sfx.tap()
    haptic.light()
    const ok = await useRaisingStore.getState().useActive(code)
    if (ok) window.dispatchEvent(new CustomEvent('idle-active', { detail: code }))
    setPending(null)
  }
  return (
    <div className="idle-actives" data-testid="idle-actives">
      {actives.map((active) => {
        const wait = Math.ceil(active.readyIn)
        return (
          <button
            key={active.code}
            type="button"
            data-testid="idle-active"
            data-code={active.code}
            data-ready={wait === 0}
            disabled={!connected || halted || wait > 0 || pending !== null}
            aria-label={
              wait > 0
                ? `${active.name} · ${wait}초 뒤에 쓸 수 있어요`
                : `${active.name} · ${ACTIVE_HINTS[active.code]}`
            }
            onClick={() => void use(active.code)}
          >
            <b>{active.name}</b>
            <small className="idle-active-note">
              {wait > 0 ? `${wait}초` : ACTIVE_HINTS[active.code]}
            </small>
            {wait > 0 && (
              <i
                aria-hidden="true"
                style={{ height: `${Math.min(100, (100 * active.readyIn) / active.cooldown)}%` }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
