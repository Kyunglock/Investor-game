import type { Applicant, Company } from '@web/api/client'
import { shortWon } from '@web/features/game/labels'
import { GradeCard } from '@web/features/raising/GradeCard'
import { titleOf } from '@web/features/raising/office'
import { useRaisingStore } from '@web/features/raising/store'
import { useState } from 'react'
import { useFx } from '../../fx/fx'
import { haptic } from '../../fx/haptics'
import { sfx } from '../../fx/sound'
import { NameTag, StatGrid } from '../people'
import { Sheet } from '../Sheet'
import { useAppUi } from '../ui'

/**
 * 공채 장면 (decisions.md 228·309·310번): 지원자 카드가 가로로 한 장씩 넘어간다(오토배틀러의 상점처럼). "뽑는다"를 누르면 코인이 터지며 계약금을 내고 뽑고,
 * 자리가 꽉 찼으면 내보낼 직원을 고르는 시트가 올라온다. 아래에 새로 받기.
 */
export function MarketScene({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const { hire, refreshApplicants } = useRaisingStore.getState()
  const sheet = useAppUi((s) => s.sheet)
  const { openSheet, closeSheet } = useAppUi.getState()
  const [at, setAt] = useState(0)
  const full = company.employees.length >= company.seats
  const applicants = [...company.applicants].sort((x, y) => Number(y.star) - Number(x.star))
  const picking = sheet?.kind === 'hire' ? applicants.find((a) => a.id === sheet.applicantId) : null
  if (company.status === 'ENDED') {
    return <p className="text-[13px] text-white/60">끝난 회사는 사람을 뽑지 않습니다.</p>
  }
  return (
    <div className="flex h-full flex-col" data-testid="market-scene">
      <p className="text-[12px] text-white/65">
        계약금을 내고 뽑습니다. 뽑은 사람은 쉬는 채로 들어오니 자리에 앉히세요.
        {company.meeting?.hrCap && ` 인사팀 덕에 ${company.meeting.hrCap} 언저리까지 옵니다.`}
      </p>
      {applicants.length === 0 ? (
        <p className="mt-6 text-center text-[14px] text-white/60">올해 지원자를 다 만났습니다.</p>
      ) : (
        <>
          <ul
            className="snap-x no-scrollbar -mx-4 mt-2 flex flex-1 items-center gap-3 overflow-x-auto px-6 pt-3 pb-2"
            data-testid="applicant-deck"
            onScroll={(ev) => {
              const el = ev.currentTarget
              const w = el.firstElementChild?.clientWidth ?? 1
              setAt(Math.round(el.scrollLeft / (w + 12)))
            }}
          >
            {applicants.map((a) => (
              <ApplicantCard
                key={a.id}
                applicant={a}
                affordable={company.capital >= a.fee}
                disabled={busy}
                full={full}
                onHire={(el) => {
                  if (full) {
                    sfx.tap()
                    openSheet({ kind: 'hire', applicantId: a.id })
                    return
                  }
                  sfx.coin()
                  haptic.light()
                  useFx.getState().burstAt(el, 'coins')
                  void hire(a.id)
                }}
              />
            ))}
          </ul>
          <p className="flex justify-center gap-1.5" aria-hidden="true">
            {applicants.map((a, i) => (
              <span
                key={a.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === at ? 'w-4 bg-(--gold-bright)' : 'w-1.5 bg-white/30'
                }`}
              />
            ))}
          </p>
        </>
      )}
      <button
        type="button"
        disabled={busy || company.capital < company.refreshCost}
        onClick={() => {
          sfx.whoosh()
          void refreshApplicants()
        }}
        className="btn btn-ghost mt-2 min-h-12 w-full text-[14px]"
      >
        지원자 새로 받기 · {shortWon(company.refreshCost)}
      </button>
      {picking && (
        <Sheet title={`${picking.name}을(를) 뽑으려면`} onClose={closeSheet} testId="hire-sheet">
          <p className="text-[13px] text-muted">
            자리가 꽉 찼습니다. 누구를 내보내고 뽑을까요? 계약금 {shortWon(picking.fee)}.
          </p>
          <div className="mt-2 grid gap-1.5">
            {company.employees.map((e) => (
              <button
                key={e.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  sfx.coin()
                  haptic.light()
                  closeSheet()
                  void hire(picking.id, e.id)
                }}
                className="btn btn-line min-h-12 justify-start px-3 text-left text-[14px] text-wine"
              >
                <NameTag employee={e} /> 내보내고 뽑는다
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}

function ApplicantCard({
  applicant: a,
  affordable,
  disabled,
  full,
  onHire,
}: {
  applicant: Applicant
  affordable: boolean
  disabled: boolean
  full: boolean
  onHire: (el: Element) => void
}) {
  return (
    <GradeCard
      as="li"
      grade={a.overallGrade}
      badgeLabel={a.star ? '특급' : '지원자'}
      className={`w-[82vw] max-w-[340px] shrink-0 p-3 ${a.star ? 'animate-glow' : ''}`}
      data-testid="applicant"
      data-star={String(a.star)}
    >
      {a.star && (
        <p className="mb-1 flex items-center gap-2 pl-[66px] text-[12px] font-bold text-gold">
          <span>★ 특급 인재</span>
          <span className="rounded bg-gold px-1.5 text-white">
            {a.leavesIn <= 1 ? '이번 분기만' : `${a.leavesIn}분기 남음`}
          </span>
        </p>
      )}
      <p className="pl-[66px] text-[17px] font-semibold">
        {a.name}{' '}
        <span className="text-[13px] font-normal text-muted">{titleOf(a.overallGrade)}</span>
      </p>
      {a.line && <p className="mt-1 pl-[66px] text-[13px] text-teal">{a.line}</p>}
      <p className="mt-1 pl-[66px] text-[12px] text-muted">등급 효과 · {a.perk}</p>
      {a.sectorName && <p className="mt-1 text-[12px] text-muted">관심 섹터 {a.sectorName}</p>}
      <div className="mt-3">
        <StatGrid grades={a.grades} size={16} />
      </div>
      <button
        type="button"
        disabled={disabled || !affordable}
        onClick={(ev) => onHire(ev.currentTarget)}
        className="btn btn-blue mt-3 min-h-14 w-full text-[16px]"
      >
        {full ? '내보내고 뽑는다' : '뽑는다'} · {shortWon(a.fee)}
      </button>
      {!affordable && (
        <p className="mt-1 text-center text-[12px] text-wine">계약금이 모자랍니다.</p>
      )}
    </GradeCard>
  )
}
