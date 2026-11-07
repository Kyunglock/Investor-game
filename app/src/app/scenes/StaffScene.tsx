import type { Company } from '@web/api/client'
import { withParticle } from '@web/features/game/labels'
import { GradeBadge, GradeCard } from '@web/features/raising/GradeCard'
import { LADDER, STAT_NAMES } from '@web/features/raising/grades'
import { autoPlace, deskEffect, seatOne } from '@web/features/raising/placement'
import { useRaisingStore } from '@web/features/raising/store'
import { haptic } from '../../fx/haptics'
import { sfx } from '../../fx/sound'
import { type Desk, type Employee, EmployeeDetail, FIT_TONE, fitOf, NameTag } from '../people'
import { Sheet } from '../Sheet'
import { useAppUi } from '../ui'

/**
 * 배치 장면 (decisions.md 269·309번): 직무 자리 카드가 늘어서고, 누르면 시트에서 앉은 사람(빼기·팀장으로)과 앉힐 후보(맞는 순)를 고른다. 위에 자동 배치.
 */
export function StaffScene({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const { place } = useRaisingStore.getState()
  const sheet = useAppUi((s) => s.sheet)
  const { openSheet, closeSheet } = useAppUi.getState()
  const ended = company.status === 'ENDED'
  const placed = company.employees.filter((e) => e.desk).length
  const open = sheet?.kind === 'desk' ? company.desks.find((d) => d.code === sheet.desk) : null
  return (
    <div data-testid="staff-scene">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] text-white/85">
          앉힌 사람 <b className="font-mono-num text-(--gold-bright)">{placed}</b> / {company.seats}
          자리
        </p>
        {!ended && company.employees.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              sfx.whoosh()
              haptic.light()
              void place(autoPlace(company))
            }}
            className="btn btn-teal min-h-11 px-4 text-[13px]"
          >
            자동 배치
          </button>
        )}
      </div>
      {company.employees.length === 0 ? (
        <p className="mt-4 text-center text-[14px] text-white/60">
          아직 직원이 없습니다. 채용에서 뽑으세요.
        </p>
      ) : (
        <ul className="mt-2 grid gap-2" data-testid="desk-board">
          {company.desks.map((d) => {
            const seated = company.employees
              .filter((e) => e.desk === d.code)
              .sort((a, b) => Number(b.leader) - Number(a.leader) || a.id - b.id)
            return (
              <li key={d.code}>
                <button
                  type="button"
                  disabled={ended}
                  onClick={() => {
                    sfx.tap()
                    openSheet({ kind: 'desk', desk: d.code })
                  }}
                  className="panel flex w-full items-start justify-between gap-2 p-3 text-left active:scale-[0.99]"
                  data-testid="desk-row"
                  data-desk={d.code}
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold">
                      {d.hot && '★ '}
                      {d.name}{' '}
                      <span className="text-[12px] font-normal text-muted">
                        {STAT_NAMES[d.statCode]} · {deskEffect(d)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[13px]" data-testid="desk-members">
                      {seated.length === 0
                        ? '비어 있음'
                        : seated.map((e, i) => (
                            <span key={e.id}>
                              {i > 0 && ' · '}
                              <NameTag employee={e} />
                              {e.leader ? '(팀장)' : ''}
                            </span>
                          ))}
                    </span>
                  </span>
                  {!ended && <span className="shrink-0 text-[13px] text-teal">고르기 ›</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {company.employees.length > 0 && (
        <details className="mt-3" open={ended}>
          <summary className="cursor-pointer text-[13px] text-white/65">
            직원 상세 능력치 ({company.employees.length}명)
          </summary>
          <ul className="mt-2 grid gap-2">
            {company.employees.map((e) => (
              <GradeCard
                as="li"
                key={e.id}
                grade={e.overallGrade}
                badgeLabel="종합"
                className="p-3 pl-[68px]"
                data-testid="employee"
              >
                <EmployeeDetail employee={e} company={company} />
              </GradeCard>
            ))}
          </ul>
        </details>
      )}
      {open && <DeskSheet company={company} desk={open} onClose={closeSheet} />}
    </div>
  )
}

/** 자리 하나의 시트: 앉은 사람(빼기·팀장으로)과 앉힐 후보. 후보는 그 자리가 원하는 능력치가 높은 순이고, 다른 자리 사람은 옮겨 앉는다. */
function DeskSheet({
  company,
  desk: d,
  onClose,
}: {
  company: Company
  desk: Desk
  onClose: () => void
}) {
  const busy = useRaisingStore((s) => s.busy)
  const { place, appointLeader } = useRaisingStore.getState()
  const placed = company.employees.filter((e) => e.desk).length
  const full = placed >= company.seats
  const rank = (e: Employee) => LADDER.indexOf(e.grades[d.statCode] as (typeof LADDER)[number])
  const seated = company.employees
    .filter((e) => e.desk === d.code)
    .sort((a, b) => Number(b.leader) - Number(a.leader) || a.id - b.id)
  const others = company.employees
    .filter((e) => e.desk !== d.code)
    .sort((a, b) => rank(b) - rank(a) || a.id - b.id)
  const deskName = (code: string | null | undefined) =>
    company.desks.find((x) => x.code === code)?.name ?? code
  return (
    <Sheet
      title={
        <>
          {d.hot && '★ '}
          {d.name}
        </>
      }
      onClose={onClose}
      testId="desk-sheet"
    >
      <p className="text-[12px] text-muted">
        {d.description} {deskEffect(d)}
      </p>
      {seated.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {seated.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line-soft bg-white px-2 py-1.5 text-[13px]"
            >
              <GradeBadge grade={e.overallGrade} size="inline" />
              <b>{e.name}</b>
              <span className="font-mono-num text-[12px]">
                {STAT_NAMES[d.statCode]} {e.grades[d.statCode]}
              </span>
              {e.leader ? (
                <span className="rounded bg-gold px-1.5 text-[11px] text-white">팀장</span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    sfx.coin()
                    haptic.light()
                    void appointLeader(d.code, e.id)
                  }}
                  className="btn btn-line min-h-8 px-2 text-[12px] text-gold"
                >
                  팀장으로
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  sfx.tap()
                  void place(seatOne(company, e.id, null))
                }}
                className="btn btn-line ml-auto min-h-8 px-2 text-[12px] text-muted"
              >
                빼기
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[12px] text-muted">
        앉힐 사람 · {withParticle(STAT_NAMES[d.statCode], '이', '가')} 높은 순
        {full && ' · 자리가 꽉 차서 쉬는 사람은 앉힐 수 없습니다'}
      </p>
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        {others.map((e) => {
          const fit = fitOf(e, d)
          const blocked = !e.desk && full
          return (
            <button
              key={e.id}
              type="button"
              disabled={busy || blocked}
              onClick={() => {
                sfx.tap()
                haptic.light()
                onClose()
                void place(seatOne(company, e.id, d.code))
              }}
              className={`btn btn-line min-h-12 flex-col items-start px-2 text-left text-[13px] ${FIT_TONE[fit]}`}
              data-fit={fit}
              data-testid="desk-candidate"
            >
              <NameTag employee={e} />
              <span className="block font-mono-num text-[11px] opacity-80">
                {STAT_NAMES[d.statCode]} {e.grades[d.statCode]}
                {e.sector && d.sector === e.sector && ' · 관심'}
              </span>
              <span className="block text-[11px] text-muted">
                {e.desk ? `${deskName(e.desk)}에서 옮김` : '쉬는 중'}
              </span>
            </button>
          )
        })}
        {others.length === 0 && <p className="text-[13px] text-muted">다른 직원이 없습니다.</p>}
      </div>
    </Sheet>
  )
}
