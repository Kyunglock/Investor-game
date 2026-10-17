import type { Game } from '../../api/client'
import { SPEEDS } from './clock'
import { EventCard } from './EventCard'
import { OutcomeCard } from './OutcomeCard'
import { StatusPanel } from './StatusPanel'
import { useGameStore } from './store'
import { useGameClock } from './useGameClock'

export function GameScreen({ game }: { game: Game }) {
  useGameClock()
  const day = useGameStore((s) => s.day)
  const outcome = useGameStore((s) => s.outcome)
  const running = useGameStore((s) => s.running)
  const speed = useGameStore((s) => s.speed)
  const choosing = useGameStore((s) => s.choosing)
  const { choose, dismissOutcome, pause, resume, setSpeed } = useGameStore.getState()

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <StatusPanel game={game} day={day} />

      {/* 모바일에서는 이벤트가 먼저 보이게 위로 올린다. 데스크톱에서는 오른쪽 칸이다. */}
      <div className="order-first flex flex-col gap-4 lg:order-none">
        {outcome ? (
          <OutcomeCard outcome={outcome} onContinue={dismissOutcome} />
        ) : game.pendingEvent ? (
          <EventCard
            event={game.pendingEvent}
            game={game}
            busy={choosing}
            onChoose={(option) => {
              void choose(option)
            }}
          />
        ) : (
          <section className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            <p className="text-lg">{running ? '시간이 흐르고 있습니다…' : '일시정지'}</p>
            <p className="mt-1 text-sm">
              {game.phase === 'INVESTING'
                ? '다음 뉴스를 기다리는 중'
                : game.job
                  ? '월급을 모으며 살아가는 중'
                  : '첫 직장을 찾는 중'}
            </p>
          </section>
        )}

        {/* 이벤트나 결과가 떠 있는 동안 시계는 멈춰 있으므로 조작 버튼을 숨긴다. */}
        {!game.pendingEvent && !outcome && (
          <div className="flex gap-2">
            <button
              type="button"
              className="min-h-12 flex-1 rounded-xl bg-white font-semibold shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              onClick={running ? pause : resume}
            >
              {running ? '일시정지' : '계속'}
            </button>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={speed === s}
                className={`min-h-12 min-w-16 rounded-xl font-semibold ring-1 ${
                  speed === s
                    ? 'bg-slate-900 text-white ring-slate-900'
                    : 'bg-white ring-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => setSpeed(s)}
              >
                {s}배속
              </button>
            ))}
          </div>
        )}
        <p className="text-center text-xs text-slate-400" data-testid="reported-day">
          서버 확인: {game.day}일
        </p>
      </div>
    </div>
  )
}
