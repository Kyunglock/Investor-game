import { useState } from 'react'
import type { Game, PendingEvent } from '../../api/client'
import { won, yearOf } from './labels'
import { Overlay } from './Overlay'

const KIND_LABELS: Record<PendingEvent['kind'], string> = {
  JOB: '직업',
  TRAIT: '일상',
  OFFER: '제안',
  NEWS: '뉴스',
}

interface Props {
  event: PendingEvent
  game: Game
  busy: boolean
  onChoose: (option: string) => void
}

/** 선택형 이벤트 카드. 스킵할 수 없고, 뉴스일 때는 화면을 어둡게 한다 (설계 5.3절). */
export function DecisionCard(props: Props) {
  const isNews = props.event.kind === 'NEWS'
  const card = <Body {...props} />
  return isNews ? <Overlay>{card}</Overlay> : card
}

function Body({ event, game, busy, onChoose }: Props) {
  const isNews = event.kind === 'NEWS'
  const holding = game.holdings.find((h) => h.sectorCode === event.sectorCode)
  const age = game.startAge + Math.floor(event.occursDay / game.daysPerYear)
  const [picked, setPicked] = useState<string | null>(null)

  return (
    <section
      className="rounded-md border border-line bg-card px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
      data-testid="event-card"
      data-kind={event.kind}
    >
      <div className="flex items-baseline justify-between text-[11px] font-bold text-wine">
        <span>
          {KIND_LABELS[event.kind]}
          {event.sectorName && ` · ${event.sectorName}`}
        </span>
        <span className="font-mono-num font-normal text-faint">
          {age}세 · {yearOf(age)}년
        </span>
      </div>
      <h2 className="mt-2 font-serif-kr text-[22px] font-black leading-snug">{event.title}</h2>
      <p className="mt-1.5 text-[13px]">{event.body}</p>

      {isNews && event.hint && (
        <p
          className="mt-3 border-l-[3px] border-teal bg-teal-soft px-2.5 py-2 font-mono-num text-xs text-[#3b5a52]"
          data-testid="hint"
        >
          힌트 · {event.hint}
        </p>
      )}
      {isNews && event.sway && (
        <div className="mt-2.5 border-l-[3px] border-line px-2.5 py-1.5 text-xs text-muted">
          <p className="text-[10px] text-faint">다른 뉴스</p>
          <p>{event.sway}</p>
        </div>
      )}

      <div className={`mt-3 grid gap-2 ${isNews ? 'grid-cols-3' : 'grid-cols-1'}`}>
        {event.options.map((option) => {
          const disabled = busy || (isNews && option.code === 'SELL' && !holding)
          const sub =
            isNews && option.code === 'BUY'
              ? `현금 ${won(game.cash)}`
              : isNews && option.code === 'SELL' && holding
                ? `보유 ${won(holding.amount)}`
                : null
          return (
            <button
              key={option.code}
              type="button"
              disabled={disabled}
              className={`min-h-12 rounded border px-2 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                picked === option.code
                  ? 'border-wine bg-wine-soft'
                  : 'border-line bg-card hover:bg-bg'
              }`}
              onClick={() => {
                setPicked(option.code)
                onChoose(option.code)
              }}
            >
              {option.label}
              {sub && (
                <span className="block font-mono-num text-[11px] font-normal text-faint">
                  {sub}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] text-faint">
        선택은 당신이 하지만, 실행은 당신의 성격이 합니다.
      </p>
    </section>
  )
}
