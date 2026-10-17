import type { Game, PendingEvent } from '../../api/client'

const KIND_LABELS: Record<PendingEvent['kind'], string> = {
  JOB: '직업',
  TRAIT: '선택의 순간',
  OFFER: '제안',
  NEWS: '뉴스',
}

interface Props {
  event: PendingEvent
  game: Game
  busy: boolean
  onChoose: (option: string) => void
}

/** 선택형 이벤트. 스킵할 수 없다 (decisions.md). */
export function EventCard({ event, game, busy, onChoose }: Props) {
  const isNews = event.kind === 'NEWS'
  const holding = game.holdings.some((h) => h.sectorCode === event.sectorCode)

  return (
    <section
      className="rounded-2xl border-2 border-blue-500 bg-white p-6 shadow-md"
      data-testid="event-card"
      data-kind={event.kind}
    >
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">
          {KIND_LABELS[event.kind]}
        </span>
        {event.sectorName && <span className="text-slate-500">{event.sectorName}</span>}
      </div>
      <h2 className="text-xl font-bold leading-snug">{event.title}</h2>
      <p className="mt-2 text-slate-600">{event.body}</p>

      {isNews && event.hint && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-amber-800" data-testid="hint">
          💭 {event.hint}
        </p>
      )}
      {isNews && event.sway && (
        <div className="mt-3 border-l-4 border-slate-300 pl-3 text-sm text-slate-600">
          <p className="text-xs text-slate-400">다른 뉴스</p>
          <p>{event.sway}</p>
        </div>
      )}

      <div className={`mt-6 grid gap-2 ${isNews ? 'grid-cols-3' : 'grid-cols-1'}`}>
        {event.options.map((option) => (
          <button
            key={option.code}
            type="button"
            disabled={busy || (isNews && option.code === 'SELL' && !holding)}
            className="min-h-12 rounded-xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            onClick={() => onChoose(option.code)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  )
}
