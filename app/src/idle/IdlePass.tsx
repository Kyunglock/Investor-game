import type { Company } from '@web/api/client'
import { DiamondIcon } from '@web/features/raising/DiamondIcon'
import { useRaisingStore } from '@web/features/raising/store'
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { Sheet } from '../app/Sheet'
import { useAppUi } from '../app/ui'
import { sfx } from '../fx/sound'
import { IdleIcon } from './icons'
import {
  focusStep,
  leftText,
  milestone,
  type PassStep,
  rewardsText,
  stepAmount,
  stepProgress,
  stepState,
} from './pass'

/** 패스 경험치를 주는 곳 (529번). 얼마씩인지는 서버 설정이라 적지 않는다. */
const EXP_SOURCES = ['매도벽 돌파', '멘탈 보호 스테이지', 'EX 디펜스', '출석']

/**
 * 시즌패스 (decisions.md 529번). 돌파 화면 위쪽의 패스 단추(받을 보상의 수를 단다)와 시즌패스 시트다. 스스로 뜨지 않는다: 단추로 연다.
 */
export function IdlePass({ company }: { company: Company }) {
  const pass = company.pass
  const [open, setOpen] = useState(false)
  // 시즌이 곧 끝나는데 받을 것이 남았으면 배지가 깜빡인다.
  const hurry = pass.endingSoon && pass.claimable > 0
  return (
    <>
      <button
        type="button"
        className="idle-quick-button"
        aria-label={pass.claimable > 0 ? `시즌패스 받을 보상 ${pass.claimable}개` : '시즌패스'}
        data-testid="idle-pass"
        onClick={() => setOpen(true)}
      >
        <IdleIcon name="pass" />
        {pass.claimable > 0 && (
          <b
            className={`idle-quick-count ${hurry ? 'is-hurry' : ''}`}
            data-testid="pass-badge"
            aria-hidden="true"
          >
            {pass.claimable}
          </b>
        )}
      </button>
      {open && <PassSheet company={company} onClose={() => setOpen(false)} />}
    </>
  )
}

