import { useEffect } from 'react'
import { signedWon } from './labels'
import { toastText } from './notices'
import { useGameStore } from './store'

const SHOW_MS = 3_000

/**
 * 생활 알림(생활 이벤트·집이 팔림·세입자 교체)을 상단 오른쪽에 3초씩 띄운다. 한꺼번에 오면 하나씩 차례로 보여 준다. 멈추지 않고 지나간다 (경제 개편 설계
 * 11.5절). 세상 소식은 WorldNews가 맡는다 (#24).
 */
export function Toast() {
  const notice = useGameStore((s) => s.notices[0] ?? null)
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
  const text = toastText(notice)
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6">
      <output
        key={notice.seq}
        className="animate-reveal mt-2 ml-auto block w-fit rounded border border-line border-l-[3px] border-l-teal bg-card px-3 py-1.5 text-xs shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
        data-testid="notice-toast"
      >
        {text ?? (
          <>
            {String(p.title ?? '')} ·{' '}
            <b className={`font-mono-num ${amount < 0 ? 'text-down' : 'text-up'}`}>
              {signedWon(amount)}
            </b>
          </>
        )}
      </output>
    </div>
  )
}
