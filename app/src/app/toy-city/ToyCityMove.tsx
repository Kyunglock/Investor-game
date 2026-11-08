import type { Company, Grade } from '@web/api/client'
import { newlyOpened } from '@web/features/raising/LockedDesks'
import { officeName } from '@web/features/raising/office'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppUi } from '../ui'
import { expansionSide, gradeIndex, MOVE_DONE, MOVE_MS, type MovePhase } from './model'
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
  const [skipped, setSkipped] = useState(false)
  const [phase, setPhase] = useState<MovePhase>(0)
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
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : MOVE_MS,
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
        // 연출 도중 화면 아무 데나 누르면 끝 모습으로 건너뛴다 (399번). 아래 버튼은 지금처럼 사무실로 간다.
        onClick={(e) => {
          if ((e.target as Element).closest('button') || phase === MOVE_DONE) return
          setSkipped(true)
          setFinished(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') done()
          if (e.key === 'Tab') {
            e.preventDefault()
            button.current?.focus()
          }
        }}
      >
        <ToyCityStreet
          company={company}
          transition={transition}
          skip={skipped}
          onPhase={setPhase}
        />
        {/* 번쩍임은 SVG 밖의 HTML 층에 둔다: 투명도만 바뀌어 폰에서 거리 그림을 다시 그리지 않는다. */}
        {up && phase === 1 && <div className="toy-move-flash" aria-hidden="true" />}
        {up && phase === 3 && (
          // 새 건물 이름이 크게 떠오른다. 같은 건물 안에서 넓힌 것이면 "확장 완료!" (399번).
          <div className="toy-move-banner" data-testid="move-banner" aria-hidden="true">
            <small>{officeName(before)}</small>
            {officeName(before) !== officeName(after) && <span>▼</span>}
            <strong>
              {officeName(before) !== officeName(after) ? officeName(after) : '확장 완료!'}
            </strong>
          </div>
        )}
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
