import type { Phase, Stats } from '../../api/client'
import { ageAt, SPEEDS } from './clock'
import { useGameStore } from './store'
import { useGameClock } from './useGameClock'

const STAT_LABELS: Record<keyof Stats, string> = {
  insight: '안목',
  patience: '인내심',
  courage: '용기',
  conviction: '줏대',
  luck: '운',
}

const PHASE_LABELS: Record<Phase, string> = {
  SAVING: '저축 중',
  INVESTING: '투자 중',
  ENDED: '종료',
}

const won = new Intl.NumberFormat('ko-KR')

export function GameScreen() {
  useGameClock()
  const game = useGameStore((s) => s.game)
  const day = useGameStore((s) => s.day)
  const reportedDay = useGameStore((s) => s.reportedDay)
  const running = useGameStore((s) => s.running)
  const speed = useGameStore((s) => s.speed)
  const { pause, resume, setSpeed, born } = useGameStore.getState()

  if (!game) {
    return null
  }
  const age = ageAt(game.startAge, day, game.daysPerYear)

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-xl bg-neutral-800 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold" data-testid="age">
            {age.years}세 {age.months}개월
          </p>
          <p className="text-sm text-neutral-400">{PHASE_LABELS[game.phase]}</p>
        </div>
        <p className="mt-2 text-lg" data-testid="cash">
          현금 {won.format(game.cash)}원
        </p>
      </section>

      <section className="grid grid-cols-5 gap-2 rounded-xl bg-neutral-800 p-4 text-center">
        {(Object.keys(STAT_LABELS) as (keyof Stats)[]).map((key) => (
          <div key={key} data-testid={`stat-${key}`}>
            <p className="text-xs text-neutral-400">{STAT_LABELS[key]}</p>
            <p className="text-lg font-semibold">{game.stats[key]}</p>
          </div>
        ))}
      </section>

      <section className="flex gap-2">
        <button
          type="button"
          className="min-h-11 flex-1 rounded-lg bg-blue-500 font-semibold"
          onClick={running ? pause : resume}
        >
          {running ? '일시정지' : '계속'}
        </button>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={speed === s}
            className={`min-h-11 min-w-14 rounded-lg ${speed === s ? 'bg-blue-500' : 'bg-neutral-700'}`}
            onClick={() => setSpeed(s)}
          >
            {s}배속
          </button>
        ))}
      </section>

      <button
        type="button"
        className="min-h-11 rounded-lg bg-neutral-700"
        onClick={() => {
          void born()
        }}
      >
        다시 시작하기
      </button>

      <p className="text-center text-xs text-neutral-500" data-testid="reported-day">
        서버 확인: {reportedDay}일
      </p>
    </div>
  )
}
