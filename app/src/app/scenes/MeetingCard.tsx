import type { Company } from '@web/api/client'
import { BattleEntryContent } from '@web/features/raising/BattleEntryButton'
import { useRaisingStore } from '@web/features/raising/store'
import { useLocked, useTutorialSpot } from '@web/features/raising/TutorialBanner'
import { useEffect, useState } from 'react'
import { useFx } from '../../fx/fx'
import { haptic } from '../../fx/haptics'
import { sfx } from '../../fx/sound'
import { clock, type MeetingState, meetingState, secondsLeft } from '../meeting'
import { useAppUi } from '../ui'

const LABEL: Record<MeetingState, string> = {
  continue: '종목회의 이어서 하기',
  open: '종목회의 열기',
  wait: '기회를 기다리는 중',
  nodesk: '종목회의 열기',
}

/**
 * 다음 기회까지 남은 초 (#803). 서버가 준 nextSeconds를 그 회사 응답을 받은 때에 묶어 화면에서 1초마다 줄인다. 0이 되면 다음 응답이 올 때까지 0에
 * 머문다.
 */
function useNextChance(company: Company): number {
  const [anchor, setAnchor] = useState(() => ({ company, at: Date.now() }))
  const [now, setNow] = useState(() => Date.now())
  // 새 응답이 오면 그때로 다시 묶는다 (그리는 도중에 맞추는 React의 "이전 값 기억" 방식).
  if (anchor.company !== company) {
    const at = Date.now()
    setAnchor({ company, at })
    setNow(at)
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return secondsLeft(anchor.company.meetings.nextSeconds, now - anchor.at)
}

/**
 * 이슈 탭의 종목회의 칸 (#803): 기회 하나를 써서 회의를 연다. 기회는 한 시간에 하나씩 생겨 세 개까지 쌓인다. 정하지 않은 회의가 있으면 이어서 한다.
 * 지난 회의의 남은 전투가 열려 있으면 그 전투로 가는 버튼도 함께 보인다(다음 회의를 열면 그 전투는 끝난다).
 */
export function MeetingCard({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const spot = useTutorialSpot(company, 'settle')
  const locked = useLocked(company, 'settle')
  const state = meetingState(company)
  const { chances, max } = company.meetings
  const left = useNextChance(company)
  const battle = company.invest?.outcome?.battle
  const pending = battle?.open ? battle : null
  const can = state === 'continue' || state === 'open'
  const open = async (el: HTMLElement) => {
    sfx.stamp()
    haptic.medium()
    useFx.getState().burstAt(el, 'sparks')
    if (await useRaisingStore.getState().convene()) {
      useAppUi.getState().setInvestOpen(true)
    }
  }
  return (
    <div className="grid gap-2">
      <p className="flex items-baseline justify-between gap-2 text-[13px] text-ink">
        <span>
          남은 기회{' '}
          <b className="font-mono-num text-[15px]" data-testid="meeting-chances">
            {chances} / {max}
          </b>
        </span>
        {chances < max && (
          <span className="font-mono-num text-[12px] text-ink/60" data-testid="meeting-next">
            다음 기회까지 {clock(left)}
          </span>
        )}
      </p>
      {pending && (
        <button
          type="button"
          className="toy-progress battle-entry battle-entry-compact toy-side-game"
          data-progress={pending.mode}
          data-mode={pending.mode}
          data-testid="pending-invest-battle"
          disabled={busy}
          onClick={() => {
            sfx.stamp()
            haptic.medium()
            useAppUi
              .getState()
              .startBattle({ kind: 'invest', mode: pending.mode, level: pending.level })
          }}
        >
          <BattleEntryContent mode={pending.mode} disabled={busy} compact />
        </button>
      )}
      <button
        type="button"
        className={`btn min-h-12 w-full text-[16px] ${can && !locked ? `btn-primary ${spot}` : 'btn-line'}`}
        data-testid="meeting-open"
        data-state={state}
        data-locked={locked || undefined}
        disabled={busy || locked || !can}
        onClick={(ev) => void open(ev.currentTarget)}
      >
        {busy ? '처리 중…' : locked ? '직원을 먼저 뽑아주세요' : LABEL[state]}
      </button>
      {state === 'nodesk' && !locked && (
        <p className="text-[12px] text-ink/60" data-testid="meeting-hint">
          돈을 굴리는 팀에 동료가 없어요. 동료를 더 뽑으면 회의를 열 수 있어요.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[12px] text-red-pen">
          {error}
        </p>
      )}
    </div>
  )
}
