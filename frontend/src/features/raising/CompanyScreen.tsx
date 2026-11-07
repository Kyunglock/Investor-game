import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Company } from '../../api/client'
import { Document } from '../game/Document'
import { money, withParticle } from '../game/labels'
import { usePixelArt } from '../game/pixelArt'
import { toggleAutoPlay } from './autoPlay'
import { BuildingArt } from './BuildingArt'
import { pnlLabel } from './board'
import { ConstructionArt } from './ConstructionArt'
import { EndingScreen } from './EndingScreen'
import { GachaPanel, GachaReveal, useDrawReveal } from './Gacha'
import { GradeBadge, GradeCard } from './GradeCard'
import { LADDER, STAT_NAMES, STAT_ORDER } from './grades'
import { IndustryLine } from './IndustryLine'
import { InvestWindow } from './InvestWindow'
import { LockedDesks } from './LockedDesks'
import { MacroWindow } from './MacroWindow'
import { MoveScene } from './MoveScene'
import { OfficeArt, type SeatFocus } from './OfficeArt'
import { ATTIRE_NAMES, attireOf, glowOf, nextStep, officeName, titleOf } from './office'
import { autoPlace, deskEffect, rankDesks, seatOne } from './placement'
import { QuarterSheet } from './QuarterSheet'
import { ResignAlert } from './ResignAlert'
import { useRaisingStore } from './store'
import { TutorialBanner, useTutorialSpot } from './TutorialBanner'
import { Ledger, PHASES, YearEndSheet } from './YearEnd'

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
 * 회사 화면 (증권사 육성 설계 4·6절). 한 해 = 이슈 → 채용 뽑기 → 배치 → (결산을 누르면 뜨는) 거시경제 회의 → (직원이 물어 오면) 종목 회의 → 결산. 사장은 사람을 뽑아 앉히기만 하고 직원은 능력치대로 알아서
 * 굴린다. 이슈·채용·배치·지난 결산은 탭으로 나뉘고(231번), 결산 버튼은 화면 아래에 늘 붙어 있다. 배치는 작년 그대로가 기본이고(7.2절), 자리를 누르면 바로
 * 앉는다.
 */
