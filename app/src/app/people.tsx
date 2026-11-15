import type { Company } from '@web/api/client'
import { STAT_NAMES, STAT_ORDER } from '@web/features/raising/grades'
import { ATTIRE_NAMES, attireOf, titleOf } from '@web/features/raising/office'
import { rate } from './income'

export type Employee = Company['employees'][number]

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

/** 직원이 1초에 버는 돈 한 줄 (#803): 직원 상세와 채용 화면의 직원 줄이 같이 쓴다. 자리와 상관없이 번다. */
export function IncomeTag({ employee: e }: { employee: Employee }) {
  return (
    <span className="whitespace-nowrap font-mono-num text-[11px] text-teal" data-testid="income">
      초당 +{rate(e.incomePerSecond)}
    </span>
  )
}

/** 직원 한 명의 상세: 이름·직함·차림새·효과·관심 섹터, 앉은 팀과 초당 수입, 능력치 다섯. 보기만 한다: 옮기거나 내보내지 않는다 (#801). */
export function EmployeeDetail({ employee: e, company }: { employee: Employee; company: Company }) {
  const desk = company.desks.find((d) => d.code === e.desk)
  return (
    <div data-testid="employee-detail">
      <p className="text-[16px] font-semibold">
        {e.name}{' '}
        <span className="text-[13px] font-normal text-muted">{titleOf(e.overallGrade)}</span>{' '}
        <span className="font-mono-num text-[13px]">종합 {e.overallGrade}</span>
        {e.quirkName && (
          // 버릇 (decisions.md 349번): 첫인사 문구가 이를 따른다.
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
        {e.sectorName && ` · 관심 섹터 ${e.sectorName}`}
      </p>
      <p className="mt-0.5 text-[12px] text-teal">등급 효과 · {e.perk}</p>
      <p className="mt-0.5 text-[12px]">
        {desk && `${desk.name} · `}
        <IncomeTag employee={e} />
      </p>
      <div className="mt-2">
        <StatGrid grades={e.grades} />
      </div>
    </div>
  )
}
