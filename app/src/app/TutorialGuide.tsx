import type { Company } from '@web/api/client'
import { tutorialStep, useTutorial } from '@web/features/raising/tutorial'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  type FirstPlayStep,
  firstQuarter,
  prepareFirstPlay,
  readFirstPlay,
  saveFirstPlay,
} from './firstPlay'
import { CatFigure } from './toy-city/CatFigure'
import { useAppUi } from './ui'
import './tutorial-guide.css'

/** 첫 방문 안내는 버튼을 눌렀을 때만 다음 장으로 넘어간다. 새로고침해도 읽던 장을 유지한다. */
export function TutorialGuide({ company }: { company: Company }) {
  const active = useTutorial((s) => s.active)
  const battle = useAppUi((s) => s.battle)
  const investOpen = useAppUi((s) => s.investOpen)
  const [first] = useState(() => firstQuarter(company) && readFirstPlay(company) !== 'done')
  const [page, setPage] = useState<FirstPlayStep>(() => readFirstPlay(company))
  const [preparing, setPreparing] = useState(first && !company.invest?.outcome)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const step = tutorialStep(company)
  const ackKey = `investor-game.guide:${company.companyId}`
  const [ack, setAck] = useState(() => {
    try {
      return localStorage.getItem(ackKey)
    } catch {
      return null
    }
  })
  // biome-ignore lint/correctness/useExhaustiveDependencies: 회사 키·안내 시작·재시도 때만 준비한다. 서버 응답마다 새 요청을 만들지 않는다.
  useEffect(() => {
    if (!active || !first || company.invest?.outcome || page === 'done') return
    let mounted = true
    setPreparing(true)
    setError(null)
    void prepareFirstPlay(company)
      .then(() => {
        if (mounted) setPreparing(false)
      })
      .catch((e: unknown) => {
        if (mounted) {
          setPreparing(false)
          setError(e instanceof Error ? e.message : '준비하지 못했어요.')
        }
      })
    return () => {
      mounted = false
    }
    // 회사 갱신마다 다시 채용하지 않고, 재시도 버튼으로만 다시 요청한다.
  }, [company.companyId, active, first, retry])

  const next = (p: FirstPlayStep) => {
    saveFirstPlay(company, p)
    setPage(p)
  }
  const done = () => {
    next('done')
    useTutorial.getState().finish()
  }
  // 첫 게임은 회의 결정까지다(474번): 회의 창을 닫거나 분기를 넘기면 돌아본다. 회의 뒤 전투는 없다.
  const decided = Boolean(company.invest?.outcome) || !firstQuarter(company)
  const review = first && page === 'play' && decided && !battle && !investOpen
  if (!active || company.status === 'ENDED') return null
  if (first && (page === 'done' || (page === 'play' && !review))) return null
  if (!first && ack === step.id) return null

  const employee = company.employees[0]
  const desk = company.desks.find((d) => d.code === employee?.desk)
  const at = first ? (review ? 4 : page === 'welcome' ? 1 : page === 'team' ? 2 : 3) : step.n
  const total = first ? 4 : 5
  const title = first
    ? review
      ? '첫 게임, 해냈어요!'
      : page === 'welcome'
        ? '사장님, 첫 출근을 환영해요!'
        : page === 'team'
          ? '첫 판 준비는 끝났어요'
          : '이제 사장님의 선택이에요'
    : step.title
  const description = first
    ? review
      ? '종목회의를 직접 해봤어요. 가운데 매도벽 돌파로 스테이지를 깨며 회사를 키워보세요.'
      : page === 'welcome'
        ? '작은 사무실에서 시작하는 나만의 투자회사. 안내를 누르며 첫 게임을 함께 해봐요.'
        : page === 'team'
          ? '첫 채용권으로 동료를 맞이하고 자리에 앉혔어요. 기본 무기도 준비되어 바로 시작할 수 있어요.'
          : '기사를 읽고 매수·매도를 골라보세요. 맞히면 벌고, 틀려도 손실은 없어요.'
    : step.id === 'meeting'
      ? // 앱은 종목회의를 이슈 탭으로 옮겼다 (474번). 가운데는 주 게임 매도벽 돌파다.
        '"이슈" 탭의 종목회의를 누르면 직원이 종목을 물어 옵니다. 기사를 읽고 매수·매도를 고르세요. 맞히면 벌고, 틀려도 손실은 없어요. 가운데 "매도벽 돌파"는 언제든 스테이지를 골라 할 수 있어요.'
      : step.text
  const button = first
    ? review
      ? '결과 확인하고 계속하기'
      : page === 'ready'
        ? '첫 종목회의 시작 →'
        : '직접 눌러 다음으로 →'
    : step.id === 'hire'
      ? '채용 보러 가기 →'
      : step.id === 'place'
        ? '인력 관리 열기 →'
        : step.id === 'meeting'
          ? '종목회의 시작 →'
          : step.id === 'sheet'
            ? '기록 확인하기 →'
            : '사무실 둘러보기 →'
  const advance = () => {
    if (first) {
      if (review) done()
      else if (page === 'welcome') next('team')
      else if (page === 'team') next('ready')
      else {
        next('play')
        useAppUi.getState().requestSettle()
      }
      return
    }
    setAck(step.id)
    try {
      localStorage.setItem(ackKey, step.id)
    } catch {
      /* 이번 화면에서는 유지한다. */
    }
    const ui = useAppUi.getState()
    if (step.id === 'hire') ui.setTab('market')
    else if (step.id === 'place') ui.setTab('staff')
    else if (step.id === 'meeting') ui.requestSettle()
    else if (step.id === 'sheet') ui.setTab('record')
    else {
      ui.setTab('office')
      useTutorial.getState().finish()
    }
  }
  return (
    <GuideDialog>
      <fieldset className="guide-route" aria-label={`안내 ${at}/${total}`}>
        {[1, 2, 3, 4, 5].slice(0, total).map((n) => (
          <span key={n} data-current={n === at} data-done={n < at}>
            {n < at ? '✓' : n}
          </span>
        ))}
      </fieldset>
      <div className="guide-mascot" aria-hidden="true">
        <svg viewBox="0 0 36 40" aria-hidden="true">
          <CatFigure id={employee?.id ?? 0} eyes="happy" />
        </svg>
        <b>{review ? '★' : '✦'}</b>
      </div>
      <p className="guide-eyebrow">
        {first ? 'FIRST PLAY · 첫 게임 안내' : `OFFICE GUIDE · ${at}/${total}`}
      </p>
      <h2 id="guide-title">{title}</h2>
      <p className="guide-description">{description}</p>
      {first && !review && (
        <div className="guide-ready-list">
          <div>
            <span>동료 · 배치</span>
            <strong>
              {employee ? `${employee.name} · ${desk?.name ?? '준비 중'}` : '첫 동료를 맞이하는 중'}
            </strong>
          </div>
          <div>
            <span>첫 게임</span>
            <strong>
              {preparing
                ? '차근차근 준비 중…'
                : error
                  ? '준비를 다시 확인해요'
                  : '첫 종목회의 준비 완료'}
            </strong>
          </div>
        </div>
      )}
      <p className="guide-manual">☝ 직접 누를 때까지 기다릴게요</p>
      {error && (
        <p role="alert" className="guide-error">
          {error}
        </p>
      )}
      <button
        type="button"
        className="guide-next"
        data-testid="tutorial-next"
        disabled={preparing}
        onClick={error ? () => setRetry((n) => n + 1) : advance}
      >
        {preparing ? '첫 게임 준비 중…' : error ? '준비 다시 시도' : button}
      </button>
      <button
        type="button"
        className="guide-skip"
        data-testid="tutorial-skip"
        disabled={preparing}
        onClick={done}
      >
        설명 건너뛰기
      </button>
    </GuideDialog>
  )
}

function GuideDialog({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    const ui = useAppUi.getState()
    const previous = ui.modalBack
    const focus = document.activeElement as HTMLElement | null
    const back = () => {} // 바깥 클릭·뒤로 가기로 안내가 자동 진행되지 않는다.
    ui.setModalBack(back)
    root.current?.focus()
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const buttons = Array.from(
        root.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
      )
      const target = e.shiftKey ? buttons.at(-1) : buttons[0]
      if (
        !buttons.length ||
        !root.current?.contains(document.activeElement) ||
        document.activeElement === root.current ||
        (!e.shiftKey && document.activeElement === buttons.at(-1)) ||
        (e.shiftKey && document.activeElement === buttons[0])
      ) {
        e.preventDefault()
        target?.focus()
      }
    }
    window.addEventListener('keydown', trap)
    return () => {
      window.removeEventListener('keydown', trap)
      if (useAppUi.getState().modalBack === back) ui.setModalBack(previous)
      if (focus?.isConnected) focus.focus()
    }
  }, [])
  return createPortal(
    <div className="guide-backdrop">
      <section
        ref={root}
        tabIndex={-1}
        className="guide-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        data-testid="tutorial-guide"
      >
        {children}
      </section>
    </div>,
    document.body,
  )
}
