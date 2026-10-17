import { useEffect } from 'react'
import { BirthReveal } from './features/game/BirthReveal'
import { GameScreen } from './features/game/GameScreen'
import { ResultScreen } from './features/game/ResultScreen'
import { useGameStore } from './features/game/store'

export function App() {
  const status = useGameStore((s) => s.status)
  const game = useGameStore((s) => s.game)
  const { load, born, startLife } = useGameStore.getState()

  useEffect(() => {
    void load()
  }, [load])

  const restart = () => {
    void born()
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <h1 className="text-lg font-bold">📈 투자자 시뮬레이터</h1>
          {status === 'playing' && (
            <button
              type="button"
              className="min-h-11 rounded-xl px-4 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              onClick={restart}
            >
              다시 시작하기
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        {status === 'loading' && <p className="text-slate-500">불러오는 중…</p>}
        {status === 'error' && (
          <p role="alert" className="text-rose-600">
            서버에 연결할 수 없습니다.
          </p>
        )}
        {status === 'none' && (
          <section className="mx-auto flex max-w-xl flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold">새로운 인생</h2>
            <p className="text-slate-600">
              능력치와 초기 자산은 태어날 때 정해집니다.
              <br />
              선택은 당신이 하지만, 실행은 당신의 성격이 합니다.
            </p>
            <button
              type="button"
              className="min-h-12 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700"
              onClick={restart}
            >
              태어나기
            </button>
          </section>
        )}
        {status === 'revealing' && game && <BirthReveal game={game} onStart={startLife} />}
        {status === 'playing' && game && <GameScreen game={game} />}
        {status === 'ended' && game && <ResultScreen game={game} onRestart={restart} />}
      </main>
    </div>
  )
}