export function CompanyScreen({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const justSettled = useRaisingStore((s) => s.justSettled)
  const moveAlert = useRaisingStore((s) => s.moveAlert)
  const upgradeMove = useRaisingStore((s) => s.upgradeMove)
  const justQuartered = useRaisingStore((s) => s.justQuartered)
  const autoPlay = useRaisingStore((s) => s.autoPlay)
  const { settle, restart, convene, conveneMacro } = useRaisingStore.getState()
  // 이사 장면은 결산 뒤 한 번만 본다. 해가 바뀌면 화면이 새로 그려져 다시 볼 수 있다.
  // 종목 회의 창 (231번): 직원이 종목을 물어 왔으면 거시경제 회의 다음에 뜨고, 고른 뒤 그대로 결산한다 (267번).
  const [investOpen, setInvestOpen] = useState(false)
  // 거시경제 회의 창 (266번): 결산을 누르면 먼저 뜬다.
  const [macroOpen, setMacroOpen] = useState(false)
  // 건물 그림에서 누른 책상 (237번). 그림 바로 아래에서 자리를 고른다.
  const [focus, setFocus] = useState<SeatFocus | null>(null)
  const ended = company.status === 'ENDED'
  const meeting = company.meeting
  const settleSpot = useTutorialSpot(company, 'settle')
  const drawn = useDrawReveal(company)

  // 거시경제 회의를 마친 뒤: 물어 온 종목이 있으면 종목 회의를 열고(한마디를 굳힌다, 249번) 창을 띄운다. 없으면 바로 결산한다.
  const stockOrSettle = async () => {
    if (!useRaisingStore.getState().company?.invest?.ready) {
      void settle()
      return
    }
    if (await convene()) {
      setInvestOpen(true)
    }
  }

  // 결산하면 연말 결산서가 따로 뜬다(240번). 닫으면 지난 결산 탭(스토어가 열어 둠)의 머리로 올린다.
  const closeYearEnd = () => {
    useRaisingStore.setState({ justSettled: false })
    document.querySelector('[data-testid="tabs"]')?.scrollIntoView({ block: 'start' })
  }

  return (
    <Document
      title={
        // 회사는 끝나지 않고 해마다 이어진다 (236번: 매각을 뺐다).
        ended
          ? `${company.number}호 회사 · 끝난 회사`
          : `${company.number}호 회사 · ${company.year}년 차 ${company.quarter}분기`
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
        {/* 튜토리얼 띠 (302번): 켜져 있으면 지금 걸음과 할 일. */}
        <TutorialBanner company={company} />
        {/* 회사 등급 글자 대신 건물로 보인다 (238번). */}
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <p
            className="font-serif-kr text-[24px] font-black leading-tight"
            data-testid="company-building"
          >
            {officeName(company.grade)}
          </p>
          <p className="shrink-0 font-mono-num text-[15px]" data-testid="company-capital">
            자본 {money(company.capital)}
          </p>
        </div>
        <IndustryLine company={company} className="mb-1 text-muted" />
        <div className="relative">
          <BuildingArt grade={company.grade} />
          {company.upgrade?.left != null && (
            <ConstructionArt
              done={company.upgrade.years - company.upgrade.left}
              years={company.upgrade.years}
            />
          )}
        </div>
        <NextStep company={company} />
        <OfficeArt company={company} focus={focus} onSeat={ended ? undefined : setFocus} />
        {!ended && focus && <SeatPicker company={company} focus={focus} onFocus={setFocus} />}
        <PixelToggle />

        <CompanyTabs company={company} />
        <AutoCountdown />

        {justSettled && <YearEndSheet company={company} onClose={closeYearEnd} />}

        {company.lastSettlement && moveAlert && !justSettled && (
          // 건물이 바뀌면 연말 결산서 뒤에 알림 창으로 뜬다 (281번): 오르면 박치기, 줄면 이삿짐 트럭.
          <MoveScene
            before={company.lastSettlement.gradeBefore}
            after={company.lastSettlement.gradeAfter}
            year={company.lastSettlement.year}
            onDone={() => useRaisingStore.setState({ moveAlert: false })}
          />
        )}

        {upgradeMove && !justSettled && (
          // 이사 비용을 내고 올라갔다 (296번): 바로 박치기 장면이 뜬다.
          <MoveScene
            before={upgradeMove.before}
            after={upgradeMove.after}
            year={upgradeMove.year}
            onDone={() => useRaisingStore.setState({ upgradeMove: null })}
          />
        )}

        {company.resign &&
          !company.ending &&
          !justSettled &&
          !justQuartered &&
          !moveAlert &&
          !upgradeMove && (
            // 연봉 때문에 사표를 들고 왔다 (282번): 다른 창을 다 닫은 뒤 마지막 기회로 뜬다.
            <ResignAlert resign={company.resign} />
          )}

        {company.ending && !justSettled && !moveAlert && !upgradeMove && (
          // 랜드마크 타워 엔딩 (276번): 결산서와 건물 알림 뒤에 뜨고, 다음 회사를 차린다.
          <EndingScreen company={company} />
        )}

        {drawn && !justSettled && (
          // 채용 뽑기 결과 (decisions.md 312번): 카드가 하나씩 뒤집힌다.
          <GachaReveal
            drawn={drawn}
            onClose={() => useRaisingStore.setState({ justDrew: false })}
          />
        )}

        {justQuartered && company.lastQuarter && (
          // 분기 실적 (268번): 1~3분기를 넘기면 짧게 뜬다.
          <QuarterSheet
            quarter={company.lastQuarter}
            onClose={() => useRaisingStore.setState({ justQuartered: false })}
          />
        )}

        {!ended && company.macro && macroOpen && (
          <MacroWindow
            macro={company.macro}
            year={company.year}
            quarter={company.quarter}
            employees={company.employees}
            stockMeeting={Boolean(company.invest?.ready)}
            onClose={() => setMacroOpen(false)}
            onNext={() => {
              setMacroOpen(false)
              void stockOrSettle()
            }}
          />
        )}

        {!ended && company.invest && investOpen && (
          <InvestWindow
            invest={company.invest}
            year={company.year}
            quarter={company.quarter}
            employees={company.employees}
            onClose={() => setInvestOpen(false)}
            onSettle={() => void settle()}
          />
        )}

        {!ended && company.broke && (
          // 망한 회사 (247번): 결산 대신 사재로 다음 회사를 차린다.
          <section
            className="sticky bottom-0 z-10 -mx-1 mt-4 grid gap-2 border-t-2 border-wine bg-card/95 px-1 pt-3 pb-3 backdrop-blur"
            data-testid="broke"
          >
            <p className="text-[14px] font-semibold text-wine">{company.broke}</p>
            {error && (
              <p role="alert" className="text-[13px] text-wine">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void restart()}
              className="min-h-12 rounded bg-wine font-semibold text-white disabled:opacity-50"
            >
              문을 닫고 사재로 {company.number + 1}호 회사 차리기
            </button>
          </section>
        )}

        {!ended && !company.broke && !company.ending && meeting && (
          // 결산은 한 해의 마지막 일이라 화면 아래에 늘 붙어 있다.
          <div className="sticky bottom-0 z-10 -mx-1 mt-4 grid gap-1 bg-card/95 px-1 pt-2 pb-3 backdrop-blur">
            {error && (
              <p role="alert" className="text-[13px] text-wine">
                {error}
              </p>
            )}
            {autoPlay && (
              <p className="text-center text-[12px] text-teal" data-testid="auto-status">
                자동 진행 중 · 뽑기 → 배치 → 거시경제 회의·종목 회의(직원 다수결) → 분기 넘기기를
                되풀이합니다
              </p>
            )}
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button
                type="button"
                aria-pressed={autoPlay}
                onClick={() => toggleAutoPlay(!autoPlay)}
                className={`min-h-12 rounded border px-3 text-[14px] font-semibold ${
                  autoPlay ? 'border-teal bg-teal text-white' : 'border-teal text-teal'
                }`}
                title="빈 자리에 뽑고, 자동 배치하고, 회의는 직원 다수결로 정하고, 결산을 해마다 되풀이한다"
              >
                {autoPlay ? '■ 자동 멈춤' : '⟳ 자동 진행'}
              </button>
              <button
                type="button"
                disabled={busy || autoPlay}
                // 돈을 굴리는 직원이 있으면 먼저 거시경제 회의를 열고(한마디를 굳힌다, 266번) 창을 띄운다. 이미 골랐으면 종목 회의나 결산으로.
                onClick={async () => {
                  if (!company.macro?.ready) {
                    await stockOrSettle()
                    return
                  }
                  if (await conveneMacro()) {
                    setMacroOpen(true)
                  }
                }}
                className={`min-h-12 rounded bg-wine font-semibold text-white disabled:opacity-50 ${settleSpot}`}
              >
                {company.year}년 차 {company.quarter}분기 넘기기
              </button>
            </div>
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

/**
 * 다음 단계 (238·296번): 다음 건물로 이사하거나 같은 건물에서 책상을 늘리는 데 드는 이사 비용과 필요한 자본. 건물은 저절로 오르지 않는다: 자본이 다음 띠 +
 * 이사 비용 이상이면 버튼이 켜지고, 누르면 비용을 내고 올라간다.
 */
function NextStep({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const { upgrade } = useRaisingStore.getState()
  const step = nextStep(company.grade)
  const plan = company.upgrade
  const spot = useTutorialSpot(company, 'upgrade')
  if (!step || !plan || company.status === 'ENDED') {
    return null
  }
  const label = step.kind === 'move' ? `다음 건물 ${step.to}` : '사무실 넓히기(책상 추가)'
  const short = (company.capital - plan.needed) * -1
  // 공사 중 (#347): 새 건물은 몇 해에 걸쳐 짓는다. 그동안 지금 건물에서 일한다.
  if (plan.left != null) {
    const done = plan.years - plan.left
    return (
      <div
        className="mt-1 rounded border border-gold bg-gold/10 px-2 py-1.5"
        data-testid="construction"
      >
        <p className="text-[12px] text-muted">
          <b className="text-gold">공사 중 · {step.kind === 'move' ? step.to : label}</b> ·{' '}
          {plan.years}년 중 {done + 1}년째 · 연말 결산마다 한 해씩 짓는다
        </p>
        <div className="mt-1 h-2 overflow-hidden rounded bg-line-soft">
          <div
            className="h-full bg-gold transition-[width] duration-700"
            style={{ width: `${Math.round(((done + 0.5) / plan.years) * 100)}%` }}
          />
        </div>
      </div>
    )
  }
  return (
    <div
      className={`mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded border px-2 py-1.5 ${
        plan.affordable ? 'border-gold bg-gold/10' : 'border-line-soft'
      } ${spot}`}
      data-testid="next-step"
      data-affordable={plan.affordable}
    >
      <p className="text-[12px] text-muted">
        <b className={plan.affordable ? 'text-gold' : 'text-ink'}>{label}</b> · 이사 비용{' '}
        {money(plan.cost)} · 자본 {money(plan.needed)}부터
        {!plan.affordable && ` (${money(short)} 더)`} · 지금 책상 {company.seats}개
        {plan.years > 0 && ` · 공사 ${plan.years}년`}
      </p>
      <button
        type="button"
        disabled={busy || !plan.affordable}
        onClick={() => void upgrade()}
        className={`min-h-9 rounded px-3 text-[13px] font-semibold disabled:opacity-40 ${
          plan.affordable ? 'animate-glow bg-gold text-white' : 'border border-line text-muted'
        }`}
        data-testid="upgrade"
      >
        {plan.years > 0 ? '공사 시작' : step.kind === 'move' ? '이사하기' : '넓히기'} ·{' '}
        {money(plan.cost)}
      </button>
    </div>
  )
}

/** 이슈 탭: 올해 폭락 조짐, 경보·선견, 올해 필요한 인재 (6.1절). */
function MeetingTab({ meeting }: { meeting: NonNullable<Company['meeting']> }) {
  const busy = useRaisingStore((s) => s.busy)
  const { answerPoach, answerRaise } = useRaisingStore.getState()
  const poach = meeting.poach
  const raise = meeting.raise
  return (
    <section data-testid="meeting">
      <h3 className="font-pen text-[22px]">이슈</h3>
      {poach && (
        // 이직 제안 (262번): 답하지 않고 결산하면 이적료를 남기고 떠난다.
        <div className="mt-1 rounded border border-wine p-2" data-testid="poach">
          <p className="text-[14px] font-semibold text-wine">{poach.line}</p>
          <p className="text-[12px] text-muted">
            답하지 않아도 회사에 남습니다. 보낼 때만 떠납니다.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void answerPoach(true)}
              className="min-h-11 rounded border border-pen text-[14px] font-semibold disabled:opacity-50"
            >
              남긴다
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void answerPoach(false)}
              className="min-h-11 rounded border border-line text-[14px]"
            >
              보낸다 · 이적료 +{money(poach.transferFee)}
            </button>
          </div>
        </div>
      )}
      {raise && (
        // 연봉 협상 (270·280번): 올려 주면 사기가 오르고 능력치가 오를 수 있다. 동결하거나 답하지 않고 버티면 떠날 수 있다.
        <div className="mt-1 rounded border border-gold p-2" data-testid="raise">
          <p className="text-[14px] font-semibold">{raise.line}</p>
          <p className="text-[12px] text-muted" data-testid="raise-odds">
            {raise.odds}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void answerRaise(true)}
              className="min-h-11 rounded border border-pen text-[14px] font-semibold disabled:opacity-50"
            >
              올려 준다 · 연 {money(raise.after)}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void answerRaise(false)}
              className="min-h-11 rounded border border-line text-[14px]"
            >
              동결한다
            </button>
          </div>
        </div>
      )}
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
      {meeting.eraEnding && (
        // 시대가 바뀌기 한 해 전 (250번): 다음 시대에 맞을 사람을 미리 생각하게 한다.
        <p className="mt-1 text-[14px] font-semibold text-teal" data-testid="era-ending">
          {meeting.eraEnding}
        </p>
      )}
      <p className="mt-1 text-[14px]">{meeting.wanted}</p>
    </section>
  )
}

/**
 * 배치 탭 (decisions.md 269번): 직무 자리를 먼저 누르고 그 자리에 앉힐 직원을 고른다. 사람마다 자리 버튼이 늘어선 화면이 헷갈려서 바꿨다. 자리 카드에는 원하는
 * 능력치·예상 효과·앉은 사람과 팀장이 보이고, 누르면 그 자리에 맞는 순서로 직원이 늘어선다(잘 맞음·보통·안 맞음 색). 앉은 사람은 빼거나 팀장으로 정할 수
 * 있다. 직원의 상세 능력치는 아래에 접어 둔다.
 */
function StaffTab({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const { place } = useRaisingStore.getState()
  const [open, setOpen] = useState<string | null>(null)
  const placed = company.employees.filter((e) => e.desk).length
  const ended = company.status === 'ENDED'
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
            title="돈을 굴리는 자리(섹터 데스크·단타)부터 맞는 사람을 앉히고, 남는 자리에 종목 발굴·리서치·리스크 관리·인사팀을 채운다"
          >
            자동 배치
          </button>
        )}
      </div>
      {company.employees.length === 0 ? (
        <p className="mt-1 text-[13px] text-muted">아직 직원이 없습니다. 채용 탭에서 뽑으세요.</p>
      ) : (
        !ended && (
          <p className="mt-1 text-[13px] text-muted">
            직무 자리를 누르고, 그 자리에 앉힐 직원을 고르세요. 자리마다 팀장이 보고합니다.
          </p>
        )
      )}
      {!ended && company.employees.length > 0 && (
        <ul className="mt-2 grid gap-2" data-testid="desk-board">
          {company.desks.map((d) => (
            <DeskCard
              key={d.code}
              company={company}
              desk={d}
              open={open === d.code}
              onToggle={() => setOpen(open === d.code ? null : d.code)}
            />
          ))}
        </ul>
      )}
      {!ended && <LockedDesks company={company} className="text-muted" />}
      {company.employees.length > 0 && (
        <details className="mt-3" open={ended}>
          <summary className="cursor-pointer text-[13px] text-muted">
            직원 상세 능력치 ({company.employees.length}명)
          </summary>
          <ul className="mt-2 grid gap-2">
            {company.employees.map((e) => (
              <GradeCard
                as="li"
                key={e.id}
                grade={e.overallGrade}
                badgeLabel="종합"
                className="p-3 pl-[72px]"
                data-testid="employee"
              >
                <EmployeeDetail employee={e} />
                <p className="mt-1 text-[12px] text-muted">
                  {e.desk
                    ? `${company.desks.find((d) => d.code === e.desk)?.name ?? e.desk}${e.leader ? ' 팀장' : ''}`
                    : '쉬는 중'}
                </p>
              </GradeCard>
            ))}
          </ul>
        </details>
      )}
      {!ended && (
        <details className="mt-2 text-[12px] text-muted">
          <summary className="cursor-pointer">
            글씨 색: <span className="text-teal">잘 맞음</span> ·{' '}
            <span className="text-gold">보통</span> · <span className="text-wine">안 맞음</span> · ★
            이번 시대에 뜨는 자리 · 관심: 그 직원의 관심 섹터
          </summary>
          <ul className="mt-1">
            {company.desks.map((d) => (
              <li key={d.code}>
                {d.hot && '★ '}
                {d.name}: {d.description} {d.trades && `(${deskEffect(d)})`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

/**
 * 직무 자리 카드 하나 (269번). 접혀 있으면 자리 이름·원하는 능력치·예상 효과·앉은 사람(팀장 먼저)을, 펼치면 앉은 사람(빼기·팀장으로)과 앉힐 후보를 보인다.
 * 후보는 그 자리가 원하는 능력치가 높은 순이고, 다른 자리에 앉은 사람은 옮겨 앉는다. 쉬던 사람은 자리가 남아 있어야 앉는다.
 */
function DeskCard({
  company,
  desk: d,
  open,
  onToggle,
}: {
  company: Company
  desk: Desk
  open: boolean
  onToggle: () => void
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
    <li
      className={`rounded border ${open ? 'border-pen' : 'border-line'}`}
      data-testid="desk-row"
      data-desk={d.code}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-2 p-2 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold">
            {d.hot && '★ '}
            {d.name}{' '}
            <span className="text-[12px] font-normal text-muted">
              {STAT_NAMES[d.statCode]} · {deskEffect(d)}
            </span>
          </span>
          <span className="block text-[13px]" data-testid="desk-members">
            {seated.length === 0
              ? '비어 있음'
              : seated.map((e, i) => (
                  <span key={e.id} className="whitespace-nowrap">
                    {i > 0 && ' · '}
                    <GradeBadge grade={e.overallGrade} size="inline" />
                    {e.name}
                    {e.leader ? '(팀장)' : ''}
                  </span>
                ))}
          </span>
        </span>
        <span className="shrink-0 text-[13px] text-teal">{open ? '접기' : '사람 고르기'}</span>
      </button>
      {open && (
        <div className="border-t border-line-soft p-2" data-testid="desk-picker">
          {seated.length > 0 && (
            <ul className="grid gap-1">
              {seated.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-1 text-[13px]">
                  <GradeBadge grade={e.overallGrade} size="inline" />
                  <b>{e.name}</b>
                  <span className="font-mono-num text-[12px]">
                    {STAT_NAMES[d.statCode]} {e.grades[d.statCode]} · 종합 {e.overallGrade}
                  </span>
                  {e.leader ? (
                    <span
                      className="rounded bg-gold px-1.5 text-[11px] text-white"
                      data-testid="leader-badge"
                    >
                      팀장
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void appointLeader(d.code, e.id)}
                      className="min-h-8 rounded border border-gold px-2 text-[12px] text-gold disabled:opacity-50"
                    >
                      팀장으로
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void place(seatOne(company, e.id, null))}
                    className="ml-auto min-h-8 rounded border border-line px-2 text-[12px] text-muted"
                  >
                    빼기
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12px] text-muted">
            {d.name}에 앉힐 사람 · {withParticle(STAT_NAMES[d.statCode], '이', '가')} 높은 순
            {full &&
              ' · 자리가 꽉 차서 쉬는 사람은 앉힐 수 없습니다(다른 자리에서 옮기는 것은 됩니다)'}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {others.map((e) => {
              const fit = fitOf(e, d)
              const blocked = !e.desk && full
              return (
                <button
                  key={e.id}
                  type="button"
                  disabled={busy || blocked}
                  onClick={() => void place(seatOne(company, e.id, d.code))}
                  className={`min-h-10 rounded border px-2 text-left text-[13px] disabled:opacity-40 ${FIT_TONE[fit]}`}
                  data-fit={fit}
                  data-testid="desk-candidate"
                >
                  <GradeBadge grade={e.overallGrade} size="inline" />
                  {e.name}{' '}
                  <span className="font-mono-num text-[11px]">
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
        </div>
      )}
    </li>
  )
}

/** 사기 (decisions.md 270번). 0(보통)은 적지 않는다. */
const MORALE: Record<number, string> = {
  [-2]: '사기 바닥',
  [-1]: '사기 낮음',
  1: '사기 높음',
  2: '의욕 넘침',
}

/** 직원 한 명의 상세 능력치: 종합 등급·차림새·효과·실전 경험·관심 섹터와 능력치 다섯의 등급. 배치 탭과 미니맵을 누르면 열리는 칸(237번)이 같이 쓴다. */
function EmployeeDetail({ employee: e }: { employee: Employee }) {
  return (
    <div className="min-w-0 flex-1" data-testid="employee-detail">
      <p className="font-semibold">
        {e.name} <span data-testid="title">{titleOf(e.overallGrade)}</span>{' '}
        <span className="font-mono-num text-[13px]">종합 {e.overallGrade}</span>{' '}
        <span className="text-[12px] text-muted" data-testid="attire">
          · {ATTIRE_NAMES[attireOf(e.overallGrade)]}
          {e.effects.length > 0 && ` · ${e.effects.join('·')}`}
          {e.experienceNeeded != null && ` · 실전 경험 ${e.experience}/${e.experienceNeeded}`}
          {glowOf(e.overallGrade) && ` · ${glowOf(e.overallGrade) === 'gold' ? '금빛' : '파란빛'}`}
          {e.sectorName && ` · 관심 섹터 ${e.sectorName}`}
          {e.deskYears > 0 && ` · 같은 자리 ${e.deskYears}년`}
          {e.settled && ' · 손에 익음'}
          {e.salary > 0 && ` · 연봉 ${money(e.salary)}`}
          {e.morale !== 0 && ` · ${MORALE[e.morale]}`}
        </span>
      </p>
      {/* 등급 효과 (289번): 등급마다 더 버는 몫과 자랄 확률. */}
      <p className="mt-0.5 text-[12px] text-teal" data-testid="perk">
        등급 효과 · {e.perk}
      </p>
      <ul className="mt-1 grid grid-cols-5 gap-1 text-center text-[11px]">
        {STAT_ORDER.map((code) => (
          <li key={code} className="rounded border border-line-soft py-0.5">
            {STAT_NAMES[code]}
            <b className="block font-mono-num text-[13px]">{e.grades[code]}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * 한 사람의 자리 버튼 (230번): 누르면 바로 앉는다. 버튼에는 자리가 원하는 능력치의 등급과 맞는 정도가 색으로 보인다. 배치 탭과 건물 그림의 자리 고르기(237번)가
 * 같이 쓴다. 앉히면 onSeated를 부른다.
 */
function DeskButtons({
  company,
  employee: e,
  onSeated,
  limit,
}: {
  company: Company
  employee: Employee
  onSeated?: () => void
  /** 있으면 맞는 자리부터 이만큼만 먼저 보이고(지금 자리는 늘 보인다) 나머지는 펼친다 (259번). */
  limit?: number
}) {
  const busy = useRaisingStore((s) => s.busy)
  const { place } = useRaisingStore.getState()
  const [all, setAll] = useState(false)
  const ranked = limit ? rankDesks(company, e) : company.desks
  const shown =
    limit && !all ? ranked.filter((d, i) => i < limit || d.code === e.desk) : company.desks
  const placed = company.employees.filter((x) => x.desk).length
  // 쉬던 사람은 자리가 남아 있어야 앉는다.
  const full = !e.desk && placed >= company.seats
  const seat = async (desk: string | null) => {
    await place(seatOne(company, e.id, desk))
    onSeated?.()
  }
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((d) => {
        const on = e.desk === d.code
        const fit = fitOf(e, d)
        return (
          <button
            key={d.code}
            type="button"
            aria-pressed={on}
            disabled={busy || (!on && full)}
            onClick={() => void seat(on ? null : d.code)}
            className={`min-h-10 rounded border px-2 text-[13px] disabled:opacity-40 ${
              on ? 'border-pen bg-pen text-white' : FIT_TONE[fit]
            }`}
            data-fit={fit}
            title={deskEffect(d)}
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
        onClick={() => void seat(null)}
        className={`min-h-10 rounded border px-2 text-[13px] ${
          !e.desk ? 'border-pen bg-pen text-white' : 'border-line text-muted'
        }`}
      >
        쉰다
      </button>
      {limit && shown.length < company.desks.length && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="min-h-10 rounded px-2 text-[13px] text-muted underline"
        >
          자리 모두 보기 ({company.desks.length})
        </button>
      )}
    </div>
  )
}

/**
 * 미니맵 칸을 누르면 미니맵 바로 아래에 열린다 (237번, #298 "배치가 그림과 따로 논다"). 사람을 눌렀으면 그 사람의 상세 능력치와 자리 버튼, 빈 자리를 눌렀으면
 * 쉬는 직원 가운데 앉힐 사람을 먼저 고른다. 쉬는 사람이 없으면 채용 탭으로 데려간다. 앉히면 닫힌다.
 */
function SeatPicker({
  company,
  focus,
  onFocus,
}: {
  company: Company
  focus: SeatFocus
  onFocus: (focus: SeatFocus | null) => void
}) {
  const close = (
    <button
      type="button"
      onClick={() => onFocus(null)}
      className="min-h-9 shrink-0 rounded px-2 text-[13px] text-muted underline"
    >
      닫기
    </button>
  )
  if ('employee' in focus) {
    const e = company.employees.find((x) => x.id === focus.employee)
    if (!e) {
      return null
    }
    return (
      <GradeCard
        as="section"
        grade={e.overallGrade}
        badgeLabel="종합"
        className="mt-2 p-3"
        aria-label={`${e.name}의 자리 고르기`}
        data-testid="seat-picker"
      >
        <div className="flex items-start justify-between gap-2 pl-[64px]">
          <EmployeeDetail employee={e} />
          {close}
        </div>
        <p className="mt-2 text-[13px] text-muted" data-testid="seat-picker-desk">
          {e.desk
            ? `지금 자리: ${company.desks.find((d) => d.code === e.desk)?.name ?? e.desk}`
            : '지금 쉬는 중'}{' '}
          · 어디에 앉힐까요?
        </p>
        <div className="mt-1">
          <DeskButtons company={company} employee={e} onSeated={() => onFocus(null)} />
        </div>
      </GradeCard>
    )
  }
  const resting = company.employees.filter((x) => !x.desk)
  return (
    <section
      className="mt-2 rounded border border-pen p-3"
      aria-label="빈 자리에 앉힐 사람 고르기"
      data-testid="seat-picker"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[14px]">빈 자리에 누구를 앉힐까요?</p>
        {close}
      </div>
      {resting.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {resting.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => onFocus({ employee: x.id })}
              className="min-h-10 rounded border border-pen px-2 text-[13px]"
            >
              <GradeBadge grade={x.overallGrade} size="inline" />
              {x.name} <span className="font-mono-num text-[11px]">종합 {x.overallGrade}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-[13px] text-muted">쉬는 직원이 없습니다.</p>
          <button
            type="button"
            onClick={() => {
              onFocus(null)
              useRaisingStore.setState({ tab: 'market' })
              document.querySelector('[data-testid="tabs"]')?.scrollIntoView({ block: 'start' })
            }}
            className="min-h-10 rounded border border-pen px-3 text-[13px] font-semibold"
          >
            채용에서 뽑기
          </button>
        </div>
      )}
    </section>
  )
}

type Tab = 'meeting' | 'market' | 'staff' | 'settlement' | 'history'

/**
 * 이슈 · 채용 · 배치 · 지난 결산을 탭으로 나눈다. 한 장에 길게 늘어놓으면 위아래로 오가야 했다. 고른 탭은 스토어에 둔다: 직원이 들고 나면 회사 화면을
 * 새로 그리기 때문이다. 아무것도 안 골랐으면 직원이 없을 때 채용, 그 밖에는 이슈. 결산하면 지난 결산으로 간다.
 */
function CompanyTabs({ company }: { company: Company }) {
  const stored = useRaisingStore((s) => s.tab) as Tab | null
  const ended = company.status === 'ENDED'
  const placed = company.employees.filter((e) => e.desk).length
  const tabs: { id: Tab; label: string; badge?: string; show: boolean }[] = [
    {
      id: 'meeting',
      label: '이슈',
      badge:
        company.meeting?.omen ||
        company.meeting?.eraEnding ||
        company.meeting?.poach ||
        company.meeting?.raise
          ? '!'
          : undefined,
      show: Boolean(company.meeting),
    },
    {
      id: 'market',
      label: '채용',
      badge: company.gacha.tickets > 0 ? `${company.gacha.tickets}장` : undefined,
      show: !ended,
    },
    { id: 'staff', label: '배치', badge: `${placed}/${company.seats}`, show: true },
    { id: 'settlement', label: '지난 결산', show: Boolean(company.lastSettlement) },
    {
      id: 'history',
      label: '업적·연표',
      badge: `${company.history.achievements.filter((a) => a.year != null).length}/${company.history.achievements.length}`,
      show: true,
    },
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
  const marketSpot = useTutorialSpot(company, 'market')
  const staffSpot = useTutorialSpot(company, 'staff')
  // 처음 정한 탭을 붙잡아 둔다: 채용에서 사람을 뽑아 직원이 생겨도 채용 탭에 그대로 있게.
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
            } ${t.id === 'market' ? marketSpot : t.id === 'staff' ? staffSpot : ''}`}
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
        {tab === 'market' && <GachaPanel company={company} />}
        {tab === 'staff' && <StaffTab company={company} />}
        {tab === 'settlement' && <SettlementView company={company} />}
        {tab === 'history' && <HistoryTab company={company} />}
      </div>
    </div>
  )
}

/** 지난 결산 탭: 연말 결산서와 같은 장부(240번)와 그해 소식 줄. */
function SettlementView({ company }: { company: Company }) {
  const s = company.lastSettlement
  if (!s) {
    return null
  }
  return (
    <section data-testid="settlement">
      <h3 className="font-pen text-[22px]">
        {s.year}년 차 결산 · {PHASES[s.phase]}
      </h3>
      <div className="mt-1">
        <Ledger company={company} settlement={s} />
      </div>
      <ul className="mt-2 text-[13px]">
        {s.lines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 같은 소식이 두 번 올 수 있고 목록은 한 번 그리면 그대로다 (#338)
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ul>
    </section>
  )
}

/** 연표의 한 줄: 등급이 바뀐 해는 건물로 말한다 (238번). */
function eventText(e: Company['history']['timeline'][number]): string {
  if ((e.kind === 'grow' || e.kind === 'shrink') && e.grade) {
    return e.kind === 'grow'
      ? `회사가 커졌다 · ${officeName(e.grade)}`
      : `회사가 줄었다 · ${officeName(e.grade)}`
  }
  return e.text ?? ''
}

/**
 * 연표 탭 (decisions.md 263번, #326): 회사의 큰 일(최근 것부터), 업적, 명예의 전당. 매각이 빠져 끝없는 회사에 중간 목표와 기록을 준다.
 */
function HistoryTab({ company }: { company: Company }) {
  const h = company.history
  return (
    <section data-testid="history">
      <h3 className="font-pen text-[22px]">업적</h3>
      <ul className="mt-1 grid grid-cols-2 gap-1 md:grid-cols-4">
        {h.achievements.map((a) => (
          <li
            key={a.code}
            className={`rounded border p-2 text-[12px] ${
              a.year != null ? 'border-gold' : 'border-line-soft text-muted opacity-70'
            }`}
            data-testid="achievement"
            data-open={a.year != null}
          >
            <b className="block text-[13px]">
              {a.year != null ? '🏆 ' : ''}
              {a.name}
            </b>
            {a.description}
            {a.year != null && <span className="block text-gold">{a.year}년 차</span>}
          </li>
        ))}
      </ul>
      <h3 className="mt-3 font-pen text-[22px]">명예의 전당</h3>
      <p className="text-[11px] text-muted">데스크 운용과 종목 회의로 번 돈을 모두 더한 누적</p>
      {h.hall.length === 0 ? (
        <p className="text-[13px] text-muted">아직 아무도 없습니다.</p>
      ) : (
        <ol className="mt-1 grid gap-0.5 text-[13px]" data-testid="hall">
          {h.hall.map((x, i) => (
            <li key={`${x.name}-${x.from}`} className="flex justify-between gap-2">
              <span>
                {i + 1}. {x.name} {titleOf(x.grade)}{' '}
                <span className="text-muted">
                  {x.from > 0 ? `${x.from}년 차` : ''}
                  {x.to != null ? ` ~ ${x.to}년 차 · 퇴사` : ' ~ 지금'}
                </span>
              </span>
              <b className={x.totalPnl >= 0 ? 'text-up' : 'text-down'}>{pnlLabel(x.totalPnl)}</b>
            </li>
          ))}
        </ol>
      )}
      <h3 className="mt-3 font-pen text-[22px]">연표</h3>
      <ol className="mt-1 grid gap-0.5 text-[13px]" data-testid="timeline">
        {[...h.timeline].reverse().map((e, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 같은 해에 같은 일이 여럿일 수 있고 연표는 쌓이기만 한다
          <li key={`${e.year}-${e.kind}-${i}`}>
            <span className="font-mono-num text-muted">{e.year}년 차</span> {eventText(e)}
          </li>
        ))}
      </ol>
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
 * 자동 진행이 띄운 창을 닫기까지 남은 초 (decisions.md 277번). 창(오버레이) 위에 떠야 보여서 화면 맨 위에 따로 붙인다(아래는 자동 멈춤 버튼이 있다). 창이 없으면 그리지 않는다.
 */
function AutoCountdown() {
  const nextAt = useRaisingStore((s) => s.autoNextAt)
  const auto = useRaisingStore((s) => s.autoPlay)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (nextAt === null) {
      return
    }
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [nextAt])
  if (!auto || nextAt === null) {
    return null
  }
  const left = Math.max(0, Math.ceil((nextAt - now) / 1000))
  return createPortal(
    <p
      className="fixed top-3 left-1/2 z-40 -translate-x-1/2 rounded-full bg-teal px-4 py-2 text-[13px] font-semibold text-white shadow-lg"
      data-testid="auto-countdown"
      aria-live="polite"
    >
      자동 진행 · {left}초 뒤 닫힘
    </p>,
    document.body,
  )
}
