import type { Company } from '@web/api/client'
import { useRaisingStore } from '@web/features/raising/store'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tutorialReady } from './onboarding'
import { tutorialTargets, useTutorialFocus } from './tutorialFocus'
import { useTutorialDragGuard } from './useTutorialDragGuard'
import './onboarding-guide.css'

/** 기존 버튼에 스포트라이트를 비추는 코치마크. 실제 행동이 완료되면 서버에 다음 단계를 저장한다. */
export function IdleTutorial({
  company,
  replay,
  onReplay,
  onGo,
  menu,
  skillUse,
  onSkillUse,
}: {
  company: Company
  replay: number | null
  onReplay: (step: number | null) => void
  onGo: (menu: 'battle' | 'growth' | 'cats' | 'skills', gear?: boolean) => void
  menu: string
  skillUse: boolean
  onSkillUse: () => void
}) {
  const maskId = useId()
  const progress = company.idle?.onboarding
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const attempted = useRef<number | null>(null)
  const bubble = useRef<HTMLElement>(null)
  const [height, setHeight] = useState(110)
  const step = replay ?? progress?.step ?? 8
  const skillGuide = step >= 8 && !!progress?.skillsUnlocked && !progress.skillGuideSeen
  const active = !!progress && (step < 8 || skillGuide)
  const focus = useTutorialFocus(tutorialTargets(step, menu, skillUse), active)
  useTutorialDragGuard(focus?.drop ? focus.target : undefined, focus?.drop?.target)
  const ready = tutorialReady(company, step)
  const advance = () => useRaisingStore.getState().tutorial('next', progress?.step ?? 8)
  useEffect(() => {
    if (
      replay !== null ||
      !progress ||
      ![0, 1, 3, 5].includes(step) ||
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
  useEffect(() => {
    if (!skillGuide || !skillUse) return
    const used = () => void useRaisingStore.getState().tutorial('skills', 8)
    window.addEventListener('idle-active', used, { once: true })
    return () => window.removeEventListener('idle-active', used)
  }, [skillGuide, skillUse])
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
      ? 68
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
        : step === 6 && menu === 'battle'
          ? '메테오 확인했어요'
          : step === 7
            ? '안내 마치기'
            : skillGuide && menu === 'skills' && !skillUse
              ? '사용 위치 보기'
              : null
  const drop = focus.drop
  const fromX = focus.left + focus.width / 2
  const fromY = focus.top - 8
  const toX = drop ? drop.left + drop.width / 2 : fromX
  const toY = drop ? drop.top + drop.height + 8 : fromY
  const path = `M ${fromX} ${fromY} C ${fromX} ${(fromY + toY) / 2} ${toX} ${(fromY + toY) / 2} ${toX} ${toY}`
  const next = () => {
    if (replay !== null) {
      onReplay(step === 7 ? null : step + 1)
      return
    }
    if (skillGuide) {
      onSkillUse()
      return
    }
    void advance()
  }
  return createPortal(
    <div data-tutorial-layer="true">
      <svg className="tutorial-shade" aria-hidden="true" width={innerWidth} height={innerHeight}>
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            {[focus, ...(drop ? [drop] : [])].map((box) => (
              <rect
                key={box.target}
                x={box.left}
                y={box.top}
                width={box.width}
                height={box.height}
                rx="12"
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="#101e36ad" mask={`url(#${maskId})`} />
        {drop && (
          <>
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
          </>
        )}
      </svg>
      <div
        className="tutorial-focus"
        data-testid="tutorial-focus"
        data-target={focus.target}
        aria-hidden="true"
        style={{ left: focus.left, top: focus.top, width: focus.width, height: focus.height }}
      />
      {drop && (
        <>
          <div
            className="tutorial-focus"
            data-testid="tutorial-drop-focus"
            data-target={drop.target}
            aria-hidden="true"
            style={{ left: drop.left, top: drop.top, width: drop.width, height: drop.height }}
          />
          <small
            className="tutorial-drop-label"
            aria-hidden="true"
            style={{ left: Math.max(8, drop.left), top: drop.top - 22 }}
          >
            여기에 놓기
          </small>
        </>
      )}
      <aside
        ref={bubble}
        className="idle-tutorial"
        data-testid="idle-tutorial"
        data-step={step}
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
          {replay !== null ? '다시 보기' : skillGuide ? '스킬 해금' : `${step + 2} / 9`}
        </small>
        <p aria-live="polite">{focus.text}</p>
        {error && <p role="alert">{error}</p>}
        <div className="tutorial-coach-actions">
          {action && (
            <button type="button" disabled={busy} onClick={next}>
              {action}
            </button>
          )}
          {error && !action && [0, 1, 3, 5].includes(step) && (
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
          {(replay !== null || skillGuide) && (
            <button
              type="button"
              className="tutorial-skip"
              disabled={busy}
              onClick={() => {
                if (replay !== null) onReplay(null)
                else void useRaisingStore.getState().tutorial('skills', 8)
              }}
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
