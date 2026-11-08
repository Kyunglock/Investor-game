import type { Company, Grade } from '@web/api/client'
import { newlyOpened } from '@web/features/raising/LockedDesks'
import { officeName } from '@web/features/raising/office'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppUi } from '../ui'
import { expansionSide, gradeIndex } from './model'
import { ToyCityStreet } from './ToyCityStreet'

/** Replaces the app's old construction card only after the server confirms a grade change. */
export function ToyCityMove({
  company,
  before,
  after,
  beforeSeats,
  year,
  onDone,
}: {
  company: Company
  before: Grade
  after: Grade
  beforeSeats: number
  year: number
  onDone: () => void
}) {
  const [finished, setFinished] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const transition = useMemo(() => ({ before, after, beforeSeats }), [before, after, beforeSeats])
  const up = gradeIndex(after) > gradeIndex(before)
  const opened = up ? newlyOpened(company, before, after) : []
  const direction = expansionSide(after)
  const done = () => {
    onDone()
    useAppUi.getState().setTab('office')
  }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    button.current?.focus()
    const timer = setTimeout(
      () => setFinished(true),
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2400,
    )
    return () => {
      clearTimeout(timer)
      previous?.focus()
    }
  }, [])
  return createPortal(
    <div className="toy-move-layer">
      <section
        className="toy-move-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="toy-move-title"
        data-testid="move-scene"
        data-move={up ? 'up' : 'down'}
        onKeyDown={(e) => {
          if (e.key === 'Escape') done()
          if (e.key === 'Tab') {
            e.preventDefault()
            button.current?.focus()
          }
        }}
      >
        <ToyCityStreet company={company} transition={transition} />
        <div className="toy-move-heading">
          <p>
            {year}년 차 ·{' '}
            {up ? `${direction === 'left' ? '왼쪽' : '오른쪽'}으로 확장` : '회사 규모 조정'}
          </p>
          <h2 id="toy-move-title">
            {up
              ? finished
                ? '우리 회사가 커졌어요!'
                : '더 큰 회사로, 쿵!'
              : '다시 도약을 준비해요'}
          </h2>
          <span>
            {officeName(before)} → {officeName(after)}
          </span>
        </div>
        <div className="toy-move-result" aria-live="polite">
          <b>
            자리 {beforeSeats} → {company.seats}
          </b>
          <p>
            {company.seats > beforeSeats
              ? '회사가 넓어졌어요. 인력 관리에서 새 동료를 배치해보세요.'
              : '현재 자리와 직원 배치를 확인해보세요.'}
          </p>
          {opened.length > 0 && <p>새로 열린 직무: {opened.map((d) => d.name).join(' · ')}</p>}
          <button ref={button} type="button" className="toy-sheet-action" onClick={done}>
            {finished ? '사무실로' : '연출 건너뛰기'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
