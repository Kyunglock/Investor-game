import type { Company } from '@web/api/client'
import { idleHoldWall } from '@web/features/raising/idlePredict'
import { moveIdle, useShownIdle } from '@web/features/raising/useIdleBattle'
import { useState } from 'react'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'

/**
 * 보스 도전 단추 (decisions.md 546번): 대량 매도벽(열 번째 벽)은 저절로 들어가지 않는다. 보스 바로 앞의 벽은 부숴도 다시 서고, 이 단추를 눌러야
 * 보스 앞에 선다. 매수벽이 무너지면 열 벽 뒤로 돌아가므로 준비가 됐을 때 누른다.
 */
export function IdleBoss({ company, connected }: { company: Company; connected: boolean }) {
  const [pending, setPending] = useState(false)
  // 화면이 먼저 부순 벽을 따른다 (532번).
  const shown = useShownIdle(company.idle)
  if (!company.idle || !idleHoldWall(shown.wall)) return null
  const challenge = async () => {
    if (pending) return
    setPending(true)
    sfx.tap()
    haptic.medium()
    await moveIdle('boss')
    setPending(false)
  }
  return (
    <button
      type="button"
      className="idle-boss"
      data-testid="idle-boss"
      disabled={!connected || pending}
      onClick={() => void challenge()}
    >
      <b>보스 도전</b>
      <small>매도벽 {(shown.wall + 1).toLocaleString()}</small>
    </button>
  )
}
