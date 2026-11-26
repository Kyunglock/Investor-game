import { useLayoutEffect } from 'react'

/** 안내 말풍선과 설정, 뽑기 연출은 늘 누를 수 있다. */
const ALWAYS = [
  '[data-testid="idle-tutorial"]',
  '[data-testid="idle-options"]',
  '.idle-options-panel',
  '[data-testid="cat-reveal"]',
  '[data-testid="weapon-reveal"]',
]

/** 첫 출근 안내 중에는 비춘 곳(과 놓을 곳) 말고는 누르지 못하게 한다. */
export function useTutorialClickGuard(targets: (string | undefined)[]) {
  const key = targets.filter(Boolean).join('\n')
  useLayoutEffect(() => {
    if (!key) return
    const allowed = [...key.split('\n'), ...ALWAYS].join(', ')
    const stop = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(allowed)) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const events = ['pointerdown', 'mousedown', 'touchstart', 'click'] as const
    for (const type of events)
      document.addEventListener(type, stop, { capture: true, passive: false })
    return () => {
      for (const type of events) document.removeEventListener(type, stop, true)
    }
  }, [key])
}
