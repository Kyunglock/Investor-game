import type { Game } from '../../api/client'
import { ageAt, SPEEDS, type Speed, secondsPerYear } from './clock'
import { yearOf } from './labels'
import { nickname } from './nickname'
import { useGameStore } from './store'

interface Props {
  game: Game | null
  running: boolean
  speed: Speed
  /** 선택·결과 카드가 떠 있어 시계가 멈춰 있을 때. 버튼은 보이되 눌리지 않는다 */
  controlsDisabled: boolean
  showControls: boolean
  onPause: () => void
  onResume: () => void
  onSpeed: (speed: Speed) => void
  onRestart: () => void
}

const buttonBase =
  'min-h-11 rounded px-3 text-sm ring-1 ring-line bg-card text-ink hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40'

/** 제목, 나이, 연도, 배속 (설계 5.1절). 나이 글자는 E2E가 보는 `{n}세 {m}개월` 형식을 유지한다. */
export function TopBar({
  game,
  running,
  speed,
  controlsDisabled,
  showControls,
  onPause,
  onResume,
  onSpeed,
  onRestart,
}: Props) {
  // 0.1초마다 바뀌는 day는 여기서만 구독한다. App이 구독하면 진행 화면 전체가 틱마다 다시 그려진다.
  const day = useGameStore((s) => s.day)
  const age = game ? ageAt(game.startAge, day, game.daysPerYear) : null
  const progress =
    game && age ? Math.min(1, (age.years - game.startAge) / (game.endAge - game.startAge)) : 0

  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-6">
        <h1 className="font-serif-kr text-base font-black">
          투자자 <span className="text-wine">시뮬레이터</span>
        </h1>
        {game && age && showControls && (
          <>
            <p className="font-serif-kr text-3xl font-black leading-none" data-testid="age">
              {age.years}세 {age.months}개월
            </p>
            <div className="text-xs text-muted">
              {yearOf(age.years)}년 · {nickname(game.initialStats).name} · 1년 ≈{' '}
              {secondsPerYear(game.phase) / speed}초
              <span className="mt-1 block h-[3px] w-40 overflow-hidden rounded-sm bg-line-soft">
                <span className="block h-full bg-wine" style={{ width: `${progress * 100}%` }} />
              </span>
            </div>
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                className={buttonBase}
                disabled={controlsDisabled}
                onClick={running ? onPause : onResume}
              >
                {running ? '❚❚ 멈춤' : '▶ 계속'}
              </button>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={speed === s}
                  disabled={controlsDisabled}
                  className={`${buttonBase} font-mono-num ${
                    speed === s ? 'bg-ink text-white ring-ink hover:bg-ink' : ''
                  }`}
                  onClick={() => onSpeed(s)}
                >
                  {s}×
                </button>
              ))}
              <button type="button" className={buttonBase} onClick={onRestart}>
                다시 시작
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
