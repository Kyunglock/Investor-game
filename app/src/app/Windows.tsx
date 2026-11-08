import type { Company, Drawn } from '@web/api/client'
import { toggleAutoPlay } from '@web/features/raising/autoPlay'
import { EndingScreen } from '@web/features/raising/EndingScreen'
import { GachaReveal, useDrawReveal } from '@web/features/raising/Gacha'
import { InvestWindow } from '@web/features/raising/InvestWindow'
import { MacroWindow } from '@web/features/raising/MacroWindow'
import { QuarterSheet } from '@web/features/raising/QuarterSheet'
import { ResignAlert } from '@web/features/raising/ResignAlert'
import { useRaisingStore } from '@web/features/raising/store'
import { useLocked, useTutorialSpot } from '@web/features/raising/TutorialBanner'
import { YearEndSheet } from '@web/features/raising/YearEnd'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFx } from '../fx/fx'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { MentalWindow } from '../mental/MentalWindow'
import { ToyCityMove } from './toy-city/ToyCityMove'
import { useAppUi } from './ui'

/**
 * 회의 창과 결산서 (웹의 CompanyScreen과 같은 흐름): 분기 넘기기를 누르면 거시경제 회의 → (직원이 물어 오면) 종목 회의 → 결산. 연말 결산서·분기 실적·
 * 건물 알림·사표·엔딩은 서버 상태와 스토어의 표시로 뜬다. 이 컴포넌트는 회사·해·분기·직원이 바뀌면 다시 그려져 창 상태가 초기화된다.
 */
