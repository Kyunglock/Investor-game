import { type ReactNode, useEffect, useEffectEvent, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

/** 아래에서 올라오는 시트 (decisions.md 309번). 바깥을 누르면 닫힌다. body에 바로 그린다(장면의 transform 안에 fixed가 갇히지 않게). */
export function Sheet({
  title,
  onClose,
  children,
  testId,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  testId?: string
}) {
  const dialog = useRef<HTMLElement>(null)
  const titleId = useId()
  const dismiss = useEffectEvent(onClose)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = dialog.current
    root?.focus()
    const keydown = (event: KeyboardEvent) => {
      // native dialog가 위에 열려 있으면 포커스와 Escape는 그 모달이 처리한다.
      if (document.querySelector('dialog[open]')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        dismiss()
      }
      if (event.key !== 'Tab' || !root) return
      const controls = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ),
      )
      const first = controls[0]
      const last = controls.at(-1)
      if (!first) {
        event.preventDefault()
        root.focus()
        return
      }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        event.preventDefault()
        last?.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === root)
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      previous?.focus()
    }
  }, [])
  return createPortal(
    <div className="fixed inset-0 z-30 flex flex-col justify-end bg-[rgba(20,22,26,0.5)]">
      <button type="button" aria-label="닫기" className="flex-1" onClick={onClose} />
      <section
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sheet-up safe-bottom max-h-[82dvh] overflow-y-auto rounded-t-2xl bg-card px-4 pt-2 pb-4 shadow-2xl"
        data-testid={testId}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-center justify-between gap-2">
          <h3 id={titleId} className="font-pen text-[22px] leading-tight">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 shrink-0 rounded-full px-3 text-[13px] text-muted"
          >
            닫기 ✕
          </button>
        </div>
        <div className="mt-2">{children}</div>
      </section>
    </div>,
    document.body,
  )
}
