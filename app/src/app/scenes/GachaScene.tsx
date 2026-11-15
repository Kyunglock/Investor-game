import './company-scenes.css'
import type { Company } from '@web/api/client'
import { CollectionGrid, RatesTable } from '@web/features/raising/Gacha'
import { GradeBadge, GradeCard } from '@web/features/raising/GradeCard'
import { collected, drawable } from '@web/features/raising/gachaRules'
import { LADDER } from '@web/features/raising/grades'
import { titleOf } from '@web/features/raising/office'
import { useRaisingStore } from '@web/features/raising/store'
import { useState } from 'react'
import { useFx } from '../../fx/fx'
import { haptic } from '../../fx/haptics'
import { sfx } from '../../fx/sound'
import { type Employee, EmployeeDetail, IncomeTag } from '../people'
import { Sheet } from '../Sheet'
import { useAppUi } from '../ui'

type Part = 'draw' | 'crew' | 'dex'

/**
 * 채용 장면 (decisions.md 312번, #801): 뽑기 · 동료 · 도감. 뽑기는 큰 채용권 숫자와 1명·N명 뽑기 버튼, 확률표. 뽑힌 직원은 서버가 바로 자리에
 * 앉히므로 사장이 할 배치가 없고, 동료 목록에서 한 명을 누르면 상세(등급·능력치·초당 수입)를 본다. 도감은 만난 등급을 모은다.
 */