export function Windows({ company }: { company: Company }) {
  const justSettled = useRaisingStore((s) => s.justSettled)
  const moveAlert = useRaisingStore((s) => s.moveAlert)
  const upgradeMove = useRaisingStore((s) => s.upgradeMove)
  const moveBeforeSeats = useRaisingStore((s) => s.moveBeforeSeats)
  const justQuartered = useRaisingStore((s) => s.justQuartered)
  const { settle, convene } = useRaisingStore.getState()
  const [investOpen, setInvestOpen] = useState(false)
  const [macroOpen, setMacroOpen] = useState(false)
  const [mentalOpen, setMentalOpen] = useState(false)
  // 디펜스는 결정 직후 (348번): 종목 회의에서 매수·매도가 정해지면 바로 전투, 끝나면 회의 창으로 돌아와 결과를 본다. 결산은 그 뒤 버튼으로.
  const [mentalMode, setMentalMode] = useState<'settle' | 'invest'>('settle')
  const ended = company.status === 'ENDED'
  const drawn = useDrawReveal(company)
  const outcome = company.invest?.outcome ?? null
  const prevOutcome = useRef(outcome)
  useEffect(() => {
    const before = prevOutcome.current
    prevOutcome.current = outcome
    if (!outcome || before) {
      return
    }
    const s = useRaisingStore.getState()
    const mental = s.company?.mental
    if (
      investOpen &&
      mental?.genre === 'DEFENSE' &&
      !mental.done &&
      !s.autoPlay &&
      outcome.choice !== 'HOLD'
    ) {
      setMentalMode('invest')
      setMentalOpen(true)
    }
  }, [outcome, investOpen])

  // 결산 직전: 이번 분기 멘탈 전투를 아직 안 치렀으면 창을 띄운다 (decisions.md 328번). 자동 진행은 건너뛴다.
  const battleOrSettle = () => {
    const s = useRaisingStore.getState()
    if (s.company?.mental && !s.company.mental.done && !s.autoPlay) {
      setMentalMode('settle')
      setMentalOpen(true)
      return
    }
    void settle()
  }

  // 거시경제 회의를 마친 뒤: 물어 온 종목이 있으면 종목 회의를 열고, 없으면 바로 결산한다.
  const stockOrSettle = async () => {
    if (!useRaisingStore.getState().company?.invest?.ready) {
      battleOrSettle()
      return
    }
    if (await convene()) {
      setInvestOpen(true)
    }
  }

  // 분기 넘기기 (결산 버튼이 부른다): 돈을 굴리는 직원이 있으면 먼저 거시경제 회의를 연다.
  useEffect(() => {
    return useAppUi.subscribe((state, prev) => {
      if (state.settleRequest === prev.settleRequest) {
        return
      }
      void (async () => {
        const c = useRaisingStore.getState().company
        if (!c?.macro?.ready) {
          await stockOrSettle()
          return
        }
        if (await useRaisingStore.getState().conveneMacro()) {
          setMacroOpen(true)
        }
      })()
    })
  })

  const closeYearEnd = () => {
    useRaisingStore.setState({ justSettled: false })
    useAppUi.getState().setTab('record')
  }

  return (
    <>
      {justSettled && <YearEndSheet company={company} onClose={closeYearEnd} />}
      {company.lastSettlement && moveAlert && !justSettled && (
        <ToyCityMove
          company={company}
          beforeSeats={moveBeforeSeats ?? company.seats}
          before={company.lastSettlement.gradeBefore}
          after={company.lastSettlement.gradeAfter}
          year={company.lastSettlement.year}
          onDone={() => useRaisingStore.setState({ moveAlert: false })}
        />
      )}
      {upgradeMove && !justSettled && (
        <ToyCityMove
          company={company}
          beforeSeats={upgradeMove.beforeSeats ?? company.seats}
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
        !upgradeMove && <ResignAlert resign={company.resign} />}
      {company.ending && !justSettled && !moveAlert && !upgradeMove && (
        <EndingScreen company={company} />
      )}
      {drawn && !justSettled && (
        // 채용 뽑기 결과 (decisions.md 312번): 카드가 열릴 때마다 소리·진동, 특급이면 금빛 번쩍임과 색종이.
        <GachaReveal
          drawn={drawn}
          onClose={() => useRaisingStore.setState({ justDrew: false })}
          onFlip={revealFx}
        />
      )}
      {justQuartered && company.lastQuarter && (
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
          onSettle={() => {
            setInvestOpen(false)
            battleOrSettle()
          }}
          hold={mentalOpen && mentalMode === 'invest'}
        />
      )}
      {!ended && company.mental && mentalOpen && (
        <MentalWindow
          mental={company.mental}
          company={company}
          onDone={() => {
            setMentalOpen(false)
            if (mentalMode === 'settle') {
              void settle()
            }
          }}
        />
      )}
      <AutoCountdown />
    </>
  )
}

/** 뽑기 카드가 열릴 때의 효과 (decisions.md 310·312번). */
function revealFx(d: Drawn, el: HTMLElement | null) {
  const fx = useFx.getState()
  if (d.star) {
    fx.flashScreen('rgba(245,211,107,0.55)')
    fx.burstAt(el, 'confetti')
    fx.shakeScreen()
    sfx.fanfare()
    haptic.heavy()
    return
  }
  if (d.fresh) {
    fx.burstAt(el, 'sparks')
    sfx.cash()
    haptic.medium()
    return
  }
  fx.burstAt(el, 'coins')
  sfx.coin()
  haptic.light()
}

/** 화면 아래의 큰 버튼 (decisions.md 310번): 분기 넘기기(누르면 도장 소리·진동·불꽃)와 자동 진행. 망했으면 다음 회사 차리기. */
export function ActionBar({
  company,
  variant = 'default',
}: {
  company: Company
  variant?: 'default' | 'toy'
}) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const autoPlay = useRaisingStore((s) => s.autoPlay)
  const { restart } = useRaisingStore.getState()
  const settleSpot = useTutorialSpot(company, 'settle')
  // 튜토리얼 잠금 (347번): 분기 넘기기는 앉힌 뒤, 자동 진행은 마지막 걸음에 열린다.
  const settleLocked = useLocked(company, 'settle')
  const autoLocked = useLocked(company, 'auto')
  const ended = company.status === 'ENDED'
  if (ended || company.ending) {
    return null
  }
  if (company.broke) {
    return (
      <div className="px-4 pt-2 pb-2 text-ink" data-testid="broke">
        <p className="text-[13px] font-semibold text-red-pen">{company.broke}</p>
        {error && (
          <p role="alert" className="text-[12px] text-red-pen">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            sfx.stamp()
            haptic.medium()
            void restart()
          }}
          className="btn btn-primary mt-1 min-h-14 w-full text-[15px]"
        >
          문을 닫고 사재로 {company.number + 1}호 회사 차리기
        </button>
      </div>
    )
  }
  if (!company.meeting) {
    return null
  }
  if (variant === 'toy') {
    const assigned = company.employees.filter((e) => e.desk).length
    const upgradeLevels = (company.battleUpgrades ?? []).reduce((n, u) => n + u.level, 0)
    return (
      <div className="toy-action-area">
        {error && (
          <p role="alert" className="toy-error">
            {error}
          </p>
        )}
        {autoPlay && (
          <button
            type="button"
            className="toy-auto-stop"
            data-testid="auto"
            aria-pressed="true"
            onClick={() => toggleAutoPlay(false)}
          >
            자동 진행 중 · 누르면 멈춤
          </button>
        )}
        {/* 아래 카드 셋 (decisions.md 367번): 지난 분기 수익·팀 분위기를 빼고 전투 강화와 스테이지를 둔다. */}
        <div className="toy-bottom-cards">
          <button
            type="button"
            className="toy-stat"
            data-testid="battle-upgrade-open"
            onClick={() => {
              sfx.tap()
              haptic.light()
              useAppUi.getState().openSheet({ kind: 'toy', panel: 'battle' })
            }}
          >
            <small>자본으로</small>
            <strong>강화</strong>
            <em>{upgradeLevels > 0 ? `${upgradeLevels}단계 올림` : '데미지·연사·속도'}</em>
          </button>
          <button
            type="button"
            disabled={busy || autoPlay || settleLocked}
            className={`toy-stat toy-advance ${settleSpot}`}
            data-testid="settle"
            data-locked={settleLocked || undefined}
            onClick={(ev) => {
              sfx.stamp()
              haptic.medium()
              useFx.getState().burstAt(ev.currentTarget, 'sparks')
              useAppUi.getState().requestSettle()
            }}
          >
            <small>{busy ? '처리 중…' : settleLocked ? '직원을 앉혀주세요' : '다음 분기로'}</small>
            <strong>▶ 넘기기</strong>
            <em>
              자리 {assigned}/{company.seats}
            </em>
          </button>
          {/* 스테이지 입구: 스테이지 선택(#493)이 생기기 전까지는 이번 분기 멘탈 시트를 연다. */}
          <button
            type="button"
            className="toy-stat"
            data-testid="stage-open"
            onClick={() => {
              sfx.tap()
              haptic.light()
              useAppUi.getState().openSheet({ kind: 'toy', panel: 'mental' })
            }}
          >
            <small>멘탈 전투</small>
            <strong>스테이지</strong>
            <em>{company.mental?.done ? '이번 분기 완료' : '전진 모드'}</em>
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="px-4 pt-2 pb-2 text-ink">
      {error && (
        <p role="alert" className="mb-1 text-[12px] text-red-pen">
          {error}
        </p>
      )}
      {autoPlay && (
        <p className="mb-1 text-center text-[11px] text-teal" data-testid="auto-status">
          자동 진행 중 · 뽑기 → 배치 → 회의(직원 다수결) → 분기 넘기기
        </p>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button
          type="button"
          aria-pressed={autoPlay}
          disabled={autoLocked}
          onClick={() => {
            sfx.tap()
            toggleAutoPlay(!autoPlay)
          }}
          className={`btn min-h-14 px-3 text-[13px] ${autoPlay ? 'btn-teal' : 'btn-ghost'} ${autoLocked ? 'opacity-40' : ''}`}
          title="빈 자리에 뽑고, 자동 배치하고, 회의는 직원 다수결로 정하고, 분기를 넘긴다"
          data-testid="auto"
          data-locked={autoLocked || undefined}
        >
          {autoLocked ? '🔒' : autoPlay ? '■ 자동 멈춤' : '⟳ 자동'}
        </button>
        <button
          type="button"
          disabled={busy || autoPlay || settleLocked}
          onClick={(ev) => {
            sfx.stamp()
            haptic.medium()
            useFx.getState().burstAt(ev.currentTarget, 'sparks')
            useAppUi.getState().requestSettle()
          }}
          className={`btn min-h-14 text-[17px] ${settleLocked ? 'btn-line opacity-50' : `btn-primary animate-breathe ${settleSpot}`}`}
          data-testid="settle"
          data-locked={settleLocked || undefined}
        >
          {settleLocked
            ? '🔒 직원을 앉히면 열린다'
            : `${company.year}년 차 ${company.quarter}분기 넘기기 ▶`}
        </button>
      </div>
    </div>
  )
}

/** 자동 진행이 띄운 창을 닫기까지 남은 초 (decisions.md 277번). */
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
