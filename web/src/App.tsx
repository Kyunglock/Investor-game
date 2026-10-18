import { useEffect } from 'react'
import { BirthCertificate } from './features/game/BirthCertificate'
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
  const speed = useGameStore((s) => s.speed)
  const outcome = useGameStore((s) => s.outcome)
  const marketOpen = useGameStore((s) => s.marketOpen)
  const { load, born, startLife, pause, resume, setSpeed } = useGameStore.getState()

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
        speed={speed}
        showControls={status === 'playing'}
        controlsDisabled={Boolean(game?.pendingEvent) || outcome !== null || marketOpen}
        onPause={pause}
        onResume={resume}
        onSpeed={setSpeed}
        onRestart={restart}
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
        {status === 'revealing' && game && <BirthCertificate game={game} onStart={startLife} />}
        {status === 'playing' && game && <GameScreen game={game} />}
        {status === 'ended' && game && <LifeRecord game={game} onRestart={restart} />}
      </main>
    </div>
  )
}
