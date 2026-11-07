import type { Company } from '../../api/client'
import { money, withParticle } from '../game/labels'
import { Overlay } from '../game/Overlay'
import { useRaisingStore } from './store'

/**
 * 사표 (decisions.md 282번). 연봉 협상을 동결하거나 답하지 않고 버텨 떠날 확률이 터지면, 바로 떠나지 않고 사표를 들고 온다: 연봉을 크게 올려 붙잡거나
 * 보낸다. 답하지 않고 다음 분기를 넘기면 떠난다. 연봉 메시지를 놓친 사장에게 주는 마지막 기회다.
 */
export function ResignAlert({ resign }: { resign: NonNullable<Company['resign']> }) {
  const busy = useRaisingStore((s) => s.busy)
  const { answerResign } = useRaisingStore.getState()
  return (
    <Overlay>
      <section
        className="animate-pop rounded border-2 border-wine bg-card p-5 text-center shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-label="사표"
        data-testid="resign"
      >
        <p className="text-[40px] leading-none" aria-hidden="true">
          ✉️
        </p>
        <h2 className="mt-2 font-pen text-[24px] leading-tight">{resign.name}의 사표</h2>
        <p className="mt-2 text-[15px]" data-testid="resign-line">
          {resign.line}
        </p>
        <p className="mt-2 text-[12px] text-muted">
          답하지 않고 다음 분기를 넘기면 {withParticle(resign.name, '은', '는')} 떠납니다. 마지막
          기회입니다.
        </p>
        <div className="mt-3 grid gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void answerResign(true)}
            className="min-h-12 rounded bg-wine font-semibold text-white disabled:opacity-50"
          >
            연봉 올려 주고 붙잡는다 · 연 {money(resign.before)} → {money(resign.after)}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void answerResign(false)}
            className="min-h-11 rounded border border-line text-[14px] disabled:opacity-50"
          >
            보낸다
          </button>
        </div>
      </section>
    </Overlay>
  )
}
