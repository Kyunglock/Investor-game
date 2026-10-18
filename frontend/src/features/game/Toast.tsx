import { useEffect } from 'react'
import { signedWon } from './labels'
import { useGameStore } from './store'

const SHOW_MS = 3_000

/** 알림성 생활 이벤트를 상단 오른쪽에 3초 띄운다. 멈추지 않고 지나간다 (경제 개편 설계 11.5절). */
export function Toast() {
  const notice = useGameStore((s) => s.lastNotice)
  const dismiss = useGameStore((s) => s.dismissNotice)

  useEffect(() => {
    if (!notice) {
      return
    }
    const id = setTimeout(dismiss, SHOW_MS)
    return () => clearTimeout(id)
  }, [notice, dismiss])

  if (!notice) {
    return null
  }
  const p = notice.payload as Record<string, unknown>
  const amount = typeof p.amount === 'number' ? p.amount : 0
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6">
      <output
        className="animate-reveal mt-2 ml-auto block w-fit rounded border border-line border-l-[3px] border-l-teal bg-card px-3 py-1.5 text-xs shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
        data-testid="notice-toast"
      >
        {String(p.title ?? '')} ·{' '}
        <b className={`font-mono-num ${amount < 0 ? 'text-down' : 'text-up'}`}>
          {signedWon(amount)}
        </b>
      </output>
    </div>
  )
}
