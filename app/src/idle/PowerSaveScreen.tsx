import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { useShownIdle } from '@web/features/raising/useIdleBattle'
import { useEffect, useState } from 'react'
import { usePowerSave, WAKE_TAP_MS } from './powerSave'
import './power-save.css'

/**
 * 절전 화면 (decisions.md 607번): 검은 화면에 지금 매도벽과 돈만 흐리게 적는다. 전투와 수입은 계속된다. 화면을 두 번 누르면 풀린다.
 */
export function PowerSaveScreen({ company }: { company: Company }) {
  const on = usePowerSave((s) => s.on)
  const shown = useShownIdle(company.idle)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const timer = window.setTimeout(() => setArmed(false), WAKE_TAP_MS)
    return () => window.clearTimeout(timer)
  }, [armed])
  useEffect(() => {
    if (!on) setArmed(false)
  }, [on])
  if (!on) return null
  return (
    <button
      type="button"
      className="power-save"
      data-testid="power-save"
      aria-label="절전 모드 · 화면을 두 번 누르면 풀려요"
      onClick={() => {
        if (armed) usePowerSave.getState().set(false)
        else setArmed(true)
      }}
    >
      <span className="power-save-title">절전 모드</span>
      <b className="power-save-wall" data-testid="power-save-wall">
        매도벽 {shown.wall.toLocaleString()}
      </b>
      <span className="power-save-money">{money(company.capital)}</span>
      <small>전투와 수입은 계속돼요</small>
      <em className={armed ? 'is-armed' : ''} data-testid="power-save-hint">
        {armed ? '한 번 더 누르면 풀려요' : '화면을 두 번 누르면 풀려요'}
      </em>
    </button>
  )
}
