import type { Company } from '@web/api/client'
import { DiamondIcon } from '@web/features/raising/DiamondIcon'
import { useRaisingStore } from '@web/features/raising/store'
import { useEffect, useRef, useState } from 'react'
import { sfx } from '../fx/sound'
import { type AttendanceReward, receivedText, shouldClaim } from './attendance'

/** 받았다는 알림이 떠 있는 시간. */
const SHOWN_MS = 3200
/** 받기에 실패했을 때 다시 해 보기까지의 틈. */
const RETRY_MS = 15_000

/**
 * 출석 보상 (decisions.md 528·566번). 단추도 출석판도 없다: 그날 처음 들어오면 저절로 받고, 받은 것을 위쪽에 한 줄로 잠깐 알린다. wait이면(자리를
 * 비운 동안의 수입 알림이 떠 있거나 다른 화면을 보는 중) 그 뒤로 미룬다. 하루에 한 번인지는 서버가 정한다.
 */
export function IdleAttendance({ company, wait }: { company: Company; wait: boolean }) {
  const attendance = company.attendance
  const asking = useRef(false)
  // 실패한 뒤에는 잠깐 쉬었다가 다시 한다. 값이 바뀌면 받기를 다시 시도한다.
  const [retry, setRetry] = useState(0)
  const [received, setReceived] = useState<AttendanceReward | null>(null)
  const claim = shouldClaim(attendance, wait)
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry는 실패한 뒤 다시 해 보라는 신호다.
  useEffect(() => {
    if (!claim || asking.current) return
    asking.current = true
    let timer = 0
    void useRaisingStore
      .getState()
      .claimAttendance()
      .then((after) => {
        asking.current = false
        const reward = after?.attendance.lastReward
        if (reward) {
          sfx.cash()
          setReceived(reward)
        } else timer = window.setTimeout(() => setRetry((n) => n + 1), RETRY_MS)
      })
    return () => window.clearTimeout(timer)
  }, [claim, retry])
  useEffect(() => {
    if (!received) return
    const timer = window.setTimeout(() => setReceived(null), SHOWN_MS)
    return () => window.clearTimeout(timer)
  }, [received])
  if (!received) return null
  return (
    <p className="idle-attend-toast" role="status" data-testid="attendance-toast">
      <DiamondIcon />
      {receivedText(received)}
    </p>
  )
}
