import type { Company } from '@web/api/client'
import { GradeBadge } from '@web/features/raising/GradeCard'
import { LADDER, STAT_NAMES, STAT_ORDER } from '@web/features/raising/grades'
import { ATTIRE_NAMES, attireOf, titleOf } from '@web/features/raising/office'
import { deskEffect, rankDesks, seatOne } from '@web/features/raising/placement'
import { useRaisingStore } from '@web/features/raising/store'

export type Employee = Company['employees'][number]
export type Desk = Company['desks'][number]

/** 직원이 그 자리에 맞는 정도: 자리가 원하는 능력치의 등급으로 (4.2절). A 이상 잘 맞음, C·B 보통, 그 아래 안 맞음. */
export function fitOf(employee: Employee, desk: Desk): 'good' | 'fair' | 'poor' {
  const at = LADDER.indexOf(employee.grades[desk.statCode] as (typeof LADDER)[number])
  return at >= LADDER.indexOf('A') ? 'good' : at >= LADDER.indexOf('C') ? 'fair' : 'poor'
}

export const FIT_TONE = {
  good: 'border-teal text-teal',
  fair: 'border-gold text-gold',
  poor: 'border-wine/60 text-wine',
} as const

/** 사기 (decisions.md 270번). 0(보통)은 적지 않는다. */
const MORALE: Record<number, string> = {
  [-2]: '사기 바닥',
  [-1]: '사기 낮음',
  1: '사기 높음',
  2: '의욕 넘침',
}

/** 능력치 다섯의 등급을 한 줄로. 지원자 카드와 직원 상세가 같이 쓴다. */
export function StatGrid({ grades, size = 14 }: { grades: Record<string, string>; size?: number }) {
  return (
    <ul className="grid grid-cols-5 gap-1 text-center text-[11px]">
      {STAT_ORDER.map((code) => (
        <li key={code} className="rounded-md border border-line-soft bg-white/60 py-1">
          {STAT_NAMES[code]}
          <b className="block font-mono-num" style={{ fontSize: size }}>
            {grades[code]}
          </b>
        </li>
      ))}
    </ul>
  )
}

/** 직원 한 명의 상세: 이름·직함·차림새·효과·관심 섹터·사기와 능력치 다섯. */
export function EmployeeDetail({ employee: e, company }: { employee: Employee; company: Company }) {
  const desk = company.desks.find((d) => d.code === e.desk)
  return (
    <div data-testid="employee-detail">
      <p className="text-[16px] font-semibold">
        {e.name}{' '}
        <span className="text-[13px] font-normal text-muted">{titleOf(e.overallGrade)}</span>{' '}
        <span className="font-mono-num text-[13px]">종합 {e.overallGrade}</span>
        {e.quirkName && (
          // 버릇 (decisions.md 349번): 이직·첫인사·합성 문구가 이를 따른다.
          <span
            className="ml-1 rounded-full border border-ink/30 bg-[#fff6c9] px-1.5 text-[11px] font-normal"
            data-testid="quirk"
          >
            {e.quirkName}
          </span>
        )}
      </p>
      <p className="text-[12px] text-muted">
        {ATTIRE_NAMES[attireOf(e.overallGrade)]}
        {e.effects.length > 0 && ` · ${e.effects.join('·')}`}
        {e.experienceNeeded != null && ` · 실전 경험 ${e.experience}/${e.experienceNeeded}`}
        {e.sectorName && ` · 관심 섹터 ${e.sectorName}`}
        {e.deskYears > 0 && ` · 같은 자리 ${e.deskYears}년`}
        {e.settled && ' · 손에 익음'}
        {e.morale !== 0 && ` · ${MORALE[e.morale]}`}
      </p>
      <p className="mt-0.5 text-[12px] text-teal">등급 효과 · {e.perk}</p>
      <p className="mt-0.5 text-[12px]">
        {desk ? `${desk.name}${e.leader ? ' 팀장' : ''}` : '쉬는 중'}
      </p>
      <div className="mt-2">
        <StatGrid grades={e.grades} />
      </div>
    </div>
  )
}

/**
 * 한 사람의 자리 버튼 (decisions.md 230번): 누르면 바로 앉는다. 맞는 자리부터 늘어서고, 맞는 정도가 색으로 보인다. 쉬던 사람은 자리가 남아 있어야 앉는다.
 */
export function DeskButtons({
  company,
  employee: e,
  onSeated,
}: {
  company: Company
  employee: Employee
  onSeated?: () => void
}) {
  const busy = useRaisingStore((s) => s.busy)
  const { place } = useRaisingStore.getState()
  const placed = company.employees.filter((x) => x.desk).length
  const full = !e.desk && placed >= company.seats
  const seat = async (desk: string | null) => {
    await place(seatOne(company, e.id, desk))
    onSeated?.()
  }
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {rankDesks(company, e).map((d) => {
        const on = e.desk === d.code
        const fit = fitOf(e, d)
        return (
          <button
            key={d.code}
            type="button"
            aria-pressed={on}
            disabled={busy || (!on && full)}
            onClick={() => void seat(on ? null : d.code)}
            className={`min-h-12 rounded-lg border px-2 text-left text-[13px] disabled:opacity-40 ${
              on ? 'border-pen bg-pen text-white' : `bg-white ${FIT_TONE[fit]}`
            }`}
            data-fit={fit}
            title={deskEffect(d)}
          >
            {d.hot && '★ '}
            {d.name}
            <span className="block font-mono-num text-[11px] opacity-80">
              {STAT_NAMES[d.statCode]} {e.grades[d.statCode]}
              {e.sector && d.sector === e.sector && ' · 관심'}
            </span>
          </button>
        )
      })}
      <button
        type="button"
        disabled={busy || !e.desk}
        onClick={() => void seat(null)}
        className="min-h-12 rounded-lg border border-line bg-white text-[13px] text-muted disabled:opacity-40"
      >
        쉰다
      </button>
    </div>
  )
}

/** 글줄 안의 이름 + 작은 방패 등급표. */
export function NameTag({ employee: e }: { employee: Employee }) {
  return (
    <span className="whitespace-nowrap">
      <GradeBadge grade={e.overallGrade} size="inline" />
      {e.name}
    </span>
  )
}
