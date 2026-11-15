import type { Company } from '@web/api/client'
import { DiamondIcon } from '@web/features/raising/DiamondIcon'
import { useRaisingStore } from '@web/features/raising/store'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppUi } from '../app/ui'
import { sfx } from '../fx/sound'
import {
  type AttendanceReward,
  cellAmount,
  cellState,
  rewardText,
  shouldAutoOpen,
} from './attendance'
import { IdleIcon } from './icons'

/**
 * 출석 보상 (decisions.md 528번). 돌파 화면 위쪽의 달력 단추와 출석판 창이다. 오늘 보상을 아직 안 받았으면 창이 스스로 뜨고(단추에는 점), 닫은 뒤에는
 * 단추로 다시 연다. wait이면(자리를 비운 동안의 수입 알림이 떠 있거나 다른 화면을 보는 중) 스스로 뜨는 것을 미룬다: 두 창이 함께 뜨지 않는다.
 */
export function IdleAttendance({ company, wait }: { company: Company; wait: boolean }) {
  const attendance = company.attendance
  const [asked, setAsked] = useState(false)
  const [dismissedDay, setDismissedDay] = useState<number | null>(null)
  // 방금 받은 보상: 받고 나면 claimable이 꺼지지만 무엇을 받았는지 보여 줄 때까지 창을 둔다.
  const [received, setReceived] = useState<AttendanceReward | null>(null)
  const open = asked || received != null || (!wait && shouldAutoOpen(attendance, dismissedDay))
  const close = () => {
    setAsked(false)
    setReceived(null)
    setDismissedDay(attendance.today)
  }
  return (
    <>
      <button
        type="button"
        className="idle-quick-button"
        aria-label={attendance.claimable ? '출석 보상 받을 수 있음' : '출석 보상'}
        data-testid="idle-attendance"
        onClick={() => setAsked(true)}
      >
        <IdleIcon name="calendar" />
        {attendance.claimable && <i className="idle-dot" data-testid="attendance-dot" />}
      </button>
      {open && (
        <AttendanceDialog
          company={company}
          received={received}
          onReceived={setReceived}
          onClose={close}
        />
      )}
    </>
  )
}

function AttendanceDialog({
  company,
  received,
  onReceived,
  onClose,
}: {
  company: Company
  received: AttendanceReward | null
  onReceived: (reward: AttendanceReward) => void
  onClose: () => void
}) {
  const attendance = company.attendance
  const box = useRef<HTMLElement>(null)
  const main = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dismiss = useEffectEvent(onClose)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    main.current?.focus()
    // 뒤로 가기(안드로이드)와 Escape는 닫기다. 창이 떠 있는 동안 아래 화면은 멈춘다(modalBack이 화면을 inert로 둔다).
    const before = useAppUi.getState().modalBack
    useAppUi.getState().setModalBack(() => dismiss())
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        dismiss()
      }
      if (event.key !== 'Tab') return
      // Tab은 창 안의 단추들 사이에서만 돈다.
      const buttons = Array.from(
        box.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [],
      )
      if (buttons.length === 0) return
      const at = buttons.indexOf(document.activeElement as HTMLElement)
      event.preventDefault()
      buttons[(at + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus()
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      useAppUi.getState().setModalBack(before)
      previous?.focus()
    }
  }, [])
  const claim = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const after = await useRaisingStore.getState().claimAttendance()
    setBusy(false)
    const reward = after?.attendance.lastReward
    if (!after || !reward) {
      setError(useRaisingStore.getState().error ?? '연결이 끊겼어요. 다시 시도해 주세요.')
      return
    }
    sfx.cash()
    onReceived(reward)
  }
  return createPortal(
    <div className="idle-offline-layer">
      <section
        ref={box}
        className="idle-offline idle-attendance"
        role="dialog"
        aria-modal="true"
        aria-labelledby="idle-attendance-title"
        data-testid="attendance"
      >
        <button
          type="button"
          className="idle-attendance-close"
          aria-label="닫기"
          data-testid="attendance-close"
          onClick={onClose}
        >
          ✕
        </button>
        <h2 id="idle-attendance-title">출석 보상</h2>
        <p className="idle-offline-away">하루에 한 번 · 빠진 날이 있어도 이어서 가요</p>
        <ol className="idle-attendance-board" data-testid="attendance-board">
          {attendance.board.map((cell) => {
            const state = cellState(attendance, cell)
            return (
              <li
                key={cell.day}
                className={`is-${state} ${cell.day === attendance.board.length ? 'is-last' : ''}`}
                data-testid="attendance-cell"
                data-day={cell.day}
                data-state={state}
                aria-current={state === 'today' ? 'true' : undefined}
              >
                <small className="idle-attendance-day">
                  {state === 'today' ? '오늘' : `${cell.day}일`}
                </small>
                <span className="idle-attendance-reward">
                  {cell.diamonds > 0 ? (
                    <DiamondIcon />
                  ) : (
                    <span className="idle-coin" aria-hidden="true">
                      ₩
                    </span>
                  )}
                  <b>
                    <span className="sr-only">{cell.diamonds > 0 ? '다이아 ' : '돈 '}</span>
                    {cellAmount(cell)}
                  </b>
                </span>
                {state === 'done' && (
                  <span className="idle-attendance-stamp" role="img" aria-label="받음">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
        {received ? (
          <p className="idle-attendance-result" role="status" data-testid="attendance-result">
            <b>{rewardText(received)}</b> 받았어요
          </p>
        ) : (
          !attendance.claimable && (
            <p className="idle-attendance-result is-quiet" data-testid="attendance-done">
              오늘 보상은 받았어요 · 내일 또 만나요
            </p>
          )
        )}
        {error && (
          <p className="idle-attendance-error" role="alert">
            {error}
          </p>
        )}
        {attendance.claimable && !received ? (
          <button
            ref={main}
            type="button"
            disabled={busy}
            onClick={() => void claim()}
            data-testid="attendance-claim"
          >
            받기
          </button>
        ) : (
          <button ref={main} type="button" onClick={onClose} data-testid="attendance-confirm">
            확인
          </button>
        )}
      </section>
    </div>,
    document.body,
  )
}
