import type { Run, RunCard } from '../../api/client'
import { shortWon as won } from '../game/labels'
import { STAT_NAMES, STAT_ORDER } from './grades'
import { RunOutcomeCard } from './RunOutcomeCard'
import { useRaisingStore } from './store'

const KIND_LABELS: Record<RunCard['kind'], string> = {
  TRAIT: '성향',
  NEWS: '실전 매매',
  PRINCIPLE: '투자 원칙',
  RELEASE: '투자 원칙',
  BIG: '돈이 걸린 큰일',
  LEVERAGE: '돈이 걸린 큰일',
  EXAM: '입사 심사',
}

/**
 * 3분 육성 한 판 (증권사 육성 설계 3절). 위에는 수습 기간의 진행과 돈·등급, 가운데에 카드 한 장. 시계가 없어 카드를 고르면 다음 카드가 온다. 결과 카드는
 * 그 위에 뜬다.
 */
export function RunScreen({ run }: { run: Run }) {
  const outcome = useRaisingStore((s) => s.outcome)
  const busy = useRaisingStore((s) => s.busy)
  const { choose, dismissOutcome } = useRaisingStore.getState()
  return (
    <div className="mx-auto w-full max-w-xl font-note text-pen">
      <RunHeader run={run} />
      {run.current && (
        <CardView card={run.current} busy={busy || outcome !== null} onChoose={choose} />
      )}
      {outcome && <RunOutcomeCard outcome={outcome} run={run} onContinue={dismissOutcome} />}
    </div>
  )
}

function RunHeader({ run }: { run: Run }) {
  const step = Math.min(run.card + 1, run.cardCount)
  const change = run.totalAsset - run.fund
  return (
    <section className="rounded bg-paper p-4 shadow-[0_2px_0_#d5d2cb]" data-testid="run-header">
      <div className="flex items-baseline justify-between">
        <span className="font-pen text-[22px]">
          수습 기간 {step} / {run.cardCount}
        </span>
        <span className="font-mono-num text-[13px]" data-testid="total-asset">
          {won(run.totalAsset)}{' '}
          <span className={change >= 0 ? 'text-up' : 'text-down'}>
            ({change >= 0 ? '+' : ''}
            {((change / run.fund) * 100).toFixed(1)}%)
          </span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded bg-line-soft" aria-hidden="true">
        <div className="h-full bg-teal" style={{ width: `${(run.card / run.cardCount) * 100}%` }} />
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px]" data-testid="grades">
        {STAT_ORDER.map((code) => (
          <li key={code}>
            {STAT_NAMES[code]}{' '}
            <b className="font-mono-num" data-testid={`grade-${code}`}>
              {run.grades[code]}
            </b>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-muted">
        현금 {won(run.cash)}
        {run.debt > 0 && ` · 빚 ${won(run.debt)}`}
        {run.holdings.map((h) => ` · ${h.stockName} ${h.quantity.toLocaleString()}주`).join('')}
      </p>
      {run.devices.map((d) => (
        <p key={d.code} className="mt-1 text-[12px] text-wine" data-testid="device">
          원칙: {d.name} — {d.cost}
        </p>
      ))}
    </section>
  )
}

function CardView({
  card,
  busy,
  onChoose,
}: {
  card: RunCard
  busy: boolean
  onChoose: (option: string) => void
}) {
  return (
    <article
      className="mt-4 animate-reveal rounded bg-card p-5 shadow-[0_2px_0_#d5d2cb,0_16px_36px_rgba(34,53,92,0.14)]"
      data-testid="run-card"
      data-kind={card.kind}
    >
      <p className="text-[12px] text-muted">
        {KIND_LABELS[card.kind]}
        {card.stock && ` · ${card.stock.sectorName} · ${card.stock.name}`}
      </p>
      <h2 className="mt-1 font-serif-kr text-[20px] font-black leading-snug">{card.title}</h2>
      {card.tips.map((tip) => (
        <p
          key={tip}
          className="mt-3 rounded bg-sticky px-3 py-2 text-[13px] text-ink"
          data-testid="tip"
        >
          {tip}
        </p>
      ))}
      {card.omen && (
        <p className="mt-3 text-[14px] font-bold text-red-pen" data-testid="omen">
          <span className="mr-1 rounded bg-red-pen px-1 text-[11px] text-white">폭락 조짐</span>
          {card.omen}
        </p>
      )}
      {card.sentences.length > 0 ? (
        <Article card={card} />
      ) : (
        card.body && <p className="mt-3 text-[15px] leading-relaxed">{card.body}</p>
      )}
      {card.stock && (
        <p className="mt-3 font-mono-num text-[12px] text-muted">
          {card.stock.name} {card.stock.price.toLocaleString()}원 (수습 시작보다{' '}
          {card.stock.changeBp >= 0 ? '+' : ''}
          {(card.stock.changeBp / 100).toFixed(1)}%)
          {card.stock.held > 0 && ` · 가진 것 ${card.stock.held.toLocaleString()}주`}
        </p>
      )}
      {card.sway && (
        <p className="mt-3 rounded border border-line px-3 py-2 text-[13px]" data-testid="sway">
          <b>{card.sway.who}</b>: “{card.sway.text}”
        </p>
      )}
      <div className="mt-4 grid gap-2">
        {card.options.map((option) => (
          <button
            key={option.code}
            type="button"
            disabled={busy}
            onClick={() => onChoose(option.code)}
            className="min-h-12 rounded border border-pen px-3 py-2 text-left hover:bg-pen hover:text-white disabled:opacity-50"
            data-testid={`option-${option.code}`}
          >
            <span className="font-semibold">{option.label}</span>
            {option.detail && <span className="block text-[12px] opacity-75">{option.detail}</span>}
          </button>
        ))}
      </div>
    </article>
  )
}

/** 단서 기사 (투자 원칙 장치 설계 3.1절). 형광펜은 안목만큼만 맞는다: 그은 문장 옆 여백에 캐릭터의 메모가 붙는다. */
function Article({ card }: { card: RunCard }) {
  return (
    <div className="mt-3" data-testid="article">
      <p className="text-[15px] leading-relaxed">
        {card.sentences.map((s) =>
          s.highlighted ? (
            <mark key={s.text} className="bg-[#fff2a8] px-0.5 text-ink" data-testid="highlight">
              {s.text}{' '}
            </mark>
          ) : (
            <span key={s.text}>{s.text} </span>
          ),
        )}
      </p>
      {card.memo && (
        <p className="mt-2 font-pen text-[20px] text-blue-pen" data-testid="memo">
          ✎ {card.memo}
        </p>
      )}
    </div>
  )
}
