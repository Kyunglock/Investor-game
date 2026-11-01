import { useEffect, useState } from 'react'
import { BirthCertificate } from './features/game/BirthCertificate'
import { EndingCredits } from './features/game/EndingCredits'
import { GameScreen } from './features/game/GameScreen'
import { LifeRecord } from './features/game/LifeRecord'
import { StartScreen } from './features/game/StartScreen'
import { useGameStore } from './features/game/store'
import { Toast } from './features/game/Toast'
import { TopBar } from './features/game/TopBar'

export function App() {
  const status = useGameStore((s) => s.status)
  const game = useGameStore((s) => s.game)
  const running = useGameStore((s) => s.running)
  const outcome = useGameStore((s) => s.outcome)
  const marketOpen = useGameStore((s) => s.marketOpen)
  const autoPlay = useGameStore((s) => s.autoPlay)
  const { load, born, startLifeAs, pause, resume, setAutoPlay } = useGameStore.getState()
  // 크레딧을 다 본(또는 건너뛴) 판. 끝난 판은 크레딧 뒤에 기록부가 나온다 (엔딩 설계 3절).
  const [creditsSeenFor, setCreditsSeenFor] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  const restart = () => {
    void born()
  }

  return (
    <div className="min-h-screen">
      <TopBar
        game={game}
        running={running}
        showControls={status === 'playing'}
        controlsDisabled={Boolean(game?.pendingEvent) || outcome !== null || marketOpen}
        // 사용자가 직접 멈추면 자동 진행도 끈다. 자동이 켜진 채로는 멈춤이 바로 되살아난다.
        onPause={() => {
          if (autoPlay) {
            setAutoPlay(false)
          }
          pause()
        }}
        onResume={resume}
        onRestart={restart}
        autoPlay={autoPlay}
        onToggleAuto={() => setAutoPlay(!autoPlay)}
      />

      {status === 'playing' && <Toast />}
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        {status === 'loading' && <p className="text-muted">불러오는 중…</p>}
        {status === 'error' && (
          <p role="alert" className="text-wine">
            서버에 연결할 수 없습니다.
          </p>
        )}
        {status === 'none' && <StartScreen onBorn={restart} />}
        {status === 'revealing' && game && <BirthCertificate game={game} onStart={startLifeAs} />}
        {status === 'playing' && game && <GameScreen game={game} />}
        {status === 'ended' &&
          game &&
          (creditsSeenFor === game.gameId ? (
            <LifeRecord game={game} onRestart={restart} />
          ) : (
            <EndingCredits game={game} onDone={() => setCreditsSeenFor(game.gameId)} />
          ))}
      </main>
    </div>
  )
}
