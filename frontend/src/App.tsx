import { useEffect } from 'react'
import { SharedPage, sharedIdFrom } from './features/game/SharedPage'
import { CompanyScreen } from './features/raising/CompanyScreen'
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

/**
 * 증권사 육성 (증권사 육성 설계). 육성 판이 진행 중이면 카드, 끝났는데 등록을 정하지 않았으면 입사 심사 결과, 회사가 있으면 회사, 아무것도 없으면 시작
 * 화면. 한 번에 하나의 모드만 보인다 (7.3절).
 */
function Raising() {
  const status = useRaisingStore((s) => s.status)
  const run = useRaisingStore((s) => s.run)
  const company = useRaisingStore((s) => s.company)
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const { load, start, hire } = useRaisingStore.getState()

  useEffect(() => {
    void load()
  }, [load])

  const screen = () => {
    if (run?.status === 'ACTIVE') {
      return <RunScreen run={run} />
    }
    if (run?.result && !run.result.decided) {
      return <RunResult run={run} company={company} busy={busy} error={error} onHire={hire} />
    }
    if (company) {
      // 직원이 들고 나거나 해가 바뀌면 배치 칸을 새로 그린다.
      const key = `${company.companyId}-${company.year}-${company.employees.map((e) => e.id).join('.')}`
      return <CompanyScreen key={key} company={company} />
    }
    return <RunStart onStart={() => void start()} busy={busy} />
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        {status === 'loading' && <p className="text-muted">불러오는 중…</p>}
        {status === 'error' && (
          <p role="alert" className="text-wine">
            서버에 연결할 수 없습니다.
          </p>
        )}
        {status === 'ready' && screen()}
      </main>
    </div>
  )
}
