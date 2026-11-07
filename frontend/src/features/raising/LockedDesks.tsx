import type { Company } from '../../api/client'
import { LADDER } from './grades'
import { officeName } from './office'

/** 자리가 열리는 때를 건물과 등급으로 말한다: "상가 2층(D)부터". */
export function unlockLabel(grade: string): string {
  return `${officeName(grade as Company['grade'])}(${grade})부터`
}

/** 이번에 새로 열린 자리 (#393): 열린 등급이 before 다음부터 after까지인 자리. */
export function newlyOpened(company: Company | null, before: string, after: string) {
  if (!company) {
    return []
  }
  const from = LADDER.indexOf(before as Company['grade'])
  const to = LADDER.indexOf(after as Company['grade'])
  return company.desks.filter((d) => {
    const at = d.unlockGrade ? LADDER.indexOf(d.unlockGrade as Company['grade']) : -1
    return at > from && at <= to
  })
}

/**
 * 아직 닫힌 돕는 자리 (#393): 회사가 커 가며 하나씩 열린다. 무엇이 언제 열리는지 미리 보인다.
 */
export function LockedDesks({ company, className = '' }: { company: Company; className?: string }) {
  const locked = company.lockedDesks ?? []
  if (locked.length === 0) {
    return null
  }
  return (
    <div className={`mt-3 ${className}`} data-testid="locked-desks">
      <p className="text-[12px] font-semibold">회사가 커지면 열리는 자리</p>
      <ul className="mt-1 grid gap-1">
        {locked.map((d) => (
          <li
            key={d.code}
            className="flex items-baseline justify-between gap-2 text-[12px] opacity-70"
          >
            <span>🔒 {d.name}</span>
            <span className="shrink-0">{unlockLabel(d.unlockGrade)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
