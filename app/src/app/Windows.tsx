import type { Company, Drawn } from '@web/api/client'
import { toggleAutoPlay } from '@web/features/raising/autoPlay'
import { EndingScreen } from '@web/features/raising/EndingScreen'
import { GachaReveal, useDrawReveal } from '@web/features/raising/Gacha'
import { InvestWindow } from '@web/features/raising/InvestWindow'
import { MacroWindow } from '@web/features/raising/MacroWindow'
import { MoveScene } from '@web/features/raising/MoveScene'
import { QuarterSheet } from '@web/features/raising/QuarterSheet'
import { ResignAlert } from '@web/features/raising/ResignAlert'
import { useRaisingStore } from '@web/features/raising/store'
import { useTutorialSpot } from '@web/features/raising/TutorialBanner'
import { YearEndSheet } from '@web/features/raising/YearEnd'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFx } from '../fx/fx'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { MentalWindow } from '../mental/MentalWindow'
import { useAppUi } from './ui'

/**
 * 회의 창과 결산서 (웹의 CompanyScreen과 같은 흐름): 분기 넘기기를 누르면 거시경제 회의 → (직원이 물어 오면) 종목 회의 → 결산. 연말 결산서·분기 실적·
 * 건물 알림·사표·엔딩은 서버 상태와 스토어의 표시로 뜬다. 이 컴포넌트는 회사·해·분기·직원이 바뀌면 다시 그려져 창 상태가 초기화된다.
 */
export function Windows({ company }: { company: Company }) {
  const justSettled = useRaisingStore((s) => s.justSettled)
  const moveAlert = useRaisingStore((s) => s.moveAlert)
  const upgradeMove = useRaisingStore((s) => s.upgradeMove)
  const justQuartered = useRaisingStore((s) => s.justQuartered)
  const { settle, convene } = useRaisingStore.getState()
  const [investOpen, setInvestOpen] = useState(false)
  const [macroOpen, setMacroOpen] = useState(false)
  const [mentalOpen, setMentalOpen] = useState(false)
  const ended = company.status === 'ENDED'
  const drawn = useDrawReveal(company)

  // 결산 직전: 이번 분기 멘탈 전투를 아직 안 치렀으면 창을 띄운다 (decisions.md 320번). 자동 진행은 건너뛴다.
  const battleOrSettle = () => {
    const s = useRaisingStore.getState()
    if (s.company?.mental && !s.company.mental.done && !s.autoPlay) {
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
        <MoveScene
          before={company.lastSettlement.gradeBefore}
          after={company.lastSettlement.gradeAfter}
          year={company.lastSettlement.year}
          onDone={() => useRaisingStore.setState({ moveAlert: false })}
        />
      )}
      {upgradeMove && !justSettled && (
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
        />
      )}
      {!ended && company.mental && mentalOpen && (
        <MentalWindow
          mental={company.mental}
          onDone={() => {
            setMentalOpen(false)
            void settle()
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
export function ActionBar({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const autoPlay = useRaisingStore((s) => s.autoPlay)
  const { restart } = useRaisingStore.getState()
  const settleSpot = useTutorialSpot(company, 'settle')
  const ended = company.status === 'ENDED'
  if (ended || company.ending) {
    return null
  }
  if (company.broke) {
    return (
      <div className="px-4 pt-2 pb-2 text-white" data-testid="broke">
        <p className="text-[13px] font-semibold text-[#ff8a7a]">{company.broke}</p>
        {error && (
          <p role="alert" className="text-[12px] text-[#ff8a7a]">
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
  return (
    <div className="px-4 pt-2 pb-2 text-white">
      {error && (
        <p role="alert" className="mb-1 text-[12px] text-[#ff8a7a]">
          {error}
        </p>
      )}
      {autoPlay && (
        <p className="mb-1 text-center text-[11px] text-[#7fd1bf]" data-testid="auto-status">
          자동 진행 중 · 뽑기 → 배치 → 회의(직원 다수결) → 분기 넘기기
        </p>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button
          type="button"
          aria-pressed={autoPlay}
          onClick={() => {
            sfx.tap()
            toggleAutoPlay(!autoPlay)
          }}
          className={`btn min-h-14 px-3 text-[13px] ${autoPlay ? 'btn-teal' : 'btn-ghost'}`}
          title="빈 자리에 뽑고, 자동 배치하고, 회의는 직원 다수결로 정하고, 분기를 넘긴다"
        >
          {autoPlay ? '■ 자동 멈춤' : '⟳ 자동'}
        </button>
        <button
          type="button"
          disabled={busy || autoPlay}
          onClick={(ev) => {
            sfx.stamp()
            haptic.medium()
            useFx.getState().burstAt(ev.currentTarget, 'sparks')
            useAppUi.getState().requestSettle()
          }}
          className={`btn btn-primary animate-breathe min-h-14 text-[17px] ${settleSpot}`}
          data-testid="settle"
        >
          {company.year}년 차 {company.quarter}분기 넘기기 ▶
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
