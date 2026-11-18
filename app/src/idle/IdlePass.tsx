import type { Company } from '@web/api/client'
import { DiamondIcon } from '@web/features/raising/DiamondIcon'
import { diamondText } from '@web/features/raising/gachaRules'
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
  missionProgress,
  type PassStep,
  rewardsText,
  stepProgress,
  stepState,
  waiting,
} from './pass'

/**
 * 시즌패스 (decisions.md 529·571번). 미션을 깨고 눌러서 포인트를 받아(572번) 모으면 단계 보상을 받는다. 돌파 화면 위쪽의 패스 단추(받을 보상과 미션의 수를 단다)와 시즌패스 시트다. 스스로 뜨지 않는다: 단추로 연다.
 */
export function IdlePass({ company }: { company: Company }) {
  const pass = company.pass
  const [open, setOpen] = useState(false)
  // 시즌이 곧 끝나는데 받을 것이 남았으면 배지가 깜빡인다.
  const count = waiting(pass)
  const hurry = pass.endingSoon && count > 0
  return (
    <>
      <button
        type="button"
        className="idle-quick-button"
        aria-label={count > 0 ? `시즌패스 받을 것 ${count}개` : '시즌패스'}
        data-testid="idle-pass"
        onClick={() => setOpen(true)}
      >
        <IdleIcon name="pass" />
        {count > 0 && (
          <b
            className={`idle-quick-count ${hurry ? 'is-hurry' : ''}`}
            data-testid="pass-badge"
            aria-hidden="true"
          >
            {count}
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
  // 미션의 포인트는 눌러서 받는다 (572번). 받은 포인트는 서버가 준 받을 포인트(ready)로 적는다.
  const take = async (code: string, points: number) => {
    if (busy) return
    setBusy(true)
    setError(null)
    const after = await useRaisingStore.getState().claimPassMission(code)
    setBusy(false)
    if (!after) {
      setError(useRaisingStore.getState().error ?? '연결이 끊겼어요. 다시 시도해 주세요.')
      return
    }
    sfx.cash()
    setGot(`포인트 +${points.toLocaleString()}P`)
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
      {pass.endingSoon && waiting(pass) > 0 && (
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
          {progress.full ? '모두 달성' : `${progress.have} / ${progress.need}P`}
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
      {/* 미션 (570·572번): 깨면 포인트를 눌러서 받는다. 받으면 다음 문턱으로 넘어가며 되풀이된다. */}
      <h4 className="idle-pass-missions-title">미션 · 깨고 눌러서 포인트를 받아요</h4>
      <ul className="idle-pass-missions" data-testid="pass-missions">
        {pass.missions.map((mission) => {
          const progress = missionProgress(mission)
          return (
            <li
              key={mission.code}
              className={mission.ready > 0 ? 'is-ready' : ''}
              data-testid="pass-mission"
              data-code={mission.code}
            >
              <span className="idle-pass-mission-name">{mission.title}</span>
              <span className="idle-pass-mission-count">{progress.text}</span>
              {mission.ready > 0 ? (
                <button
                  type="button"
                  className="idle-pass-mission-claim"
                  disabled={busy}
                  onClick={() => void take(mission.code, mission.ready)}
                  data-testid="pass-mission-claim"
                >
                  받기 +{mission.ready.toLocaleString()}P
                </button>
              ) : (
                <b className="idle-pass-mission-points">{mission.points}P</b>
              )}
              <div
                className="idle-pass-bar"
                role="progressbar"
                aria-label={`${mission.title} 진행도`}
                aria-valuemin={0}
                aria-valuemax={mission.target}
                aria-valuenow={progress.have}
              >
                <i style={{ width: `${progress.ratio * 100}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

function StepCard({ step, busy, onClaim }: { step: PassStep; busy: boolean; onClaim: () => void }) {
  const state = stepState(step)
  return (
    <li
      className={`is-${state} ${milestone(step) ? 'is-mile' : ''}`}
      data-testid="pass-step-card"
      data-step={step.step}
      data-state={state}
    >
      <small className="idle-pass-no">{step.step}단계</small>
      <span className="idle-pass-rewards">
        {step.diamonds > 0 && (
          <span className="idle-pass-reward">
            <DiamondIcon />
            <b>
              <span className="sr-only">다이아 </span>
              {diamondText(step.diamonds)}
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
