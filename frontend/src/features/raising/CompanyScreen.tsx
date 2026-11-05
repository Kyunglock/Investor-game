import { useEffect, useState } from 'react'
import type { Applicant, Company } from '../../api/client'
import { Document } from '../game/Document'
import { shortWon, signedWon } from '../game/labels'
import { usePixelArt } from '../game/pixelArt'
import { bubbleOf, pnlLabel } from './board'
import { GradeLadder } from './GradeLadder'
import { LADDER, STAT_NAMES, STAT_ORDER } from './grades'
import { InvestWindow } from './InvestWindow'
import { MoveScene } from './MoveScene'
import { OfficeArt } from './OfficeArt'
import { ATTIRE_NAMES, attireOf, glowOf } from './office'
import { autoPlace } from './placement'
import { useRaisingStore } from './store'

type Employee = Company['employees'][number]
type Desk = Company['desks'][number]

/** 직원이 그 자리에 맞는 정도: 자리가 원하는 능력치의 등급으로 (4.2절). A 이상 잘 맞음, C·B 보통, 그 아래 안 맞음. */
export function fitOf(employee: Employee, desk: Desk): 'good' | 'fair' | 'poor' {
  const at = LADDER.indexOf(employee.grades[desk.statCode] as (typeof LADDER)[number])
  return at >= LADDER.indexOf('A') ? 'good' : at >= LADDER.indexOf('C') ? 'fair' : 'poor'
}

const FIT_TONE = {
  good: 'border-teal text-teal',
  fair: 'border-gold text-gold',
  poor: 'border-wine/60 text-wine',
} as const

/**
 * 회사 화면 (증권사 육성 설계 4·6절). 한 해 = 연초 회의(공채 시장) → 배치 → (결산을 누르면 뜨는) 투자 회의 → 결산. 사장은 사람을 뽑아 앉히기만 하고 직원은 능력치대로 알아서
 * 굴린다. 연초 회의·공채·배치·지난 결산은 탭으로 나뉘고(231번), 결산 버튼은 화면 아래에 늘 붙어 있다. 배치는 작년 그대로가 기본이고(7.2절), 자리를 누르면 바로
 * 앉는다.
 */
