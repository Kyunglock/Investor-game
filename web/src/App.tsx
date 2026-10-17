import { useEffect } from 'react'
import { GameScreen } from './features/game/GameScreen'
import { useGameStore } from './features/game/store'

export function App() {
  const status = useGameStore((s) => s.status)
  const { load, born } = useGameStore.getState()

  useEffect(() => {
    void load()
  }, [load])

  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-lg font-bold">투자자 시뮬레이터</h1>
      {status === 'loading' && <p className="text-neutral-400">불러오는 중…</p>}
      {status === 'error' && (
        <p role="alert" className="text-red-400">
          서버에 연결할 수 없습니다.
        </p>
      )}
      {status === 'none' && (
        <section className="flex flex-col gap-4 rounded-xl bg-neutral-800 p-6 text-center">
          <p>능력치와 초기 자산은 태어날 때 정해집니다.</p>
          <button
            type="button"
            className="min-h-11 rounded-lg bg-blue-500 font-semibold"
            onClick={() => {
              void born()
            }}
          >
            태어나기
          </button>
        </section>
      )}
      {status === 'playing' && <GameScreen />}
    </main>
  )
}
