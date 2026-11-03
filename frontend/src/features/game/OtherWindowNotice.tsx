import { useState } from 'react'
import { takeOver, useWindowRole } from '../../api/window'
import { useGameStore } from './store'

/**
 * 한 판은 한 창만 (#189). 다른 탭·창·기기가 이 판을 진행하는 동안 이 창은 보기 전용이다. 시계는 멈춰 있고, 누르면 이 창이 판을 넘겨받는다
 * (다른 창은 다음 보고 때 보기 전용이 된다).
 */
export function OtherWindowNotice() {
  const role = useWindowRole((s) => s.role)
  const [busy, setBusy] = useState(false)
  if (role === 'primary') {
    return null
  }
  const takeHere = async () => {
    setBusy(true)
    await takeOver()
    await useGameStore.getState().load()
    setBusy(false)
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(29,38,38,0.55)] px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="other-window-title"
      data-testid="other-window"
    >
      <div className="w-full max-w-sm rounded bg-paper px-6 py-6 text-center font-note text-pen shadow-lg">
        <p id="other-window-title" className="font-pen text-[28px] leading-8">
          다른 창에서 진행 중입니다
        </p>
        <p className="mt-2 text-[14px] text-pen-soft">
          {role === 'tab'
            ? '이 브라우저의 다른 탭에서 이 판이 흘러가고 있다. 한 판은 한 창에서만 진행된다.'
            : '다른 창이나 기기에서 이 판을 이어 가고 있다. 한 판은 한 창에서만 진행된다.'}
        </p>
        <button
          type="button"
          disabled={busy}
          className="mt-5 min-h-[52px] w-full rounded-full bg-pen text-[16px] text-white hover:opacity-90 disabled:opacity-40"
          onClick={() => void takeHere()}
          data-testid="take-over"
        >
          {busy ? '넘겨받는 중…' : '이 창에서 이어하기'}
        </button>
      </div>
    </div>
  )
}