export function GachaScene({ company }: { company: Company }) {
  const [part, setPart] = useState<Part>('draw')
  const sheet = useAppUi((s) => s.sheet)
  const shown =
    sheet?.kind === 'employee' ? company.employees.find((e) => e.id === sheet.id) : undefined

  const parts: { id: Part; label: string; badge?: string }[] = [
    { id: 'draw', label: '뽑기' },
    { id: 'crew', label: `동료 ${company.employees.length}` },
    { id: 'dex', label: `도감 ${collected(company)}/${company.gacha.collection.length}` },
  ]
  return (
    <div className="company-scene recruitment-scene" data-testid="gacha-scene">
      <header className="scene-cover">
        <p className="scene-eyebrow">TALENT OFFICE</p>
        <h1>새로운 동료를 만나요</h1>
        <p>작은 만남이 회사의 다음 장을 바꿔요.</p>
        <span className="scene-cover-mark" aria-hidden="true">
          ✦
        </span>
      </header>
      <div className="scene-tabs no-scrollbar" role="tablist">
        {parts.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={part === p.id}
            onClick={() => {
              sfx.tap()
              setPart(p.id)
            }}
            className={`relative min-h-9 shrink-0 rounded-full border-2 px-3 font-game text-[14px] shadow-[0_2px_0_var(--outline)] ${
              part === p.id
                ? 'border-(--outline) bg-(--gold-bright) text-ink'
                : 'border-(--outline) bg-white/80 text-ink'
            }`}
            data-testid={`gacha-part-${p.id}`}
          >
            {p.label}
            {p.badge && (
              <span className="animate-badge-pulse ml-1 rounded-full bg-red-pen px-1.5 text-[10px] text-white">
                {p.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-3">
        {part === 'draw' && <DrawPart company={company} />}
        {part === 'crew' && <CrewPart company={company} />}
        {part === 'dex' && (
          <div className="panel p-3">
            <CollectionGrid company={company} />
          </div>
        )}
      </div>
      {shown && (
        <Sheet
          title={shown.name}
          onClose={() => useAppUi.getState().closeSheet()}
          testId="employee-sheet"
        >
          <GradeCard
            grade={shown.overallGrade}
            badgeLabel="종합"
            className="p-3 pl-[68px]"
            data-testid="employee"
          >
            <EmployeeDetail employee={shown} company={company} />
          </GradeCard>
        </Sheet>
      )}
    </div>
  )
}

/** 우리 동료 목록 (#801): 등급이 높은 순으로 이름·등급·앉은 팀·초당 수입. 누르면 상세 시트가 열린다. 보기만 한다. */
function CrewPart({ company }: { company: Company }) {
  const rank = (e: Employee) => LADDER.indexOf(e.overallGrade)
  const crew = [...company.employees].sort((a, b) => rank(b) - rank(a) || a.id - b.id)
  const deskName = (code: string | null | undefined) =>
    company.desks.find((d) => d.code === code)?.name
  if (crew.length === 0) {
    return (
      <p className="panel p-4 text-center text-[13px] text-ink/60" data-testid="crew-empty">
        아직 함께하는 동료가 없어요. 뽑기에서 첫 동료를 만나보세요.
      </p>
    )
  }
  return (
    <div className="panel p-3">
      <p className="mb-2 text-[12px] text-ink/60">
        뽑은 동료는 바로 자리에 앉아 일해요. 눌러서 자세히 볼 수 있어요.
      </p>
      <ul className="grid gap-1.5" data-testid="crew">
        {crew.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => {
                sfx.tap()
                useAppUi.getState().openSheet({ kind: 'employee', id: e.id })
              }}
              className="crew-row"
              data-testid="crew-row"
            >
              <GradeBadge grade={e.overallGrade} size="md" />
              <span className="crew-name">
                <b>{e.name}</b>
                <small>{deskName(e.desk) ?? titleOf(e.overallGrade)}</small>
              </span>
              <IncomeTag employee={e} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 뽑기: 채용권 숫자, 1명·N명 뽑기, 확률표. 자리가 꽉 차면 뽑을 수 없고 그때만 자리 수를 보인다 (#801). */
function DrawPart({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const { draw } = useRaisingStore.getState()
  const g = company.gacha
  // 자리(seats)만큼만 데리고 있을 수 있다: 남은 자리보다 많이 뽑지 않는다.
  const seatsLeft = Math.max(0, company.seats - company.employees.length)
  const many = Math.min(drawable(company), seatsLeft)
  const full = seatsLeft === 0
  const press = (count: number, el: Element) => {
    sfx.stamp()
    haptic.medium()
    useFx.getState().burstAt(el, 'sparks')
    void draw(count)
  }
  return (
    <div className="grid gap-3">
      <div className="recruit-ticket panel flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-[12px] text-ink/60">채용권</p>
          <p className="font-game text-[38px] leading-none text-[#e08a00] [-webkit-text-stroke:1.5px_var(--outline)] [paint-order:stroke]">
            🎟 <span data-testid="tickets">{g.tickets}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-ink/60">함께하는 동료</p>
          <p className="font-mono-num text-[20px] font-bold" data-testid="roster">
            {company.employees.length}명
          </p>
        </div>
      </div>
      <div className="recruit-actions grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy || many < 1}
          onClick={(ev) => press(1, ev.currentTarget)}
          className="btn btn-primary min-h-16 text-[17px]"
          data-testid="draw-one"
        >
          <span>1명 뽑기</span>
          <small>{full ? '자리가 없어요' : '채용권 1장'}</small>
        </button>
        <button
          type="button"
          disabled={busy || many < 2}
          onClick={(ev) => press(many, ev.currentTarget)}
          className="btn btn-gold min-h-16 text-[17px]"
          data-testid="draw-many"
        >
          <span>{many >= 2 ? `${many}명 뽑기` : '여러 명'}</span>
          <small>
            {many >= 2
              ? `채용권 ${many}장`
              : full
                ? '자리가 없어요'
                : seatsLeft < 2
                  ? '남은 자리 1'
                  : '채용권을 모아주세요'}
          </small>
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[12px] text-red-pen" data-testid="draw-error">
          {error}
        </p>
      )}
      {full ? (
        <p className="recruit-full" data-testid="roster-full">
          <b className="font-mono-num">
            자리 {company.employees.length} / {company.seats}
          </b>
          <span>회사를 넓히면 더 뽑을 수 있어요</span>
        </p>
      ) : (
        <p className="text-[12px] text-ink/60">
          회사를 차릴 때와 건물을 올릴 때 채용권을 받습니다.
          {company.meeting?.hrCap && ` 인사팀 덕에 ${company.meeting.hrCap} 언저리까지 나옵니다.`}
        </p>
      )}
      <div className="panel p-3">
        <p className="mb-1 text-[13px] font-semibold">어떤 동료를 만나게 될까요?</p>
        <RatesTable company={company} />
      </div>
    </div>
  )
}