function PassSheet({ company, onClose }: { company: Company; onClose: () => void }) {
  const pass = company.pass
  const list = useRef<HTMLOListElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 방금 받은 것 한 줄: 응답의 lastRewards로 적어 둔다.
  const [got, setGot] = useState<string | null>(null)
  const dismiss = useEffectEvent(onClose)
  useEffect(() => {
    // 뒤로 가기(안드로이드)는 시트를 닫는다. Escape와 포커스는 Sheet가 맡는다.
    const before = useAppUi.getState().modalBack
    useAppUi.getState().setModalBack(() => dismiss())
    return () => useAppUi.getState().setModalBack(before)
  }, [])
  // 열면 받을 수 있는 첫 단계(없으면 오르고 있는 단계)가 가운데에 오게 옆으로 넘겨 둔다.
  const first = useRef(focusStep(pass))
  useLayoutEffect(() => {
    const box = list.current
    const card = box?.querySelector<HTMLElement>(`[data-step="${first.current}"]`)
    if (!box || !card) return
    box.scrollLeft = card.offsetLeft - box.offsetLeft - (box.clientWidth - card.offsetWidth) / 2
  }, [])
  const claim = async (step?: number) => {
    if (busy) return
    setBusy(true)
    setError(null)
    const after = await useRaisingStore.getState().claimPass(step)
    setBusy(false)
    if (!after) {
      setError(useRaisingStore.getState().error ?? '연결이 끊겼어요. 다시 시도해 주세요.')
      return
    }
    sfx.cash()
    setGot(rewardsText(after.pass.lastRewards, after.weapons ?? []))
  }
  const progress = stepProgress(pass)
  return (
    <Sheet title="시즌패스" onClose={onClose} testId="pass" className="idle-sheet idle-pass-sheet">
      <p className="idle-pass-season">
        <b data-testid="pass-name">{pass.name}</b>
        <span
          className={`idle-pass-left ${pass.endingSoon ? 'is-soon' : ''}`}
          data-testid="pass-left"
        >
          {leftText(pass.secondsLeft)}
        </span>
      </p>
      {pass.endingSoon && pass.claimable > 0 && (
        <p className="idle-pass-ending" role="alert" data-testid="pass-ending">
          시즌이 곧 끝나요. 보상을 받아 가세요
        </p>
      )}
      <div className="idle-pass-progress">
        <strong data-testid="pass-step">{pass.step}단계</strong>
        <div
          className="idle-pass-bar"
          role="progressbar"
          aria-label="다음 단계까지"
          aria-valuemin={0}
          aria-valuemax={progress.need}
          aria-valuenow={progress.have}
        >
          <i style={{ width: `${(progress.have / progress.need) * 100}%` }} />
        </div>
        <small className="idle-pass-exp" data-testid="pass-exp">
          {progress.full ? '모두 달성' : `${progress.have} / ${progress.need}`}
        </small>
      </div>
      <ol className="idle-pass-steps" ref={list} data-testid="pass-steps" aria-label="단계 보상">
        {pass.steps.map((step) => (
          <StepCard key={step.step} step={step} busy={busy} onClaim={() => void claim(step.step)} />
        ))}
      </ol>
      {got != null && (
        <p className="idle-pass-got" role="status" data-testid="pass-got">
          <b>{got}</b> 받았어요
        </p>
      )}
      {error && (
        <p className="idle-pass-error" role="alert">
          {error}
        </p>
      )}
      {pass.claimable > 0 && (
        <button
          type="button"
          className="idle-pass-all"
          disabled={busy}
          onClick={() => void claim()}
          data-testid="pass-claim-all"
        >
          모두 받기 <small className="idle-pass-all-count">{pass.claimable}개</small>
        </button>
      )}
      <p className="idle-pass-hint" data-testid="pass-hint">
        패스 경험치는 여기서 모아요
        <br />
        {EXP_SOURCES.map((source, i) => (
          <span key={source}>
            {i > 0 && ' · '}
            <span className="idle-pass-source">{source}</span>
          </span>
        ))}
      </p>
    </Sheet>
  )
}

function StepCard({ step, busy, onClaim }: { step: PassStep; busy: boolean; onClaim: () => void }) {
  const state = stepState(step)
  const amount = stepAmount(step)
  return (
    <li
      className={`is-${state} ${milestone(step) ? 'is-mile' : ''}`}
      data-testid="pass-step-card"
      data-step={step.step}
      data-state={state}
    >
      <small className="idle-pass-no">{step.step}단계</small>
      <span className="idle-pass-rewards">
        {amount != null && (
          <span className="idle-pass-reward">
            {step.diamonds > 0 ? (
              <DiamondIcon />
            ) : (
              <span className="idle-coin" aria-hidden="true">
                ₩
              </span>
            )}
            <b>
              <span className="sr-only">{step.diamonds > 0 ? '다이아 ' : '돈 '}</span>
              {amount}
            </b>
          </span>
        )}
        {step.weapon && (
          <span className="idle-pass-reward idle-pass-extra">
            <span className="idle-pass-extra-icon">
              <IdleIcon name="damage" />
            </span>
            무기
          </span>
        )}
        {step.cat && (
          <span className="idle-pass-reward idle-pass-extra">
            <span className="idle-pass-extra-icon">
              <IdleIcon name="cats" />
            </span>
            고양이
          </span>
        )}
      </span>
      {state === 'ready' ? (
        <button type="button" disabled={busy} onClick={onClaim} data-testid="pass-claim">
          받기
        </button>
      ) : (
        <span
          className="idle-pass-mark"
          role="img"
          aria-label={state === 'claimed' ? '받음' : '잠김'}
        >
          {state === 'claimed' ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <IdleIcon name="lock" />
          )}
        </span>
      )}
    </li>
  )
}
