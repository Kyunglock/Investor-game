import type { Company } from '@web/api/client'
import { useRaisingStore } from '@web/features/raising/store'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tutorialReady } from './onboarding'
import { tutorialTargets, useTutorialFocus } from './tutorialFocus'
import { useTutorialClickGuard } from './useTutorialClickGuard'
import { useTutorialDragGuard } from './useTutorialDragGuard'
import './onboarding-guide.css'

/** 기존 UI 옆의 짧은 안내. 직접 조작하는 단계는 행동 완료 후 이어간다. 비춘 곳 말고는 누를 수 없다. */
export function IdleTutorial({
  company,
  replay,
  onReplay,
  onGo,
  menu,
}: {
  company: Company
  replay: number | null
  onReplay: (step: number | null) => void
  onGo: (menu: 'battle' | 'growth' | 'cats' | 'skills', gear?: boolean) => void
  menu: string
}) {
  const progress = company.idle?.onboarding
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const attempted = useRef<number | null>(null)
  const maskId = useId()
  const bubble = useRef<HTMLElement>(null)
  const [height, setHeight] = useState(110)
  const step = replay ?? progress?.step ?? 8
  // 100벽의 스킬 안내(587번)는 없앴다: 사장냥의 스킬은 매도벽 돌파 스테이지의 레벨업 카드가 되었다 (667번).
  const active = !!progress && step < 8
  const focus = useTutorialFocus(tutorialTargets(step, menu), active)
  useTutorialDragGuard(focus?.drop ? focus.target : undefined, focus?.drop?.target)
  useTutorialClickGuard(active && focus ? [focus.target, focus.drop?.target] : [])
  const ready = tutorialReady(company, step)
  const advance = () => useRaisingStore.getState().tutorial('next', progress?.step ?? 8)
  useEffect(() => {
    if (
      replay !== null ||
      !progress ||
      ![1, 3, 5].includes(step) ||
      !ready ||
      busy ||
      attempted.current === step
    )
      return
    attempted.current = step
    void useRaisingStore
      .getState()
      .tutorial('next', step)
      .then(() => {
        if (step === 5 && !useRaisingStore.getState().error) onGo('battle')
      })
  }, [step, ready, busy, replay, progress, onGo])
  useLayoutEffect(() => {
    if (!active || !focus || !bubble.current) return
    const observer = new ResizeObserver(() =>
      setHeight(bubble.current?.getBoundingClientRect().height ?? 110),
    )
    observer.observe(bubble.current)
    return () => observer.disconnect()
  }, [active, focus])
  if (!active || !focus || !progress) return null
  const width = Math.min(focus.drop ? 210 : 250, innerWidth - 24)
  const anchoredLeft = Math.max(
    12,
    Math.min(innerWidth - width - 12, focus.left + focus.width / 2 - width / 2),
  )
  const left = focus.drop
    ? focus.left < innerWidth / 2
      ? innerWidth - width - 12
      : 12
    : anchoredLeft
  const above = focus.top - height - 12 >= 60
  const top = focus.drop
    ? Math.max(60, Math.min(innerHeight - height - 10, focus.drop.top + focus.drop.height + 16))
    : focus.battle
      ? Math.min(innerHeight - height - 10, focus.top + 10)
      : above
        ? focus.top - height - 12
        : Math.min(innerHeight - height - 10, focus.top + focus.height + 12)
  const action =
    replay !== null
      ? step === 7
        ? '다시 보기 마치기'
        : '다음 안내'
      : step === -1
        ? '함께 시작하기'
        : step === 7
          ? '안내 마치기'
          : null
  const drop = focus.drop
  const windows = (drop ? [focus, drop] : [focus]).map((box) => (
    <rect key={box.target} x={box.left} y={box.top} width={box.width} height={box.height} rx={9} />
  ))
  const fromX = focus.left + focus.width / 2
  const fromY = focus.top - 8
  const toX = drop ? drop.left + drop.width / 2 : fromX
  const toY = drop ? drop.top + drop.height + 8 : fromY
  const path = `M ${fromX} ${fromY} C ${fromX} ${(fromY + toY) / 2} ${toX} ${(fromY + toY) / 2} ${toX} ${toY}`
  const next = () => {
    if (replay !== null) {
      onReplay(step === 7 ? null : step === 5 ? 7 : step === -1 ? 1 : step + 1)
      return
    }
    void advance()
  }
  return createPortal(
    <div data-tutorial-layer="true">
      <svg className="tutorial-shade" aria-hidden="true" focusable="false">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
            <rect width="100%" height="100%" fill="white" />
            <g fill="black">{windows}</g>
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="#14243e" opacity="0.38" mask={`url(#${maskId})`} />
        <g className="tutorial-focus" fill="none" stroke="#ffe8a6" strokeWidth="2">
          {windows}
        </g>
      </svg>
      {drop && (
        <svg
          className="tutorial-drag-path"
          aria-hidden="true"
          width={innerWidth}
          height={innerHeight}
        >
          <path d={path} fill="none" stroke="#ffe17d" strokeWidth="3" strokeDasharray="5 5" />
          <path
            d={`M ${toX - 6} ${toY + 8} L ${toX} ${toY} L ${toX + 6} ${toY + 8}`}
            fill="none"
            stroke="#ffe17d"
            strokeWidth="3"
          />
          <circle
            className="tutorial-drag-dot"
            r="6"
            fill="#fff9e9"
            stroke="#c78b28"
            strokeWidth="2"
          >
            <animateMotion dur="1.8s" repeatCount="indefinite" path={path} />
          </circle>
        </svg>
      )}
      {drop && (
        <small
          className="tutorial-drop-label"
          aria-hidden="true"
          style={{ left: Math.max(8, drop.left), top: drop.top - 22 }}
        >
          여기에 놓기
        </small>
      )}
      <aside
        ref={bubble}
        className="idle-tutorial"
        data-testid="idle-tutorial"
        data-step={step}
        data-target={focus.target}
        data-drop-target={drop?.target}
        data-side={above ? 'above' : 'below'}
        aria-label="첫 출근 안내"
        style={{ left, top, width }}
      >
        {!focus.battle && !focus.drop && (
          <i
            className="tutorial-tail"
            aria-hidden="true"
            style={{
              left: Math.max(18, Math.min(width - 28, focus.left + focus.width / 2 - left)),
            }}
          />
        )}
        <small>
          {replay !== null ? '다시 보기' : `${step === -1 ? 1 : Math.min(step + 1, 7)} / 7`}
        </small>
        <p aria-live="polite">{focus.text}</p>
        {error && <p role="alert">{error}</p>}
        <div className="tutorial-coach-actions">
          {action && (
            <button type="button" disabled={busy} onClick={next}>
              {action}
            </button>
          )}
          {error && !action && [1, 3, 5].includes(step) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                attempted.current = null
                void advance()
              }}
            >
              다시 시도
            </button>
          )}
          {replay !== null && (
            <button
              type="button"
              className="tutorial-skip"
              disabled={busy}
              onClick={() => onReplay(null)}
            >
              안내 닫기
            </button>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  )
}
