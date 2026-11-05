import { useState } from 'react'
import type { Applicant, Company } from '../../api/client'
import { Document } from '../game/Document'
import { shortWon, signedWon } from '../game/labels'
import { usePixelArt } from '../game/pixelArt'
import { bubbleOf } from './board'
import { GradeLadder } from './GradeLadder'
import { STAT_NAMES, STAT_ORDER } from './grades'
import { InvestPanel } from './InvestPanel'
import { MoveScene } from './MoveScene'
import { OfficeArt } from './OfficeArt'
import { ATTIRE_NAMES, attireOf, glowOf } from './office'
import { useRaisingStore } from './store'

type Seats = Record<number, string | null>

/**
 * 회사 화면 (증권사 육성 설계 4·6절). 한 해 = 연초 회의(공채 시장) → 배치 → 결산. 사장은 사람을 뽑아 앉히기만 하고 직원은 능력치대로 알아서 굴린다. 배치는
 * 작년 그대로가 기본이다 (7.2절).
 */
export function CompanyScreen({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const { place, settle } = useRaisingStore.getState()
  const [seats, setSeats] = useState<Seats>(() =>
    Object.fromEntries(company.employees.map((e) => [e.id, e.desk ?? null])),
  )
  // 이사 장면은 결산 뒤 한 번만 본다. 해가 바뀌면 화면이 새로 그려져 다시 볼 수 있다.
  const [moved, setMoved] = useState(false)
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

        {company.lastSettlement && !moved && (
          <MoveScene
            before={company.lastSettlement.gradeBefore}
            after={company.lastSettlement.gradeAfter}
            year={company.lastSettlement.year}
            onDone={() => setMoved(true)}
          />
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
            {meeting.earlyOmen && (
              <p className="mt-1 text-[14px] text-red-pen" data-testid="early-omen">
                {meeting.earlyOmen}
              </p>
            )}
            {meeting.forecast && (
              <p className="mt-1 text-[14px] text-gold" data-testid="forecast">
                {meeting.forecast}
              </p>
            )}
            <p className="mt-1 text-[14px]">{meeting.wanted}</p>
          </section>
        )}

        {!ended && <MarketPanel company={company} locked={changed} />}

        <section className="mt-4">
          <h3 className="font-pen text-[22px]">
            배치 ({placed} / {company.seats}자리)
          </h3>
          {company.employees.length === 0 && (
            <p className="mt-1 text-[13px] text-muted">아직 직원이 없습니다. 공채에서 뽑으세요.</p>
          )}
          <ul className="mt-2 grid gap-2">
            {company.employees.map((e) => (
              <li key={e.id} className="rounded border border-line p-3" data-testid="employee">
                <p className="font-semibold">
                  {e.name} <span className="font-mono-num text-[13px]">종합 {e.overallGrade}</span>{' '}
                  <span className="text-[12px] text-muted" data-testid="attire">
                    · {ATTIRE_NAMES[attireOf(e.overallGrade)]}
                    {e.effects.length > 0 && ` · ${e.effects.join('·')}`}
                    {e.experienceNeeded != null &&
                      ` · 실전 경험 ${e.experience}/${e.experienceNeeded}`}
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

        {!ended && company.invest && <InvestPanel invest={company.invest} locked={changed} />}

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
            <button
              type="button"
              disabled={busy || changed || Boolean(company.invest?.ready)}
              onClick={() => void settle()}
              className="min-h-12 rounded bg-wine font-semibold text-white disabled:opacity-50"
            >
              {company.invest?.ready ? '투자 회의를 먼저 합니다' : `${company.year}년 차 결산 보기`}
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
      {s.results.length > 0 && (
        <ol
          className="mt-2 rounded bg-ink p-3 font-mono-num text-[13px] text-white"
          aria-label="결산 전광판"
          data-testid="board"
        >
          {s.results.map((r, i) => {
            const bubble = bubbleOf(r.flips)
            return (
              <li
                key={r.employeeId}
                className="animate-reveal flex flex-wrap items-baseline justify-between gap-x-2 py-0.5"
                // 직원별 수익이 차례로 오른다 (8.3절).
                style={{ animationDelay: `${i * 400}ms`, animationFillMode: 'both' }}
              >
                <span>
                  {r.name} · {desk(r.desk)}
                </span>
                <b className={r.pnl >= 0 ? 'text-[#ff8a7a]' : 'text-[#8cc3ec]'}>
                  {signedWon(r.pnl)}
                </b>
                {bubble && (
                  <span
                    className="w-full rounded bg-white px-2 text-[12px] text-ink"
                    data-testid="bubble"
                  >
                    💬 {bubble}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      )}
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

/**
 * 연초 공채 (decisions.md 228번). 오토배틀러의 상점처럼 해마다 지원자가 오고, 계약금을 내고 뽑는다. 자리가 꽉 찼으면 내보낼 직원을 고른다. 마음에 안 들면
 * 값을 내고 새로 받는다. 배치를 바꾸는 중에는(locked) 뽑지 않는다: 직원이 바뀌면 배치 칸을 새로 그리기 때문이다.
 */
function MarketPanel({ company, locked }: { company: Company; locked: boolean }) {
  const busy = useRaisingStore((s) => s.busy)
  const { hire, refreshApplicants } = useRaisingStore.getState()
  const [picking, setPicking] = useState<number | null>(null)
  const full = company.employees.length >= company.seats
  const meeting = company.meeting
  return (
    <section className="mt-5 border-t border-line-soft pt-4" data-testid="market">
      <h3 className="font-pen text-[22px]">연초 공채</h3>
      <p className="text-[12px] text-muted">
        계약금을 내고 뽑습니다. 뽑은 사람은 쉬는 채로 들어오니 자리에 앉히세요.
        {meeting?.hrCap && ` 인사팀 덕에 ${meeting.hrCap} 언저리까지 옵니다.`}
      </p>
      {locked && (
        <p className="mt-1 text-[12px] text-wine">바꾼 배치를 먼저 앉히면 뽑을 수 있습니다.</p>
      )}
      {company.applicants.length === 0 && (
        <p className="mt-2 text-[13px] text-muted">올해 지원자를 다 만났습니다.</p>
      )}
      <ul className="mt-2 grid gap-2 md:grid-cols-3">
        {company.applicants.map((a) => (
          <ApplicantCard
            key={a.id}
            applicant={a}
            affordable={company.capital >= a.fee}
            disabled={busy || locked}
            picking={picking === a.id}
            full={full}
            employees={company.employees}
            onHire={(replace) => {
              setPicking(null)
              void hire(a.id, replace)
            }}
            onPick={() => setPicking(picking === a.id ? null : a.id)}
          />
        ))}
      </ul>
      <button
        type="button"
        disabled={busy || locked || company.capital < company.refreshCost}
        onClick={() => {
          setPicking(null)
          void refreshApplicants()
        }}
        className="mt-2 min-h-11 w-full rounded border border-line text-[14px] disabled:opacity-50"
      >
        지원자 새로 받기 ({shortWon(company.refreshCost)})
      </button>
    </section>
  )
}

function ApplicantCard({
  applicant: a,
  affordable,
  disabled,
  picking,
  full,
  employees,
  onHire,
  onPick,
}: {
  applicant: Applicant
  affordable: boolean
  disabled: boolean
  picking: boolean
  full: boolean
  employees: Company['employees']
  onHire: (replace?: number) => void
  onPick: () => void
}) {
  const button =
    'min-h-11 w-full rounded font-semibold disabled:opacity-50 border border-pen hover:bg-pen hover:text-white'
  return (
    <li className="rounded border border-line p-3" data-testid="applicant">
      <p className="flex items-baseline justify-between">
        <span className="font-semibold">{a.name}</span>
        <span className="font-mono-num text-[13px]">
          종합 <b className="text-[17px]">{a.overallGrade}</b>
        </span>
      </p>
      {a.line && <p className="mt-1 text-[13px] text-teal">{a.line}</p>}
      <ul className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px]">
        {STAT_ORDER.map((code) => (
          <li key={code} className="rounded border border-line-soft py-0.5">
            {STAT_NAMES[code]}
            <b className="block font-mono-num text-[14px]">{a.grades[code]}</b>
          </li>
        ))}
      </ul>
      <div className="mt-2 grid gap-1">
        {!full ? (
          <button
            type="button"
            disabled={disabled || !affordable}
            onClick={() => onHire()}
            className={button}
          >
            뽑는다 · 계약금 {shortWon(a.fee)}
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled || !affordable}
            onClick={onPick}
            className={button}
            aria-expanded={picking}
          >
            {picking ? '그만둔다' : `자리가 꽉 찼다 · 계약금 ${shortWon(a.fee)}`}
          </button>
        )}
        {full &&
          picking &&
          employees.map((e) => (
            <button
              key={e.id}
              type="button"
              disabled={disabled}
              onClick={() => onHire(e.id)}
              className="min-h-10 w-full rounded border border-wine text-[13px] text-wine disabled:opacity-50"
            >
              {e.name}(종합 {e.overallGrade}) 내보내고 뽑는다
            </button>
          ))}
        {!affordable && <p className="text-[12px] text-muted">계약금이 모자랍니다.</p>}
      </div>
    </li>
  )
}
