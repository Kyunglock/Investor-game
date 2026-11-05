import { useEffect } from 'react'
import { SharedPage, sharedIdFrom } from './features/game/SharedPage'
import { RunResult } from './features/raising/RunResult'
import { RunScreen } from './features/raising/RunScreen'
import { RunStart } from './features/raising/RunStart'
import { useRaisingStore } from './features/raising/store'

export function App() {
  // 공유 링크로 들어온 사람은 판 대신 공유 카드를 본다 (#197).
  const sharedId = sharedIdFrom(window.location.pathname)
  if (sharedId) {
    return <SharedPage shareId={sharedId} />
  }
  return <Raising />
}

/** 3분 육성 한 판 (증권사 육성 설계 3절). 나이와 시계가 없어 화면은 시작 → 카드 → 입사 심사 결과뿐이다. */
function Raising() {
  const status = useRaisingStore((s) => s.status)
  const run = useRaisingStore((s) => s.run)
  const busy = useRaisingStore((s) => s.busy)
  const { load, start } = useRaisingStore.getState()

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        {status === 'loading' && <p className="text-muted">불러오는 중…</p>}
        {status === 'error' && (
          <p role="alert" className="text-wine">
            서버에 연결할 수 없습니다.
          </p>
        )}
        {status === 'none' && <RunStart onStart={() => void start()} busy={busy} />}
        {status === 'playing' && run && <RunScreen run={run} />}
        {status === 'ended' && run && <RunResult run={run} onRestart={() => void start()} />}
      </main>
    </div>
  )
}
