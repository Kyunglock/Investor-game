import { useState } from 'react'
import type { Company } from '../../api/client'
import { Document } from '../game/Document'
import { shortWon, signedWon } from '../game/labels'
import { usePixelArt } from '../game/pixelArt'
import { STAT_NAMES } from './grades'
import { OfficeArt } from './OfficeArt'
import { ATTIRE_NAMES, attireOf, glowOf } from './office'
import { GradeLadder } from './RunResult'
import { useRaisingStore } from './store'

type Seats = Record<number, string | null>

/**
 * 회사 화면 (증권사 육성 설계 4·6절). 한 해 = 연초 회의 → 배치 → (공채 육성) → 결산. 사장은 배치만 하고 직원은 능력치대로 알아서 굴린다. 배치는 작년
 * 그대로가 기본이다 (7.2절).
 */
export function CompanyScreen({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const { place, settle, start } = useRaisingStore.getState()
  const [seats, setSeats] = useState<Seats>(() =>
    Object.fromEntries(company.employees.map((e) => [e.id, e.desk ?? null])),
  )
  const placed = Object.values(seats).filter(Boolean).length
  const changed = company.employees.some((e) => (e.desk ?? null) !== seats[e.id])
  const ended = company.status === 'ENDED'
  const meeting = company.meeting

  const save = () =>
    place(company.employees.map((e) => ({ employeeId: e.id, desk: seats[e.id] ?? null })))

  return (
    <Document
      title={
        ended
          ? `${company.number}호 회사 · 시대가 끝났다`
          : `${company.number}호 회사 · ${company.year}년 차 / ${company.turns}년`
      }
    >
      <div data-testid="company">
        <p className="text-[13px]" data-testid="era">
          <b>{company.era.name}</b> — {company.era.description}
        </p>
        <p className="mt-1 text-[12px] text-muted" data-testid="owner">
          사장 명성 <b className="font-mono-num">{company.owner.fameGrade}</b> · 판 회사{' '}
          {company.owner.sales}곳
        </p>
        {company.opening && !company.lastSettlement && (
          <p className="mt-2 text-[13px]" data-testid="opening">
            {company.opening}
          </p>
        )}
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] text-muted">회사 등급</p>
          <p className="font-mono-num text-[15px]" data-testid="company-capital">
            자본 {shortWon(company.capital)}
          </p>
        </div>
        <p
          className="font-serif-kr text-[40px] font-black leading-none"
          data-testid="company-grade"
        >
          {company.grade}
        </p>
        <GradeLadder grade={company.grade} />
        <OfficeArt company={company} />
        <PixelToggle />
        {company.nextGradeCapital != null && (
          <p className="mt-1 text-[12px] text-muted">
            다음 등급까지 자본 {shortWon(company.nextGradeCapital)} · 자리 {company.seats}개
          </p>
        )}

        {company.lastSettlement && <SettlementView company={company} />}

        {meeting && (
          <section className="mt-5 border-t border-line-soft pt-4" data-testid="meeting">
            <h3 className="font-pen text-[22px]">연초 회의</h3>
            {meeting.omen && (
              <p className="mt-1 text-[14px] font-bold text-red-pen" data-testid="company-omen">
                <span className="mr-1 rounded bg-red-pen px-1 text-[11px] text-white">
                  폭락 조짐
                </span>
                {meeting.omen}
              </p>
            )}
            <p className="mt-1 text-[14px]">{meeting.wanted}</p>
          </section>
        )}

        <section className="mt-4">
          <h3 className="font-pen text-[22px]">
            배치 ({placed} / {company.seats}자리)
          </h3>
          <ul className="mt-2 grid gap-2">
            {company.employees.map((e) => (
              <li key={e.id} className="rounded border border-line p-3" data-testid="employee">
                <p className="font-semibold">
                  {e.name} <span className="font-mono-num text-[13px]">종합 {e.overallGrade}</span>{' '}
                  <span className="text-[12px] text-muted" data-testid="attire">
                    · {ATTIRE_NAMES[attireOf(e.overallGrade)]}
                    {glowOf(e.overallGrade) &&
                      ` · ${glowOf(e.overallGrade) === 'gold' ? '금빛' : '파란빛'}`}
                  </span>
                </p>
                <p className="text-[12px] text-muted">
                  {Object.entries(STAT_NAMES)
                    .map(([code, name]) => `${name} ${e.grades[code]}`)
                    .join(' · ')}
                </p>
                {!ended && (
                  <select
                    aria-label={`${e.name}의 자리`}
                    className="mt-2 w-full rounded border border-line bg-card p-2"
                    value={seats[e.id] ?? ''}
                    onChange={(event) => setSeats({ ...seats, [e.id]: event.target.value || null })}
                  >
                    <option value="">쉰다</option>
                    {company.desks.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name} ({STAT_NAMES[d.statCode]})
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
          {!ended && (
            <ul className="mt-2 text-[12px] text-muted">
              {company.desks.map((d) => (
                <li key={d.code}>
                  {d.name}: {d.description}
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && (
          <p role="alert" className="mt-3 text-[13px] text-wine">
            {error}
          </p>
        )}

        {!ended && meeting && (
          <div className="mt-4 grid gap-2">
            {changed && (
              <button
                type="button"
                disabled={busy || placed > company.seats}
                onClick={() => void save()}
                className="min-h-12 rounded border border-pen font-semibold disabled:opacity-50"
              >
                이렇게 앉힌다
              </button>
            )}
            {meeting.recruitOpen && (
              <button
                type="button"
                disabled={busy || changed}
                onClick={() => void start()}
                className="min-h-12 rounded border border-pen font-semibold disabled:opacity-50"
              >
                공채 육성 (회사 돈 {shortWon(meeting.recruitFund)})
              </button>
            )}
            <button
              type="button"
              disabled={busy || changed}
              onClick={() => void settle()}
              className="min-h-12 rounded bg-wine font-semibold text-white disabled:opacity-50"
            >
              {company.year}년 차 결산 보기
            </button>
          </div>
        )}
        {company.sale && <SalePanel company={company} />}
      </div>
    </Document>
  )
}

const PHASES: Record<string, string> = { boom: '호황', normal: '보통', crash: '폭락장' }

function SettlementView({ company }: { company: Company }) {
  const s = company.lastSettlement
  if (!s) {
    return null
  }
  const desk = (code: string) => company.desks.find((d) => d.code === code)?.name ?? code
  return (
    <section className="mt-5 border-t border-line-soft pt-4" data-testid="settlement">
      <h3 className="font-pen text-[22px]">
        {s.year}년 차 결산 · {PHASES[s.phase]}
      </h3>
      <p className="text-[14px]">
        자본 {shortWon(s.capitalBefore)} → <b>{shortWon(s.capitalAfter)}</b>
        {s.gradeBefore !== s.gradeAfter && ` · 등급 ${s.gradeBefore} → ${s.gradeAfter}`}
      </p>
      <p className="text-[12px] text-muted">수수료 매출 {signedWon(s.fee)}</p>
      <ul className="mt-2 text-[13px]">
        {s.results.map((r) => (
          <li key={r.employeeId}>
            {r.name} ({desk(r.desk)}): {signedWon(r.pnl)}
          </li>
        ))}
      </ul>
      <ul className="mt-2 text-[13px]">
        {s.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  )
}

/** 도트 그림 끄기 (decisions.md 190번). 끄면 건물 그림 대신 같은 내용을 글로 보인다. */
function PixelToggle() {
  const shown = usePixelArt((s) => s.shown)
  const setShown = usePixelArt((s) => s.setShown)
  return (
    <button
      type="button"
      onClick={() => setShown(!shown)}
      className="mt-1 text-[12px] text-muted underline"
      aria-pressed={!shown}
    >
      {shown ? '그림 끄기' : '그림 켜기'}
    </button>
  )
}

/**
 * 매각과 재창업 (9절). 시대가 끝나면 반드시 팔고, 그 전에는 등급이 매각 조건 이상일 때 스스로 판다. 아끼던 직원을 공동창업자로 데려가 다음 회사를 F에서
 * 차린다.
 */
function SalePanel({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const { sell } = useRaisingStore.getState()
  const sale = company.sale
  const [open, setOpen] = useState(sale?.forced ?? false)
  const [picked, setPicked] = useState<number[]>([])
  if (!sale) {
    return null
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 min-h-12 w-full rounded border border-gold font-semibold"
      >
        회사 팔기 ({sale.note})
      </button>
    )
  }
  const toggle = (id: number) =>
    setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id])
  return (
    <section className="mt-5 rounded border border-gold p-4" data-testid="sale">
      <h3 className="font-pen text-[22px]">매각</h3>
      <p className="text-[14px]">{sale.note}</p>
      <p className="mt-1 text-[13px]">
        매각가 <b>{shortWon(sale.price)}</b> · 사장 명성 {company.owner.fameGrade} →{' '}
        {sale.fameAfter}
      </p>
      <p className="mt-2 text-[13px] text-muted">
        공동창업자로 {sale.cofounderSlots}명까지 데려갑니다. 등급은 그대로입니다.
      </p>
      <ul className="mt-2 grid gap-1">
        {company.employees.map((e) => {
          const checked = picked.includes(e.id)
          return (
            <li key={e.id}>
              <label className="flex items-center gap-2 text-[14px]">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && picked.length >= sale.cofounderSlots}
                  onChange={() => toggle(e.id)}
                />
                {e.name} (종합 {e.overallGrade})
              </label>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        disabled={busy}
        onClick={() => void sell(picked)}
        className="mt-3 min-h-12 w-full rounded bg-wine font-semibold text-white disabled:opacity-50"
      >
        회사를 팔고 새 회사를 차린다
      </button>
    </section>
  )
}
