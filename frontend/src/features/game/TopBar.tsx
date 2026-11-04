import type { Game } from '../../api/client'
import { ageAt } from './clock'
import { usePixelArt } from './pixelArt'
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
  /** 자동 진행 (decisions.md 131·185번). 선택 카드가 떠 있어도 켜고 끌 수 있다 */
  autoPlay: boolean
  onToggleAuto: () => void
}

// 색은 따로 붙인다. 같은 종류의 유틸리티(text-*·bg-*)를 겹쳐 쓰면 어느 쪽이 이기는지 CSS 순서에 달려 글자가 안 보일 수 있다 (decisions.md 136번).
const buttonBase =
  'min-h-11 min-w-11 rounded-full border-2 border-pen px-3 font-note text-sm disabled:cursor-not-allowed disabled:opacity-40'
const buttonPaper = 'bg-paper text-pen hover:bg-white'
const buttonInk = 'bg-pen text-paper hover:opacity-90'

/**
 * 진행 버튼(계속·자동·그림 끄기·다시 태어나기). 자동 버튼은 159번에서 뺐다가 185번에서 되살렸다. 제목·나이·연도·이름은 진행 중에는 띄우지 않는다 (decisions.md 159번, 설계 5.1절). 배속은 없다: 정배속만 있다. 나이 글자는 E2E가 보는 `{n}세 {m}개월` 형식을 유지한다. "여기서 끝내기"는
 * 사용자 요청으로 뺐다 (decisions.md 136번, API는 남아 있다).
 */
export function TopBar({
  game,
  running,
  controlsDisabled,
  showControls,
  onPause,
  onResume,
  onRestart,
  autoPlay,
  onToggleAuto,
}: Props) {
  // 0.1초마다 바뀌는 day는 여기서만 구독한다. App이 구독하면 진행 화면 전체가 틱마다 다시 그려진다.
  const day = useGameStore((s) => s.day)
  const pixelArt = usePixelArt((s) => s.shown)
  const setPixelArt = usePixelArt((s) => s.setShown)
  const age = game ? ageAt(game.startAge, day, game.daysPerYear) : null

  return (
    <header>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-5 pb-1 text-pen md:px-6">
        {/* 진행 중에는 제목·나이·연도·이름을 띄우지 않는다. 나이는 수첩 머리("3월, 27살")에 있다 (decisions.md 159번). 화면 읽기 프로그램에는 남긴다. */}
        <h1
          className={
            game && showControls ? 'sr-only' : 'font-pen text-[32px] font-normal leading-none'
          }
        >
          투자자 시뮬레이터
        </h1>
        {game && age && showControls && (
          <>
            <p className="sr-only" data-testid="age">
              {age.years}세 {age.months}개월
            </p>
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                className={`${buttonBase} ${buttonPaper}`}
                disabled={controlsDisabled}
                onClick={running ? onPause : onResume}
              >
                {running ? '❚❚ 멈춤' : '▶ 계속'}
              </button>
              <button
                type="button"
                className={`${buttonBase} ${autoPlay ? buttonInk : buttonPaper}`}
                aria-pressed={autoPlay}
                title="성향과 안목으로 선택을 대신하고 엔딩 크레딧까지 흐른다"
                onClick={onToggleAuto}
                data-testid="auto-button"
              >
                {autoPlay ? '⟳ 자동 켬' : '⟳ 자동'}
              </button>
              {/* 회사처럼 남의 눈이 있는 곳에서 게임처럼 보이지 않게 도트 그림을 끈다 (decisions.md 190번) */}
              <button
                type="button"
                className={`${buttonBase} ${pixelArt ? buttonPaper : buttonInk}`}
                aria-pressed={!pixelArt}
                title="캐릭터·장면 그림을 숨긴다. 글과 숫자는 그대로다"
                onClick={() => setPixelArt(!pixelArt)}
                data-testid="pixel-toggle"
              >
                {pixelArt ? '그림 끄기' : '그림 켜기'}
              </button>
              <button type="button" className={`${buttonBase} ${buttonPaper}`} onClick={onRestart}>
                다시 태어나기
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
