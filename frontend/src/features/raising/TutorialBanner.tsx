import { useEffect } from 'react'
import type { Company } from '../../api/client'
import { useRaisingStore } from './store'
import {
  type Feature,
  TUTORIAL_STEPS,
  tutorialStep,
  unlockedFeatures,
  useTutorial,
} from './tutorial'

/**
 * 튜토리얼 띠 (decisions.md 302번): 회사 화면 머리에 지금 걸음(1~5)과 할 일을 보인다. 걸음은 회사 상태가 정하고(직원을 뽑으면 다음 걸음으로), 걸음이 탭을 가리키면
 * 그 탭을 열어 준다. 건너뛰기·끝내기를 누르면 브라우저에 남아 다시 보이지 않는다.
 */
export function TutorialBanner({ company }: { company: Company }) {
  const active = useTutorial((s) => s.active)
  const { finish } = useTutorial.getState()
  const step = tutorialStep(company)
  const ended = company.status === 'ENDED'
  // 걸음이 바뀌어 탭을 가리키면 한 번 열어 준다. 그 뒤로 사장이 다른 탭을 봐도 되돌리지 않는다.
  useEffect(() => {
    if (active && !ended && step.tab) {
      useRaisingStore.setState({ tab: step.tab })
    }
  }, [active, ended, step.tab])
  if (!active || ended) {
    return null
  }
  const last = step.n === TUTORIAL_STEPS
  return (
    <section
      className="mt-2 rounded border-2 border-teal bg-teal/10 px-3 py-2"
      aria-label="튜토리얼"
      data-testid="tutorial"
      data-step={step.id}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-bold text-teal">
          튜토리얼 {step.n}/{TUTORIAL_STEPS} · {step.title}
        </p>
        <button
          type="button"
          onClick={finish}
          className="min-h-8 shrink-0 rounded px-2 text-[12px] text-muted underline"
        >
          {last ? '끝내기' : '건너뛰기'}
        </button>
      </div>
      <p className="mt-1 text-[13px]">{step.text}</p>
      {last && (
        <button
          type="button"
          onClick={finish}
          className="mt-2 min-h-9 rounded bg-teal px-3 text-[13px] font-semibold text-white"
        >
          알겠어요, 이제 혼자 할게요
        </button>
      )}
    </section>
  )
}

/** 튜토리얼이 아직 열지 않은 것인가 (347번). 꺼져 있으면 모두 열려 있다. */
export function useLocked(company: Company, feature: Feature): boolean {
  const active = useTutorial((s) => s.active)
  return !unlockedFeatures(company, active).includes(feature)
}

/** 지금 걸음이 가리키는 것이면 반짝이는 테두리 클래스. 튜토리얼이 꺼져 있으면 빈 문자열. */
export function useTutorialSpot(company: Company, spot: 'market' | 'staff' | 'settle' | 'upgrade') {
  const active = useTutorial((s) => s.active)
  if (!active || company.status === 'ENDED') {
    return ''
  }
  return tutorialStep(company).spot === spot ? 'ring-2 ring-teal ring-offset-2 animate-glow' : ''
}
