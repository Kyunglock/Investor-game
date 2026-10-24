import { useEffect } from 'react'
import { signedWon } from './labels'
import { momentForNotice } from './moments'
import { toastText } from './notices'
import { layersFor } from './pixel/layers'
import { Vignette } from './pixel/Vignette'
import { useGameStore } from './store'

const SHOW_MS = 4_000
/** 그림이 붙은 알림은 조금 더 오래 */
const MOMENT_MS = 6_000

/**
 * 알림 토스트: 생활 이벤트·집이 팔림·세입자 교체·세상 소식(전조·기사·위기 회고)을 상단 오른쪽에 4초씩, 한꺼번에 오면 하나씩 차례로 띄운다. 멈추지 않고
 * 지나간다 (경제 개편 설계 11.5절). 세상 소식은 수첩의 "요즘 있었던 일"에서 다시 볼 수 있다 (#24, decisions.md 47번).
 */
export function Toast() {
  const notice = useGameStore((s) => s.notices[0] ?? null)
  const dismiss = useGameStore((s) => s.dismissNotice)
  const game = useGameStore((s) => s.game)
  // 가족 여행 같은 순간은 그림이 붙고 조금 더 오래 남는다 (decisions.md 62번).
  const moment = notice ? momentForNotice(notice) : null

  useEffect(() => {
    if (!notice) {
      return
    }
    const id = setTimeout(dismiss, moment ? MOMENT_MS : SHOW_MS)
    return () => clearTimeout(id)
  }, [notice, dismiss, moment])

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
        {moment && game && (
          <span className="mb-1.5 block w-[256px]">
            <Vignette
              art={moment.art}
              me={layersFor(
                game.initialStats,
                game.stats,
                game.startAge + Math.floor(game.day / game.daysPerYear),
              )}
              mood={moment.mood}
            />
          </span>
        )}
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
