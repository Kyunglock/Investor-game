import { useState } from 'react'
import type { Game } from '../../api/client'
import { ageAt, secondsPerYear } from './clock'
import { yearOf } from './labels'
import { nickname } from './nickname'
import { useGameStore } from './store'

interface Props {
  game: Game | null
  running: boolean
  /** 선택·결과 카드가 떠 있어 시계가 멈춰 있을 때. 버튼은 보이되 눌리지 않는다 */
  controlsDisabled: boolean
  showControls: boolean
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  /** 투자 인생을 여기서 끝낸다 (decisions.md 68번). 두 번 눌러 확인한다 */
  onQuit: () => void
}

const buttonBase =
  'min-h-11 min-w-11 rounded-full border-2 border-pen px-3 font-note text-sm bg-paper text-pen hover:bg-white disabled:cursor-not-allowed disabled:opacity-40'

/** 제목, 나이, 연도 (설계 5.1절). 배속은 없다: 정배속만 있다. 나이 글자는 E2E가 보는 `{n}세 {m}개월` 형식을 유지한다. */
export function TopBar({
  game,
  running,
  controlsDisabled,
  showControls,
  onPause,
  onResume,
  onRestart,
  onQuit,
}: Props) {
  // 0.1초마다 바뀌는 day는 여기서만 구독한다. App이 구독하면 진행 화면 전체가 틱마다 다시 그려진다.
  const day = useGameStore((s) => s.day)
  // 끝내기는 한 번 누르면 확인을 묻고, 다시 누르면 끝낸다. 다른 버튼을 누르면 묻기를 거둔다.
  const [confirmQuit, setConfirmQuit] = useState(false)
  const age = game ? ageAt(game.startAge, day, game.daysPerYear) : null
  const progress =
    game && age ? Math.min(1, (age.years - game.startAge) / (game.endAge - game.startAge)) : 0

  return (
    <header>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-5 pb-1 text-pen md:px-6">
        <h1 className="font-pen text-[32px] font-normal leading-none">투자자 시뮬레이터</h1>
        {game && age && showControls && (
          <>
            <p className="font-pen text-[34px] leading-none" data-testid="age">
              {age.years}세 {age.months}개월
            </p>
            <div className="font-note text-xs text-pen-soft">
              {yearOf(age.years)}년 · {nickname(game.initialStats).name} ·{' '}
              <span data-testid="happiness">행복 {game.happiness}</span> · 1년 ≈{' '}
              {secondsPerYear(game.phase)}초
              <span className="mt-1 block h-[3px] w-40 overflow-hidden rounded-full bg-[var(--ruled)]">
                <span className="block h-full bg-red-pen" style={{ width: `${progress * 100}%` }} />
              </span>
            </div>
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                className={buttonBase}
                disabled={controlsDisabled}
                onClick={() => {
                  setConfirmQuit(false)
                  ;(running ? onPause : onResume)()
                }}
              >
                {running ? '❚❚ 멈춤' : '▶ 계속'}
              </button>
              <button
                type="button"
                className={`${buttonBase} ${confirmQuit ? 'border-red-pen text-red-pen' : ''}`}
                disabled={controlsDisabled}
                onClick={() => {
                  if (confirmQuit) {
                    setConfirmQuit(false)
                    onQuit()
                  } else {
                    setConfirmQuit(true)
                  }
                }}
                data-testid="quit-button"
              >
                {confirmQuit ? '정말 끝낼까요?' : '여기서 끝내기'}
              </button>
              <button
                type="button"
                className={buttonBase}
                onClick={() => {
                  setConfirmQuit(false)
                  onRestart()
                }}
              >
                다시 태어나기
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