export function CompanyScreen({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const justSettled = useRaisingStore((s) => s.justSettled)
  const { settle } = useRaisingStore.getState()
  // 이사 장면은 결산 뒤 한 번만 본다. 해가 바뀌면 화면이 새로 그려져 다시 볼 수 있다.
  const [moved, setMoved] = useState(false)
  // 투자 회의 창 (231번): 결산을 누르면 뜨고, 고른 뒤 그대로 결산한다.
  const [investOpen, setInvestOpen] = useState(false)
  const ended = company.status === 'ENDED'
  const meeting = company.meeting

  useEffect(() => {
    if (justSettled) {
      // 결산하면 지난 결산 탭이 열린다(스토어). 탭 머리로 올려 결과부터 보이게 한다.
      document.querySelector('[data-testid="tabs"]')?.scrollIntoView({ block: 'start' })
      useRaisingStore.setState({ justSettled: false })
    }
  }, [justSettled])

  return (
    <Document
      title={
        // 회사는 끝나지 않고 해마다 이어진다 (236번: 매각을 뺐다).
        ended
          ? `${company.number}호 회사 · 끝난 회사`
          : `${company.number}호 회사 · ${company.year}년 차`
      }
    >
      <div data-testid="company">
        <p className="text-[13px]" data-testid="era">
          <b>{company.era.name}</b> — {company.era.description}
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

        <CompanyTabs company={company} />

        {!ended && company.invest && investOpen && (
          <InvestWindow
            invest={company.invest}
            year={company.year}
            employees={company.employees}
            onClose={() => setInvestOpen(false)}
            onSettle={() => void settle()}
          />
        )}

        {!ended && meeting && (
          // 결산은 한 해의 마지막 일이라 화면 아래에 늘 붙어 있다.
          <div className="sticky bottom-0 z-10 -mx-1 mt-4 grid gap-1 bg-card/95 px-1 pt-2 pb-3 backdrop-blur">
            {error && (
              <p role="alert" className="text-[13px] text-wine">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              // 돈을 굴리는 직원이 있으면 먼저 투자 회의 창이 뜨고, 고르면 그대로 결산한다.
              onClick={() => (company.invest?.ready ? setInvestOpen(true) : void settle())}
              className="min-h-12 rounded bg-wine font-semibold text-white disabled:opacity-50"
            >
              {company.year}년 차 결산 보기
            </button>
          </div>
        )}
        {ended && error && (
          <p role="alert" className="mt-3 text-[13px] text-wine">
            {error}
          </p>
        )}
      </div>
    </Document>
  )
}

/** 연초 회의 탭: 올해 폭락 조짐, 경보·선견, 올해 필요한 인재 (6.1절). */
function MeetingTab({ meeting }: { meeting: NonNullable<Company['meeting']> }) {
  return (
    <section data-testid="meeting">
      <h3 className="font-pen text-[22px]">연초 회의</h3>
      {meeting.omen && (
        <p className="mt-1 text-[14px] font-bold text-red-pen" data-testid="company-omen">
          <span className="mr-1 rounded bg-red-pen px-1 text-[11px] text-white">폭락 조짐</span>
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
      {meeting.hot && (
        <p className="mt-1 text-[14px] font-semibold text-gold" data-testid="hot-sector">
          ★ {meeting.hot}
        </p>
      )}
      <p className="mt-1 text-[14px]">{meeting.wanted}</p>
    </section>
  )
}

/** 배치 탭: 자리 버튼을 누르면 바로 앉는다. 버튼에는 자리가 원하는 능력치의 등급과 맞는 정도가 보인다 (230번). */
function StaffTab({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const { place } = useRaisingStore.getState()
  const placed = company.employees.filter((e) => e.desk).length
  const ended = company.status === 'ENDED'
  const seat = (employeeId: number, desk: string | null) =>
    place(
      company.employees.map((e) => ({
        employeeId: e.id,
        desk: e.id === employeeId ? desk : (e.desk ?? null),
      })),
    )
  return (
    <section data-testid="staff">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-pen text-[22px]">
          배치 ({placed} / {company.seats}자리)
        </h3>
        {!ended && company.employees.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void place(autoPlace(company))}
            className="min-h-10 rounded border border-teal px-3 text-[13px] font-semibold text-teal hover:bg-teal hover:text-white disabled:opacity-50"
            title="돈을 굴리는 자리(섹터 데스크·단타)부터 맞는 사람을 앉히고, 남는 자리에 리서치·리스크 관리·인사팀을 채운다"
          >
            자동 배치
          </button>
        )}
      </div>
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
                {e.experienceNeeded != null && ` · 실전 경험 ${e.experience}/${e.experienceNeeded}`}
                {glowOf(e.overallGrade) &&
                  ` · ${glowOf(e.overallGrade) === 'gold' ? '금빛' : '파란빛'}`}
                {e.sectorName && ` · 관심 섹터 ${e.sectorName}`}
              </span>
            </p>
            <ul className="mt-1 grid grid-cols-5 gap-1 text-center text-[11px]">
              {STAT_ORDER.map((code) => (
                <li key={code} className="rounded border border-line-soft py-0.5">
                  {STAT_NAMES[code]}
                  <b className="block font-mono-num text-[13px]">{e.grades[code]}</b>
                </li>
              ))}
            </ul>
            {!ended && (
              <fieldset className="mt-2">
                <legend className="sr-only">{e.name}의 자리</legend>
                <div className="flex flex-wrap gap-1">
                  {company.desks.map((d) => {
                    const on = e.desk === d.code
                    const fit = fitOf(e, d)
                    // 쉬던 사람은 자리가 남아 있어야 앉는다.
                    const full = !e.desk && placed >= company.seats
                    return (
                      <button
                        key={d.code}
                        type="button"
                        aria-pressed={on}
                        disabled={busy || (!on && full)}
                        onClick={() => void seat(e.id, on ? null : d.code)}
                        className={`min-h-10 rounded border px-2 text-[13px] disabled:opacity-40 ${
                          on ? 'border-pen bg-pen text-white' : FIT_TONE[fit]
                        }`}
                        data-fit={fit}
                        title={d.description}
                      >
                        {d.hot && '★ '}
                        {d.name}{' '}
                        <span className="font-mono-num text-[11px]">
                          {STAT_NAMES[d.statCode]} {e.grades[d.statCode]}
                          {e.sector && d.sector === e.sector && ' · 관심'}
                        </span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    aria-pressed={!e.desk}
                    disabled={busy || !e.desk}
                    onClick={() => void seat(e.id, null)}
                    className={`min-h-10 rounded border px-2 text-[13px] ${
                      !e.desk ? 'border-pen bg-pen text-white' : 'border-line text-muted'
                    }`}
                  >
                    쉰다
                  </button>
                </div>
              </fieldset>
            )}
          </li>
        ))}
      </ul>
      {!ended && (
        <details className="mt-2 text-[12px] text-muted">
          <summary className="cursor-pointer">
            자리 설명 · 글씨 색: <span className="text-teal">잘 맞음</span> ·{' '}
            <span className="text-gold">보통</span> · <span className="text-wine">안 맞음</span> · ★
            이번 시대에 뜨는 자리 · 관심: 관심 섹터의 데스크
          </summary>
          <ul className="mt-1">
            {company.desks.map((d) => (
              <li key={d.code}>
                {d.hot && '★ '}
                {d.name}: {d.description}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

type Tab = 'meeting' | 'market' | 'staff' | 'settlement'

/**
 * 연초 회의 · 공채 · 배치 · 지난 결산을 탭으로 나눈다. 한 장에 길게 늘어놓으면 위아래로 오가야 했다. 고른 탭은 스토어에 둔다: 직원이 들고 나면 회사 화면을
 * 새로 그리기 때문이다. 아무것도 안 골랐으면 직원이 없을 때 공채, 그 밖에는 연초 회의. 결산하면 지난 결산으로 간다.
 */
function CompanyTabs({ company }: { company: Company }) {
  const stored = useRaisingStore((s) => s.tab) as Tab | null
  const ended = company.status === 'ENDED'
  const placed = company.employees.filter((e) => e.desk).length
  const tabs: { id: Tab; label: string; badge?: string; show: boolean }[] = [
    {
      id: 'meeting',
      label: '연초 회의',
      badge: company.meeting?.omen ? '!' : undefined,
      show: Boolean(company.meeting),
    },
    {
      id: 'market',
      label: '공채',
      badge: company.applicants.length > 0 ? `${company.applicants.length}명` : undefined,
      show: !ended,
    },
    { id: 'staff', label: '배치', badge: `${placed}/${company.seats}`, show: true },
    { id: 'settlement', label: '지난 결산', show: Boolean(company.lastSettlement) },
  ]
  const shown = tabs.filter((t) => t.show)
  const fallback: Tab = ended
    ? company.lastSettlement
      ? 'settlement'
      : 'staff'
    : company.employees.length === 0
      ? 'market'
      : 'meeting'
  const tab = shown.some((t) => t.id === stored) && stored ? stored : fallback
  // 처음 정한 탭을 붙잡아 둔다: 공채에서 사람을 뽑아 직원이 생겨도 공채 탭에 그대로 있게.
  useEffect(() => {
    if (stored !== tab) {
      useRaisingStore.setState({ tab })
    }
  }, [stored, tab])
  return (
    <div className="mt-4" data-testid="tabs">
      <div
        role="tablist"
        aria-label="회사 일"
        className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto border-b border-line bg-card/95 px-1 pt-1 backdrop-blur"
      >
        {shown.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => useRaisingStore.setState({ tab: t.id })}
            className={`min-h-11 shrink-0 rounded-t px-3 text-[14px] ${
              tab === t.id ? 'border-b-2 border-wine font-bold text-wine' : 'text-muted'
            }`}
          >
            {t.label}
            {t.badge && (
              <span
                className={`ml-1 rounded px-1 font-mono-num text-[11px] ${
                  t.badge === '!' ? 'bg-red-pen text-white' : 'bg-line-soft text-ink'
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-3">
        {tab === 'meeting' && company.meeting && <MeetingTab meeting={company.meeting} />}
        {tab === 'market' && <MarketPanel company={company} />}
        {tab === 'staff' && <StaffTab company={company} />}
        {tab === 'settlement' && <SettlementView company={company} />}
      </div>
    </div>
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
    <section data-testid="settlement">
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
            const bubble = bubbleOf(r.flips, r.pnl)
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
                  {pnlLabel(r.pnl)}
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
 * 연초 공채 (decisions.md 228번). 오토배틀러의 상점처럼 해마다 지원자가 오고, 계약금을 내고 뽑는다. 자리가 꽉 찼으면 내보낼 직원을 고른다. 마음에 안 들면
 * 값을 내고 새로 받는다.
 */
function MarketPanel({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const { hire, refreshApplicants } = useRaisingStore.getState()
  const [picking, setPicking] = useState<number | null>(null)
  const full = company.employees.length >= company.seats
  const meeting = company.meeting
  return (
    <section data-testid="market">
      <h3 className="sr-only">연초 공채</h3>
      <p className="text-[12px] text-muted">
        계약금을 내고 뽑습니다. 뽑은 사람은 쉬는 채로 들어오니 자리에 앉히세요.
        {meeting?.hrCap && ` 인사팀 덕에 ${meeting.hrCap} 언저리까지 옵니다.`}
      </p>
      {company.applicants.length === 0 && (
        <p className="mt-2 text-[13px] text-muted">올해 지원자를 다 만났습니다.</p>
      )}
      <ul className="mt-2 grid gap-2 md:grid-cols-3">
        {company.applicants.map((a) => (
          <ApplicantCard
            key={a.id}
            applicant={a}
            affordable={company.capital >= a.fee}
            disabled={busy}
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
        disabled={busy || company.capital < company.refreshCost}
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
      {a.sectorName && (
        <p className="mt-1 text-[12px] text-muted" data-testid="applicant-sector">
          관심 섹터 {a.sectorName}
        </p>
      )}
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
