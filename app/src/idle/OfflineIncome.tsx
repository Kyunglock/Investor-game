import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { useEffect, useEffectEvent, useRef } from 'react'
import { createPortal } from 'react-dom'
import { awayText, saveOfflineSeen, shouldShowOffline } from '../app/income'
import { useAppUi } from '../app/ui'
import { sfx } from '../fx/sound'

/**
 * 자리를 비운 동안 번 돈 알림 (#803). 서버는 마지막으로 준 것을 응답마다 그대로 실어 보내므로, 이 기기가 확인한 at과 다를 때만 한 번 띄운다. 확인을
 * 누르면 그 at을 기기에 남긴다. 메인 화면(매도벽 돌파) 위에 뜨고, body에 바로 그린다(아래 화면은 그동안 누를 수 없다). 확인한 at(seen)은
 * 돌파 화면이 들고 있다: 이 알림이 떠 있는 동안 출석판이 기다리게 하려는 것이다 (528번).
 */
export function OfflineIncome({
  company,
  seen,
  onSeen,
}: {
  company: Company
  seen: number | null
  onSeen: (at: number) => void
}) {
  const offline = company.idle?.offline
  if (!offline || !shouldShowOffline(offline, seen)) return null
  return (
    <OfflineDialog
      key={offline.at}
      offline={offline}
      onConfirm={() => {
        saveOfflineSeen(offline.at)
        onSeen(offline.at)
      }}
    />
  )
}

function OfflineDialog({
  offline,
  onConfirm,
}: {
  offline: NonNullable<NonNullable<Company['idle']>['offline']>
  onConfirm: () => void
}) {
  const button = useRef<HTMLButtonElement>(null)
  const confirm = () => {
    sfx.cash()
    onConfirm()
  }
  // 뒤로 가기·Escape가 부르는 쪽: 회사가 1초마다 새로 와도 effect를 다시 걸지 않는다.
  const dismiss = useEffectEvent(confirm)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    button.current?.focus()
    // 뒤로 가기(안드로이드)와 Escape도 확인이다. 창이 떠 있는 동안 아래 화면은 멈춘다(modalBack이 화면을 inert로 둔다).
    const before = useAppUi.getState().modalBack
    useAppUi.getState().setModalBack(() => dismiss())
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        dismiss()
      }
      // 단추가 하나뿐이라 Tab은 그 단추에 머문다.
      if (event.key === 'Tab') {
        event.preventDefault()
        button.current?.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      useAppUi.getState().setModalBack(before)
      previous?.focus()
    }
  }, [])
  return createPortal(
    <div className="idle-offline-layer">
      <section
        className="idle-offline"
        role="dialog"
        aria-modal="true"
        aria-labelledby="idle-offline-title"
        aria-describedby="idle-offline-body"
        data-testid="offline-income"
      >
        <h2 id="idle-offline-title">자리를 비운 동안</h2>
        <p id="idle-offline-body" className="idle-offline-earned">
          <b data-testid="offline-earned">{money(offline.earned)}</b> 벌었어요
        </p>
        <p className="idle-offline-away" data-testid="offline-away">
          {awayText(offline.seconds)} 동안 직원들이 일했어요
        </p>
        {offline.capped && (
          <p className="idle-offline-cap" data-testid="offline-capped">
            최대 8시간까지 쌓여요
          </p>
        )}
        <button ref={button} type="button" onClick={confirm} data-testid="offline-confirm">
          확인
        </button>
      </section>
    </div>,
    document.body,
  )
}
