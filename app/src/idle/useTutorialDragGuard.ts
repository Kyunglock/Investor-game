import { useLayoutEffect } from 'react'

/** 드래그 연습 중에는 화면과 목표를 고정하고, 집을 아이템만 입력을 받는다. */
export function useTutorialDragGuard(source?: string, destination?: string) {
  useLayoutEffect(() => {
    if (!source || !destination) return
    const item = document.querySelector<HTMLElement>(source)
    const target = document.querySelector<HTMLElement>(destination)
    if (!item || !target) return
    document.body.dataset.tutorialDragLock = 'true'
    target.dataset.tutorialDrop = 'true'
    const coach = (event: Event) =>
      event.target instanceof Element && !!event.target.closest('[data-testid="idle-tutorial"]')
    const stop = (event: Event) => {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const down = (event: PointerEvent) => {
      if (!coach(event) && !(event.target instanceof Node && item.contains(event.target)))
        stop(event)
    }
    // 아이템을 탭해 상세창을 열거나, 놓은 직후 다른 버튼이 눌리는 것도 막는다.
    const click = (event: MouseEvent) => {
      if (!coach(event)) stop(event)
    }
    const scroll = (event: Event) => event.preventDefault()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        stop(event)
        const controls = [
          item,
          ...document.querySelectorAll<HTMLElement>(
            '[data-testid="idle-tutorial"] button:not(:disabled)',
          ),
        ]
        const index = controls.indexOf(document.activeElement as HTMLElement)
        const next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length
        controls[next]?.focus({ preventScroll: true })
      } else if (
        event.key === 'Escape' ||
        (!coach(event) &&
          [
            'Enter',
            ' ',
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'PageUp',
            'PageDown',
            'Home',
            'End',
          ].includes(event.key))
      )
        stop(event)
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('click', click, true)
    document.addEventListener('wheel', scroll, { passive: false, capture: true })
    document.addEventListener('touchmove', scroll, { passive: false, capture: true })
    document.addEventListener('keydown', key, true)
    return () => {
      delete document.body.dataset.tutorialDragLock
      delete target.dataset.tutorialDrop
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('click', click, true)
      document.removeEventListener('wheel', scroll, true)
      document.removeEventListener('touchmove', scroll, true)
      document.removeEventListener('keydown', key, true)
    }
  }, [source, destination])
}
