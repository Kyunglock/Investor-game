import type { Company } from '../../api/client'
import { shortWon } from '../game/labels'
import { useRaisingStore } from './store'

type Invest = NonNullable<Company['invest']>

const STUBBORN: Record<string, { label: string; tone: string }> = {
  LOW: { label: '고집 낮음', tone: 'border-line text-muted' },
  MID: { label: '고집 보통', tone: 'border-gold text-gold' },
  HIGH: { label: '고집 높음 · 제멋대로 할지도', tone: 'border-wine text-wine' },
}

/** 사장 말대로 한 직원은 문장이 이미 말하므로 표를 붙이지 않는다. */
const FOLLOW: Record<string, { label: string; tone: string }> = {
  OWN: { label: '제멋대로', tone: 'bg-wine text-white' },
  SWAY: { label: '꼬드김', tone: 'bg-gold text-white' },
}

/** 이익은 빨강, 손실은 파랑 (한국 증시 색). */
function signed(amount: number): string {
  return `${amount > 0 ? '+' : ''}${shortWon(amount)}`
}

/**
 * 투자 회의 (decisions.md 229번). 단서 기사를 놓고 직원들과 고민한다. 리서치 팀이 형광펜을 긋고, 자리에 앉은 직원이 한마디씩 하고(고집이 센 직원은 미리
 * 티가 난다), 사장이 고른다. 돈을 굴리는 직원 몇 명은 "제가 알아서 할게요" 하고 제 판단대로 한다.
 */
export function InvestPanel({ invest }: { invest: Invest }) {
  const busy = useRaisingStore((s) => s.busy)
  const { decideInvest } = useRaisingStore.getState()
  const outcome = invest.outcome
  return (
    <section className="mt-5 border-t border-line-soft pt-4" data-testid="invest">
      <h3 className="font-pen text-[22px]">투자 회의</h3>
      <article className="mt-2 rounded border border-line bg-card p-3">
        <p className="text-[12px] text-muted">
          {invest.sectorName} · {invest.stockName}
        </p>
        <h4 className="mt-0.5 font-semibold text-[16px]">{invest.title}</h4>
        <p className="mt-2 text-[14px] leading-relaxed" data-testid="invest-article">
          {invest.sentences.map((s, i) => (
            <span
              // 문장 순서는 회의 내내 그대로다.
              // biome-ignore lint/suspicious/noArrayIndexKey: 같은 문장이 두 번 나오지 않지만 순서가 곧 정체다
              key={i}
              className={`${s.highlighted ? 'bg-sticky' : ''} ${
                outcome && outcome.decisive === i ? 'underline decoration-wine decoration-2' : ''
              }`}
              data-highlighted={s.highlighted}
            >
              {s.text}{' '}
            </span>
          ))}
        </p>
        {invest.highlightBy && (
          <p className="mt-1 text-[12px] text-muted">형광펜: 리서치 팀 {invest.highlightBy}</p>
        )}
        <p className="mt-2 rounded border border-line-soft px-2 py-1 text-[13px]">
          <b>{invest.sway.who}</b>: “{invest.sway.text}”
        </p>
      </article>

      {invest.remarks.length > 0 && (
        <ul className="mt-2 grid gap-1" data-testid="remarks">
          {invest.remarks.map((r) => (
            <li key={r.employeeId} className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
              <b>{r.name}</b>
              <span>“{r.text}”</span>
              {r.stubborn && (
                <span
                  className={`rounded border px-1 text-[11px] ${STUBBORN[r.stubborn].tone}`}
                  data-testid="stubborn"
                >
                  {STUBBORN[r.stubborn].label}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!outcome && (
        <>
          {!invest.ready && (
            <p className="mt-2 text-[13px] text-muted">
              바이오·단타 데스크에 사람을 앉혀야 회의를 엽니다.
            </p>
          )}
          <div className="mt-2 grid grid-cols-3 gap-2">
            {invest.options.map((o) => (
              <button
                key={o.code}
                type="button"
                disabled={busy || !invest.ready}
                onClick={() => void decideInvest(o.code)}
                className="min-h-12 rounded border border-pen font-semibold hover:bg-pen hover:text-white disabled:opacity-50"
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}

      {outcome && (
        <div className="mt-3" data-testid="invest-outcome">
          <p className="font-semibold text-[15px]">
            {outcome.reveal}{' '}
            <span className={outcome.total >= 0 ? 'text-up' : 'text-down'}>
              회의 손익 {signed(outcome.total)}
            </span>
          </p>
          <ul className="mt-2 grid gap-1">
            {outcome.results.map((r) => (
              <li
                key={r.employeeId}
                className="flex flex-wrap items-baseline justify-between gap-x-2 rounded border border-line-soft px-2 py-1 text-[14px]"
                data-follow={r.follow}
                data-testid="invest-result"
              >
                <span>
                  {r.follow !== 'BOSS' && (
                    <span className={`mr-1 rounded px-1 text-[11px] ${FOLLOW[r.follow].tone}`}>
                      {FOLLOW[r.follow].label}
                    </span>
                  )}
                  <b>{r.name}</b> {r.line}
                </span>
                <b className={r.pnl >= 0 ? 'text-up' : 'text-down'}>{signed(r.pnl)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
